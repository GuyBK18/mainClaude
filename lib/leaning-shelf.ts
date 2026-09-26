import type { Book, BookFormat } from "@/types/reading";

/**
 * Geometry for the leaning shelf: books stand at an angle, pressed one against the next, so
 * each shows its spine and a strip of cover. A pointed-at book first slides out along its own
 * cover, which never touches its neighbors, and only turns toward the reader once it is clear.
 */

/** What a pointed-at book does: slide out and turn to face the reader, or only slide out. */
export type LeaningMode = "turn" | "slide";

export interface LeaningSettings {
  mode: LeaningMode;
  /** Degrees each book is turned from facing the reader. */
  angle: number;
  /** Pixels of each cover left in view before the next book's spine. */
  reveal: number;
}

export const DEFAULT_LEANING: LeaningSettings = { mode: "turn", angle: 62, reveal: 14 };
export const ANGLE_RANGE = { min: 40, max: 75 } as const;
export const REVEAL_RANGE = { min: 0, max: 40 } as const;

const clampTo = (v: number, { min, max }: { min: number; max: number }) => Math.min(max, Math.max(min, Math.round(v)));

/** Settings from storage, with anything missing or out of range set to the default. */
export function toLeaningSettings(value: unknown): LeaningSettings {
  const v = (value ?? {}) as Partial<LeaningSettings>;
  return {
    mode: v.mode === "slide" ? "slide" : "turn",
    angle: typeof v.angle === "number" ? clampTo(v.angle, ANGLE_RANGE) : DEFAULT_LEANING.angle,
    reveal: typeof v.reveal === "number" ? clampTo(v.reveal, REVEAL_RANGE) : DEFAULT_LEANING.reveal,
  };
}

/** A book as a block: width and height of the cover, thickness of the spine. */
export interface Slab {
  w: number;
  h: number;
  t: number;
}

const HEIGHT: Record<BookFormat, number> = { hardcover: 212, paperback: 192, ebook: 196, audiobook: 200 };

/**
 * Thickness grows with page count, one pixel per 16 pages, so a book twice as long is
 * twice as thick. At the paperback's 192 px for about 20 cm, that is close to real paper.
 * Below MIN_PAGES a spine is too thin for its title, so those books share the thinnest spine.
 * MAX_PAGES only stops a mistyped count from filling a whole row. A missing count gets a
 * typical length, not the thinnest spine.
 */
export const MIN_PAGES = 192;
export const MAX_PAGES = 1500;
const TYPICAL_PAGES = 320;
const PAGES_PER_PX = 16;

export function spinePages(pageCount: number) {
  const pages = Number.isFinite(pageCount) && pageCount > 0 ? pageCount : TYPICAL_PAGES;
  return Math.min(MAX_PAGES, Math.max(MIN_PAGES, pages));
}

/** Height follows format, thickness follows page count. */
export function slabOf(book: Pick<Book, "format" | "pageCount">): Slab {
  const h = HEIGHT[book.format];
  return {
    w: Math.round(h * 0.655),
    h,
    t: Math.round((spinePages(book.pageCount) / PAGES_PER_PX) * (book.format === "hardcover" ? 1.08 : 1)),
  };
}

/** Pulling out: slide over p from 0 to SLIDE_END, turn from TURN_START to 1. */
export const SLIDE_END = 0.6;
export const TURN_START = 0.45;
/** Degrees a turned book ends at, so its cover faces the reader. */
export const TURNED = 16;
const FORWARD = 40;
const LIFT = 20;
/** Room left between a slid-out book and the next one before it may turn. */
const CLEARANCE = 12;
/** Height of one shelf: room above for lifting, the tallest book, and the board it stands on. */
export const SHELF_HEIGHT = 44 + 212 + 44;
/** Distance from the bottom of a shelf to where the books stand. */
export const PLINTH = 44;
/** The camera: its distance, and how far above a shelf's top it sits, so the books are seen from a little above. */
export const PERSPECTIVE = 2200;
export const EYE_ABOVE = 220;
/** Half the depth of the board, front to back, and its thickness. */
const BOARD_DEPTH = 76;
const BOARD_THICKNESS = 10;

