"use client";

import { useEffect, useRef, type MouseEvent, type ReactNode, type RefObject } from "react";
import { CLASS_COLORS, CLASS_NAMES, type NormPoint } from "@/lib/vision/types";
import type { FrameResult } from "./useCounterEngine";
import s from "./counter.module.css";

const LINE = "#f5f3ee";
const ZONE = "#2dd4bf";
const IN = "#34d399";
const OUT = "#fb7185";

export type DrawMode = null | "line" | "zone";

interface Props {
  videoRef: RefObject<HTMLVideoElement | null>;
  hasSource: boolean;
  resultRef: RefObject<FrameResult | null>;
  zoneCount: number | null;
  line: NormPoint[] | null;
  zone: NormPoint[] | null;
  mode: DrawMode;
  draft: NormPoint[];
  onPoint: (p: NormPoint) => void;
  overlay?: ReactNode;
}

/**
 * Draws the live video plus line, zone, boxes and trails on a canvas every
 * screen refresh. Detection results update whenever a frame finishes, so
 * the video stays smooth even if detection runs slower than the camera.
 */
export function VideoStage({ videoRef, hasSource, resultRef, zoneCount, line, zone, mode, draft, onPoint, overlay }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef({ line, zone, mode, draft, zoneCount });
  useEffect(() => {
    propsRef.current = { line, zone, mode, draft, zoneCount };
  }, [line, zone, mode, draft, zoneCount]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;

    const label = (text: string, x: number, y: number, bg: string, W: number) => {
      const size = Math.max(12, Math.round(W / 72));
      ctx.font = `600 ${size}px Inter, system-ui, sans-serif`;
      const w = ctx.measureText(text).width + 10;
      const h = size + 8;
      y = Math.max(h, y);
      x = Math.min(Math.max(0, x), W - w);
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.roundRect(x, y - h, w, h, 4);
      ctx.fill();
      ctx.fillStyle = "#141006";
      ctx.fillText(text, x + 5, y - 6);
    };

    const arrow = (x1: number, y1: number, x2: number, y2: number, color: string, lw: number) => {
      const a = Math.atan2(y2 - y1, x2 - x1);
      const head = lw * 5;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - head * Math.cos(a - 0.5), y2 - head * Math.sin(a - 0.5));
      ctx.lineTo(x2 - head * Math.cos(a + 0.5), y2 - head * Math.sin(a + 0.5));
      ctx.closePath();
      ctx.fill();
    };

    const render = () => {
      raf = requestAnimationFrame(render);
      const video = videoRef.current;
      if (!video?.videoWidth) return;
      const { line, zone, mode, draft, zoneCount } = propsRef.current;
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        // CSS uses this to fit the whole video on screen (see .stage canvas)
        canvas.style.setProperty("--ar", String(video.videoWidth / video.videoHeight));
      }
      const W = canvas.width;
      const H = canvas.height;
      const lw = Math.max(2, W / 420);
      ctx.drawImage(video, 0, 0, W, H);

      // Zone
      const z = mode === "zone" ? draft : zone;
      if (z?.length) {
        ctx.beginPath();
        z.forEach(([x, y], i) => (i ? ctx.lineTo(x * W, y * H) : ctx.moveTo(x * W, y * H)));
        if (z.length > 2) ctx.closePath();
        if (z === zone) {
          ctx.fillStyle = "rgba(34, 211, 238, 0.14)";
          ctx.fill();
        }
        ctx.strokeStyle = ZONE;
        ctx.lineWidth = lw;
        ctx.setLineDash(z === zone ? [] : [lw * 3, lw * 2]);
        ctx.stroke();
        ctx.setLineDash([]);
        if (z === zone && zoneCount !== null) {
          const top = z.reduce((a, p) => (p[1] < a[1] ? p : a));
          // Same frame as the boxes (React state would lag a frame behind).
          const inside = resultRef.current?.inZone.size ?? zoneCount;
          label(`ZONE · ${inside} inside`, top[0] * W, top[1] * H - 6, ZONE, W);
        }
      }

      // Counting line with IN / OUT arrows (same direction rule as the tracker)
      const l = mode === "line" ? draft : line;
      if (l?.length) {
        ctx.strokeStyle = LINE;
        ctx.lineWidth = lw * 1.6;
        ctx.beginPath();
        ctx.moveTo(l[0][0] * W, l[0][1] * H);
        if (l[1]) ctx.lineTo(l[1][0] * W, l[1][1] * H);
        ctx.stroke();
        if (l[1]) {
          const ax = l[0][0] * W, ay = l[0][1] * H, bx = l[1][0] * W, by = l[1][1] * H;
          const mx = (ax + bx) / 2, my = (ay + by) / 2;
          const len = Math.hypot(bx - ax, by - ay) || 1;
          const nx = (by - ay) / len, ny = -(bx - ax) / len;
          const sz = W / 26;
          arrow(mx, my, mx + nx * sz, my + ny * sz, LINE, lw);
          arrow(mx, my, mx - nx * sz, my - ny * sz, LINE, lw);
          label("IN", mx + nx * sz * 1.5 - 12, my + ny * sz * 1.5 + 8, IN, W);
          label("OUT", mx - nx * sz * 1.5 - 18, my - ny * sz * 1.5 + 8, OUT, W);
        }
      }

      if (mode) {
        ctx.fillStyle = "#fb7185";
        for (const [x, y] of draft) {
          ctx.beginPath();
          ctx.arc(x * W, y * H, lw * 2.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Tracked objects (analysed at a smaller size, so scale up)
      const result = resultRef.current;
      if (result) {
        const k = W / result.width;
        for (const t of result.tracks) {
          const name = CLASS_NAMES[t.cls];
          const color = CLASS_COLORS[name] ?? "#ccc";
          const flash = result.flash.has(t.id);
          if (t.trail.length > 1) {
            ctx.strokeStyle = color;
            ctx.globalAlpha = 0.85;
            ctx.lineWidth = lw;
            ctx.beginPath();
            t.trail.forEach(([x, y], i) => (i ? ctx.lineTo(x * k, y * k) : ctx.moveTo(x * k, y * k)));
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
          const [x1, y1, x2, y2] = t.box.map((v) => v * k);
          ctx.strokeStyle = flash ? "#ffffff" : color;
          ctx.lineWidth = flash ? lw * 2.4 : lw;
          ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
          label(`#${t.id} ${name} ${Math.round(t.conf * 100)}%${result.inZone.has(t.id) ? " · zone" : ""}`,
            x1, y1 - 3, color, W);
          const [ax, ay] = t.anchor();
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(ax * k, ay * k, lw * 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [videoRef, resultRef]);

  const handleClick = (e: MouseEvent<HTMLCanvasElement>) => {
    if (!mode) return;
    const r = e.currentTarget.getBoundingClientRect();
    onPoint([(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]);
  };

  return (
    <div className={s.stage}>
      <canvas
        ref={canvasRef}
        width={1280}
        height={720}
        className={mode ? s.drawing : undefined}
        onClick={handleClick}
        style={{ visibility: hasSource ? "visible" : "hidden" }}
        aria-label="Live video with detections"
      />
      {overlay}
      {mode && (
        <div className={s.hint}>
          {mode === "line"
            ? "Click 2 points to draw the counting line"
            : `Click the zone's corners (${draft.length} so far), then Finish zone or press Enter`}
        </div>
      )}
    </div>
  );
}
