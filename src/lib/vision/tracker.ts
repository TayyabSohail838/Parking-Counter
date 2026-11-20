/**
 * Tracking and counting - a TypeScript port of the tested Python engine.
 *
 *  Tracker       gives every detected object an ID that sticks between frames
 *  LineCounter   counts IN / OUT when an object's path crosses the line
 *  ZoneCounter   counts objects currently inside a polygon (+ unique visitors)
 *  CountingSession ties them together for one camera / video
 */
import { iou } from "./detector";
import {
  CLASS_GROUPS, CLASS_NAMES, OVERHEAD_ALIASES,
  type Anchor, type Box, type CameraView, type ClassGroup, type Counts, type CountRow, type Detection,
  type NormPoint, type PxPoint,
} from "./types";

const TRAIL_LENGTH = 30;

/** Detections at or above this start new tracks; weaker ones (down to the
 *  detector's floor) may only keep an existing track alive. */
export const HIGH_CONF = 0.4;
export const LOW_CONF = 0.2;

/** car, bus, truck - the model often swaps these on the same vehicle,
 *  so they may match each other. */
const VEHICLE_CLASSES = new Set([2, 5, 7]);
const sameKind = (a: number, b: number) => a === b || (VEHICLE_CLASSES.has(a) && VEHICLE_CLASSES.has(b));

export class Track {
  velocity: Box = [0, 0, 0, 0];
  hits = 1; // frames in which it was seen
  missed = 0; // frames in a row it has not been seen
  trail: PxPoint[] = [];
  /** class votes weighted by confidence; `cls` is the current winner */
  private votes = new Map<number, number>();
  cls: number;

  constructor(
    readonly id: number,
    public box: Box,
    cls: number,
    public conf: number,
    private anchorMode: Anchor,
  ) {
    this.cls = cls;
    this.votes.set(cls, conf);
    this.trail.push(this.anchor());
  }

  /** The single point used for counting: box centre, or bottom-centre (where it meets the ground). */
  anchor(): PxPoint {
    const cx = (this.box[0] + this.box[2]) / 2;
    return this.anchorMode === "center" ? [cx, (this.box[1] + this.box[3]) / 2] : [cx, this.box[3]];
  }

  /** Barely moving (parked or queued)? Speed under 2% of its own size per frame. */
  stationary(): boolean {
    const size = Math.max(this.box[2] - this.box[0], this.box[3] - this.box[1], 1);
    const speed = Math.hypot((this.velocity[0] + this.velocity[2]) / 2, (this.velocity[1] + this.velocity[3]) / 2);
    return this.hits >= 3 && speed < size * 0.02;
  }

  predicted(): Box {
    return this.box.map((v, i) => v + this.velocity[i]) as Box;
  }

  update(d: Detection) {
    this.velocity = d.box.map((v, i) => 0.6 * this.velocity[i] + 0.4 * (v - this.box[i])) as Box;
    this.box = d.box;
    this.conf = d.conf;
    this.hits += 1;
    this.missed = 0;
    this.votes.set(d.cls, (this.votes.get(d.cls) ?? 0) + d.conf);
    for (const [c, v] of this.votes) if (v > (this.votes.get(this.cls) ?? 0)) this.cls = c;
    this.trail.push(this.anchor());
    if (this.trail.length > TRAIL_LENGTH) this.trail.shift();
  }
}

export class Tracker {
  tracks: Track[] = [];
  private nextId = 1;

  constructor(
    private anchor: Anchor = "bottom",
    private iouThreshold = 0.25,
    private maxMissed = 30, // forget a track after this many frames unseen
    // Only trust a track after this many frames. 2 (not 3): new tracks need a
    // confident detection anyway, and at 5-10 FPS each extra frame is 0.1-0.2 s
    // of a vehicle on screen without a box.
    private minHits = 2,
  ) {}

