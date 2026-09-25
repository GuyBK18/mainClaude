/**
 * Goodreads has no public API, so this reads the public book page the way a browser
 * would. Each field is read three ways, most stable first: the page's JSON-LD block,
 * the Next.js data the page is built from, and finally the visible HTML. If Goodreads
 * changes its markup, whatever still parses is used and the rest is left empty.
 */
import type { EditionLanguage, PartialDetails, PublicRating } from "./types";
import { endpoints, getText, HttpError } from "./http";
import { decodeEntities, htmlToParagraphs, languageCode, normalizeTitle, stripTags, surname, toIsbn13, yearFrom } from "./text";

type Json = Record<string, unknown>;

export interface GoodreadsSearchHit {
  url: string;
  title: string;
  author?: string;
  year?: number;
  rating?: PublicRating;
  coverUrl?: string;
}

/** Goodreads thumbnails carry a size token like "._SY75_"; without it the full image is served. */
function fullSizeCover(url: string | undefined) {
  return url?.replace(/\._[A-Z]{2}\d+_(?=\.)/g, "").replace(/\._S[XY]\d+(_[A-Z]+\d+)?_/g, "");
}

function absolute(href: string, base: string) {
  const u = new URL(decodeEntities(href), base);
  u.search = "";
  u.hash = "";
  return u.toString();
}

