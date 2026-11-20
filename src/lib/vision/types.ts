/** A point as fractions (0-1) of the video width and height. */
export type NormPoint = [number, number];
export type PxPoint = [number, number];
/** x1, y1, x2, y2 in pixels of the analysed frame. */
export type Box = [number, number, number, number];

export interface Detection {
  box: Box;
  conf: number;
  cls: number;
}

export type ClassGroup = "vehicles" | "people" | "all";
export type Anchor = "center" | "bottom";
/** "overhead" = camera looking straight down (drone, ceiling, high pole). */
export type CameraView = "street" | "overhead";

/**
 * Seen from directly above, the COCO-trained YOLO model labels cars as
 * "cell phone" (and sometimes "suitcase") - measured at 76-92% confidence on
 * a top-down parking clip where "car" scored ~0. In overhead mode those
 * look-alikes are read as cars. Never used for street-level cameras.
 */
export const OVERHEAD_ALIASES: Record<number, number> = { 67: 2, 28: 2 };
export type Backend = "webgpu" | "wasm";

// COCO class ids the YOLO model knows, limited to the ones we count.
export const CLASS_NAMES: Record<number, string> = {
  0: "person",
  1: "bicycle",
  2: "car",
  3: "motorcycle",
  5: "bus",
  7: "truck",
};

export const CLASS_GROUPS: Record<ClassGroup, number[]> = {
  people: [0],
  vehicles: [1, 2, 3, 5, 7],
  all: [0, 1, 2, 3, 5, 7],
};

export const CLASS_COLORS: Record<string, string> = {
  person: "#ffc857",
  bicycle: "#4cc9f0",
  car: "#f2b544",
  motorcycle: "#f472b6",
  bus: "#a3e635",
  truck: "#2dd4bf",
};

export interface CountRow {
  in: number;
  out: number;
  zone: number;
  visited: number;
  /** on screen right now (no line or zone needed) */
  now: number;
  /** unique vehicles seen this session (confirmed tracks) */
  seen: number;
}

export interface Counts {
  total: CountRow;
  classes: Record<string, CountRow>;
  hasLine: boolean;
  hasZone: boolean;
}