  /** How well a track (at its predicted position) matches a detection: 0 = no match. */
  private score(t: Track, d: Detection) {
    if (!sameKind(t.cls, d.cls)) return 0;
    const p = t.predicted();
    const o = iou(p, d.box);
    if (o >= this.iouThreshold) return o;
    // Low frame rates make objects jump further than their own size between
    // frames, so boxes stop overlapping. Fall back to centre distance.
    // Kept strict so two vehicles side by side can't swap IDs when one of
    // them is missed for a frame: close (under 0.6 of its size) AND similar
    // in size (area within 2.5x).
    const pcx = (p[0] + p[2]) / 2, pcy = (p[1] + p[3]) / 2;
    const dcx = (d.box[0] + d.box[2]) / 2, dcy = (d.box[1] + d.box[3]) / 2;
    const size = Math.max(p[2] - p[0], p[3] - p[1], d.box[2] - d.box[0], d.box[3] - d.box[1]);
    const ratio = ((p[2] - p[0]) * (p[3] - p[1])) / Math.max(1, (d.box[2] - d.box[0]) * (d.box[3] - d.box[1]));
    if (ratio > 2.5 || ratio < 0.4) return 0;
    const reach = size * 0.6;
    const dist = Math.hypot(pcx - dcx, pcy - dcy);
    return dist < reach ? this.iouThreshold * (1 - dist / reach) * 0.99 : 0;
  }

  /** Greedy best-first matching of `dets` to tracks not yet in `usedT`. Returns matched detection indexes. */
  private match(dets: Detection[], usedT: Set<number>): Set<number> {
    const pairs: [number, number, number][] = [];
    this.tracks.forEach((t, ti) => {
      if (usedT.has(ti)) return;
      dets.forEach((d, di) => {
        const s = this.score(t, d);
        if (s > 0) pairs.push([s, ti, di]);
      });
    });
    pairs.sort((a, b) => b[0] - a[0]);
    const usedD = new Set<number>();
    for (const [, ti, di] of pairs) {
      if (usedT.has(ti) || usedD.has(di)) continue;
      this.tracks[ti].update(dets[di]);
      usedT.add(ti);
      usedD.add(di);
    }
    return usedD;
  }

  /**
   * Two-stage association (the ByteTrack idea): confident detections are
   * matched first; weak ones then rescue tracks that would otherwise be lost
   * (dark or partly hidden vehicles flicker below the threshold). Only
   * confident detections start new tracks, so weak noise never does.
   */
  update(dets: Detection[]): Track[] {
    const high = dets.filter((d) => d.conf >= HIGH_CONF);
    const low = dets.filter((d) => d.conf < HIGH_CONF);
    const usedT = new Set<number>();
    const usedHigh = this.match(high, usedT);
    this.match(low, usedT);
    this.tracks.forEach((t, ti) => {
      if (!usedT.has(ti)) {
        t.missed += 1;
        t.box = t.predicted(); // coast along for a few frames
      }
    });
    high.forEach((d, di) => {
      if (!usedHigh.has(di)) this.tracks.push(new Track(this.nextId++, d.box, d.cls, d.conf, this.anchor));
    });
    // Parked vehicles in poor light drop out of detection for seconds at a
    // time; they don't move, so remember them 5x longer and they keep their
    // ID (instead of coming back as a "new" vehicle).
    this.tracks = this.tracks.filter((t) => t.missed <= (t.stationary() ? this.maxMissed * 5 : this.maxMissed));
    return this.tracks.filter((t) => t.hits >= this.minHits && t.missed === 0);
  }

  /** Confirmed tracks seen in the last `grace` frames - for zone occupancy,
   *  so a vehicle missed for a frame or two doesn't blink out of the count. */
  recent(grace = 2): Track[] {
    return this.tracks.filter((t) => t.hits >= this.minHits && t.missed <= grace);
  }
}

/** >0 on one side of line a->b, <0 on the other (2D cross product). */
function side(p: PxPoint, a: PxPoint, b: PxPoint) {
  return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
}

function segmentsIntersect(p1: PxPoint, p2: PxPoint, a: PxPoint, b: PxPoint) {
  return side(p1, a, b) * side(p2, a, b) < 0 && side(a, p1, p2) * side(b, p1, p2) < 0;
}

type CountMap = Record<number, number>;

export class LineCounter {
  inCount: CountMap = {};
  outCount: CountMap = {};
  counted = new Set<number>();
  flash = new Map<number, number>(); // track id -> frames left to highlight

