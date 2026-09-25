import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearCache } from "../http";
import { searchCatalogs, mergeCandidates } from "../search";
import { getBookDetails, lookupUrl } from "../details";
import { docToCandidate, type SearchDoc } from "../open-library";
import type { BookCandidate } from "../types";
import { fakeFetch, fixture, html, json } from "./fake-fetch";

const GR = "https://www.goodreads.com";
const GR_COVER = "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1353467455i/13651.jpg";
const OL_EDITION_COVER = "https://covers.openlibrary.org/b/id/10523448-L.jpg";
const GOOGLE_COVER = "https://books.google.com/books/content?id=zvI0EAAAQBAJ&printsec=frontcover&img=1&zoom=6&source=gbs_api";

const catalogRoutes = {
  googleSearch: [/googleapis\.com\/books\/v1\/volumes\?/, json("google-search-piranesi.json")] as const,
  googleVolume: [/googleapis\.com\/books\/v1\/volumes\/zvI0EAAAQBAJ/, json("google-volume-piranesi.json")] as const,
  olSearch: [/openlibrary\.org\/search\.json/, json("ol-search-piranesi.json")] as const,
  olWork: [/openlibrary\.org\/works\/OL20812346W\.json/, json("ol-work-piranesi.json")] as const,
};

beforeEach(() => {
  delete process.env.LUMINAREAD_GOODREADS;
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearCache();
});

describe("search", () => {
  it("merges the same book from Google Books and Open Library into one candidate", async () => {
    fakeFetch([catalogRoutes.googleSearch, catalogRoutes.olSearch]);
    const { candidates, notes } = await searchCatalogs("piranesi");
    expect(notes).toEqual([]);

    const piranesi = candidates[0];
    expect(piranesi.title).toBe("Piranesi");
    expect(piranesi.sources).toEqual(["googlebooks", "openlibrary"]);
    // First publication year from Open Library, real edition page count from Google.
    expect(piranesi.year).toBe(2020);
    expect(piranesi.pageCount).toBe(272);
    expect(piranesi.editionCount).toBe(41);
    expect(piranesi.refs).toMatchObject({
      googleId: "zvI0EAAAQBAJ",
      openLibraryWork: "/works/OL20812346W",
      goodreadsIds: ["50202953"],
      openLibraryCover: 10523448,
    });
    // The English edition's cover, not the work's.
    expect(piranesi.coverUrl).toBe("https://covers.openlibrary.org/b/id/10523448-M.jpg");
    expect(piranesi.lang).toBe("en");
    // Open Library's 122 ratings outweigh Google's 41.
    expect(piranesi.rating).toEqual({ value: 4.12, count: 122, source: "openlibrary" });
    // An Open Library rating from one reader is not shown.
    expect(candidates.find((c) => c.subtitle === "The Complete Etchings")?.rating).toBeUndefined();
    expect(candidates).toHaveLength(3);
  });

  it("still answers when one catalog fails, and says which", async () => {
    fakeFetch([[/googleapis/, { status: 429 }], catalogRoutes.olSearch]);
    const { candidates, notes } = await searchCatalogs("piranesi");
    expect(candidates[0].sources).toEqual(["openlibrary"]);
    expect(notes).toEqual(["Google Books rate limited."]);
  });

  it("fails only when every catalog fails", async () => {
    fakeFetch([[/./, new TypeError("fetch failed")]]);
    await expect(searchCatalogs("piranesi")).rejects.toThrow("No catalog answered.");
  });

  it("asks both catalogs for English editions by default", async () => {
    const calls = fakeFetch([catalogRoutes.googleSearch, catalogRoutes.olSearch]);
    const res = await searchCatalogs("piranesi");
    expect(res.lang).toBe("en");
    const google = new URL(calls.find((u) => u.includes("googleapis"))!);
    const ol = new URL(calls.find((u) => u.includes("openlibrary"))!);
    expect(google.searchParams.get("langRestrict")).toBe("en");
    expect(ol.searchParams.get("language")).toBe("eng");
    expect(ol.searchParams.get("lang")).toBe("en");
    expect(ol.searchParams.get("fields")).toContain("editions.isbn");
  });

  it("asks for Hebrew editions when the query is in Hebrew", async () => {
    const calls = fakeFetch([
      [/googleapis/, { body: '{"totalItems":0}' }],
      [/openlibrary/, { body: '{"docs":[]}' }],
    ]);
    const res = await searchCatalogs("פירנזי");
    expect(res.lang).toBe("he");
    expect(new URL(calls.find((u) => u.includes("googleapis"))!).searchParams.get("langRestrict")).toBe("he");
    expect(new URL(calls.find((u) => u.includes("openlibrary"))!).searchParams.get("language")).toBe("heb");
  });

  it("looks an ISBN up as is, without a language filter", async () => {
    const calls = fakeFetch([
      [/googleapis/, { body: '{"totalItems":0}' }],
      [/openlibrary/, { body: '{"docs":[]}' }],
    ]);
    await searchCatalogs("978-1-63557-563-7");
    const google = new URL(calls.find((u) => u.includes("googleapis"))!);
    const ol = new URL(calls.find((u) => u.includes("openlibrary"))!);
    expect(google.searchParams.get("q")).toBe("isbn:9781635575637");
    expect(google.searchParams.has("langRestrict")).toBe(false);
    expect(ol.searchParams.get("isbn")).toBe("9781635575637");
    expect(ol.searchParams.has("language")).toBe(false);
  });

  it("merges by ISBN even when titles differ", () => {
    const a: BookCandidate = { key: "gb:1", title: "Piranesi", authors: ["Susanna Clarke"], isbn: "9781635575637", refs: { googleId: "1" }, sources: ["googlebooks"] };
    const b: BookCandidate = { key: "ol:2", title: "Piranesi (Hardcover)", authors: ["S. Clarke"], isbn: "9781635575637", refs: { openLibraryWork: "/works/2" }, sources: ["openlibrary"] };
    expect(mergeCandidates([[a], [b]])).toHaveLength(1);
  });
});

