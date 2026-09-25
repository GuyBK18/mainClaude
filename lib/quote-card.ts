export type QuoteTheme = "paper" | "obsidian" | "cover";
export type QuoteAlign = "left" | "center" | "right";
export type QuoteRatio = "1:1" | "4:5" | "9:16";

export interface QuoteCardOptions {
  text: string;
  author: string;
  source: string;
  /** Size in px at the 1080px export width. */
  fontSize: number;
  align: QuoteAlign;
  theme: QuoteTheme;
  ratio: QuoteRatio;
  italic: boolean;
  palette: [string, string, string];
}

export const CARD_WIDTH = 1080;
export const RATIO_HEIGHT: Record<QuoteRatio, number> = { "1:1": 1080, "4:5": 1350, "9:16": 1920 };

export function themeColors(theme: QuoteTheme, palette: [string, string, string]) {
  if (theme === "obsidian") return { bg: "#0E0E0E", ink: "#F2F0EC", muted: "#9C9890", rule: "#262420" };
  if (theme === "cover") return { bg: palette[0], ink: palette[1], muted: palette[1], rule: palette[2] };
  return { bg: "#F9F8F6", ink: "#1A1815", muted: "#6B6559", rule: "#E4E1D9" };
}

/** Resolves a next/font CSS variable to the concrete family list canvas needs. */
export function fontFamily(variable: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.body).getPropertyValue(variable).trim();
  return value || fallback;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  for (const paragraph of text.split(/\n+/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

/**
 * Draws the card at export resolution. Returns the font size actually used:
 * long quotes shrink until they fit, so nothing is ever cut off.
 */
export function drawQuoteCard(canvas: HTMLCanvasElement, o: QuoteCardOptions) {
  const W = CARD_WIDTH;
  const H = RATIO_HEIGHT[o.ratio];
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return o.fontSize;

  const serif = fontFamily("--font-newsreader", "Georgia, serif");
  const display = fontFamily("--font-space-grotesk", "system-ui, sans-serif");
  const c = themeColors(o.theme, o.palette);
  const pad = 112;
  const maxWidth = W - pad * 2;

  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, W, H);

  // The cover theme carries the book's own glow into the card.
  if (o.theme === "cover") {
    const glow = ctx.createRadialGradient(W * 0.78, H * 0.18, 0, W * 0.78, H * 0.18, W * 0.75);
    glow.addColorStop(0, `${o.palette[2]}55`);
    glow.addColorStop(1, `${o.palette[2]}00`);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
  }

  const x = o.align === "left" ? pad : o.align === "right" ? W - pad : W / 2;
  ctx.textAlign = o.align;
  ctx.textBaseline = "alphabetic";

  const hasAttribution = Boolean(o.author || o.source);
  // Offsets from the rule to each attribution baseline.
  const RULE_GAP = 40;
  const AUTHOR_Y = 62;
  const SOURCE_Y = o.author ? AUTHOR_Y + 46 : AUTHOR_Y;
  const attributionHeight = hasAttribution ? RULE_GAP + (o.source ? SOURCE_Y : AUTHOR_Y) + 10 : 0;

  // Measured bounds relative to the first baseline: the quotation mark sits above it.
  const markRise = (s: number) => s * 2.6;
  const blockHeight = (s: number, n: number) => markRise(s) + (n - 1) * s * 1.28 + s * 0.3 + attributionHeight;

  let size = o.fontSize;
  let lines: string[] = [];
  for (; size >= 20; size -= 2) {
    ctx.font = `${o.italic ? "italic " : ""}400 ${size}px ${serif}`;
    lines = wrap(ctx, o.text.trim() || " ", maxWidth);
    if (blockHeight(size, lines.length) <= H - pad * 2) break;
  }
  const lineHeight = size * 1.28;
  let y = (H - blockHeight(size, lines.length)) / 2 + markRise(size);

  // Opening quotation mark, set large in the serif and quiet in color.
  ctx.fillStyle = o.theme === "cover" ? c.rule : c.muted;
  ctx.globalAlpha = o.theme === "cover" ? 0.9 : 0.35;
  ctx.font = `400 ${Math.round(size * 2.4)}px ${serif}`;
  ctx.fillText("\u201C", x, y - size * 0.9);
  ctx.globalAlpha = 1;

  ctx.fillStyle = c.ink;
  ctx.font = `${o.italic ? "italic " : ""}400 ${size}px ${serif}`;
  lines.forEach((line, i) => ctx.fillText(line, x, y + i * lineHeight));
  y += (lines.length - 1) * lineHeight + size * 0.3;

  if (hasAttribution) {
    const ruleY = y + RULE_GAP;
    const ruleW = 56;
    const ruleX = o.align === "left" ? x : o.align === "right" ? x - ruleW : x - ruleW / 2;
    ctx.fillStyle = c.rule;
    ctx.fillRect(ruleX, ruleY, ruleW, 2);

    const spaced = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
    if (o.author) {
      ctx.fillStyle = c.ink;
      ctx.font = `500 26px ${display}`;
      if ("letterSpacing" in spaced) spaced.letterSpacing = "5px";
      ctx.fillText(o.author.toUpperCase(), x, ruleY + AUTHOR_Y);
      if ("letterSpacing" in spaced) spaced.letterSpacing = "0px";
    }
    if (o.source) {
      ctx.fillStyle = c.muted;
      ctx.globalAlpha = o.theme === "cover" ? 0.75 : 1;
      ctx.font = `italic 400 30px ${serif}`;
      ctx.fillText(o.source, x, ruleY + SOURCE_Y);
      ctx.globalAlpha = 1;
    }
  }

  return size;
}
