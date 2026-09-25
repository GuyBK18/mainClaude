import type { CoverArt, CoverStyle } from "@/types/reading";
import { proxiedCover } from "@/lib/metadata/client";

/** Palettes for typeset covers when a book is added without an image. [ground, ink, accent] */
const PALETTES: [string, string, string][] = [
  ["#1F2A44", "#E9DFC7", "#C8A45C"],
  ["#6B2E2A", "#F1E8D8", "#D9A441"],
  ["#20404A", "#EAE4D6", "#8FB3B0"],
  ["#E8E2D4", "#1C1B19", "#B5452F"],
  ["#2F4A2B", "#E9E2CF", "#9DB27C"],
  ["#4A3B5C", "#EFE7DA", "#C9A96E"],
  ["#141414", "#E9E1D1", "#B8322A"],
  ["#F2C14E", "#2B2A28", "#E0703A"],
  ["#A9C6CF", "#13283A", "#E8D8B5"],
];

const STYLES: CoverStyle[] = ["band", "frame", "disc", "split", "type"];

function hash(value: string) {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function generatedCover(title: string, url?: string): CoverArt {
  const h = hash(title || "untitled");
  return { url: url || undefined, palette: PALETTES[h % PALETTES.length], style: STYLES[h % STYLES.length] };
}

function toHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

function luminance([r, g, b]: number[]) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Reads the dominant colors of a cover image in the browser. Goes through the app's
 * same-origin cover proxy first, then the image itself. Returns null when neither can
 * be read, so callers keep the generated palette.
 */
export async function extractPalette(url: string): Promise<[string, string, string] | null> {
  if (typeof window === "undefined") return null;
  return (await readPalette(proxiedCover(url))) ?? (await readPalette(url));
}

/** The image's pixels at a small size, or null when the host does not allow reading them. */
async function pixels(url: string, width: number, height: number) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.decoding = "async";
  img.src = url;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height).data;
}

async function readPalette(url: string): Promise<[string, string, string] | null> {
  try {
    const data = await pixels(url, 24, 36);
    if (!data) return null;

    // Bucket at 4 bits per channel and keep a running average per bucket.
    const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      const entry = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
      entry.n++;
      entry.r += r;
      entry.g += g;
      entry.b += b;
      buckets.set(key, entry);
    }
    const ranked = [...buckets.values()]
      .sort((a, b) => b.n - a.n)
      .map((e) => [e.r / e.n, e.g / e.n, e.b / e.n]);

    const picked: number[][] = [];
    for (const color of ranked) {
      const distinct = picked.every((p) => Math.hypot(p[0] - color[0], p[1] - color[1], p[2] - color[2]) > 60);
      if (distinct) picked.push(color);
      if (picked.length === 3) break;
    }
    while (picked.length < 3) picked.push(ranked[0] ?? [128, 128, 128]);

    const [ground, ...rest] = picked;
    // Ink is whichever remaining color contrasts most with the ground.
    rest.sort((a, b) => Math.abs(luminance(b) - luminance(ground)) - Math.abs(luminance(a) - luminance(ground)));
    return [toHex(ground[0], ground[1], ground[2]), toHex(rest[0][0], rest[0][1], rest[0][2]), toHex(rest[1][0], rest[1][1], rest[1][2])];
  } catch {
    return null;
  }
}

/** WCAG contrast ratio between two colors. */
function contrast(a: number[], b: number[]) {
  const channel = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const lum = ([r, g, b]: number[]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const CREAM = [242, 237, 228];
const NEAR_BLACK = [22, 20, 15];

/**
 * Spine colors for a book from its cover image, as [ground, ink, accent]. The ground is the
 * color of the cover's left edge, where the art meets the spine. The title goes on it in
 * cream or near-black, whichever stands out more, and the accent is the most saturated color
 * common in the image. Null when the image cannot be read.
 */
export function spinePalette(url: string): Promise<[string, string, string] | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  let pending = spineCache.get(url);
  if (!pending) {
    pending = readSpine(proxiedCover(url)).then((p) => p ?? readSpine(url));
    spineCache.set(url, pending);
  }
  return pending;
}

const spineCache = new Map<string, Promise<[string, string, string] | null>>();

async function readSpine(url: string): Promise<[string, string, string] | null> {
  try {
    const W = 40;
    const H = 60;
    const data = await pixels(url, W, H);
    if (!data) return null;
    // The strip from 2% to 9% of the width: past the hinge shading, before the art moves on.
    const ground = [0, 0, 0];
    let n = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 1; x <= 3; x++) {
        const i = (y * W + x) * 4;
        ground[0] += data[i];
        ground[1] += data[i + 1];
        ground[2] += data[i + 2];
        n++;
      }
    }
    ground.forEach((_, k) => (ground[k] /= n));

    const buckets = new Map<number, { n: number; c: number[] }>();
    for (let i = 0; i < data.length; i += 4) {
      const key = ((data[i] >> 5) << 6) | ((data[i + 1] >> 5) << 3) | (data[i + 2] >> 5);
      const e = buckets.get(key) ?? { n: 0, c: [0, 0, 0] };
      e.n++;
      e.c[0] += data[i];
      e.c[1] += data[i + 1];
      e.c[2] += data[i + 2];
      buckets.set(key, e);
    }
    const saturation = ([r, g, b]: number[]) => Math.max(r, g, b) - Math.min(r, g, b);
    const common = [...buckets.values()].filter((e) => e.n >= (W * H) / 60).map((e) => e.c.map((v) => v / e.n));
    const accent = common.sort((a, b) => saturation(b) - saturation(a))[0];

    const ink = contrast(ground, CREAM) >= contrast(ground, NEAR_BLACK) ? CREAM : NEAR_BLACK;
    const hex = (c: number[]) => toHex(c[0], c[1], c[2]);
    return [hex(ground), hex(ink), hex(accent && contrast(ground, accent) > 1.8 ? accent : ink)];
  } catch {
    return null;
  }
}
