/**
 * Loads the two browser runtimes from /public/vendor (copied there by
 * scripts/copy-vendor.mjs). They are loaded on demand, only on the client,
 * so the landing page stays light.
 */
import type * as Ort from "onnxruntime-web";

/* OpenCV.js has no official TypeScript types for its Emscripten build;
   we describe only the small part we use. */
/* eslint-disable @typescript-eslint/no-explicit-any */
export type CV = any;

let cvPromise: Promise<CV> | null = null;
let ortPromise: Promise<typeof Ort> | null = null;

export function loadOpenCV(): Promise<CV> {
  if (cvPromise) return cvPromise;
  cvPromise = new Promise<CV>((resolve, reject) => {
    const w = window as any;
    const finish = (cv: CV) => (cv instanceof Promise ? cv.then(resolve, reject) : resolve(cv));
    if (w.cv?.Mat) return resolve(w.cv);

    const script = document.createElement("script");
    script.src = "/vendor/opencv/opencv.js";
    script.async = true;
    script.onerror = () => {
      cvPromise = null;
      reject(new Error("Could not download OpenCV.js"));
    };
    script.onload = () => {
      const cv = w.cv;
      if (!cv) return reject(new Error("OpenCV.js loaded but did not initialise"));
      if (cv instanceof Promise) return finish(cv);
      if (cv.Mat) return resolve(cv);
      cv.onRuntimeInitialized = () => resolve(cv);
    };
    document.head.appendChild(script);
  });
  return cvPromise;
}

export function loadOrt(): Promise<typeof Ort> {
  if (ortPromise) return ortPromise;
  const url = "/vendor/ort/ort.webgpu.min.mjs";
  ortPromise = import(/* webpackIgnore: true */ /* turbopackIgnore: true */ url).then((mod) => {
    const ort = (mod.default ?? mod) as typeof Ort;
    ort.env.wasm.wasmPaths = "/vendor/ort/";
    // Multi-threaded WebAssembly needs cross-origin isolation (see next.config.ts).
    ort.env.wasm.numThreads = self.crossOriginIsolated
      ? Math.min(4, navigator.hardwareConcurrency || 2)
      : 1;
    return ort;
  });
  ortPromise.catch(() => (ortPromise = null));
  return ortPromise;
}
