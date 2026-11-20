"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import s from "./scroll.module.css";

/** [x1, y1, x2, y2, conf, class] with coordinates as 0-1 fractions of the frame. */
type Det = [number, number, number, number, number, string];
interface Manifest {
  count: number;
  width: number;
  height: number;
  detections: Det[][];
  /** Optional portrait set for phones in /scroll/m/: a centre slice [x0, x1] (0-1) of the frame. */
  mobile?: { width: number; height: number; crop: [number, number] };
}

const VEHICLES = new Set(["car", "truck", "bus", "motorcycle", "bicycle"]);
const COLORS: Record<string, string> = {
  car: "#f2b544", truck: "#2dd4bf", bus: "#a3e635", motorcycle: "#f472b6", bicycle: "#4cc9f0", person: "#ffc857",
};

/* Text chapters and the part of the scroll (0-1) where each is visible. */
const CHAPTERS = [
  { from: 0, to: 0.2, hero: true },
  { from: 0.26, to: 0.46, kicker: "01 · Detect", title: "Spots every vehicle the moment it enters the frame.", text: "YOLO11 runs on OpenCV, frame by frame, and tells cars, trucks, buses and bikes apart." },
  { from: 0.52, to: 0.72, kicker: "02 · Track & count", title: "Follows each one and counts it exactly once.", text: "Draw a line or a zone. Every crossing is logged with its direction and vehicle type." },
  { from: 0.78, to: 1.01, kicker: "03 · Decide", title: "Your whole site, on one live dashboard.", text: "Occupancy, peak hours and traffic trends, updating as it happens.", cta: true },
];

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export function ScrollStory() {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chapterRefs = useRef<(HTMLDivElement | null)[]>([]);
  const hudCountRef = useRef<HTMLSpanElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const dimRef = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [missing, setMissing] = useState(false);
  const [loaded, setLoaded] = useState(0);

  useEffect(() => {
    fetch("/scroll/manifest.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((m: Manifest | null) => (m?.count ? setManifest(m) : setMissing(true)))
      .catch(() => setMissing(true));
  }, []);

  useEffect(() => {
    if (!manifest) return;
    const section = sectionRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d", { alpha: false })!;
    const images: (HTMLImageElement | null)[] = new Array(manifest.count).fill(null);
    let raf = 0;
    let pending = false;
    let lastKey = "";
    let cancelled = false;

    // Phones and portrait screens get the portrait set (a 9:16 slice cut from
    // the 4K source): fewer bytes, and sharp instead of a cropped landscape frame.
    const portrait = window.innerWidth <= 820 && window.innerHeight > window.innerWidth;
    const m = portrait ? manifest.mobile : undefined;
    const dir = m ? "/scroll/m" : "/scroll";
    const fw = m?.width ?? manifest.width;
    const fh = m?.height ?? manifest.height;
    const [c0, c1] = m?.crop ?? [0, 1];

    // Draw only when something changed (scroll, resize, a frame arrived) -
    // never in an idle loop.
    const schedule = () => {
      if (pending || cancelled) return;
      pending = true;
      raf = requestAnimationFrame(() => {
        pending = false;
        render();
      });
    };

    // Coarse to fine: every 16th frame first, then 8th, 4th... so scrubbing
    // works almost at once, then fills in. 6 downloads at a time; each frame
    // is decoded off the main thread before it is used (no jank on first draw).
    const order: number[] = [];
    const seen = new Set<number>();
    for (const step of [16, 8, 4, 2, 1]) {
      for (let i = 0; i < manifest.count; i += step) if (!seen.has(i)) { seen.add(i); order.push(i); }
    }
    let done = 0;
    const loadOne = async (i: number) => {
      const img = new Image();
      img.src = `${dir}/frame_${String(i).padStart(3, "0")}.webp`;
      let ok = true;
      try {
        await img.decode();
      } catch {
        ok = false; // a missing frame: the nearest loaded one is shown instead
      }
      if (cancelled) return;
      if (ok) images[i] = img;
      done += 1;
      // update the badge in steps, not once per frame (150 React re-renders)
      if (done % 15 === 0 || done === manifest.count) setLoaded(done);
      lastKey = ""; // a closer frame may now be available
      schedule();
    };
    (async () => {
      let next = 0;
      const worker = async () => {
        while (!cancelled && next < order.length) await loadOne(order[next++]);
      };
      await Promise.all(Array.from({ length: 6 }, worker));
    })();

    const nearestLoaded = (i: number) => {
      for (let d = 0; d < manifest.count; d++) {
        if (images[i - d]) return i - d;
        if (images[i + d]) return i + d;
      }
      return -1;
    };

    const drawBox = (det: Det, rx: number, ry: number, rw: number, rh: number, alpha: number, dpr: number) => {
      const [fx1, y1, fx2, y2, conf, name] = det;
      // boxes are stored for the full frame; map them into the portrait slice
      const x1 = (fx1 - c0) / (c1 - c0);
      const x2 = (fx2 - c0) / (c1 - c0);
      if (x2 <= 0 || x1 >= 1) return; // outside the slice
      const color = COLORS[name] ?? "#fff";
      const X = rx + x1 * rw, Y = ry + y1 * rh, W = (x2 - x1) * rw, H = (y2 - y1) * rh;
      const c = Math.min(W, H) * 0.22;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2 * dpr;
      ctx.strokeRect(X, Y, W, H);
      // bold corner brackets
      ctx.lineWidth = 4 * dpr;
      ctx.beginPath();
      for (const [cx, cy, sx, sy] of [[X, Y, 1, 1], [X + W, Y, -1, 1], [X, Y + H, 1, -1], [X + W, Y + H, -1, -1]]) {
        ctx.moveTo(cx, cy + sy * c);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx + sx * c, cy);
      }
      ctx.stroke();
      const label = `${name} ${Math.round(conf * 100)}%`;
      ctx.font = `600 ${12 * dpr}px Inter, system-ui, sans-serif`;
      const tw = ctx.measureText(label).width + 12 * dpr;
      const th = 20 * dpr;
      // Label above the box's right edge, away from the text column on the left.
      const lx = Math.max(X, X + W - tw);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(lx, Math.max(0, Y - th - 4 * dpr), tw, th, 4 * dpr);
      ctx.fill();
      ctx.fillStyle = "#141006";
      ctx.fillText(label, lx + 6 * dpr, Math.max(th, Y - 4 * dpr) - 6 * dpr);
      ctx.globalAlpha = 1;
    };

    const render = () => {
      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight;
      // p: progress through the intro chapters. pageP: progress through the whole
      // page - the video plays across the entire page as the background.
      const p = clamp(-rect.top / (rect.height - vh));
      const pageP = clamp(window.scrollY / Math.max(1, document.documentElement.scrollHeight - vh));
      // Dim the video once the intro has scrolled away, so the sections stay readable.
      const dim = smooth(0, 1, 1 - rect.bottom / vh);
      if (dimRef.current) dimRef.current.style.opacity = String(dim);
      // The live-camera overlay belongs to the intro; fade it out with the boxes.
      if (hudRef.current) hudRef.current.style.opacity = String(1 - dim);
      // Canvas resolution: never more pixels than the frames actually have
      // (a 1080p frame on a 2x screen gains nothing from a 4K canvas, it only
      // costs fill time on every scroll step).
      const vw = window.innerWidth;
      const fa0 = fw / fh;
      const coverCssW = fa0 > vw / vh ? vh * fa0 : vw; // width the frame is drawn at, in CSS px
      const dpr = Math.min(window.devicePixelRatio || 1, Math.max(1, fw / coverCssW));
      const cw = Math.round(vw * dpr);
      const ch = Math.round(vh * dpr);

      // Text chapters + progress bar (no React re-render needed)
      CHAPTERS.forEach((c, i) => {
        const el = chapterRefs.current[i];
        if (!el) return;
        const o = c.from === 0 ? 1 - smooth(c.to - 0.06, c.to, p) : smooth(c.from, c.from + 0.06, p) * (1 - smooth(c.to - 0.06, c.to, p));
        el.style.opacity = String(o);
        el.style.transform = `translateY(${(1 - o) * 24}px)`;
        el.style.pointerEvents = o > 0.5 ? "auto" : "none";
      });
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${pageP})`;

      const want = Math.round(pageP * (manifest.count - 1));
      const idx = nearestLoaded(want);
      const key = `${idx}|${cw}x${ch}|${p.toFixed(3)}|${dim.toFixed(2)}`;
      if (idx < 0 || key === lastKey) return;
      lastKey = key;
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }

      const img = images[idx]!;
      const fa = fw / fh;
      const va = cw / ch;
      // Cover the screen. Only a video much narrower than the screen (a portrait
      // clip on a wide monitor) is shown whole over a blurred, enlarged copy;
      // a landscape clip on a phone simply fills the screen.
      const cover = (a: number) => (a > va ? { w: ch * a, h: ch } : { w: cw, h: cw / a });
      let rw: number, rh: number;
      if (fa < va && Math.log(va / fa) > 0.45) {
        const bg = cover(fa);
        ctx.filter = `blur(${28 * dpr}px) brightness(0.55)`;
        ctx.drawImage(img, (cw - bg.w) / 2, (ch - bg.h) / 2, bg.w, bg.h);
        ctx.filter = "none";
        rh = ch;
        rw = ch * fa;
        if (rw > cw) {
          rw = cw;
          rh = cw / fa;
        }
      } else {
        const c = cover(fa);
        rw = c.w;
        rh = c.h;
      }
      const rx = (cw - rw) / 2;
      const ry = (ch - rh) / 2;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, rx, ry, rw, rh);

      // Detection boxes fade in after the opening chapter, and out again once the
      // content sections scroll over the video (they would compete with the cards).
      const dets = manifest.detections[idx] ?? [];
      const alpha = smooth(0.17, 0.27, p) * (1 - dim);
      if (alpha > 0.01) for (const d of dets) drawBox(d, rx, ry, rw, rh, alpha, dpr);
      if (hudCountRef.current) hudCountRef.current.textContent = String(dets.filter((d) => VEHICLES.has(d[5])).length);
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    schedule();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [manifest]);

  // Frames were removed or never generated: hide the section entirely.
  if (missing) return null;

  return (
    <>
    {/* The video: fixed behind the whole page */}
    <div className={s.backdrop} aria-hidden>
      <canvas ref={canvasRef} className={s.canvas} />
      <div className={s.shade} />
      <div ref={dimRef} className={s.dim} />
      <div ref={hudRef} className={s.hud}>
        <span className={s.live}><i />LIVE</span>
        <span className={s.hudPlace}>Camera 03 · Level −1</span>
        <span className={s.hudCount}>Vehicles in view <b ref={hudCountRef}>0</b></span>
      </div>
      {(!manifest || loaded < manifest.count) && (
        <div className={s.loading}>
          Loading frames {manifest ? Math.round((loaded / manifest.count) * 100) : 0}%
        </div>
      )}
      <div className={s.progress}><div ref={progressRef} /></div>
    </div>

    {/* The intro chapters, which scroll over the video */}
    <section ref={sectionRef} className={s.story} aria-label="Parking Counter in action">
      <div className={s.sticky}>
        {CHAPTERS.map((c, i) => (
          <div
            key={i}
            ref={(el) => { chapterRefs.current[i] = el; }}
            className={c.hero ? s.heroChapter : s.chapter}
            style={{ opacity: i === 0 ? 1 : 0 }}
          >
            {c.hero ? (
              <>
                <span className={s.eyebrow}><i />Computer vision that runs in your browser</span>
                <h1>Every vehicle,<br /><span className={s.gradient}>counted live.</span></h1>
                <p>Turn any camera into a traffic and parking counter. Scroll to see it work.</p>
                <div className={s.ctas}>
                  <Link href="/app" className="btn btn-primary btn-lg">Launch live counter</Link>
                </div>
                <span className={s.scrollHint} aria-hidden>Scroll</span>
              </>
            ) : (
              <>
                <span className={s.kicker}>{c.kicker}</span>
                <h2>{c.title}</h2>
                <p>{c.text}</p>
                {c.cta && <Link href="/app" className="btn btn-primary btn-lg">Try it with your camera</Link>}
              </>
            )}
          </div>
        ))}
      </div>
    </section>
    </>
  );
}
