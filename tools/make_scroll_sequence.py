"""
Turn a video into a scroll-driven image sequence for the landing page,
with YOLO11 detections pre-computed for every frame (OpenCV DNN).

    pip install opencv-python numpy
    python tools/make_scroll_sequence.py path/to/video.mp4

Writes:
    public/scroll/frame_000.webp ... frame_NNN.webp
    public/scroll/manifest.json   (frame size + detections per frame)

Use only footage you own or have a licence for - it will be published.
"""

import argparse
import json
import shutil
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
MODEL = ROOT / "public" / "models" / "yolo11n.onnx"
OUT = ROOT / "public" / "scroll"

CLASS_NAMES = {0: "person", 1: "bicycle", 2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}
SIZE = 640


def detect(net, frame, conf_thr=0.35, nms_thr=0.45):
    """YOLO11 on cv2.dnn. Returns [(x1, y1, x2, y2, conf, cls)] in frame pixels."""
    h, w = frame.shape[:2]
    scale = SIZE / max(h, w)
    nw, nh = round(w * scale), round(h * scale)
    px, py = (SIZE - nw) // 2, (SIZE - nh) // 2
    canvas = np.full((SIZE, SIZE, 3), 114, np.uint8)
    canvas[py:py + nh, px:px + nw] = cv2.resize(frame, (nw, nh))
    net.setInput(cv2.dnn.blobFromImage(canvas, 1 / 255.0, (SIZE, SIZE), swapRB=True))
    out = net.forward()[0].T                       # (8400, 84)

    scores = out[:, 4:]
    cls = scores.argmax(1)
    conf = scores[np.arange(len(scores)), cls]
    keep = (conf >= conf_thr) & np.isin(cls, list(CLASS_NAMES))
    if not keep.any():
        return []
    cx, cy, bw, bh = out[keep, :4].T
    boxes = np.stack([(cx - bw / 2 - px) / scale, (cy - bh / 2 - py) / scale, bw / scale, bh / scale], 1)
    conf, cls = conf[keep], cls[keep]
    idx = np.array(cv2.dnn.NMSBoxesBatched(boxes.tolist(), conf.tolist(), cls.tolist(),
                                           conf_thr, nms_thr)).flatten().astype(int)
    result = []
    for i in idx:
        x, y, bw_, bh_ = (float(v) for v in boxes[i])  # plain floats (JSON can't store float32)
        result.append((max(0.0, x), max(0.0, y), min(w - 1.0, x + bw_), min(h - 1.0, y + bh_),
                       float(conf[i]), int(cls[i])))
    return result


def enhance(frame, gamma=0.8):
    """Make dark footage clearer with OpenCV:
    CLAHE (local contrast) on the lightness channel, a gamma lift for the
    shadows, and a gentle unsharp mask for crisp edges."""
    lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    l = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(l)
    frame = cv2.cvtColor(cv2.merge([l, a, b]), cv2.COLOR_LAB2BGR)
    lut = np.array([((i / 255.0) ** gamma) * 255 for i in range(256)], np.uint8)
    frame = cv2.LUT(frame, lut)
    blur = cv2.GaussianBlur(frame, (0, 0), 1.2)
    return cv2.addWeighted(frame, 1.35, blur, -0.35, 0)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("video")
    ap.add_argument("--frames", type=int, default=120, help="number of frames to keep (default 120)")
    ap.add_argument("--max-side", type=int, default=1280, help="longest side in pixels (default 1280)")
    ap.add_argument("--quality", type=int, default=72, help="WebP quality 1-100 (default 72)")
    ap.add_argument("--conf", type=float, default=0.35, help="detection confidence (default 0.35)")
    ap.add_argument("--last", type=float, help="use only the last N seconds of the video")
    ap.add_argument("--start", type=float, default=0.0, help="start time in seconds (default 0)")
    ap.add_argument("--end", type=float, help="end time in seconds (default: end of video)")
    ap.add_argument("--enhance", action="store_true",
                    help="brighten and sharpen dark footage (CLAHE + gamma + unsharp mask)")
    args = ap.parse_args()

    cap = cv2.VideoCapture(args.video)
    if not cap.isOpened():
        raise SystemExit(f"Could not open {args.video}")
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    if total <= 0:
        raise SystemExit("Could not read the frame count of this video.")
    first, last = int(args.start * fps), total - 1
    if args.end is not None:
        last = min(last, int(args.end * fps))
    if args.last is not None:
        first = max(0, total - int(args.last * fps))
    if first >= last:
        raise SystemExit("The chosen time range is empty.")
    print(f"Using {first / fps:.1f}s - {last / fps:.1f}s of a {total / fps:.1f}s video")
    wanted = np.linspace(first, last, min(args.frames, last - first + 1)).round().astype(int)

    net = cv2.dnn.readNetFromONNX(str(MODEL))
    shutil.rmtree(OUT, ignore_errors=True)
    OUT.mkdir(parents=True)

    frames_meta, size, total_bytes = [], None, 0
    wanted_set, pos, n = set(wanted.tolist()), int(wanted[0]), 0
    cap.set(cv2.CAP_PROP_POS_FRAMES, pos)  # jump straight to the start of the range
    ok, frame = cap.read()
    while ok and n < len(wanted):
        if pos in wanted_set:
            h, w = frame.shape[:2]
            s = min(1.0, args.max_side / max(h, w))
            if s < 1.0:
                frame = cv2.resize(frame, (round(w * s), round(h * s)), interpolation=cv2.INTER_AREA)
            h, w = frame.shape[:2]
            size = (w, h)
            if args.enhance:
                frame = enhance(frame)
            dets = detect(net, frame, args.conf)
            path = OUT / f"frame_{n:03d}.webp"
            cv2.imwrite(str(path), frame, [cv2.IMWRITE_WEBP_QUALITY, args.quality])
            total_bytes += path.stat().st_size
            frames_meta.append([
                [round(x1 / w, 4), round(y1 / h, 4), round(x2 / w, 4), round(y2 / h, 4),
                 round(c, 2), CLASS_NAMES[k]]
                for x1, y1, x2, y2, c, k in dets
            ])
            n += 1
            print(f"\rframe {n}/{len(wanted)}  objects {len(dets):2d}", end="")
        ok, frame = cap.read()
        pos += 1
    cap.release()

    manifest = {"count": n, "width": size[0], "height": size[1], "detections": frames_meta}
    (OUT / "manifest.json").write_text(json.dumps(manifest, separators=(",", ":")))
    print(f"\nWrote {n} frames ({size[0]}x{size[1]}, {total_bytes / 1e6:.1f} MB) + manifest.json to {OUT}")


if __name__ == "__main__":
    main()