describe("Open Library editions", () => {
  const work: SearchDoc = {
    key: "/works/OL274505W",
    title: "Cien años de soledad",
    author_name: ["Gabriel García Márquez"],
    first_publish_year: 1967,
    cover_i: 1,
    isbn: ["9788497592208", "9780060883287"],
    publisher: ["Sudamericana", "Harper"],
  };

  it("takes the title, ISBN, publisher and cover of the edition in the wanted language", () => {
    const c = docToCandidate(
      {
        ...work,
        editions: {
          docs: [{ title: "One Hundred Years of Solitude", language: ["eng"], isbn: ["0060883286", "9780060883287"], cover_i: 2, publisher: ["Harper Perennial"] }],
        },
      },
      "en",
    );
    expect(c).toMatchObject({
      title: "One Hundred Years of Solitude",
      isbn: "9780060883287",
      publisher: "Harper Perennial",
      language: "en",
      year: 1967,
      coverUrl: "https://covers.openlibrary.org/b/id/2-M.jpg",
      refs: { openLibraryCover: 2 },
    });
  });

  it("leaves edition fields empty when the edition is in another language", () => {
    const c = docToCandidate({ ...work, editions: { docs: [{ title: "Sto lat samotności", language: ["pol"], isbn: ["9788307033000"], cover_i: 3 }] } }, "en");
    expect(c?.title).toBe("Cien años de soledad");
    expect(c?.isbn).toBeUndefined();
    expect(c?.publisher).toBeUndefined();
    expect(c?.language).toBeUndefined();
    expect(c?.refs.openLibraryCover).toBeUndefined();
  });
});

