"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { endSession, recordEvents, startSession } from "@/lib/history";
import { getDetector, removeProgressListener, type Detector, type LoadProgress, type ModelSize } from "@/lib/vision/detector";
import { CountingSession, LOW_CONF, type SessionConfig, type Track } from "@/lib/vision/tracker";
import { CLASS_NAMES, type Backend, type Counts } from "@/lib/vision/types";

const ANALYSE_WIDTH = 640; // frames are shrunk to this width before detection
const BUCKET_MS = 10_000; // timeline resolution
const MAX_BUCKETS = 30; // 5 minutes of timeline
const MAX_EVENTS = 40;

export type EngineStatus = "loading" | "ready" | "running" | "error";

export interface CountEvent {
  key: string;
  time: string;
  id: number;
  name: string;
  dir: "in" | "out";
}

export interface Bucket {
  start: number;
  in: number;
  out: number;
}

/** What the canvas needs to draw the latest analysed frame. */
export interface FrameResult {
  width: number;
  height: number;
  tracks: Track[];
  flash: Set<number>;
  inZone: Set<number>;
  /** Full-resolution copy of the exact frame these boxes came from. The stage
   *  shows this instead of the live video, so boxes always sit on the
   *  vehicles (live video runs ~100 ms ahead of the detections). */
  frame: HTMLCanvasElement | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function useCounterEngine(videoRef: RefObject<HTMLVideoElement | null>, config: SessionConfig, model: ModelSize = "fast") {
  const [rawStatus, setStatus] = useState<EngineStatus>("loading");
  // Which model the current detector is - while it differs from `model`, a new
  // one is loading (derived, so no state is set synchronously in an effect).
  const [loadedModel, setLoadedModel] = useState<ModelSize | null>(null);
  const status: EngineStatus = rawStatus !== "error" && loadedModel !== model ? "loading" : rawStatus;
  const [progress, setProgress] = useState<LoadProgress>({ stage: "opencv" });
  const [error, setError] = useState<string | null>(null);
  const [backend, setBackend] = useState<Backend | null>(null);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [stats, setStats] = useState({ fps: 0, ms: 0 });
  const [events, setEvents] = useState<CountEvent[]>([]);
  const [timeline, setTimeline] = useState<Bucket[]>([]);

  const detectorRef = useRef<Detector | null>(null);
  const sessionRef = useRef<CountingSession | null>(null);
  const resultRef = useRef<FrameResult | null>(null);
  const runningRef = useRef(false);
  const historyRef = useRef<string | null>(null); // current history session id
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameBufs = useRef<(HTMLCanvasElement | undefined)[]>([]);
  const frameFlip = useRef(0);

  // Load OpenCV.js, ONNX Runtime and the model as soon as the page opens, and
  // again when the user picks another model. Detectors are page-wide
  // singletons (one per model), so they are never disposed here. While a new
  // model loads the counting loop just waits; it resumes on the new model.
  useEffect(() => {
    let cancelled = false;
    const onProgress = (p: LoadProgress) => !cancelled && setProgress(p);
    detectorRef.current = null;
    getDetector(onProgress, model)
      .then((d) => {
        if (cancelled) return;
        detectorRef.current = d;
        setBackend(d.backend);
        setLoadedModel(model);
        setStatus((s) => (s === "loading" ? (runningRef.current ? "running" : "ready") : s));
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setStatus("error");
        setError(`Could not start the detector: ${e instanceof Error ? e.message : String(e)}`);
      });
    return () => {
      cancelled = true;
      removeProgressListener(onProgress);
    };
  }, [model]);

  // Stop the counting loop when the page goes away.
  useEffect(() => () => {
    runningRef.current = false;
  }, []);

  const resetStats = useCallback(() => {
    setEvents([]);
    setTimeline([]);
    resultRef.current = null;
  }, []);

  // A new counting session whenever what/how we count changes.
  useEffect(() => {
    const contains = (poly: [number, number][], x: number, y: number) =>
      detectorRef.current ? detectorRef.current.pointInPolygon(poly, x, y) : false;
    sessionRef.current = new CountingSession(config, contains);
    setCounts(sessionRef.current.counts());
    resetStats();
  }, [config, resetStats]);

  // Each start gets a new run id. A loop only keeps going - and only writes
  // results - while its id is current, so a stop / new video can never leave
  // two loops running on one model, or let an old loop that was mid-detection
  // paint its stale frame after the switch (which froze the picture).
  const runIdRef = useRef(0);

  const loop = useCallback(async (runId: number) => {
    let fps = 0;
    const current = () => runningRef.current && runIdRef.current === runId;
    while (current()) {
      const video = videoRef.current;
      const detector = detectorRef.current;
      const session = sessionRef.current;
      const ready = video && video.readyState >= 2 && video.videoWidth > 0 && !video.paused;
      if (!detector || !session || !ready) {
        await sleep(100);
        continue;
      }

      const t0 = performance.now();
      // Grab the video ONCE, at full size, for display (see FrameResult.frame),
      // then make the small analysis copy from that grab - not from the video
      // again: the video can advance between two drawImage calls (measured),
      // which left boxes trailing moving vehicles. Two display canvases
      // alternate so the one on screen is never overwritten mid-display.
      const frame = (frameBufs.current[frameFlip.current ^= 1] ??= document.createElement("canvas"));
      frame.width = video.videoWidth;
      frame.height = video.videoHeight;
      frame.getContext("2d", { willReadFrequently: true })!.drawImage(video, 0, 0);
      const canvas = (canvasRef.current ??= document.createElement("canvas"));
      const scale = Math.min(1, ANALYSE_WIDTH / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      canvas.getContext("2d", { willReadFrequently: true })!.drawImage(frame, 0, 0, canvas.width, canvas.height);
      try {
        // Low floor on purpose: weak detections only extend tracks (Tracker.update).
        const dets = await detector.detect(canvas, session.detectIds, LOW_CONF);
        if (!current()) break; // stopped or a new source started while detecting
        if (session !== sessionRef.current) continue; // settings changed mid-frame
        const { tracks, events: newEvents } = session.process(dets, canvas.width, canvas.height);
        resultRef.current = {
          width: canvas.width,
          height: canvas.height,
          tracks: [...tracks],
          flash: new Set(session.line?.flash.keys() ?? []),
          inZone: new Set(session.zone?.inside ?? []),
          frame,
        };
        setCounts(session.counts());

        if (newEvents.length) {
          // Save to this device's history for the dashboard.
          if (historyRef.current) {
            recordEvents(historyRef.current, newEvents.map((e) => ({ type: CLASS_NAMES[e.cls], dir: e.dir })));
          }
          const now = Date.now();
          const time = new Date(now).toLocaleTimeString([], {
            hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
          });
          setEvents((prev) =>
            [...newEvents.map((e) => ({ key: `${now}-${e.id}`, time, id: e.id, name: CLASS_NAMES[e.cls], dir: e.dir })), ...prev]
              .slice(0, MAX_EVENTS),
          );
          setTimeline((prev) => {
            const start = Math.floor(now / BUCKET_MS) * BUCKET_MS;
            const next = prev.length && prev[prev.length - 1].start === start
              ? prev.slice(0, -1).concat({ ...prev[prev.length - 1] })
              : prev.concat({ start, in: 0, out: 0 });
            const b = next[next.length - 1];
            for (const e of newEvents) b[e.dir] += 1;
            return next.slice(-MAX_BUCKETS);
          });
        }
      } catch (e) {
        if (!current()) break;
        setError(`Detection failed: ${e instanceof Error ? e.message : String(e)}`);
        await sleep(500);
      }

      if (!current()) break;
      const ms = performance.now() - t0;
      fps = fps ? fps * 0.85 + (1000 / ms) * 0.15 : 1000 / ms;
      setStats({ fps: Math.round(fps * 10) / 10, ms: Math.round(ms) });
      await sleep(0); // let the browser paint between frames
    }
  }, [videoRef]);

  const start = useCallback((source: "camera" | "file" | "link" = "camera") => {
    const runId = ++runIdRef.current; // ends any loop still finishing a frame
    runningRef.current = true;
    // A new camera / video starts from zero (the line and zone stay).
    sessionRef.current?.reset();
    if (sessionRef.current) setCounts(sessionRef.current.counts());
    resetStats();
    historyRef.current = startSession(source);
    setStatus((s) => (s === "error" ? s : detectorRef.current ? "running" : "loading"));
    void loop(runId);
  }, [loop, resetStats]);

  const stop = useCallback(() => {
    runIdRef.current++; // the running loop exits and can no longer write results
    runningRef.current = false;
    if (historyRef.current) endSession(historyRef.current);
    historyRef.current = null;
    resultRef.current = null;
    setStats({ fps: 0, ms: 0 });
    setStatus((s) => (s === "running" ? "ready" : s));
  }, []);

  // When loading finishes while the camera is already running, flip to "running".
  useEffect(() => {
    if (backend && runningRef.current) setStatus("running");
  }, [backend]);

  const reset = useCallback(() => {
    sessionRef.current?.reset();
    if (sessionRef.current) setCounts(sessionRef.current.counts());
    resetStats();
  }, [resetStats]);

  return { status, progress, error, setError, backend, counts, stats, events, timeline, resultRef, start, stop, reset };
}
