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
  books: Book[];
  highlights: Highlight[];
  sessions: ReadingSession[];
  goals: ReadingGoal[];
}

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

  /** Adds pages to the book's session for that day, creating it if needed. */
  logPages(bookId: string, date: string, pages: number): Promise<ReadingSession | null>;

  setGoal(goal: ReadingGoal): Promise<ReadingGoal>;
}
