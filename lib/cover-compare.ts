import { proxiedCover } from "@/lib/metadata/client";

/** A small summary of a cover image, enough to tell two covers apart. */
export interface CoverPrint {
  width: number;
  height: number;
  /** 64-bit difference hash: whether each grayscale cell is brighter than its right neighbor. */
  bits: Uint8Array;
  /** Average color of each cell in a 4×6 grid, as r, g, b triples (0 to 255). */
  cells: Float32Array;
}

export type CoverCheck =
  | { status: "ok"; print: CoverPrint }
  /** Loads, but its pixels cannot be read, so it cannot be compared. */
  | { status: "unreadable" }
  | { status: "broken" };

// Same image at another size or compression differs in a few bits and a few color steps per
// region. Different art differs in 20 or more bits; a recolored edition, in its regions' colors.
const MAX_BIT_DIFFERENCE = 10;
const MAX_CELL_COLOR_DISTANCE = 20;
export const GRID = { cols: 4, rows: 6 };

export function hamming(a: Uint8Array, b: Uint8Array) {
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
}

/** Mean distance between the colors of matching regions. */
export function cellDistance(a: Float32Array, b: Float32Array) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 3) sum += Math.hypot(a[i] - b[i], a[i + 1] - b[i + 1], a[i + 2] - b[i + 2]);
  return sum / (a.length / 3);
}

/** Same layout and the same colors region by region: one cover, even if two catalogs host it. */
export function looksAlike(a: CoverPrint, b: CoverPrint) {
  return hamming(a.bits, b.bits) <= MAX_BIT_DIFFERENCE && cellDistance(a.cells, b.cells) < MAX_CELL_COLOR_DISTANCE;
}

/** Book covers are portrait. Square images are audiobooks; tiny ones are placeholders. */
export function fitsAsCover(p: Pick<CoverPrint, "width" | "height">) {
  const ratio = p.width / p.height;
  return p.width >= 60 && ratio >= 0.45 && ratio <= 0.85;
}

/**
 * Walks the covers in order and keeps each one that does not look like a cover already
 * kept. Covers not checked yet are left out; ones that could not be read are kept.
 */
export function distinctCovers<T extends { url: string }>(covers: T[], checks: Map<string, CoverCheck>): T[] {
  const kept: T[] = [];
  const prints: CoverPrint[] = [];
  for (const cover of covers) {
    const check = checks.get(cover.url);
    if (!check || check.status === "broken") continue;
    if (check.status === "ok") {
      if (!fitsAsCover(check.print) || prints.some((p) => looksAlike(p, check.print))) continue;
      prints.push(check.print);
    }
    kept.push(cover);
  }
  return kept;
}

/** Turns 9×8 grayscale values into the 64 comparison bits. */
export function hashFromGray(gray: ArrayLike<number>) {
  const bits = new Uint8Array(64);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits[y * 8 + x] = gray[y * 9 + x] > gray[y * 9 + x + 1] ? 1 : 0;
  return bits;
}

function load(src: string, crossOrigin: boolean) {
  const img = new Image();
  if (crossOrigin) img.crossOrigin = "anonymous";
  img.decoding = "async";
  img.src = src;
  return img.decode().then(() => img);
}

function printOf(img: HTMLImageElement): CoverPrint {
  // Reduce in two steps so the small grids average the image instead of sampling it.
  const cell = 6;
  const mid = document.createElement("canvas");
  mid.width = GRID.cols * cell;
  mid.height = GRID.rows * cell;
  const midCtx = mid.getContext("2d", { willReadFrequently: true })!;
  midCtx.imageSmoothingQuality = "high";
  midCtx.drawImage(img, 0, 0, mid.width, mid.height);
  const { data } = midCtx.getImageData(0, 0, mid.width, mid.height);
  const cells = new Float32Array(GRID.cols * GRID.rows * 3);
  for (let y = 0; y < mid.height; y++) {
    for (let x = 0; x < mid.width; x++) {
      const at = ((Math.floor(y / cell) * GRID.cols + Math.floor(x / cell)) * 3);
      const i = (y * mid.width + x) * 4;
      cells[at] += data[i] / (cell * cell);
      cells[at + 1] += data[i + 1] / (cell * cell);
      cells[at + 2] += data[i + 2] / (cell * cell);
    }
  }

  const small = document.createElement("canvas");
  small.width = 9;
  small.height = 8;
  const ctx = small.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, 9, 8);
  const px = ctx.getImageData(0, 0, 9, 8).data;
  const gray = new Float32Array(72);
  for (let i = 0; i < 72; i++) gray[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
  return { width: img.naturalWidth, height: img.naturalHeight, bits: hashFromGray(gray), cells };
}

/** Reads a cover through the app's same-origin proxy; falls back to checking that it loads at all. */
export async function checkCover(url: string, timeoutMs = 6000): Promise<CoverCheck> {
  const attempt = async (): Promise<CoverCheck> => {
    try {
      return { status: "ok", print: printOf(await load(proxiedCover(url), true)) };
    } catch {
      try {
        await load(url, false);
        return { status: "unreadable" };
      } catch {
        return { status: "broken" };
      }
    }
  };
  const timeout = new Promise<CoverCheck>((resolve) => setTimeout(() => resolve({ status: "unreadable" }), timeoutMs));
  return Promise.race([attempt(), timeout]);
}
