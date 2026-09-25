import type { CoverArt, CoverStyle } from "@/types/reading";

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
 * Reads the dominant colors of a cover image in the browser.
 * Returns null when the host blocks cross-origin reads, so callers keep the generated palette.
 */
export async function extractPalette(url: string): Promise<[string, string, string] | null> {
  if (typeof window === "undefined") return null;
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.src = url;
    await img.decode();

    const canvas = document.createElement("canvas");
    canvas.width = 24;
    canvas.height = 36;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

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
