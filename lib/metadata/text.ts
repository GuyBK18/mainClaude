const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  laquo: "«",
  raquo: "»",
  eacute: "é",
  egrave: "è",
  uuml: "ü",
  ouml: "ö",
  auml: "ä",
  copy: "©",
};

export function decodeEntities(value: string) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : match;
    }
    return NAMED[code.toLowerCase()] ?? match;
  });
}

/**
 * Turns catalog HTML into plain paragraphs joined by blank lines.
 * The app renders these as text nodes, so no markup from a catalog ever reaches the page.
 */
export function htmlToParagraphs(html: string | undefined, maxLength = 6000) {
  if (!html) return undefined;
  const text = decodeEntities(
    html
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<\/\s*(p|div|li|h\d)\s*>/gi, "\n\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\r/g, "")
    .replace(/[ \t ]+/g, " ");

  const paragraphs = text
    .split(/\n\s*\n|\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!paragraphs.length) return undefined;

  let out = paragraphs.join("\n\n");
  if (out.length > maxLength) out = `${out.slice(0, maxLength).replace(/\s+\S*$/, "")}…`;
  return out;
}

export function stripTags(html: string) {
  return decodeEntities(html.replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

export function snippetOf(text: string | undefined, length = 180) {
  const plain = htmlToParagraphs(text)?.replace(/\n+/g, " ");
  if (!plain) return undefined;
  return plain.length > length ? `${plain.slice(0, length).replace(/\s+\S*$/, "")}…` : plain;
}

/** Lowercase, no accents, no punctuation, no leading article, no subtitle. For matching only. */
export function normalizeTitle(title: string) {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[:(\[]/)[0]
    .replace(/^(the|a|an)\s+/, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function surname(author: string | undefined) {
  if (!author) return "";
  const parts = author
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\s-]/gu, " ")
    .trim()
    .split(/\s+/);
  return parts[parts.length - 1] ?? "";
}

export function yearFrom(value: string | number | undefined | null) {
  if (value === undefined || value === null) return undefined;
  // Goodreads sends publication dates as epoch milliseconds, negative before 1970.
  if (typeof value === "number") return Math.abs(value) > 3000 ? new Date(value).getUTCFullYear() : value;
  const match = String(value).match(/\b(\d{4})\b/);
  return match ? Number(match[1]) : undefined;
}

export function cleanIsbn(value: string | undefined) {
  const digits = value?.replace(/[^0-9X]/gi, "").toUpperCase();
  return digits && (digits.length === 10 || digits.length === 13) ? digits : undefined;
}

export function isbn10to13(isbn10: string) {
  const core = `978${isbn10.slice(0, 9)}`;
  const sum = [...core].reduce((s, d, i) => s + Number(d) * (i % 2 ? 3 : 1), 0);
  return `${core}${(10 - (sum % 10)) % 10}`;
}

/** Prefers ISBN-13 and converts ISBN-10 so candidates from different catalogs compare equal. */
export function toIsbn13(value: string | undefined) {
  const isbn = cleanIsbn(value);
  if (!isbn) return undefined;
  return isbn.length === 13 ? isbn : isbn10to13(isbn);
}

export function isIsbnQuery(query: string) {
  return /^[\d\s-]{9,17}[\dXx]$/.test(query.trim()) && cleanIsbn(query) !== undefined;
}

export function hasHebrew(value: string) {
  return /[֐-׿]/.test(value);
}

const LANGUAGE_NAMES = new Intl.DisplayNames(["en"], { type: "language" });
const ISO_639_2: Record<string, string> = {
  eng: "en",
  heb: "he",
  fre: "fr",
  fra: "fr",
  ger: "de",
  deu: "de",
  spa: "es",
  ita: "it",
  rus: "ru",
  jpn: "ja",
  chi: "zh",
  zho: "zh",
  por: "pt",
  ara: "ar",
  dut: "nl",
  nld: "nl",
  pol: "pl",
  swe: "sv",
  kor: "ko",
  yid: "yi",
};

/** "he", "heb" or "Hebrew" in; ISO 639-1 out. */
export function languageCode(value: string | undefined) {
  if (!value) return undefined;
  const v = value.trim().toLowerCase();
  if (v.length === 2) return v;
  if (v.length === 3) return ISO_639_2[v];
  for (const code of Object.values(ISO_639_2)) {
    if (LANGUAGE_NAMES.of(code)?.toLowerCase() === v) return code;
  }
  return undefined;
}

export function languageName(code: string | undefined) {
  if (!code) return undefined;
  try {
    return LANGUAGE_NAMES.of(code);
  } catch {
    return undefined;
  }
}

export function httpsUrl(url: string | undefined) {
  return url?.replace(/^http:\/\//, "https://");
}