/**
 * Where the board's back, front and lower edge land on screen, in pixels from the top of a
 * shelf, seen in the same perspective as the books so they stand on it and not over its edge.
 */
export function boardLines() {
  const base = SHELF_HEIGHT - PLINTH;
  const project = (y: number, z: number) => -EYE_ABOVE + (y + EYE_ABOVE) * (PERSPECTIVE / (PERSPECTIVE - z));
  return {
    back: Math.round(project(base, -BOARD_DEPTH)),
    front: Math.round(project(base, BOARD_DEPTH)),
    edge: Math.round(project(base + BOARD_THICKNESS, BOARD_DEPTH)),
  };
}

const rad = (deg: number) => (deg * Math.PI) / 180;

export function smooth(a: number, b: number, p: number) {
  const x = Math.min(1, Math.max(0, (p - a) / (b - a)));
  return x * x * (3 - 2 * x);
}

export interface Placed {
  /** Index into the slabs given to `layoutRows`. */
  index: number;
  /** Center of the book along the shelf, in pixels. */
  x: number;
  /** How far the book slides out along its cover before it turns. */
  d: number;
}

/**
 * Places books left to right in rows that fit `width`. Each book keeps its spine and
 * `reveal` pixels of cover in view, and sits far enough from the last one that the two
 * never overlap, however their thicknesses differ. `inset` leaves room on the left for
 * the first book to slide out.
 */
export function layoutRows(slabs: Slab[], settings: LeaningSettings, width: number, inset: number): Placed[][] {
  const sin = Math.sin(rad(settings.angle));
  const cos = Math.cos(rad(settings.angle));
  const projected = (s: Slab) => s.w * cos + s.t * sin;
  const right = width - 12;

  const rows: Placed[][] = [];
  let row: Placed[] = [];
  let left = inset;
  slabs.forEach((slab, index) => {
    let x = left + projected(slab) / 2;
    const prev = row[row.length - 1];
    if (prev) x = Math.max(x, prev.x + ((slabs[prev.index].t + slab.t) / 2 + 2) / sin);
    if (row.length && x + projected(slab) / 2 > right) {
      rows.push(row);
      row = [];
      x = inset + projected(slab) / 2;
    }
    row.push({ index, x, d: 0 });
    left = x - projected(slab) / 2 + slab.t * sin + settings.reveal;
  });
  if (row.length) rows.push(row);

  // Slide far enough to clear the next book before turning, with room to spare. A thick book
  // swings its back corner behind it as it turns, so it slides further until its whole path
  // stays clear of both neighbors.
  for (const r of rows) {
    r.forEach((placed, i) => {
      const slab = slabs[placed.index];
      const next = r[i + 1];
      const clear = next ? slab.w / 2 + slabs[next.index].w / 2 - (next.x - placed.x) * cos + CLEARANCE : 0;
      placed.d = Math.max(slab.w * 0.4, clear / smooth(0, SLIDE_END, TURN_START));
      if (settings.mode !== "turn") return;
      const neighbors = [r[i - 1], next].filter(Boolean).map((n) => boxAt(slabs[n.index], n, settings, 0));
      const limit = placed.d + slab.w * 3;
      while (placed.d < limit && turnHits(slab, placed, settings, neighbors)) placed.d += 2;
    });
  }
  return rows;
}

/** A book seen from above: its center, half its cover width and thickness, and its angle. */
interface Box {
  x: number;
  z: number;
  hw: number;
  ht: number;
  cos: number;
  sin: number;
}

function boxAt(slab: Slab, placed: Placed, settings: LeaningSettings, p: number): Box {
  const pose = poseAt(placed, settings, p);
  const a = rad(pose.angle);
  return { x: pose.x, z: pose.z, hw: slab.w / 2, ht: slab.t / 2, cos: Math.cos(a), sin: Math.sin(a) };
}

