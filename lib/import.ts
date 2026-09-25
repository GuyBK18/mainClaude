/**
 * URL import. Open Library links (and any URL carrying an ISBN) are fetched from
 * Open Library's public JSON API. Anything else falls back to reading the title
 * out of the URL slug, so Goodreads, Amazon or StoryGraph links still prefill the form.
 */

export interface ImportResult {
  title?: string;
  author?: string;
  pageCount?: number;
  publishedYear?: number;
  publisher?: string;
  isbn?: string;
  coverUrl?: string;
  sourceUrl: string;
  /** Where the fields came from, shown to the reader before saving. */
  source: "open-library" | "url";
}

const OL = "https://openlibrary.org";

async function getJSON<T>(url: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json() as Promise<T>;
}

type OLRecord = {
  title?: string;
  subtitle?: string;
  number_of_pages?: number;
  publishers?: string[];
  publish_date?: string;
  first_publish_date?: string;
  covers?: number[];
  authors?: ({ key: string } | { author: { key: string } })[];
  works?: { key: string }[];
  isbn_13?: string[];
  isbn_10?: string[];
};

function yearFrom(value?: string) {
  const match = value?.match(/\d{4}/);
  return match ? Number(match[0]) : undefined;
}

async function fromOpenLibrary(path: string, sourceUrl: string, signal: AbortSignal): Promise<ImportResult> {
  const record = await getJSON<OLRecord>(`${OL}${path}.json`, signal);
  let authorKey: string | undefined;
  const first = record.authors?.[0];
  if (first) authorKey = "key" in first ? first.key : first.author.key;

  // Editions often omit authors; the work has them.
  if (!authorKey && record.works?.[0]) {
    const work = await getJSON<OLRecord>(`${OL}${record.works[0].key}.json`, signal);
    const a = work.authors?.[0];
    if (a) authorKey = "key" in a ? a.key : a.author.key;
  }
  const author = authorKey ? (await getJSON<{ name?: string }>(`${OL}${authorKey}.json`, signal)).name : undefined;

  return {
    title: record.title,
    author,
    pageCount: record.number_of_pages,
    publishedYear: yearFrom(record.publish_date ?? record.first_publish_date),
    publisher: record.publishers?.[0],
    isbn: record.isbn_13?.[0] ?? record.isbn_10?.[0],
    coverUrl: record.covers?.[0] ? `https://covers.openlibrary.org/b/id/${record.covers[0]}-L.jpg` : undefined,
    sourceUrl,
    source: "open-library",
  };
}

function titleFromSlug(url: URL) {
  const segments = url.pathname.split("/").filter(Boolean);
  // Amazon: /Title-Words/dp/ASIN. Goodreads: /book/show/123.Title_Words or 123-title-words.
  const dp = segments.indexOf("dp");
  let slug = dp > 0 ? segments[dp - 1] : segments[segments.length - 1] ?? "";
  slug = decodeURIComponent(slug)
    .replace(/^\d+[.-]?/, "")
    .replace(/\.[a-z]+$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
  if (!slug) return undefined;
  return slug.replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function importFromUrl(raw: string): Promise<ImportResult> {
  const url = new URL(raw.trim());
  const sourceUrl = url.toString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    if (url.hostname.endsWith("openlibrary.org")) {
      const match = url.pathname.match(/^\/(works|books|isbn)\/[^/]+/);
      if (match) return await fromOpenLibrary(match[0], sourceUrl, controller.signal);
    }
    const isbn = sourceUrl.match(/(?:97[89])?\d{9}[\dX]/)?.[0];
    if (isbn) return await fromOpenLibrary(`/isbn/${isbn}`, sourceUrl, controller.signal);
  } catch {
    // Offline or blocked: fall through to the slug.
  } finally {
    clearTimeout(timer);
  }

  return { title: titleFromSlug(url), sourceUrl, source: "url" };
}
