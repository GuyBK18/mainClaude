import { afterEach, describe, expect, it, vi } from "vitest";
import { clearCache } from "../http";
import { goodreadsLookup, parseGoodreadsBook, parseGoodreadsSearch } from "../goodreads";
import { fakeFetch, fixture, html } from "./fake-fetch";

const GR = "https://www.goodreads.com";

afterEach(() => {
  vi.unstubAllGlobals();
  clearCache();
});

describe("Goodreads book page", () => {
  it("reads rating, series, genres and details from the page data", () => {
    const d = parseGoodreadsBook(fixture("goodreads-book-full.html"), `${GR}/book/show/13651.The_Dispossessed`);
    expect(d.title).toBe("The Dispossessed");
    expect(d.authors).toEqual(["Ursula K. Le Guin"]);
    expect(d.rating).toEqual({ value: 4.23, count: 131585, source: "goodreads" });
    expect(d.series).toEqual({ name: "Hainish Cycle", position: 6 });
    expect(d.categories?.slice(0, 2)).toEqual(["Science Fiction", "Fiction"]);
    expect(d.pageCount).toBe(387);
    // Original publication (the work), not the 1994 paperback.
    expect(d.publishedYear).toBe(1974);
    expect(d.publisher).toBe("Harper Voyager");
    expect(d.isbn).toBe("9780061054884");
    expect(d.language).toBe("en");
    expect(d.description).toBe("A bleak moon settled by utopian anarchists.\n\nShevek, a brilliant physicist, decides to take action.");
    expect(d.coverUrl).toMatch(/13651\.jpg$/);
  });

  it("takes the rating the page shows when the app data disagrees", () => {
    const page = fixture("goodreads-book-full.html").replace('"averageRating": 4.23, "ratingsCount": 131585', '"averageRating": 3.9, "ratingsCount": 12');
    const d = parseGoodreadsBook(page, `${GR}/book/show/13651.The_Dispossessed`);
    expect(d.rating).toEqual({ value: 4.23, count: 131585, source: "goodreads" });
  });

  it("falls back to the visible HTML when the structured data is missing", () => {
    const d = parseGoodreadsBook(fixture("goodreads-book-htmlonly.html"), `${GR}/book/show/18423.The_Left_Hand_of_Darkness`);
    expect(d.title).toBe("The Left Hand of Darkness");
    expect(d.rating).toEqual({ value: 4.09, count: 245812, source: "goodreads" });
    expect(d.series).toEqual({ name: "Hainish Cycle", position: 4 });
    expect(d.categories).toEqual(["Science Fiction", "Classics", "Fantasy"]);
    expect(d.pageCount).toBe(304);
    expect(d.publishedYear).toBe(1969);
    expect(d.description).toBe("A groundbreaking work of science fiction.\n\nGenly Ai is sent to Winter & its people.");
    // The size token is stripped so the full cover loads.
    expect(d.coverUrl).toBe("https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1488213612i/18423.jpg");
  });
});

describe("Goodreads search page", () => {
  it("reads each row's link, author, rating and cover", () => {
    const hits = parseGoodreadsSearch(fixture("goodreads-search-piranesi.html"), GR);
    expect(hits).toHaveLength(2);
    expect(hits[0]).toMatchObject({
      url: `${GR}/book/show/50202953-piranesi`,
      title: "Piranesi",
      author: "Susanna Clarke",
      year: 2020,
      rating: { value: 4.22, count: 312448, source: "goodreads" },
    });
    expect(hits[0].coverUrl).toMatch(/50202953\.jpg$/);
    expect(hits[1].title).toBe("Piranesi's Prisons");
    expect(hits[1].coverUrl).toMatch(/\/111\.jpg$/);
  });
});

