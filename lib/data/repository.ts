import type {
  Book,
  BookPatch,
  Highlight,
  NewBook,
  NewHighlight,
  ReadingGoal,
  ReadingSession,
} from "@/types/reading";

/** Everything the app holds, loaded in one read. */
export interface LibrarySnapshot {
  /** Format version, used to run one-time changes on load. Missing on libraries saved before versions existed. */
  version?: number;
  /** When the reader last changed anything (ISO timestamp). Decides which copy is newer: this browser's or the backup's. */
  updatedAt?: string;
  books: Book[];
  highlights: Highlight[];
  sessions: ReadingSession[];
  goals: ReadingGoal[];
}

/** "change" for a change made in this tab, "external" when another tab saved the library. */
export type ChangeCause = "change" | "external";
export type ChangeListener = (snapshot: LibrarySnapshot, cause: ChangeCause) => void;

/**
 * The only contract UI code depends on. Swap the LocalStorage implementation
 * for an API or database client by providing another class with these methods.
 * Every method is async so a network-backed version drops in unchanged.
 */
export interface LibraryRepository {
  load(): Promise<LibrarySnapshot>;

  createBook(input: NewBook): Promise<Book>;
  updateBook(id: string, patch: BookPatch): Promise<Book>;
  deleteBook(id: string): Promise<void>;

  createHighlight(input: NewHighlight): Promise<Highlight>;
  deleteHighlight(id: string): Promise<void>;

  /** Removes every reading day logged for the book. */
  deleteSessions(bookId: string): Promise<void>;

  /** Adds pages to the book's session for that day, creating it if needed. */
  logPages(bookId: string, date: string, pages: number): Promise<ReadingSession | null>;

  setGoal(goal: ReadingGoal): Promise<ReadingGoal>;

  /**
   * Replaces the whole library, as when a backup is loaded. With `change`, it counts as the
   * reader's latest change: it gets a new timestamp and listeners hear about it.
   */
  replace(snapshot: LibrarySnapshot, options?: { change?: boolean }): Promise<LibrarySnapshot>;

  /** Calls `listener` after every save. Returns a function that stops the calls. */
  subscribe(listener: ChangeListener): () => void;
}
