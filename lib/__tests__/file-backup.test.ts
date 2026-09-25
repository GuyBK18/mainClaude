import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Book, NewBook } from "@/types/reading";
import type { LibrarySnapshot } from "@/lib/data/repository";
import { LocalStorageRepository } from "@/lib/data/local-storage-repository";
import { startFileBackup, type BackupStatus } from "@/lib/data/file-backup";
import { emptyLibrary } from "@/lib/data/migrations";

const KEY = "luminaread:library:v1";
let storage: Map<string, string>;
let file: LibrarySnapshot | null;
let puts: { body: LibrarySnapshot; restore: boolean }[];
let failRead: boolean;
let holdRead: Promise<void> | null;

beforeEach(() => {
  storage = new Map();
  file = null;
  puts = [];
  failRead = false;
  holdRead = null;
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => void storage.set(k, v),
    },
    addEventListener: () => {},
  });
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
    if (init?.method === "PUT") {
      const body = JSON.parse(String(init.body)) as LibrarySnapshot;
      puts.push({ body, restore: url.includes("restore=1") });
      const created = file === null;
      file = body;
      return reply({ where: "iCloud Drive/LuminaRead", created, savedAt: "now" });
    }
    if (url.startsWith("/api/library/copies")) return reply({ library: { ...emptyLibrary(), books: [book("from-copy")] } });
    if (failRead) return reply({ error: "disk is gone" }, 500);
    if (holdRead) await holdRead;
    return reply({ where: "iCloud Drive/LuminaRead", library: file });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const book = (id: string): Book => ({
  id,
  title: id,
  author: "Someone",
  genres: ["Fantasy"],
  pageCount: 100,
  currentPage: 0,
  format: "paperback",
  status: "tbr",
  personalRating: null,
  goodreadsRating: null,
  cover: { palette: ["#000", "#fff", "#888"], style: "band" },
  addedAt: "2026-09-01",
  review: "",
  summary: "",
});

const newBook = (title: string): NewBook => ({ ...book(title), id: undefined }) as NewBook;

const settle = () => new Promise((r) => setTimeout(r, 500));

function start() {
  const repo = new LocalStorageRepository();
  const statuses: BackupStatus[] = [];
  const backup = startFileBackup(repo, (s) => statuses.push(s));
  return { repo, backup, statuses };
}

describe("file backup", () => {
  it("makes this browser's library the first backup", async () => {
    storage.set(KEY, JSON.stringify({ ...emptyLibrary(), updatedAt: undefined, books: [book("red-rising")] }));
    const { backup } = start();
    await backup.ready;
    await settle();
    expect(puts).toHaveLength(1);
    expect(puts[0].body.books.map((b) => b.id)).toEqual(["red-rising"]);
    expect(puts[0].body.updatedAt).toBeTruthy();
  });

  it("fills an empty browser from the backup without writing anything back", async () => {
    file = { ...emptyLibrary(), updatedAt: "2026-09-25T10:00:00.000Z", books: [book("dune")] };
    const { repo, backup } = start();
    await backup.ready;
    await settle();
    expect((await repo.load()).books.map((b) => b.id)).toEqual(["dune"]);
    expect(puts).toHaveLength(0);
  });

  it("takes a newer backup over an older browser copy", async () => {
    storage.set(KEY, JSON.stringify({ ...emptyLibrary(), updatedAt: "2026-09-20T10:00:00.000Z", books: [book("old")] }));
    file = { ...emptyLibrary(), updatedAt: "2026-09-25T10:00:00.000Z", books: [book("new")] };
    const { repo, backup } = start();
    await backup.ready;
    expect((await repo.load()).books.map((b) => b.id)).toEqual(["new"]);
  });

  it("sends changes the backup missed", async () => {
    storage.set(KEY, JSON.stringify({ ...emptyLibrary(), updatedAt: "2026-09-25T12:00:00.000Z", books: [book("newer")] }));
    file = { ...emptyLibrary(), updatedAt: "2026-09-25T10:00:00.000Z", books: [] };
    const { backup } = start();
    await backup.ready;
    await settle();
    expect(puts.map((p) => p.body.books.length)).toEqual([1]);
  });

  it("merges a library from before backups into an existing backup", async () => {
    storage.set(KEY, JSON.stringify({ ...emptyLibrary(), updatedAt: undefined, books: [book("mine"), book("both")] }));
    file = { ...emptyLibrary(), updatedAt: "2026-09-25T10:00:00.000Z", books: [book("both"), book("theirs")] };
    const { repo, backup } = start();
    await backup.ready;
    await settle();
    expect((await repo.load()).books.map((b) => b.id)).toEqual(["both", "theirs", "mine"]);
    expect(puts).toHaveLength(1);
  });

  it("keeps a book added while the backup was still loading", async () => {
    file = { ...emptyLibrary(), updatedAt: "2026-09-25T10:00:00.000Z", books: [book("dune"), book("emma")] };
    let release = () => {};
    holdRead = new Promise((r) => (release = r));
    const { repo, backup } = start();
    await repo.createBook(newBook("Piranesi"));
    release();
    await backup.ready;
    await settle();
    expect((await repo.load()).books.map((b) => b.id).sort()).toEqual(["dune", "emma", "piranesi"]);
    expect(puts.map((p) => p.body.books.length)).toEqual([3]);
  });

  it("sends every change after the start", async () => {
    const { repo, backup } = start();
    await backup.ready;
    await repo.createBook(newBook("Piranesi"));
    await repo.createBook(newBook("Dune"));
    await settle();
    // Two quick changes go out as one save.
    expect(puts.map((p) => p.body.books.length)).toEqual([2]);
  });

  it("never writes when the backup could not be read", async () => {
    failRead = true;
    const { repo, backup, statuses } = start();
    await backup.ready;
    await repo.createBook(newBook("Piranesi"));
    await settle();
    expect(puts).toHaveLength(0);
    expect(statuses.at(-1)).toMatchObject({ state: "failed", error: "disk is gone" });
  });

  it("restores a copy and marks the save as a restore", async () => {
    storage.set(KEY, JSON.stringify({ ...emptyLibrary(), updatedAt: "2026-09-25T10:00:00.000Z", books: [book("current")] }));
    file = { ...emptyLibrary(), updatedAt: "2026-09-25T10:00:00.000Z", books: [book("current")] };
    const { repo, backup } = start();
    await backup.ready;
    await backup.restore("2026-09-24");
    await settle();
    expect((await repo.load()).books.map((b) => b.id)).toEqual(["from-copy"]);
    expect(puts).toMatchObject([{ restore: true }]);
  });
});
