import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearCache } from "../http";
import { searchCatalogs, mergeCandidates } from "../search";
import { getBookDetails, lookupUrl } from "../details";
import type { BookCandidate } from "../types";
import { fakeFetch, html, json } from "./fake-fetch";

const GR = "https://www.goodreads.com";

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
    expect(piranesi.refs).toMatchObject({ googleId: "zvI0EAAAQBAJ", openLibraryWork: "/works/OL20812346W", goodreadsIds: ["50202953"] });
    expect(piranesi.coverUrl).toBe("https://covers.openlibrary.org/b/id/10523447-M.jpg");
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

  it("merges by ISBN even when titles differ", () => {
    const a: BookCandidate = { key: "gb:1", title: "Piranesi", authors: ["Susanna Clarke"], isbn: "9781635575637", refs: { googleId: "1" }, sources: ["googlebooks"] };
    const b: BookCandidate = { key: "ol:2", title: "Piranesi (Hardcover)", authors: ["S. Clarke"], isbn: "9781635575637", refs: { openLibraryWork: "/works/2" }, sources: ["openlibrary"] };
    expect(mergeCandidates([[a], [b]])).toHaveLength(1);
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
    refs: { googleId: "zvI0EAAAQBAJ", openLibraryWork: "/works/OL20812346W", goodreadsIds: ["50202953"] },
    sources: ["googlebooks", "openlibrary"],
    rating: { value: 4.12, count: 122, source: "openlibrary" },
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
    expect(d.coverUrl).toMatch(/goodreads\.com\/books\/1353467455i\/13651\.jpg$/);
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
    expect(d.coverUrl).toBe("https://covers.openlibrary.org/b/id/10523447-L.jpg");
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