describe("details", () => {
  const candidate: BookCandidate = {
    key: "gb:zvI0EAAAQBAJ",
    title: "Piranesi",
    authors: ["Susanna Clarke"],
    year: 2020,
    pageCount: 272,
    isbn: "9781635575637",
    refs: { googleId: "zvI0EAAAQBAJ", openLibraryWork: "/works/OL20812346W", goodreadsIds: ["50202953"], openLibraryCover: 10523448 },
    sources: ["googlebooks", "openlibrary"],
    rating: { value: 4.12, count: 122, source: "openlibrary" },
    lang: "en",
  };

  it("combines all catalogs and records where each field came from", async () => {
    const calls = fakeFetch([
      catalogRoutes.googleVolume,
      catalogRoutes.olWork,
      [/goodreads\.com\/book\/show\/50202953/, html("goodreads-book-full.html", `${GR}/book/show/50202953-piranesi`)],
    ]);
    const d = await getBookDetails(candidate);

    expect(d.rating).toEqual({ value: 4.23, count: 131585, source: "goodreads" });
    expect(d.series).toEqual({ name: "Hainish Cycle", position: 6 });
    expect(d.description).toMatch(/^From the New York Times bestselling author/);
    expect(d.pageCount).toBe(387);
    expect(d.publishedYear).toBe(2020);
    expect(d.genres[0]).toBe("Science Fiction");
    expect(d.language).toBe("English");
    // Two covers found online, best first; the typeset one is made in the browser.
    expect(d.covers).toEqual([
      { url: GR_COVER, source: "goodreads" },
      { url: OL_EDITION_COVER, source: "openlibrary" },
    ]);
    expect(d.coverUrl).toBe(GR_COVER);
    expect(d.lang).toBe("en");
    expect(d.sourceUrl).toBe(`${GR}/book/show/50202953-piranesi`);
    expect(d.provenance).toMatchObject({
      rating: "goodreads",
      series: "goodreads",
      description: "googlebooks",
      publisher: "googlebooks",
      publishedYear: "openlibrary",
      genres: "goodreads",
    });
    expect(d.notes).toEqual([]);
    // Wikidata is skipped when Goodreads already named the series.
    expect(calls.some((u) => u.includes("wikidata"))).toBe(false);
  });

  it("falls back to Open Library's rating and Wikidata's series when Goodreads is blocked", async () => {
    fakeFetch([
      catalogRoutes.googleVolume,
      catalogRoutes.olWork,
      [/goodreads\.com/, { status: 403 }],
      [/query\.wikidata\.org\/sparql/, json("wikidata-series.json")],
    ]);
    const d = await getBookDetails(candidate);
    expect(d.rating).toEqual({ value: 4.12, count: 122, source: "openlibrary" });
    expect(d.series).toEqual({ name: "Hainish Cycle", position: 6 });
    expect(d.provenance.series).toBe("wikidata");
    expect(d.covers).toEqual([
      { url: OL_EDITION_COVER, source: "openlibrary" },
      { url: GOOGLE_COVER, source: "googlebooks" },
    ]);
    expect(d.notes).toEqual([
      "Goodreads returned 403.",
      "No Goodreads rating came back, so the rating is the Open Library average.",
    ]);
  });

  it("skips Goodreads entirely when it is turned off", async () => {
    process.env.LUMINAREAD_GOODREADS = "off";
    const calls = fakeFetch([catalogRoutes.googleVolume, catalogRoutes.olWork, [/wikidata/, { body: '{"results":{"bindings":[]}}' }]]);
    const d = await getBookDetails(candidate);
    expect(calls.some((u) => u.includes("goodreads"))).toBe(false);
    expect(d.notes).toEqual([]);
    expect(d.rating?.source).toBe("openlibrary");
  });

  it("strips Open Library's markdown links and source footers from descriptions", async () => {
    fakeFetch([[/googleapis/, { status: 500 }], catalogRoutes.olWork, [/goodreads|wikidata/, { status: 500 }]]);
    const d = await getBookDetails(candidate);
    expect(d.description).toBe("Piranesi lives in the House. Perhaps he always has.\n\nIn his notebooks he records the tides.");
    expect(d.provenance.description).toBe("openlibrary");
  });
});

