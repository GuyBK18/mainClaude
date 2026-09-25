import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { LibrarySnapshot } from "@/lib/data/repository";
import { listCopies, readCopy, readLibrary, writeLibrary } from "@/lib/backup/store";

let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "luminaread-"));
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

const library = (books: number, updatedAt = "2026-09-25T10:00:00.000Z"): LibrarySnapshot => ({
  version: 2,
  updatedAt,
  books: Array.from({ length: books }, (_, i) => ({ id: `b${i}`, title: `Book ${i}` }) as LibrarySnapshot["books"][number]),
  highlights: [],
  sessions: [],
  goals: [],
});

const day = (d: string) => new Date(`${d}T12:00:00`);

describe("backup store", () => {
  it("has nothing to read before the first save", async () => {
    expect(await readLibrary(dir)).toBeNull();
    expect(await listCopies(dir)).toEqual([]);
  });

  it("saves the library and a copy for the day, and says when the file is new", async () => {
    expect(await writeLibrary(dir, library(2), { now: day("2026-09-24") })).toEqual({ created: true });
    expect(await writeLibrary(dir, library(3), { now: day("2026-09-24") })).toEqual({ created: false });
    expect((await readLibrary(dir))?.books).toHaveLength(3);
    const copies = await listCopies(dir);
    expect(copies.map((c) => [c.id, c.books])).toEqual([["2026-09-24", 3]]);
  });

  it("keeps the library a restore replaces", async () => {
    await writeLibrary(dir, library(5), { now: day("2026-09-24") });
    await writeLibrary(dir, library(1), { now: day("2026-09-25"), restore: true });
    const copies = await listCopies(dir);
    expect(copies.map((c) => [c.id, c.books])).toEqual([
      ["2026-09-25", 1],
      ["2026-09-25-before-restore", 5],
      ["2026-09-24", 5],
    ]);
    expect((await readCopy(dir, "2026-09-25-before-restore")).books).toHaveLength(5);
  });

  it("keeps thirty days of copies", async () => {
    for (let i = 1; i <= 35; i++) await writeLibrary(dir, library(i), { now: new Date(2026, 7, i, 12) });
    const copies = await listCopies(dir);
    expect(copies).toHaveLength(30);
    expect(copies[0].date).toBe("2026-09-04");
    expect(copies.at(-1)?.date).toBe("2026-08-06");
  });

  it("refuses copy ids that are not dates", async () => {
    await expect(readCopy(dir, "../library")).rejects.toThrow("No such copy.");
  });

  it("explains a file iCloud has not downloaded yet", async () => {
    await fs.writeFile(path.join(dir, ".library.json.icloud"), "");
    await expect(readLibrary(dir)).rejects.toThrow(/not downloaded/);
  });

  it("refuses a file that is not a library", async () => {
    await fs.writeFile(path.join(dir, "library.json"), JSON.stringify({ hello: "world" }));
    await expect(readLibrary(dir)).rejects.toThrow(/not a LuminaRead library/);
  });
});