/** Whether two books come within `gap` pixels of each other (separating axis test). */
function tooClose(a: Box, b: Box, gap: number) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  // Each book's cover runs along (cos, -sin) and its thickness along (sin, cos).
  for (const [lx, lz] of [[a.cos, -a.sin], [a.sin, a.cos], [b.cos, -b.sin], [b.sin, b.cos]]) {
    const reach = (k: Box) => k.hw * Math.abs(k.cos * lx - k.sin * lz) + k.ht * Math.abs(k.sin * lx + k.cos * lz);
    if (Math.abs(dx * lx + dz * lz) >= reach(a) + reach(b) + gap) return false;
  }
  return true;
}

/**
 * Whether a book passes within a pixel of a resting neighbor while it turns. Before the
 * turn it slides parallel to its neighbors, so it cannot touch them.
 */
function turnHits(slab: Slab, placed: Placed, settings: LeaningSettings, neighbors: Box[]) {
  for (let p = TURN_START; p <= 1.0001; p += 0.01) {
    const moving = boxAt(slab, placed, settings, p);
    if (neighbors.some((n) => tooClose(moving, n, 1))) return true;
  }
  return false;
}

/** Where a book is at progress p (0 on the shelf, 1 fully out), seen from above: x along the shelf, z toward the reader. */
export function poseAt(placed: Placed, settings: LeaningSettings, p: number) {
  const turn = settings.mode === "turn";
  const slid = turn ? smooth(0, SLIDE_END, p) : smooth(0, 1, p);
  const turned = turn ? smooth(TURN_START, 1, p) : 0;
  const a = rad(settings.angle);
  return {
    slid,
    turned,
    /** Degrees from facing the reader. */
    angle: settings.angle - (settings.angle - TURNED) * turned,
    x: placed.x - placed.d * slid * Math.cos(a),
    z: placed.d * slid * Math.sin(a) + FORWARD * turned,
    lift: LIFT * (turn ? turned : slid),
  };
}

/**
 * The CSS transform for a book at progress p, for an element `slab.w` wide whose left edge
 * sits at the shelf's left. `tilt` follows the pointer once the book has turned.
 */
export function transformAt(slab: Slab, placed: Placed, settings: LeaningSettings, p: number, tilt = { x: 0, y: 0 }) {
  const pose = poseAt(placed, settings, p);
  return (
    `translate3d(${(placed.x - slab.w / 2).toFixed(2)}px, ${(-pose.lift).toFixed(2)}px, ${(FORWARD * pose.turned).toFixed(2)}px) ` +
    `rotateY(${settings.angle}deg) translateX(${(-placed.d * pose.slid).toFixed(2)}px) ` +
    `rotateY(${(pose.angle - settings.angle + tilt.y * pose.turned).toFixed(2)}deg) rotateX(${(tilt.x * pose.turned).toFixed(2)}deg)`
  );
}

/** How far a book's contact shadow moves along the shelf at progress p. */
export function shadowShift(placed: Placed, settings: LeaningSettings, p: number) {
  return poseAt(placed, settings, p).x - placed.x;
}

/** Below this a book counts as back on the shelf. */
const HOME = 0.01;

/**
 * The progress a book should head for. Only one book turns at a time: a book waits on the
 * shelf while another is turned, and waits before turning until every other book is home.
 * Books that are not turned stay parallel, so any number of them can slide without touching.
 */
export function pullTarget(wanted: boolean, self: number, others: number[], mode: LeaningMode) {
  if (!wanted) return 0;
  if (mode === "slide") return 1;
  const hold = TURN_START - 0.01;
  if (others.some((p) => p > TURN_START)) return self < HOME ? 0 : hold;
  return others.every((p) => p < HOME) ? 1 : hold;
}

/** One step of a critically damped spring toward `target`. Settles in about half a second. */
export function springStep(p: number, v: number, target: number, dt: number) {
  const k = 130;
  const nextV = v + (k * (target - p) - 2 * Math.sqrt(k) * v) * dt;
  const nextP = p + nextV * dt;
  return Math.abs(target - nextP) < 0.0015 && Math.abs(nextV) < 0.01 ? { p: target, v: 0, done: true } : { p: nextP, v: nextV, done: false };
}