describe("details in the wanted language", () => {
  const polishVolume = [/googleapis\.com\/books\/v1\/volumes\/PLVOL1/, json("google-volume-piranesi-pl.json")] as const;

  it("reads the English edition when the picked result is a Polish one", async () => {
    const calls = fakeFetch([
      polishVolume,
      [/googleapis\.com\/books\/v1\/volumes\?q=intitle/, json("google-search-piranesi.json")],
      catalogRoutes.googleVolume,
      catalogRoutes.olWork,
      [/goodreads\.com\/search\?/, html("goodreads-search-piranesi.html")],
      [/goodreads\.com\/book\/show\/50202953/, html("goodreads-book-full.html", `${GR}/book/show/50202953-piranesi`)],
    ]);
    const d = await getBookDetails({
      key: "gb:PLVOL1",
      title: "Piranesi",
      authors: ["Susanna Clarke"],
      isbn: "9788366409000",
      publisher: "Wydawnictwo Mag",
      pageCount: 250,
      language: "pl",
      refs: { googleId: "PLVOL1", openLibraryWork: "/works/OL20812346W" },
      sources: ["googlebooks"],
      lang: "en",
    });

    expect(d.language).toBe("English");
    expect(d.description).toMatch(/^From the New York Times bestselling author/);
    expect(d.publisher).toBe("Bloomsbury Publishing USA");
    expect(d.isbn).toBe("9781635575637");
    expect(d.covers.map((c) => c.url)).toEqual([GR_COVER, GOOGLE_COVER]);
    expect(d.covers.some((c) => c.url.includes("PLVOL1"))).toBe(false);
    const titleSearch = new URL(calls.find((u) => u.includes("q=intitle"))!);
    expect(titleSearch.searchParams.get("langRestrict")).toBe("en");
    // The Polish ISBN is never sent to Goodreads.
    expect(calls.some((u) => u.includes("9788366409000"))).toBe(false);
  });

  it("rejects a description whose text is in another language, whatever the catalog claims", async () => {
    const mislabeled = JSON.parse(fixture("google-volume-piranesi-pl.json"));
    mislabeled.volumeInfo.language = "en";
    process.env.LUMINAREAD_GOODREADS = "off";
    fakeFetch([[/volumes\/PLVOL1/, { body: JSON.stringify(mislabeled) }], catalogRoutes.olWork, [/wikidata/, { status: 500 }]]);
    const d = await getBookDetails({
      key: "gb:PLVOL1",
      title: "Piranesi",
      authors: ["Susanna Clarke"],
      refs: { googleId: "PLVOL1", openLibraryWork: "/works/OL20812346W" },
      sources: ["googlebooks"],
      lang: "en",
    });
    expect(d.provenance.description).toBe("openlibrary");
    expect(d.description).toMatch(/^Piranesi lives in the House/);
  });

  it("says so when no catalog has an English description", async () => {
    process.env.LUMINAREAD_GOODREADS = "off";
    fakeFetch([polishVolume, [/volumes\?q=/, { body: '{"totalItems":0}' }], [/openlibrary|wikidata/, { status: 500 }]]);
    const d = await getBookDetails({
      key: "gb:PLVOL1",
      title: "Piranesi",
      authors: ["Susanna Clarke"],
      refs: { googleId: "PLVOL1" },
      sources: ["googlebooks"],
      language: "pl",
      lang: "en",
    });
    expect(d.description).toBeUndefined();
    expect(d.covers).toEqual([]);
    expect(d.notes).toContain("No catalog had a description in English, so the description is empty.");
  });

  it("falls back to an English description for a Hebrew edition, and keeps English covers out", async () => {
    process.env.LUMINAREAD_GOODREADS = "off";
    fakeFetch([[/googleapis/, { body: '{"totalItems":0}' }], catalogRoutes.olWork, [/wikidata/, { status: 500 }]]);
    const d = await getBookDetails({
      key: "ol:/works/OL20812346W",
      title: "פירנזי",
      authors: ["סוזנה קלארק"],
      refs: { openLibraryWork: "/works/OL20812346W" },
      sources: ["openlibrary"],
      lang: "he",
    });
    expect(d.language).toBe("Hebrew");
    expect(d.description).toMatch(/^Piranesi lives in the House/);
    expect(d.notes).toContain("No catalog had a Hebrew description, so the description is in English.");
    // The work's own cover is the English original's.
    expect(d.covers).toEqual([]);
  });
});

describe("URL import", () => {
  it("loads a Goodreads book page and enriches it by ISBN", async () => {
    const calls = fakeFetch([
      [/goodreads\.com\/book\/show\/13651/, html("goodreads-book-full.html", `${GR}/book/show/13651.The_Dispossessed`)],
      [/googleapis\.com\/books\/v1\/volumes\?q=isbn/, { body: '{"totalItems":0}' }],
      [/openlibrary\.org\/search\.json/, { body: '{"docs":[]}' }],
    ]);
    const res = await lookupUrl(`${GR}/book/show/13651.The_Dispossessed?ref=nav`);
    expect("details" in res && res.details.title).toBe("The Dispossessed");
    expect("details" in res && res.details.rating?.source).toBe("goodreads");
    expect(calls.some((u) => decodeURIComponent(u).includes("isbn:9780061054884"))).toBe(true);
  });

  it("searches the ISBN in an Amazon link", async () => {
    const calls = fakeFetch([catalogRoutes.googleSearch, catalogRoutes.olSearch]);
    const res = await lookupUrl("https://www.amazon.com/Left-Hand-Darkness-Ursula-Guin/dp/0441478123");
    expect(calls.some((u) => decodeURIComponent(u).includes("isbn:9780441478125"))).toBe(true);
    expect("candidates" in res).toBe(true);
  });

  it("turns any other link into a title search", async () => {
    const calls = fakeFetch([catalogRoutes.googleSearch, catalogRoutes.olSearch]);
    const res = await lookupUrl("https://www.example-books.com/p/piranesi-susanna-clarke");
    expect("candidates" in res && res.candidates[0].title).toBe("Piranesi");
    expect(calls[0]).toContain("piranesi");
  });
});
