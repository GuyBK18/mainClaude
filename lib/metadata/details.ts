import type {
  BookCandidate,
  BookDetails,
  DetailField,
  EditionLanguage,
  LookupResponse,
  PartialDetails,
  PublicRating,
  SourceId,
} from "./types";
import { SOURCE_LABEL } from "./types";
import { describeFailure, endpoints, goodreadsEnabled } from "./http";
import { googleFind, googleVolume } from "./google-books";
import { coverUrl as openLibraryCover, editionIn, openLibraryByIsbn, openLibraryWork } from "./open-library";
import { goodreadsEditionCovers, goodreadsLookup, readGoodreadsLink, workOnly } from "./goodreads";
import { collectCovers } from "./covers";
import { wikidataSeries } from "./wikidata";
import { mapGenres } from "./genres";
import { searchCatalogs } from "./search";
import { cleanIsbn, languageName, textLanguage, toIsbn13 } from "./text";

type Offer<T> = [SourceId | undefined, T | undefined];

// Google and Open Library ratings rest on few voters; below this they mislead more than they help.
const MIN_FALLBACK_RATINGS = 5;

/** The candidate's own values came from whichever catalog found it first. */
function candidateSource(c: BookCandidate, prefer: SourceId): SourceId | undefined {
  return c.sources.includes(prefer) ? prefer : c.sources[0];
}

/** A record for an edition in another language keeps only what every edition shares. */
function inLanguage(p: PartialDetails | undefined, lang: EditionLanguage) {
  if (!p || p.workOnly || !p.language || p.language === lang) return p;
  return workOnly(p);
}

const sameEdition = (p: PartialDetails | undefined) => (p && !p.workOnly ? p.url : undefined);

/** Descriptions are checked by their text too: catalogs mislabel editions more often than you would think. */
function descriptionIn(p: PartialDetails | undefined, lang: EditionLanguage | "en") {
  const text = p?.description;
  if (!text) return undefined;
  const reads = textLanguage(text);
  return reads === lang || (reads === undefined && (!p.language || p.language === lang)) ? text : undefined;
}