describe("Goodreads lookup", () => {
  it("follows the ISBN redirect when the search finds nothing", async () => {
    const calls = fakeFetch([
      [/\/search\?/, { body: "<html><body>No results</body></html>", type: "text/html" }],
      [/\/book\/isbn\/9780061054884/, html("goodreads-book-full.html", `${GR}/book/show/13651.The_Dispossessed`)],
    ]);
    const d = await goodreadsLookup({ isbn: "9780061054884", title: "The Dispossessed", author: "Ursula K. Le Guin" });
    expect(d?.series?.name).toBe("Hainish Cycle");
    expect(calls).toHaveLength(2);
  });

  it("prefers the edition Goodreads shows for the book over the ISBN's printing", async () => {
    const calls = fakeFetch([
      [/\/search\?/, html("goodreads-search-piranesi.html")],
      [/\/book\/show\/50202953/, html("goodreads-book-full.html", `${GR}/book/show/50202953-piranesi`)],
      [/\/book\/isbn\//, html("goodreads-book-htmlonly.html", `${GR}/book/show/18423.Other_printing`)],
    ]);
    const d = await goodreadsLookup({ isbn: "9781635575637", title: "Piranesi", author: "Susanna Clarke", lang: "en" });
    expect(d?.url).toBe(`${GR}/book/show/50202953-piranesi`);
    expect(d?.pageCount).toBe(387);
    expect(calls.some((u) => u.includes("/book/isbn/"))).toBe(false);
  });

  it("searches by title when the ISBN is unknown, and skips rows by other authors", async () => {
    fakeFetch([
      [/\/book\/isbn\//, { status: 404 }],
      [/\/search\?/, html("goodreads-search-piranesi.html")],
      [/\/book\/show\/50202953/, html("goodreads-book-htmlonly.html", `${GR}/book/show/50202953-piranesi`)],
    ]);
    const d = await goodreadsLookup({ isbn: "9780000000002", title: "Piranesi", author: "Susanna Clarke" });
    expect(d?.url).toBe(`${GR}/book/show/50202953-piranesi`);
  });

  it("uses the search row's rating when the book page cannot be read", async () => {
    fakeFetch([
      [/\/search\?/, html("goodreads-search-piranesi.html")],
      [/\/book\/show\//, { status: 503 }],
    ]);
    const d = await goodreadsLookup({ title: "Piranesi", author: "Susanna Clarke" });
    expect(d?.rating).toEqual({ value: 4.22, count: 312448, source: "goodreads" });
  });

  it("returns null for no match and throws when Goodreads blocks every request", async () => {
    fakeFetch([[/\/search\?/, { body: "<html><body>No results</body></html>", type: "text/html" }]]);
    await expect(goodreadsLookup({ title: "Nothing Like This", author: "Nobody" })).resolves.toBeNull();

    clearCache();
    fakeFetch([[/goodreads/, { status: 403 }]]);
    await expect(goodreadsLookup({ isbn: "9780061054884", title: "The Dispossessed" })).rejects.toThrow(/403/);
  });

  it("skips an edition in another language and goes on to the English one", async () => {
    const calls = fakeFetch([
      [/\/search\?/, html("goodreads-search-piranesi.html")],
      [/\/book\/show\/50202953/, html("goodreads-book-polish.html", `${GR}/book/show/99999.Zloty_syn`)],
      [/\/book\/isbn\//, html("goodreads-book-full.html", `${GR}/book/show/13651.The_Dispossessed`)],
    ]);
    const d = await goodreadsLookup({ isbn: "9780061054884", title: "Piranesi", author: "Susanna Clarke", lang: "en" });
    expect(d?.language).toBe("en");
    expect(d?.workOnly).toBeUndefined();
    expect(d?.coverUrl).toMatch(/13651\.jpg$/);
    expect(calls.some((u) => u.includes("/book/isbn/"))).toBe(true);
  });

  it("keeps only rating, series and genres when Goodreads has just another language's edition", async () => {
    const calls = fakeFetch([
      [/\/book\/isbn\//, html("goodreads-book-polish.html", `${GR}/book/show/99999.Zloty_syn`)],
      [/\/search\?/, { body: "<html><body>No results</body></html>", type: "text/html" }],
    ]);
    const d = await goodreadsLookup({ isbn: "9788365661000", ids: ["99999"], title: "Piranesi", author: "Susanna Clarke", lang: "en" });
    expect(d).toMatchObject({ workOnly: true, language: "pl", rating: { value: 4.51, count: 614661, source: "goodreads" } });
    expect(d?.series?.name).toBe("Hainish Cycle");
    expect(d?.categories?.[0]).toBe("Science Fiction");
    expect(d?.coverUrl).toBeUndefined();
    expect(d?.description).toBeUndefined();
    expect(d?.pageCount).toBeUndefined();
    expect(d?.isbn).toBeUndefined();
    // The Open Library ids are not worth a request once a page for the book was found.
    expect(calls.some((u) => u.includes("/book/show/99999"))).toBe(false);
  });

  it("drops Goodreads' placeholder image for books without a cover", async () => {
    fakeFetch([[/\/book\/isbn\//, html("goodreads-book-nophoto.html", `${GR}/book/show/13651.The_Dispossessed`)]]);
    const d = await goodreadsLookup({ isbn: "9780061054884", title: "The Dispossessed", lang: "en" });
    expect(d?.title).toBe("The Dispossessed");
    expect(d?.coverUrl).toBeUndefined();
  });
});
