/**
 * Counting history, saved on this device (localStorage) so the dashboard can
 * show what the live counter has counted. Nothing is uploaded.
 *
 * Storage can be unavailable (private windows, blocked site data), so every
 * read and write is wrapped and the app keeps working without it.
 */

const KEY = "parking-counter-history-v1";
const MAX_EVENTS = 20_000;
const MAX_SESSIONS = 200;

export type Direction = "in" | "out";

export interface CountEvent {
  /** epoch milliseconds */
  t: number;
  /** vehicle / road-user type, e.g. "car" */
  type: string;
  dir: Direction;
  session: string;
}

export interface Session {
  id: string;
  start: number;
  end: number;
  source: "camera" | "file" | "link";
  sample?: boolean;
}

export interface History {
  sessions: Session[];
  events: CountEvent[];
}

const EMPTY: History = { sessions: [], events: [] };
const CHANGE = "parking-counter-history";
const FLUSH_MS = 1000;

/*
 * Performance: the stored history can hold up to 20k events (~1 MB of JSON).
 * - The raw string is cached in memory, so React's frequent snapshot reads
 *   don't hit localStorage each time.
 * - Parsed history is cached per raw string, so it's parsed once per change.
 * - The live counter's crossings are queued and written at most once a
 *   second (and on stop / tab hide), not once per crossing.
 */
let rawCache: string | null = null;
let parsedFor: string | null = null;
let parsedCache: History = EMPTY;
let pending: CountEvent[] = [];
let pendingEnds = new Map<string, number>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function readRaw(): string {
  if (rawCache === null) {
    try {
      rawCache = localStorage.getItem(KEY) ?? "";
    } catch {
      rawCache = "";
    }
  }
  return rawCache;
}

export function parseHistory(raw: string): History {
  if (raw === parsedFor) return parsedCache;
  let h = EMPTY;
  if (raw) {
    try {
      const v = JSON.parse(raw) as History;
      if (Array.isArray(v.sessions) && Array.isArray(v.events)) h = v;
    } catch {
      /* corrupt - treat as empty */
    }
  }
  parsedFor = raw;
  parsedCache = h;
  return h;
}

export function loadHistory(): History {
  return parseHistory(readRaw());
}

function save(h: History) {
  const raw = JSON.stringify({
    sessions: h.sessions.slice(-MAX_SESSIONS),
    events: h.events.slice(-MAX_EVENTS),
  });
  rawCache = raw;
  try {
    localStorage.setItem(KEY, raw);
  } catch {
    /* storage full or blocked - kept in memory for this tab only */
  }
  window.dispatchEvent(new Event(CHANGE));
}

/** For useSyncExternalStore: the raw stored string (a stable value between changes). */
export function getHistorySnapshot(): string {
  return readRaw();
}

/** For useSyncExternalStore: notify on changes from this tab or another tab. */
export function subscribeHistory(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY && e.key !== null) return;
    rawCache = null; // another tab wrote; re-read on next snapshot
    onChange();
  };
  window.addEventListener(CHANGE, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** Write any queued crossings now. */
export function flushHistory() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (!pending.length && !pendingEnds.size) return;
  rawCache = null; // pick up writes from other tabs before merging
  const h = loadHistory();
  const ends = pendingEnds;
  save({
    sessions: ends.size ? h.sessions.map((x) => (ends.has(x.id) ? { ...x, end: ends.get(x.id)! } : x)) : h.sessions,
    events: pending.length ? h.events.concat(pending) : h.events,
  });
  pending = [];
  pendingEnds = new Map();
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushHistory);
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flushHistory());
}

export function startSession(source: Session["source"]): string {
  flushHistory();
  const now = Date.now();
  const id = `${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const h = loadHistory();
  save({ ...h, sessions: [...h.sessions, { id, start: now, end: now, source }] });
  return id;
}

export function recordEvents(session: string, events: { type: string; dir: Direction }[]) {
  if (!events.length) return;
  const now = Date.now();
  for (const e of events) pending.push({ ...e, t: now, session });
  pendingEnds.set(session, now);
  flushTimer ??= setTimeout(flushHistory, FLUSH_MS);
}

export function endSession(session: string) {
  pendingEnds.set(session, Date.now());
  flushHistory();
}

export function clearHistory() {
  pending = [];
  pendingEnds = new Map();
  rawCache = "";
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(CHANGE));
}

/**
 * A realistic week of sample data so the dashboard can be previewed before
 * anything has been counted. Marked `sample: true` and labelled in the UI.
 */
export function buildSampleHistory(nowMs: number): History {
  const sessions: Session[] = [];
  const events: CountEvent[] = [];
  const types: [string, number][] = [["car", 0.72], ["truck", 0.09], ["motorcycle", 0.07], ["bus", 0.04], ["bicycle", 0.05], ["person", 0.03]];
  // Hourly traffic shape for a car park: morning arrivals, evening departures.
  const arrive = [0, 0, 0, 0, 0, 1, 3, 9, 14, 10, 6, 5, 7, 6, 5, 4, 4, 3, 2, 2, 1, 1, 0, 0];
  const leave = [0, 0, 0, 0, 0, 0, 1, 1, 2, 3, 4, 5, 7, 6, 5, 6, 9, 13, 11, 6, 3, 2, 1, 0];
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pickType = () => {
    let r = rand();
    for (const [t, p] of types) if ((r -= p) <= 0) return t;
    return "car";
  };
  const today = new Date(nowMs);
  today.setHours(0, 0, 0, 0);
  for (let d = 6; d >= 0; d--) {
    const day = today.getTime() - d * 86_400_000;
    const weekend = [0, 6].includes(new Date(day).getDay());
    const id = `sample-${d}`;
    const last = d === 0 ? new Date(nowMs).getHours() : 23;
    sessions.push({ id, start: day + 6 * 3_600_000, end: day + (last + 1) * 3_600_000 - 1, source: "camera", sample: true });
    for (let h = 0; h <= last; h++) {
      for (const [dir, curve] of [["in", arrive], ["out", leave]] as const) {
        const n = Math.round(curve[h] * (weekend ? 0.55 : 1) * (0.8 + rand() * 0.5) * 3);
        for (let i = 0; i < n; i++) {
          const t = day + h * 3_600_000 + Math.floor(rand() * 3_600_000);
          const type = pickType();
          if (t <= nowMs) events.push({ t, type, dir, session: id });
        }
      }
    }
  }
  events.sort((a, b) => a.t - b.t);
  // Drop sessions that have no crossings yet (e.g. "today" before 6 am).
  const used = new Set(events.map((e) => e.session));
  return { sessions: sessions.filter((x) => used.has(x.id)), events };
}

/** Save the sample week so it behaves like real history (can be cleared). */
export function loadSampleHistory() {
  save(buildSampleHistory(Date.now()));
}