export async function getBookDetails(c: BookCandidate): Promise<BookDetails> {
  const lang: EditionLanguage = c.lang ?? "en";
  const notes: string[] = [];
  const author = c.authors[0];
  // A result that is itself another language's edition still names the book, but its ISBN,
  // publisher and page count belong to that edition.
  const sameLanguage = !c.language || c.language === lang;
  const isbnHint = sameLanguage ? c.isbn : undefined;

  const googleTask = (async () => {
    const volume = c.refs.googleId ? await googleVolume(c.refs.googleId) : null;
    if (volume && (!volume.language || volume.language === lang)) return volume;
    return (await googleFind({ isbn: isbnHint, title: c.title, author, lang })) ?? volume;
  })();
  const olTask = c.refs.openLibraryWork
    ? openLibraryWork(c.refs.openLibraryWork).then((details) => ({ details, cover: c.refs.openLibraryCover, workKey: c.refs.openLibraryWork }))
    : isbnHint
      ? openLibraryByIsbn(isbnHint).then((r) => r && { details: r.details, cover: editionIn(r.doc, lang)?.cover_i, workKey: r.doc.key })
      : Promise.resolve(null);
  const grTask = goodreadsEnabled()
    ? goodreadsLookup({ url: c.refs.goodreadsUrl, ids: c.refs.goodreadsIds, isbn: isbnHint, title: c.title, author, lang })
    : Promise.resolve(null);

  const [g, o, r] = await Promise.allSettled([googleTask, olTask, grTask]);
  const settle = <T,>(result: PromiseSettledResult<T | null>, source: SourceId) => {
    if (result.status === "fulfilled") return result.value ?? undefined;
    notes.push(`${SOURCE_LABEL[source]} ${describeFailure(result.reason)}.`);
    return undefined;
  };
  const googleAny = settle(g, "googlebooks");
  const olResult = settle(o, "openlibrary");
  const grAny = settle(r, "goodreads");
  if (goodreadsEnabled() && r.status === "fulfilled" && !r.value) notes.push("Goodreads has no page that matches this book.");

  const google = inLanguage(googleAny, lang);
  const gr = inLanguage(grAny, lang);
  const ol = olResult?.details;
  const wanted = languageName(lang)!;
  if (grAny?.workOnly && grAny.language) {
    const other = languageName(grAny.language) ?? "another language";
    notes.push(`Goodreads only had the ${other} edition, so its cover, pages and description were not used.`);
  }

  // The editions list gives covers of other printings; it runs alongside the series lookup.
  const editionsTask =
    grAny?.workId && goodreadsEnabled() ? goodreadsEditionCovers(grAny.workId, lang).catch(() => []) : Promise.resolve([]);

  let series = gr?.series;
  let seriesSource: SourceId | undefined = series ? "goodreads" : undefined;
  if (!series) {
    try {
      series = await wikidataSeries(c.title, author);
      if (series) seriesSource = "wikidata";
    } catch (error) {
      notes.push(`Wikidata ${describeFailure(error)}, so a series may be missing.`);
    }
  }
  const editions = await editionsTask;

  const provenance: BookDetails["provenance"] = {};
  // A Goodreads page the reader pasted is their own pick: it wins every field it has, and
  // the other catalogs only fill what it lacks.
  const readerPicked = Boolean(c.refs.goodreadsUrl);
  const goodreadsFirst = <T,>(offers: Offer<T>[]) =>
    readerPicked ? [...offers.filter(([s]) => s === "goodreads"), ...offers.filter(([s]) => s !== "goodreads")] : offers;
  const pick = <T,>(field: DetailField, offers: Offer<T>[]): T | undefined => {
    const hit = goodreadsFirst(offers).find(([source, value]) => source && value !== undefined && value !== null && value !== "");
    if (hit) provenance[field] = hit[0];
    return hit?.[1];
  };

  const fromCandidate = <K extends keyof BookCandidate>(key: K, prefer: SourceId): Offer<BookCandidate[K]> => [
    candidateSource(c, prefer),
    c[key],
  ];
  const fromEdition = <K extends "pageCount" | "publisher" | "isbn">(key: K, prefer: SourceId): Offer<BookCandidate[K]> =>
    sameLanguage ? fromCandidate(key, prefer) : [undefined, undefined];

  const pageCount = pick("pageCount", [
    ["goodreads", gr?.pageCount],
    ["googlebooks", google?.pageCount],
    fromEdition("pageCount", "googlebooks"),
    ["openlibrary", ol?.pageCount],
  ]);
  const publishedYear = pick("publishedYear", [
    // Open Library and Goodreads both report first publication; Google reports the edition.
    ["openlibrary", c.sources.includes("openlibrary") ? c.year : ol?.publishedYear],
    ["goodreads", grAny?.publishedYear],
    ["googlebooks", googleAny?.publishedYear],
    fromCandidate("year", "googlebooks"),
  ]);
  const publisher = pick("publisher", [
    ["googlebooks", google?.publisher],
    ["goodreads", gr?.publisher],
    fromEdition("publisher", "googlebooks"),
  ]);
  const isbn = pick("isbn", [fromEdition("isbn", "googlebooks"), ["googlebooks", google?.isbn], ["goodreads", gr?.isbn]]);

  const descriptions: Offer<string>[] = [
    ["googlebooks", descriptionIn(googleAny, lang)],
    ["goodreads", descriptionIn(grAny, lang)],
    ["openlibrary", descriptionIn(ol, lang)],
  ];
  let description = pick("description", descriptions);
  if (!description && lang === "he") {
    // Few Hebrew editions carry a description; an English one beats none.
    description = pick("description", [
      ["googlebooks", descriptionIn(googleAny, "en")],
      ["goodreads", descriptionIn(grAny, "en")],
      ["openlibrary", descriptionIn(ol, "en")],
    ]);
    if (description) notes.push("No catalog had a Hebrew description, so the description is in English.");
  } else if (!description && [googleAny, grAny, ol].some((p) => p?.description)) {
    notes.push(`No catalog had a description in ${wanted}, so the description is empty.`);
  }

  const enough = (rating: PublicRating | undefined) => (rating && rating.count >= MIN_FALLBACK_RATINGS ? rating : undefined);
  const rating = pick("rating", [
    // A Goodreads rating covers every edition, so a page in another language still counts.
    ["goodreads", grAny?.rating],
    ["openlibrary", enough(ol?.rating ?? (c.rating?.source === "openlibrary" ? c.rating : undefined))],
    ["googlebooks", enough(googleAny?.rating ?? (c.rating?.source === "googlebooks" ? c.rating : undefined))],
  ]);

  // Covers of editions in the wanted language, best image first. The work's own cover is
  // usually the original edition's, so it is a last resort and only for English.
  const covers = collectCovers([
    { source: "goodreads", url: gr?.coverUrl },
    ...editions.map((e) => ({ source: "goodreads" as const, url: e.coverUrl, format: e.format })),
    { source: "openlibrary", url: openLibraryCover(olResult?.cover, "L") },
    { source: "googlebooks", url: google?.coverUrl },
    ...(lang === "en" ? [ol?.coverUrl, ...(ol?.moreCovers ?? [])].map((url) => ({ source: "openlibrary" as const, url })) : []),
  ]);
  if (covers[0]) provenance.coverUrl = covers[0].source;
  if (series && seriesSource) provenance.series = seriesSource;

  const allGenreSources = [
    { source: "goodreads" as const, labels: grAny?.categories ?? [], weight: 5 },
    { source: "googlebooks" as const, labels: googleAny?.categories ?? [], weight: 2 },
    { source: "openlibrary" as const, labels: ol?.categories ?? [], weight: 1 },
  ];
  const genreSources = readerPicked && grAny?.categories?.length ? allGenreSources.slice(0, 1) : allGenreSources;
  const genres = mapGenres(genreSources);
  const genreSource = genreSources.find((s) => s.labels.length)?.source;
  if (genres.length && genreSource) provenance.genres = genreSource;

  if (goodreadsEnabled() && rating && rating.source !== "goodreads") {
    notes.push(`No Goodreads rating came back, so the rating is the ${SOURCE_LABEL[rating.source]} average.`);
  }

  return {
    title: c.title,
    subtitle: c.subtitle,
    author: c.authors.slice(0, 2).join(" & ") || grAny?.authors?.[0] || googleAny?.authors?.[0] || "",
    pageCount,
    publishedYear,
    publisher,
    isbn,
    language: wanted,
    description,
    genres,
    series,
    rating,
    coverUrl: covers[0]?.url,
    covers,
    lang,
    coverQuery: {
      title: c.title,
      author: c.authors[0] ?? grAny?.authors?.[0] ?? "",
      lang,
      goodreadsWorkId: grAny?.workId,
      openLibraryWork: c.refs.openLibraryWork ?? olResult?.workKey,
    },
    // Link to the edition in the wanted language when there is one.
    sourceUrl: sameEdition(gr) ?? sameEdition(google) ?? grAny?.url ?? ol?.url ?? googleAny?.url,
    provenance,
    notes,
  };
}

