"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Book, BookPatch, NewBook, NewHighlight, ReadingGoal } from "@/types/reading";
import { getRepository, type LibrarySnapshot } from "@/lib/data";
import { startFileBackup, type BackupStatus, type FileBackup } from "@/lib/data/file-backup";
import { today } from "@/lib/dates";

interface LibraryContextValue {
  data: LibrarySnapshot | null;
  addBook: (input: NewBook) => Promise<Book>;
  /**
   * Adds several books with one refresh at the end. Logs no reading: these books were read
   * before, on days the app does not know.
   */
  addBooks: (inputs: NewBook[]) => Promise<Book[]>;
  updateBook: (id: string, patch: BookPatch) => Promise<void>;
  deleteBook: (id: string) => Promise<void>;
  /** Moves the bookmark and logs the page difference as today's reading. */
  setProgress: (id: string, page: number) => Promise<void>;
  addHighlight: (input: NewHighlight) => Promise<void>;
  deleteHighlight: (id: string) => Promise<void>;
  setGoal: (goal: ReadingGoal) => Promise<void>;
  /** The file backup on this computer. */
  backup: BackupStatus;
  /** Replaces the library with one of the backup's daily copies. */
  restoreCopy: (copyId: string) => Promise<void>;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<LibrarySnapshot | null>(null);
  const [backup, setBackup] = useState<BackupStatus>({ state: "starting" });
  const fileBackup = useRef<FileBackup | null>(null);
  const repo = getRepository();

  const refresh = useCallback(async () => setData(await repo.load()), [repo]);

  useEffect(() => {
    // The library shows once the browser and the backup agree, so a newer backup never flashes the old list first.
    const started = startFileBackup(repo, setBackup);
    fileBackup.current = started;
    void started.ready.then(refresh);
    const unsubscribe = repo.subscribe((_, cause) => {
      if (cause === "external") void refresh();
    });
    return () => {
      started.stop();
      unsubscribe();
    };
  }, [repo, refresh]);

  const restoreCopy = useCallback(
    async (copyId: string) => {
      await fileBackup.current?.restore(copyId);
      await refresh();
    },
    [refresh],
  );

  const addBook = useCallback(
    async (input: NewBook) => {
      // Pages read before the book was added were read on days the app cannot know, so none are logged.
      const book = await repo.createBook(input);
      await refresh();
      return book;
    },
    [repo, refresh],
  );

  const addBooks = useCallback(
    async (inputs: NewBook[]) => {
      const books: Book[] = [];
      for (const input of inputs) books.push(await repo.createBook(input));
      await refresh();
      return books;
    },
    [repo, refresh],
  );

  const updateBook = useCallback(
    async (id: string, patch: BookPatch) => {
      await repo.updateBook(id, patch);
      await refresh();
    },
    [repo, refresh],
  );

  const deleteBook = useCallback(
    async (id: string) => {
      await repo.deleteBook(id);
      await refresh();
    },
    [repo, refresh],
  );

  const setProgress = useCallback(
    async (id: string, page: number) => {
      const book = data?.books.find((b) => b.id === id);
      if (!book) return;
      const next = Math.round(Math.min(book.pageCount, Math.max(0, page)));
      const delta = next - book.currentPage;
      if (delta === 0) return;

      const date = today();
      const patch: BookPatch = { currentPage: next };
      if (book.status === "tbr" && next > 0) {
        patch.status = "reading";
        patch.startedAt = date;
      }
      if (next === book.pageCount) {
        patch.status = "completed";
        patch.finishedAt = date;
      } else if (book.status === "completed") {
        patch.status = "reading";
        patch.finishedAt = undefined;
      }

      await repo.updateBook(id, patch);
      await repo.logPages(id, date, delta);
      await refresh();
    },
    [data, repo, refresh],
  );

  const addHighlight = useCallback(
    async (input: NewHighlight) => {
      await repo.createHighlight(input);
      await refresh();
    },
    [repo, refresh],
  );

  const deleteHighlight = useCallback(
    async (id: string) => {
      await repo.deleteHighlight(id);
      await refresh();
    },
    [repo, refresh],
  );

  const setGoal = useCallback(
    async (goal: ReadingGoal) => {
      await repo.setGoal(goal);
      await refresh();
    },
    [repo, refresh],
  );

  const value = useMemo(
    () => ({ data, addBook, addBooks, updateBook, deleteBook, setProgress, addHighlight, deleteHighlight, setGoal, backup, restoreCopy }),
    [data, addBook, addBooks, updateBook, deleteBook, setProgress, addHighlight, deleteHighlight, setGoal, backup, restoreCopy],
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibrary must be used inside <LibraryProvider>");
  return ctx;
}
