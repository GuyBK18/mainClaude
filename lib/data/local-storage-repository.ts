import type { Book, BookPatch, NewBook, NewHighlight, ReadingGoal } from "@/types/reading";
import { today } from "@/lib/dates";
import { slugify, uid } from "@/lib/utils";
import type { ChangeListener, LibraryRepository, LibrarySnapshot } from "./repository";
import { CURRENT_VERSION, emptyLibrary, migrate } from "./migrations";

const STORAGE_KEY = "luminaread:library:v1";

/**
 * Keeps the whole library as one JSON document in localStorage.
 * Falls back to memory when storage is blocked (private windows, previews).
 */
export class LocalStorageRepository implements LibraryRepository {
  private memory: LibrarySnapshot | null = null;
  private listeners = new Set<ChangeListener>();
  private watchingTabs = false;

  private read(): LibrarySnapshot {
    if (this.memory) return this.memory;
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const stored = JSON.parse(raw) as LibrarySnapshot;
        if (stored.version === CURRENT_VERSION) {
          this.memory = stored;
        } else {
          this.write(migrate(stored), false);
        }
        return this.memory!;
      }
    } catch {
      // Unreadable storage. Its text is kept under another key so it can still be recovered by hand.
      try {
        if (raw) window.localStorage.setItem(`${STORAGE_KEY}:unreadable`, raw);
      } catch {
        // Nowhere to keep it.
      }
    }
    this.write(emptyLibrary(), false);
    return this.memory!;
  }

  /**
   * Saves the library. A change the reader made gets a new `updatedAt` and goes to listeners,
   * such as the file backup. Loading, migrating and adopting a backup keep the stamp they had.
   */
  private write(next: LibrarySnapshot, change = true) {
    const saved = change ? { ...next, updatedAt: new Date().toISOString() } : next;
    this.memory = saved;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch {
      // Storage full or blocked. The in-memory copy keeps the session working, and listeners still get it.
    }
    if (change) for (const listener of this.listeners) listener(saved, "change");
  }

  subscribe(listener: ChangeListener) {
    this.listeners.add(listener);
    this.watchOtherTabs();
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** When another tab saves, the copy cached here is stale: drop it, so this tab never writes over theirs. */
  private watchOtherTabs() {
    if (this.watchingTabs || typeof window === "undefined") return;
    this.watchingTabs = true;
    window.addEventListener("storage", (event) => {
      if (event.key !== STORAGE_KEY) return;
      this.memory = null;
      const current = this.read();
      for (const listener of this.listeners) listener(current, "external");
    });
  }

  async replace(snapshot: LibrarySnapshot, options: { change?: boolean } = {}) {
    this.write(snapshot.version === CURRENT_VERSION ? snapshot : migrate(snapshot), options.change ?? false);
    return structuredClone(this.memory!);
  }

  async load() {
    return structuredClone(this.read());
  }

  async createBook(input: NewBook) {
    const data = this.read();
    const base = slugify(input.title) || "book";
    const id = data.books.some((b) => b.id === base) ? `${base}-${uid()}` : base;
    const book: Book = { ...input, id, addedAt: input.addedAt ?? today() };
    this.write({ ...data, books: [book, ...data.books] });
    return book;
  }

  async updateBook(id: string, patch: BookPatch) {
    const data = this.read();
    const current = data.books.find((b) => b.id === id);
    if (!current) throw new Error(`Book ${id} not found`);
    const book = { ...current, ...patch };
    this.write({ ...data, books: data.books.map((b) => (b.id === id ? book : b)) });
    return book;
  }

  async deleteBook(id: string) {
    const data = this.read();
    this.write({
      ...data,
      books: data.books.filter((b) => b.id !== id),
      highlights: data.highlights.filter((h) => h.bookId !== id),
      sessions: data.sessions.filter((s) => s.bookId !== id),
    });
  }

  async createHighlight(input: NewHighlight) {
    const data = this.read();
    const highlight = { ...input, id: uid("hl"), createdAt: new Date().toISOString() };
    this.write({ ...data, highlights: [highlight, ...data.highlights] });
    return highlight;
  }

  async deleteHighlight(id: string) {
    const data = this.read();
    this.write({ ...data, highlights: data.highlights.filter((h) => h.id !== id) });
  }

  async logPages(bookId: string, date: string, pages: number) {
    const data = this.read();
    const existing = data.sessions.find((s) => s.bookId === bookId && s.date === date);
    const total = (existing?.pages ?? 0) + pages;

    // Moving the slider back can cancel out today's reading; drop the empty session.
    if (total <= 0) {
      if (existing) this.write({ ...data, sessions: data.sessions.filter((s) => s !== existing) });
      return null;
    }

    const session = existing ? { ...existing, pages: total } : { id: uid("s"), bookId, date, pages: total };
    const sessions = existing
      ? data.sessions.map((s) => (s === existing ? session : s))
      : [...data.sessions, session];
    this.write({ ...data, sessions });
    return session;
  }

  async setGoal(goal: ReadingGoal) {
    const data = this.read();
    const goals = [...data.goals.filter((g) => g.year !== goal.year), goal];
    this.write({ ...data, goals });
    return goal;
  }
}