/** An ISBN standing alone as a path segment: Open Library /isbn/…, Amazon /dp/…, and similar. */
function isbnInPath(url: URL) {
  const segment = url.pathname.split("/").find((s) => /^(97[89])?\d{9}[\dX]$/i.test(s));
  return segment ? toIsbn13(cleanIsbn(segment)) : undefined;
}

function titleFromSlug(url: URL) {
  const segments = url.pathname.split("/").filter(Boolean);
  const dp = segments.indexOf("dp");
  let slug = dp > 0 ? segments[dp - 1] : (segments[segments.length - 1] ?? "");
  slug = decodeURIComponent(slug)
    .replace(/^\d+[.-]?/, "")
    .replace(/\.[a-z]+$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
  return slug || undefined;
}

async function detailsOrChoices(query: string): Promise<LookupResponse> {
  const found = await searchCatalogs(query);
  if (found.candidates.length === 1) return { details: await getBookDetails(found.candidates[0]) };
  return found;
}

/**
 * Resolves a pasted link. Goodreads book pages and links carrying an ISBN resolve to one
 * book; anything else is searched by the title in its address and returned as choices.
 * A Goodreads page that cannot be read is searched by title too, with a note that says why.
 */
export async function lookupUrl(raw: string): Promise<LookupResponse> {
  const url = new URL(raw.trim());
  let problem: string | undefined;

  if (goodreadsEnabled() && /(^|\.)goodreads\.com$/.test(url.hostname) && /\/book\/show\//.test(url.pathname)) {
    // Read from Goodreads' own address, whichever form of it was pasted (goodreads.com, m.goodreads.com).
    const pageUrl = `${endpoints.goodreads}${url.pathname}`;
    let page: PartialDetails | undefined;
    try {
      const read = await readGoodreadsLink(pageUrl);
      if ("page" in read) page = read.page;
      else problem = read.problem;
    } catch (error) {
      problem = `Goodreads ${describeFailure(error)}.`;
    }
    if (page?.title) {
      // The pasted page decides the language: Hebrew stays Hebrew, anything else is read in English.
      const lang: EditionLanguage = page.language === "he" ? "he" : "en";
      return {
        details: await getBookDetails({
          key: `gr:${url.pathname}`,
          title: page.title,
          authors: page.authors ?? [],
          isbn: page.language === lang ? page.isbn : undefined,
          refs: { goodreadsUrl: pageUrl },
          sources: ["goodreads"],
          lang,
        }),
      };
    }
    problem ??= "Goodreads sent the book page without the book's title.";
  }

  const isbn = isbnInPath(url);
  if (isbn) return detailsOrChoices(isbn);

  const title = titleFromSlug(url);
  if (!title) throw new Error(problem ?? "That link does not name a book.");
  return { ...(await searchCatalogs(title)), notes: problem ? [problem] : [] };
}
