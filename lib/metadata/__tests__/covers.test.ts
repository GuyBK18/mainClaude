import { afterEach, describe, expect, it, vi } from "vitest";
import { clearCache } from "../http";
import { collectCovers, imageKey, moreCovers } from "../covers";
import type { CoverQuery } from "../types";
import { fakeFetch, html, json } from "./fake-fetch";

afterEach(() => {
  vi.unstubAllGlobals();
  clearCache();
});

const GR_IMG = "compressed.photo.goodreads.com/books/1353467455i/13651";

describe("cover addresses", () => {
  it("treats one image under different hosts and sizes as the same", () => {
    expect(imageKey(`https://i.gr-assets.com/images/S/${GR_IMG}._SY75_.jpg`)).toBe(
      imageKey(`https://images-na.ssl-images-amazon.com/images/S/${GR_IMG}.jpg`),
    );
    expect(imageKey("https://covers.openlibrary.org/b/id/10523447-M.jpg")).toBe(imageKey("https://covers.openlibrary.org/b/id/10523447-L.jpg"));
    expect(imageKey("https://covers.openlibrary.org/b/id/1-L.jpg")).not.toBe(imageKey("https://covers.openlibrary.org/b/id/2-L.jpg"));
  });

  it("keeps the first of each image and skips empty offers", () => {
    const covers = collectCovers([
      { source: "goodreads", url: `https://images-na.ssl-images-amazon.com/images/S/${GR_IMG}.jpg` },
      { source: "goodreads", url: undefined },
      { source: "goodreads", url: `https://i.gr-assets.com/images/S/${GR_IMG}.jpg`, format: "Paperback" },
      { source: "openlibrary", url: "https://covers.openlibrary.org/b/id/1-L.jpg", format: "Hardcover" },
    ]);
    expect(covers).toEqual([
      { source: "goodreads", url: `https://images-na.ssl-images-amazon.com/images/S/${GR_IMG}.jpg` },
      { source: "openlibrary", url: "https://covers.openlibrary.org/b/id/1-L.jpg", format: "Hardcover" },
    ]);
  });
});

describe("more covers", () => {
  const query: CoverQuery = {
    title: "Piranesi",
    author: "Susanna Clarke",
    lang: "en",
    goodreadsWorkId: "1116815",
    openLibraryWork: "/works/OL20812346W",
  };
  const olEditions = JSON.stringify({
    entries: [
      { covers: [111], languages: [{ key: "/languages/eng" }], physical_format: "Hardcover" },
      { covers: [222], languages: [{ key: "/languages/pol" }] },
      { covers: [-1], languages: [{ key: "/languages/eng" }] },
      { covers: [333, 334], languages: [{ key: "/languages/eng" }] },
    ],
  });

  it("reads the next page of every catalog, in the wanted language, and skips what the browser has", async () => {
    const calls = fakeFetch([
      [/goodreads\.com\/work\/editions\/1116815/, html("goodreads-editions.html")],
      [/openlibrary\.org\/works\/OL20812346W\/editions\.json/, { body: olEditions }],
      [/googleapis\.com\/books\/v1\/volumes\?/, json("google-search-piranesi.json")],
    ]);
    const res = await moreCovers(query, 2, [`https://i.gr-assets.com/images/S/${GR_IMG}.jpg`]);

    expect(res.done).toBe(false);
    expect(res.covers.map((c) => [c.source, c.url.split("/").pop()?.split("&")[0], c.format])).toEqual([
      ["openlibrary", "111-L.jpg", "Hardcover"],
      ["googlebooks", "content?id=zvI0EAAAQBAJ", undefined],
      ["goodreads", "7700.jpg", "Mass Market Paperback"],
      ["openlibrary", "333-L.jpg", undefined],
      ["goodreads", "7704.jpg", "Kindle Edition"],
    ]);
    expect(new URL(calls.find((u) => u.includes("/work/editions/"))!).searchParams.get("page")).toBe("2");
    const google = new URL(calls.find((u) => u.includes("googleapis"))!);
    expect(google.searchParams.get("langRestrict")).toBe("en");
    expect(google.searchParams.get("startIndex")).toBe("0");
  });

  it("says when no catalog has anything more", async () => {
    fakeFetch([
      [/goodreads/, { body: "<html><body></body></html>", type: "text/html" }],
      [/openlibrary/, { body: '{"entries":[]}' }],
      [/googleapis/, { body: '{"totalItems":0}' }],
    ]);
    await expect(moreCovers(query, 3, [])).resolves.toEqual({ covers: [], done: true });
  });
});
