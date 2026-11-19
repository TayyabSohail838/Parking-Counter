"use client";

import Link from "next/link";
import { LogoMark } from "@/components/brand/LogoMark";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { preload } from "react-dom";
import type { SessionConfig } from "@/lib/vision/tracker";
import type { Anchor, ClassGroup, NormPoint } from "@/lib/vision/types";
import { EventLog, KpiRow, Timeline, VehicleMix } from "./Dashboard";
import { useCounterEngine } from "./useCounterEngine";
import { VideoStage, type DrawMode } from "./VideoStage";
import s from "./counter.module.css";

const LOAD_TEXT = {
  opencv: "Loading OpenCV.js…",
  runtime: "Loading ONNX Runtime…",
  model: "Downloading YOLO11 model",
  warmup: "Warming up the detector…",
} as const;

function cameraError(e: unknown) {
  const name = e instanceof DOMException ? e.name : "";
  if (name === "NotAllowedError") return "Camera permission was denied. Allow camera access in the address bar and try again.";
  if (name === "NotFoundError") return "No camera was found on this device.";
  if (name === "NotReadableError") return "The camera is being used by another app. Close it and try again.";
  return `Could not open the camera: ${e instanceof Error ? e.message : String(e)}`;
}

export function CounterApp() {
  preload("/dashboard/bg.webp", {
    as: "image",
    fetchPriority: "high",
    imageSrcSet: "/dashboard/bg-sm.webp 960w, /dashboard/bg.webp 1920w",
    imageSizes: "(max-width: 720px) 320px, 1921px",
  });
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [hasSource, setHasSource] = useState(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState("");
  const [classes, setClasses] = useState<ClassGroup>("vehicles");
  const [anchor, setAnchor] = useState<Anchor>("center");
  const [line, setLine] = useState<NormPoint[] | null>(null);
  const [zone, setZone] = useState<NormPoint[] | null>(null);
  const [mode, setMode] = useState<DrawMode>(null);
  const [draft, setDraft] = useState<NormPoint[]>([]);

  const config: SessionConfig = useMemo(() => ({ classes, anchor, line, zone }), [classes, anchor, line, zone]);
  const engine = useCounterEngine(videoRef, config);
  const { start, stop, setError } = engine;

  // ---------- video sources ----------
  const releaseSource = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);
    fileUrlRef.current = null;
    const v = videoRef.current;
    if (v) {
      v.pause();
      v.srcObject = null;
      v.removeAttribute("src");
      v.load();
    }
  }, []);

  const stopAll = useCallback(() => {
    stop();
    releaseSource();
    setHasSource(false);
  }, [stop, releaseSource]);

  const startCamera = useCallback(async (deviceId?: string) => {
    stop();
    releaseSource();
    const v = videoRef.current!;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera access needs a secure page (https:// or http://localhost).");
      return;
    }
    try {
      const size = { width: { ideal: 1280 }, height: { ideal: 720 } };
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: deviceId ? { ...size, deviceId: { exact: deviceId } } : { ...size, facingMode: "environment" },
      });
      streamRef.current = stream;
      v.srcObject = stream;
      v.loop = false;
      await v.play();
      const devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
      setCameras(devices);
      setCameraId(stream.getVideoTracks()[0].getSettings().deviceId ?? "");
      setHasSource(true);
      setError(null);
      start("camera");
    } catch (e) {
      setHasSource(false);
      setError(cameraError(e));
    }
  }, [releaseSource, setError, start, stop]);

  const startFile = useCallback(async (file: File) => {
    stop();
    releaseSource();
    const v = videoRef.current!;
    const url = URL.createObjectURL(file);
    fileUrlRef.current = url;
    v.src = url;
    v.loop = true;
    try {
      await v.play();
      setHasSource(true);
      setError(null);
      start("file");
    } catch (e) {
      setError(`Could not play that video: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [releaseSource, setError, start, stop]);

  useEffect(() => () => releaseSource(), [releaseSource]);

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void startFile(file);
    e.target.value = "";
  };

  // ---------- drawing ----------
  const chooseMode = (m: DrawMode) => {
    setDraft([]);
    setMode((cur) => (cur === m ? null : m));
  };

  const finishZone = useCallback(() => {
    if (draft.length < 3) return;
    setZone(draft);
    setDraft([]);
    setMode(null);
  }, [draft]);

  const addPoint = (p: NormPoint) => {
    const prev = draft[draft.length - 1];
    if (prev && Math.hypot(prev[0] - p[0], prev[1] - p[1]) < 0.01) return; // double-click
    const next = [...draft, p];
    if (mode === "line" && next.length === 2) {
      setLine(next);
      setDraft([]);
      setMode(null);
    } else {
      setDraft(next);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && mode === "zone") finishZone();
      if (e.key === "Escape" && mode) {
        setMode(null);
        setDraft([]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, finishZone]);

  // ---------- status ----------
  const { status, progress, backend, stats, counts } = engine;
  const statusLabel =
    status === "running" ? `Live · ${stats.fps || "–"} FPS`
    : status === "ready" ? "Ready"
    : status === "error" ? "Error"
    : "Loading";

  const overlay = !hasSource ? (
    <div className={s.placeholder}>
      <div className={s.placeholderIcon} aria-hidden>
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 10l5-3v10l-5-3zM3 7h12v10H3z" />
        </svg>
      </div>
      <strong>Start your camera or open a video</strong>
      <span>
        {status === "loading"
          ? `${LOAD_TEXT[progress.stage]}${progress.fraction !== undefined ? ` ${Math.round(progress.fraction * 100)}%` : ""}`
          : status === "error" ? "The detector could not start. See the message on the right."
          : "The detector is ready. Video stays on this device."}
      </span>
      {status === "loading" && (
        <div className={s.progress}>
          <div style={{ width: `${progress.stage === "model" ? Math.round((progress.fraction ?? 0) * 100) : progress.stage === "warmup" ? 100 : 8}%` }} />
        </div>
      )}
    </div>
  ) : status === "loading" ? (
    <div className={s.loadingBadge}>
      {LOAD_TEXT[progress.stage]}
      {progress.fraction !== undefined && ` ${Math.round(progress.fraction * 100)}%`}
    </div>
  ) : null;

  return (
    <div className={s.app}>
      {/* Hidden video element: frames are drawn onto the canvas instead. */}
      <video ref={videoRef} muted playsInline hidden />

      <div className={s.bg} aria-hidden />

      <header className={s.topbar}>
        <div className={s.topInner}>
          <Link href="/" className={s.brand} aria-label="Parking Counter home">
            <LogoMark size={32} />
            <span>Parking Counter</span>
          </Link>
          <nav className={s.navLinks} aria-label="Main">
            <Link href="/">Home</Link>
            <Link href="/app" aria-current="page">Live counter</Link>
          </nav>
          <Link href="/dashboard" className="btn btn-primary btn-sm">Dashboard</Link>
        </div>
      </header>

      <div className={s.head}>
        <div>
          <span className={s.kicker}>Live counter</span>
          <h1>Count what crosses the line</h1>
          <p className={s.lead}>Start a camera or open a video, draw a line across the entrance, and every crossing is counted. Video stays on this device.</p>
        </div>
        <div className={s.statusGroup}>
          {backend && <span className={s.backendPill}>{backend === "webgpu" ? "GPU · WebGPU" : "CPU · WebAssembly"}</span>}
          <span className={`${s.statusPill} ${status === "running" ? s.live : status === "error" ? s.err : ""}`}>
            <i />
            {statusLabel}
          </span>
        </div>
      </div>

      <main className={s.main}>
        <section className={s.left}>
          <VideoStage
            videoRef={videoRef}
            hasSource={hasSource}
            resultRef={engine.resultRef}
            zoneCount={counts?.hasZone ? counts.total.zone : null}
            line={line}
            zone={zone}
            mode={mode}
            draft={draft}
            onPoint={addPoint}
            overlay={overlay}
          />
          <KpiRow counts={counts} timeline={engine.timeline} />
          <Timeline timeline={engine.timeline} />
        </section>

        <aside className={s.right}>
          {engine.error && (
            <div className={s.error} role="alert">
              {engine.error}
              <button onClick={() => setError(null)} aria-label="Dismiss">×</button>
            </div>
          )}

          <div className={s.card}>
            <div className={s.cardHead}><h2>Source</h2></div>
            <div className={s.row}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => void startCamera()}>Start camera</button>
              <button className="btn" style={{ flex: 1 }} onClick={() => fileInputRef.current?.click()}>Video file…</button>
              <input ref={fileInputRef} type="file" accept="video/*" hidden onChange={onFileChange} />
            </div>
            <div className={s.row}>
              <label className={s.field}>
                Camera
                <select value={cameraId} disabled={cameras.length < 2} onChange={(e) => void startCamera(e.target.value)}>
                  {cameras.length === 0 && <option value="">—</option>}
                  {cameras.map((c, i) => (
                    <option key={c.deviceId} value={c.deviceId}>{c.label || `Camera ${i + 1}`}</option>
                  ))}
                </select>
              </label>
              <button className="btn" style={{ alignSelf: "flex-end" }} disabled={!hasSource} onClick={stopAll}>Stop</button>
            </div>
          </div>

          <div className={s.card}>
            <div className={s.cardHead}><h2>Counting</h2></div>
            <div className={s.row}>
              <label className={s.field}>
                Count
                <select value={classes} onChange={(e) => setClasses(e.target.value as ClassGroup)}>
                  <option value="vehicles">Vehicles</option>
                  <option value="people">People</option>
                  <option value="all">Vehicles + people</option>
                </select>
              </label>
              <label className={s.field}>
                Count point
                <select value={anchor} onChange={(e) => setAnchor(e.target.value as Anchor)}>
                  <option value="center">Box centre</option>
                  <option value="bottom">Box bottom (street cams)</option>
                </select>
              </label>
            </div>
            <div className={s.row}>
              <button className={`btn ${mode === "line" ? s.activeBtn : ""}`} style={{ flex: 1 }} onClick={() => chooseMode("line")}>
                {line ? "Redraw line" : "Draw line"}
              </button>
              <button className={`btn ${mode === "zone" ? s.activeBtn : ""}`} style={{ flex: 1 }} onClick={() => chooseMode("zone")}>
                {zone ? "Redraw zone" : "Draw zone"}
              </button>
            </div>
            <div className={s.row}>
              <button className="btn" style={{ flex: 1 }} disabled={mode !== "zone" || draft.length < 3} onClick={finishZone}>
                Finish zone
              </button>
              <button className="btn" style={{ flex: 1 }} disabled={!line && !zone}
                onClick={() => { setLine(null); setZone(null); setMode(null); setDraft([]); }}>
                Clear both
              </button>
            </div>
            <button className="btn" style={{ width: "100%", marginTop: 8 }} onClick={engine.reset}>Reset counts</button>
            <p className={s.note}>Changing what to count, the line or the zone restarts the counts.</p>
          </div>

          <VehicleMix counts={counts} />
          <EventLog events={engine.events} />
        </aside>
      </main>
    </div>
  );
}
