/**
 * YOLO11 object detector running fully in the browser.
 *
 *   OpenCV.js         letterbox (cv.resize + cv.copyMakeBorder), colour
 *                     conversion and cv.blobFromImage -> model input tensor
 *   ONNX Runtime Web  runs the model on the GPU (WebGPU) or CPU (WebAssembly)
 *   TypeScript        decodes the 8400 candidate boxes and removes duplicates (NMS)
 */
import type * as Ort from "onnxruntime-web";
import { loadOpenCV, loadOrt, type CV } from "./runtime";
import type { Backend, Box, Detection } from "./types";

const SIZE = 640;
const MODEL_URL = "/models/yolo11n.onnx";

export interface LoadProgress {
  stage: "opencv" | "runtime" | "model" | "warmup";
  /** 0-1 while downloading the model, otherwise undefined */
  fraction?: number;
}

async function fetchWithProgress(url: string, onProgress: (f: number) => void) {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Could not download the model (${res.status})`);
  const total = Number(res.headers.get("content-length")) || 0;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (total) onProgress(received / total);
  }
  const buf = new Uint8Array(received);
  let offset = 0;
  for (const c of chunks) {
    buf.set(c, offset);
    offset += c.length;
  }
  return buf;
}

/** Intersection over union of two boxes. */
export function iou(a: Box, b: Box) {
  const ix = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]));
  const iy = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  const inter = ix * iy;
  const union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter;
  return union > 0 ? inter / union : 0;
}

/** Non-maximum suppression, done separately per class. */
function nms(dets: Detection[], threshold: number) {
  dets.sort((a, b) => b.conf - a.conf);
  const kept: Detection[] = [];
  for (const d of dets) {
    if (kept.every((k) => k.cls !== d.cls || iou(k.box, d.box) < threshold)) kept.push(d);
  }
  return kept;
}

let shared: Promise<Detector> | null = null;
let progressListeners: ((p: LoadProgress) => void)[] = [];

/**
 * The one detector for the whole page. Creating two ONNX Runtime sessions at
 * the same time can hang the runtime (React runs effects twice in development),
 * so every caller shares the same instance, and it is kept across navigations.
 */
export function getDetector(onProgress?: (p: LoadProgress) => void): Promise<Detector> {
  if (onProgress) progressListeners.push(onProgress);
  if (!shared) {
    shared = Detector.create((p) => progressListeners.forEach((l) => l(p)));
    shared.then(
      () => (progressListeners = []),
      () => {
        shared = null; // allow a retry after a failure
        progressListeners = [];
      },
    );
  }
  return shared;
}

export function removeProgressListener(onProgress: (p: LoadProgress) => void) {
  progressListeners = progressListeners.filter((l) => l !== onProgress);
}

export class Detector {
  private constructor(
    private cv: CV,
    private ort: typeof Ort,
    private session: Ort.InferenceSession,
    readonly backend: Backend,
  ) {}

  static async create(onProgress: (p: LoadProgress) => void = () => {}): Promise<Detector> {
    onProgress({ stage: "opencv" });
    const cvP = loadOpenCV();
    onProgress({ stage: "runtime" });
    const ortP = loadOrt();
    const modelP = fetchWithProgress(MODEL_URL, (fraction) => onProgress({ stage: "model", fraction }));
    const [cv, ort, model] = await Promise.all([cvP, ortP, modelP]);

    onProgress({ stage: "warmup" });
    let session: Ort.InferenceSession | null = null;
    let backend: Backend = "wasm";
    if ("gpu" in navigator) {
      try {
        session = await ort.InferenceSession.create(model, { executionProviders: ["webgpu"] });
        backend = "webgpu";
      } catch {
        session = null; // no usable GPU adapter - fall back to the CPU
      }
    }
    session ??= await ort.InferenceSession.create(model, { executionProviders: ["wasm"] });

    const detector = new Detector(cv, ort, session, backend);
    // One dummy run so the first real frame isn't slow (shader / JIT warm-up).
    const warm = new ort.Tensor("float32", new Float32Array(3 * SIZE * SIZE), [1, 3, SIZE, SIZE]);
    await session.run({ [session.inputNames[0]]: warm });
    return detector;
  }

  /**
   * Detect objects in a frame drawn on a canvas.
   * Returns boxes in the canvas's pixel coordinates.
   */
  async detect(source: HTMLCanvasElement, classes: number[], conf = 0.35, nmsIou = 0.45): Promise<Detection[]> {
    const { cv, ort, session } = this;
    const w = source.width;
    const h = source.height;
    const scale = SIZE / Math.max(w, h);
    const nw = Math.round(w * scale);
    const nh = Math.round(h * scale);
    const px = Math.floor((SIZE - nw) / 2);
    const py = Math.floor((SIZE - nh) / 2);

    // --- OpenCV.js pre-processing ------------------------------------
    const rgba = cv.imread(source);
    const rgb = new cv.Mat();
    const resized = new cv.Mat();
    const boxed = new cv.Mat();
    let input: Float32Array;
    try {
      cv.cvtColor(rgba, rgb, cv.COLOR_RGBA2RGB);
      cv.resize(rgb, resized, new cv.Size(nw, nh), 0, 0, cv.INTER_LINEAR);
      // Pad to a 640x640 square with grey, keeping the aspect ratio ("letterbox").
      cv.copyMakeBorder(resized, boxed, py, SIZE - nh - py, px, SIZE - nw - px,
        cv.BORDER_CONSTANT, new cv.Scalar(114, 114, 114, 255));
      // HWC uint8 -> NCHW float32 scaled to 0-1
      const blob = cv.blobFromImage(boxed, 1 / 255, new cv.Size(SIZE, SIZE),
        new cv.Scalar(0, 0, 0, 0), false, false);
      input = blob.data32F.slice(); // copy out of the WebAssembly heap
      blob.delete();
    } finally {
      rgba.delete();
      rgb.delete();
      resized.delete();
      boxed.delete();
    }

    // --- Inference ----------------------------------------------------
    const tensor = new ort.Tensor("float32", input, [1, 3, SIZE, SIZE]);
    const outputs = await session.run({ [session.inputNames[0]]: tensor });
    const out = outputs[session.outputNames[0]];
    const data = out.data as Float32Array; // shape [1, 84, 8400]
    const n = out.dims[2];
    tensor.dispose?.();

    // --- Decode -------------------------------------------------------
    const dets: Detection[] = [];
    for (let i = 0; i < n; i++) {
      let best = -1;
      let bestScore = conf;
      for (const c of classes) {
        const s = data[(4 + c) * n + i];
        if (s > bestScore) {
          bestScore = s;
          best = c;
        }
      }
      if (best < 0) continue;
      const cx = data[i], cy = data[n + i], bw = data[2 * n + i], bh = data[3 * n + i];
      // Undo the letterbox so the box is in source-canvas pixels.
      const x1 = (cx - bw / 2 - px) / scale;
      const y1 = (cy - bh / 2 - py) / scale;
      const x2 = (cx + bw / 2 - px) / scale;
      const y2 = (cy + bh / 2 - py) / scale;
      dets.push({
        box: [Math.max(0, x1), Math.max(0, y1), Math.min(w - 1, x2), Math.min(h - 1, y2)],
        conf: bestScore,
        cls: best,
      });
    }
    out.dispose?.();
    return nms(dets, nmsIou);
  }

  /** Is (x, y) inside the polygon? Uses OpenCV's pointPolygonTest. */
  pointInPolygon(polygon: [number, number][], x: number, y: number) {
    const { cv } = this;
    const mat = cv.matFromArray(polygon.length, 1, cv.CV_32SC2, polygon.flat().map(Math.round));
    try {
      return cv.pointPolygonTest(mat, new cv.Point(x, y), false) >= 0;
    } finally {
      mat.delete();
    }
  }

  dispose() {
    void this.session.release();
  }
}