  constructor(public a: PxPoint, public b: PxPoint) {}

  reset() {
    this.inCount = {};
    this.outCount = {};
    this.counted.clear();
    this.flash.clear();
  }

  /** Each object counts once. Returns the events counted this frame. */
  update(tracks: Track[]) {
    const events: { id: number; cls: number; dir: "in" | "out" }[] = [];
    for (const t of tracks) {
      if (this.counted.has(t.id) || t.trail.length < 2) continue;
      const p0 = t.trail[0];
      const p1 = t.trail[t.trail.length - 1];
      if (!segmentsIntersect(p0, p1, this.a, this.b)) continue;
      // Ending up on the side the on-screen "IN" arrow points to = IN.
      const dir = side(p1, this.a, this.b) < 0 ? "in" : "out";
      const map = dir === "in" ? this.inCount : this.outCount;
      map[t.cls] = (map[t.cls] ?? 0) + 1;
      this.counted.add(t.id);
      this.flash.set(t.id, 12);
      events.push({ id: t.id, cls: t.cls, dir });
    }
    for (const [id, left] of this.flash) {
      if (left <= 1) this.flash.delete(id);
      else this.flash.set(id, left - 1);
    }
    return events;
  }
}

const ZONE_DWELL_FRAMES = 3;
/** A track counts toward "seen so far" once it has been detected this many times. */
const SEEN_HITS = 3;
/** A box counts as inside when at least this share of it overlaps the zone. */
const ZONE_OVERLAP = 0.4;
const GRID = 5; // 5x5 sample points per box to estimate the overlap

/** Ray-casting point-in-polygon (plain JS: cheap enough for 25 samples per box). */
function inPoly(poly: PxPoint[], x: number, y: number) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Share of the box (0-1) that lies inside the polygon, from a GRIDxGRID sample. */
function overlapShare(poly: PxPoint[], [x1, y1, x2, y2]: Box) {
  let hits = 0;
  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      if (inPoly(poly, x1 + ((i + 0.5) / GRID) * (x2 - x1), y1 + ((j + 0.5) / GRID) * (y2 - y1))) hits++;
    }
  }
  return hits / (GRID * GRID);
}

export class ZoneCounter {
  current: CountMap = {};
  visitors = new Map<number, Set<number>>(); // class -> unique ids ever inside
  inside = new Set<number>();

  constructor(
    public polygon: PxPoint[],
    private contains: (poly: PxPoint[], x: number, y: number) => boolean,
  ) {}

  reset() {
    this.current = {};
    this.visitors.clear();
    this.inside.clear();
    this.dwell.clear();
  }

  /** consecutive frames each track has been inside */
  private dwell = new Map<number, number>();

  update(tracks: Track[]) {
    this.current = {};
    this.inside = new Set();
    const dwell = new Map<number, number>();
    for (const t of tracks) {
      // Inside if its counting point is inside (OpenCV pointPolygonTest) or a
      // good part of the vehicle overlaps the zone - a car half in the zone
      // is "in the zone" to anyone watching, even if its centre isn't yet.
      const [x, y] = t.anchor();
      if (!this.contains(this.polygon, x, y) && overlapShare(this.polygon, t.box) < ZONE_OVERLAP) continue;
      this.current[t.cls] = (this.current[t.cls] ?? 0) + 1;
      this.inside.add(t.id);
      // Only a vehicle that stays inside for a moment counts as a visitor,
      // so boxes that flicker for a frame or two (tiny, distant or dark
      // vehicles) don't inflate the unique count.
      const n = (this.dwell.get(t.id) ?? 0) + 1;
      dwell.set(t.id, n);
      if (n >= ZONE_DWELL_FRAMES) {
        if (!this.visitors.has(t.cls)) this.visitors.set(t.cls, new Set());
        this.visitors.get(t.cls)!.add(t.id);
      }
    }
    this.dwell = dwell;
  }
}

export interface SessionConfig {
  classes: ClassGroup;
  anchor: Anchor;
  line: NormPoint[] | null;
  zone: NormPoint[] | null;
  view?: CameraView;
}