function toNumber(value: unknown) {
  const n = typeof value === "number" ? value : Number(String(value ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function parseGoodreadsSearch(html: string, base = endpoints.goodreads): GoodreadsSearchHit[] {
  const rows = html.split(/<tr[^>]*itemtype="https?:\/\/schema\.org\/Book"[^>]*>/i).slice(1);
  const hits: GoodreadsSearchHit[] = [];
  for (const row of rows) {
    const chunk = row.split(/<\/tr>/i)[0];
    const anchor = chunk.match(/<a[^>]*class="bookTitle"[^>]*>([\s\S]*?)<\/a>/i);
    const href = anchor?.[0].match(/href="([^"]+)"/)?.[1];
    if (!anchor || !href) continue;
    // The rating sits after nested star spans, so read the text that follows the class instead of matching tags.
    const at = chunk.indexOf('class="minirating"');
    const mini = at >= 0 ? stripTags(chunk.slice(at, at + 800).replace(/^[^>]*>/, "")) : "";
    const m = mini.match(/([\d.]+)\s*avg rating\s*[—–-]+\s*([\d,]+)\s*rating/i);
    hits.push({
      url: absolute(href, base),
      title: stripTags(anchor[1]),
      author: stripTags(chunk.match(/<a[^>]*class="authorName"[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? "") || undefined,
      year: yearFrom(stripTags(chunk).match(/published\s+(\d{4})/i)?.[1]),
      rating: m ? { value: Number(m[1]), count: Number(m[2].replace(/,/g, "")), source: "goodreads" } : undefined,
      coverUrl: fullSizeCover(chunk.match(/<img[^>]+src="([^"]+)"/i)?.[1]),
    });
  }
  return hits;
}

function jsonLdBook(html: string): Json | undefined {
  const blocks = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const [, body] of blocks) {
    try {
      const parsed = JSON.parse(body) as Json | Json[];
      const items = (Array.isArray(parsed) ? parsed : [parsed]).flatMap((x) => (Array.isArray(x["@graph"]) ? (x["@graph"] as Json[]) : [x]));
      const book = items.find((x) => x["@type"] === "Book");
      if (book) return book;
    } catch {
      // Malformed block: try the next one.
    }
  }
  return undefined;
}

function apolloState(html: string): Json | undefined {
  const body = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i)?.[1];
  if (!body) return undefined;
  try {
    const data = JSON.parse(body) as { props?: { pageProps?: { apolloState?: Json } } };
    return data.props?.pageProps?.apolloState;
  } catch {
    return undefined;
  }
}

function fromApollo(state: Json, pageUrl: string): PartialDetails {
  const deref = (x: unknown): Json | undefined => {
    if (!x || typeof x !== "object") return undefined;
    const ref = (x as Json).__ref;
    return typeof ref === "string" ? (state[ref] as Json | undefined) : (x as Json);
  };
  const legacyId = pageUrl.match(/\/book\/show\/(\d+)/)?.[1];
  const books = Object.values(state).filter((v): v is Json => !!v && typeof v === "object" && (v as Json).__typename === "Book");
  const book =
    books.find((b) => legacyId && String(b.legacyId) === legacyId) ?? books.find((b) => b.bookSeries || b.bookGenres) ?? books[0];
  if (!book) return {};

  // Apollo keys fields called with arguments as `description({"stripped":true})`; the plain key keeps line breaks.
  const descriptionKey = Object.keys(book).find((k) => k === "description") ?? Object.keys(book).find((k) => k.startsWith("description"));
  const details = deref(book.details) ?? {};
  const work = deref(book.work);
  const stats = deref(work?.stats);
  const workDetails = deref(work?.details);

  const seriesEdge = Array.isArray(book.bookSeries) ? deref(book.bookSeries[0]) : undefined;
  const seriesName = seriesEdge ? (deref(seriesEdge.series)?.title as string | undefined) : undefined;
  const position = toNumber(seriesEdge?.userPosition);

  const genres = Array.isArray(book.bookGenres)
    ? (book.bookGenres as unknown[]).map((g) => deref(deref(g)?.genre)?.name).filter((n): n is string => typeof n === "string")
    : undefined;

  const contributor = deref(deref(book.primaryContributorEdge)?.node);
  const averageRating = toNumber(stats?.averageRating);
  const ratingsCount = toNumber(stats?.ratingsCount);

  return {
    title: typeof book.title === "string" ? book.title : undefined,
    authors: typeof contributor?.name === "string" ? [contributor.name] : undefined,
    pageCount: toNumber(details.numPages),
    publishedYear: yearFrom((workDetails?.publicationTime as number | undefined) ?? (details.publicationTime as number | undefined)),
    publisher: typeof details.publisher === "string" && details.publisher ? details.publisher : undefined,
    isbn: toIsbn13((details.isbn13 as string | undefined) ?? (details.isbn as string | undefined)),
    language: languageCode(deref(details.language)?.name as string | undefined),
    description: descriptionKey ? htmlToParagraphs(book[descriptionKey] as string) : undefined,
    categories: genres,
    series: seriesName && position ? { name: seriesName, position } : undefined,
    rating: averageRating && ratingsCount ? { value: averageRating, count: ratingsCount, source: "goodreads" } : undefined,
    coverUrl: typeof book.imageUrl === "string" ? book.imageUrl : undefined,
  };
}

function fromJsonLd(book: Json): PartialDetails {
  const rating = book.aggregateRating as Json | undefined;
  const value = toNumber(rating?.ratingValue);
  const count = toNumber(rating?.ratingCount);
  const authors = (Array.isArray(book.author) ? book.author : book.author ? [book.author] : [])
    .map((a) => (a as Json).name)
    .filter((n): n is string => typeof n === "string");
  return {
    title: typeof book.name === "string" ? decodeEntities(book.name) : undefined,
    authors: authors.length ? authors : undefined,
    pageCount: toNumber(book.numberOfPages),
    isbn: toIsbn13(book.isbn as string | undefined),
    language: languageCode(book.inLanguage as string | undefined),
    rating: value && count ? { value, count, source: "goodreads" } : undefined,
    coverUrl: typeof book.image === "string" ? book.image : undefined,
  };
}

function fromHtml(html: string): PartialDetails {
  const rating = toNumber(html.match(/class="RatingStatistics__rating"[^>]*>\s*([\d.]+)/)?.[1]);
  const at = html.indexOf('data-testid="ratingsCount"');
  const countText = at >= 0 ? stripTags(html.slice(at, at + 300).replace(/^[^>]*>/, "")) : "";
  const count = toNumber(countText.match(/^([\d,]+)/)?.[1]);
  const series = html.match(/href="[^"]*\/series\/[^"]*"[^>]*>\s*([^<]+?)\s*#\s*(\d+(?:\.\d+)?)\s*<\/a>/);
  const genres = [...html.matchAll(/href="[^"]*\/genres\/[^"]*"[^>]*>\s*<span class="Button__labelItem">([^<]+)<\/span>/g)].map((m) =>
    decodeEntities(m[1].trim()),
  );
  const description = html.match(/data-testid="description"[\s\S]*?<span class="Formatted">([\s\S]*?)<\/span>/)?.[1];
  const cover = html.match(/class="BookCover__image"[\s\S]{0,400}?<img[^>]+src="([^"]+)"/)?.[1];
  return {
    title: stripTags(html.match(/data-testid="bookTitle"[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? "") || undefined,
    pageCount: toNumber(html.match(/data-testid="pagesFormat"[^>]*>\s*(\d+)\s*pages/)?.[1]),
    publishedYear: yearFrom(stripTags(html.match(/data-testid="publicationInfo"[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? "")),
    description: htmlToParagraphs(description),
    categories: genres.length ? genres : undefined,
    series: series ? { name: decodeEntities(series[1].trim()), position: Number(series[2]) } : undefined,
    rating: rating && count ? { value: rating, count, source: "goodreads" } : undefined,
    coverUrl: cover,
  };
}

/** Reads a Goodreads book page. Earlier sources win per field; missing fields stay undefined. */
export function parseGoodreadsBook(html: string, pageUrl: string): PartialDetails {
  const ld = jsonLdBook(html);
  const state = apolloState(html);
  const apollo = state ? fromApollo(state, pageUrl) : undefined;
  const declared = ld ? fromJsonLd(ld) : undefined;
  const visible = fromHtml(html);
  const layers = [apollo, declared, visible].filter((l): l is PartialDetails => l !== undefined);

  const merged: PartialDetails = {};
  for (const layer of layers) {
    for (const [k, v] of Object.entries(layer) as [keyof PartialDetails, unknown][]) {
      if (merged[k] === undefined && v !== undefined && !(Array.isArray(v) && v.length === 0)) {
        (merged as Record<string, unknown>)[k] = v;
      }
    }
  }
  // The rating is the one number a reader checks against the site, so take it as the page
  // shows it: the visible text, then the page's declared data, then its app data.
  merged.rating = visible.rating ?? declared?.rating ?? apollo?.rating;
  merged.coverUrl = fullSizeCover(merged.coverUrl);
  merged.url = absolute(pageUrl, pageUrl);
  return merged;
}

function looksLikeBookPage(url: string) {
  return /\/book\/show\//.test(url);
}

async function readPage(url: string): Promise<PartialDetails | null> {
  const { text, url: finalUrl } = await getText(url, { browser: true, timeoutMs: 9000 });
  if (!looksLikeBookPage(finalUrl)) return null;
  const parsed = parseGoodreadsBook(text, finalUrl);
  return parsed.title || parsed.rating ? parsed : null;
}

function matches(hit: GoodreadsSearchHit, title: string, author?: string) {
  const a = normalizeTitle(hit.title);
  const b = normalizeTitle(title);
  const titleOk = a === b || a.startsWith(b) || b.startsWith(a);
  const authorOk = !author || !hit.author || surname(hit.author) === surname(author);
  return titleOk && authorOk;
}

/** Keeps what holds for every edition of the book and drops what belongs to this printing. */
export function workOnly(page: PartialDetails): PartialDetails {
  return { ...page, pageCount: undefined, publisher: undefined, isbn: undefined, description: undefined, coverUrl: undefined, workOnly: true };
}

/** Goodreads serves a placeholder image for books without a cover. */
function realCover(url: string | undefined) {
  return url && !/\/nophoto\//.test(url) ? url : undefined;
}

/**
 * Finds the book's Goodreads page in the wanted language: a given URL first, then a title
 * and author search, then the ISBN redirect, then the ids Open Library links to.
 * Each Goodreads page is one edition, so a page in another language only lends its
 * rating, series, genres and first publication year. Throws only when Goodreads itself failed.
 */
export async function goodreadsLookup(q: {
  url?: string;
  ids?: string[];
  isbn?: string;
  title: string;
  author?: string;
  lang?: EditionLanguage;
}): Promise<PartialDetails | null> {
  const base = endpoints.goodreads;
  let lastError: unknown = null;
  let otherLanguage: PartialDetails | null = null;

  const attempt = async (url: string) => {
    try {
      const page = await readPage(url);
      if (page) page.coverUrl = realCover(page.coverUrl);
      return page;
    } catch (error) {
      if (!(error instanceof HttpError && error.status === 404)) lastError = error;
      return null;
    }
  };
  // A page with no language stated is taken at its word; one in another language is held back.
  const inLanguage = (page: PartialDetails | null) => {
    if (!page) return null;
    if (!q.lang || !page.language || page.language === q.lang) return page;
    otherLanguage ??= page;
    return null;
  };

  if (q.url) {
    const page = await attempt(q.url);
    if (page) return inLanguage(page) ?? workOnly(page);
    if (lastError) throw lastError;
    return null;
  }

  // Search first: it leads to the edition Goodreads itself shows for the book, the one a
  // reader sees there. The ISBN leads to one specific printing, with its own page count.
  let row: PartialDetails | null = null;
  try {
    const query = [q.title, q.author].filter(Boolean).join(" ");
    const { text } = await getText(`${base}/search?q=${encodeURIComponent(query)}&search_type=books`, { browser: true, timeoutMs: 9000 });
    const hit = parseGoodreadsSearch(text, base).find((h) => matches(h, q.title, q.author));
    if (hit) {
      const page = await attempt(hit.url);
      const found = inLanguage(page);
      if (found) return found;
      // The search row alone still carries the rating and cover.
      if (!page) row = { title: hit.title, rating: hit.rating, coverUrl: realCover(hit.coverUrl), url: hit.url, publishedYear: hit.year };
    }
  } catch (error) {
    lastError = error;
  }

  if (q.isbn) {
    const found = inLanguage(await attempt(`${base}/book/isbn/${q.isbn}`));
    if (found) return found;
  }

  if (!otherLanguage) {
    for (const id of q.ids?.slice(0, 2) ?? []) {
      const found = inLanguage(await attempt(`${base}/book/show/${encodeURIComponent(id)}`));
      if (found) return found;
    }
  }

  if (otherLanguage) return workOnly(otherLanguage);
  if (row) return row;
  if (lastError) throw lastError;
  return null;
}