/** Overlapping boxes of the same kind (after aliasing) are one object: keep the most confident. */
function dedupe(dets: Detection[], threshold = 0.5) {
  const kept: Detection[] = [];
  for (const d of [...dets].sort((a, b) => b.conf - a.conf)) {
    if (kept.every((k) => !sameKind(k.cls, d.cls) || iou(k.box, d.box) < threshold)) kept.push(d);
  }
  return kept;
}

/** Everything needed to count for one video source. */
export class CountingSession {
  tracker: Tracker;
  line: LineCounter | null = null;
  zone: ZoneCounter | null = null;
  /** classes that are counted */
  readonly classIds: number[];
  /** classes the detector is asked for (counted classes + overhead look-alikes) */
  readonly detectIds: number[];
  private overhead: boolean;
  private size: [number, number] | null = null;

  constructor(
    readonly config: SessionConfig,
    private contains: (poly: PxPoint[], x: number, y: number) => boolean,
  ) {
    this.tracker = new Tracker(config.anchor);
    this.classIds = CLASS_GROUPS[config.classes];
    this.overhead = config.view === "overhead" && this.classIds.includes(2);
    this.detectIds = this.overhead
      ? [...this.classIds, ...Object.keys(OVERHEAD_ALIASES).map(Number)]
      : this.classIds;
  }

  /** Line / zone are stored as 0-1 fractions; convert to pixels for this frame size. */
  private ensureGeometry(w: number, h: number) {
    if (this.size?.[0] === w && this.size?.[1] === h) return;
    this.size = [w, h];
    const px = (p: NormPoint): PxPoint => [p[0] * w, p[1] * h];
    const { line, zone } = this.config;
    if (line?.length === 2) {
      if (this.line) [this.line.a, this.line.b] = [px(line[0]), px(line[1])];
      else this.line = new LineCounter(px(line[0]), px(line[1]));
    }
    if (zone && zone.length >= 3) {
      if (this.zone) this.zone.polygon = zone.map(px);
      else this.zone = new ZoneCounter(zone.map(px), this.contains);
    }
  }

  process(dets: Detection[], w: number, h: number) {
    this.ensureGeometry(w, h);
    if (this.overhead) {
      dets = dedupe(dets.map((d) => (d.cls in OVERHEAD_ALIASES ? { ...d, cls: OVERHEAD_ALIASES[d.cls] } : d)));
    }
    const tracks = this.tracker.update(dets);
    const events = this.line ? this.line.update(tracks) : [];
    const recent = this.tracker.recent();
    this.zone?.update(recent);
    // Live numbers that need no line or zone: what's on screen now, and every
    // vehicle seen so far (its latest type wins, so a car/truck flip isn't two).
    this.now = {};
    for (const t of recent) {
      this.now[t.cls] = (this.now[t.cls] ?? 0) + 1;
      if (t.hits >= SEEN_HITS) this.seen.set(t.id, t.cls);
    }
    return { tracks, events };
  }

  private now: CountMap = {};
  private seen = new Map<number, number>(); // track id -> class

  reset() {
    this.line?.reset();
    this.zone?.reset();
    this.seen.clear();
  }

  counts(): Counts {
    const classes: Record<string, CountRow> = {};
    const seenBy: CountMap = {};
    for (const c of this.seen.values()) seenBy[c] = (seenBy[c] ?? 0) + 1;
    for (const c of this.classIds) {
      classes[CLASS_NAMES[c]] = {
        in: this.line?.inCount[c] ?? 0,
        out: this.line?.outCount[c] ?? 0,
        zone: this.zone?.current[c] ?? 0,
        visited: this.zone?.visitors.get(c)?.size ?? 0,
        now: this.now[c] ?? 0,
        seen: seenBy[c] ?? 0,
      };
    }
    const rows = Object.values(classes);
    const sum = (k: keyof CountRow) => rows.reduce((s, r) => s + r[k], 0);
    return {
      total: { in: sum("in"), out: sum("out"), zone: sum("zone"), visited: sum("visited"), now: sum("now"), seen: sum("seen") },
      classes,
      hasLine: !!this.config.line,
      hasZone: !!this.config.zone,
    };
  }
}
