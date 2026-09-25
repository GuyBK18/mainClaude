import type { Book } from "@/types/reading";
import { normalizeTitle, surname, toIsbn13 } from "@/lib/metadata/text";

/** One book to look up, taken from a pasted list. */
export interface BulkLink {
  url: string;
  /** Set for Goodreads book pages. Two links with the same id are the same book. */
  goodreadsId?: string;
}

// A scheme is optional: links copied from some apps start at "www." or at the domain.
const LINK = /(?:https?:\/\/|www\.|goodreads\.com\/)[^\s<>"'`]+/gi;

export function goodreadsBookId(raw: string | undefined) {
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (!/(^|\.)goodreads\.com$/.test(url.hostname)) return undefined;
    return url.pathname.match(/\/book\/show\/(\d+)/)?.[1];
  } catch {
    return undefined;
  }
}

/**
 * Pulls every link out of pasted text, in order. Text around the links is ignored, so a
 * list copied from notes or a chat works as is. The same Goodreads book twice counts once.
 */
export function parseLinks(text: string): BulkLink[] {
  const seen = new Set<string>();
  const links: BulkLink[] = [];
  for (const [match] of text.matchAll(LINK)) {
    const trimmed = match.replace(/[.,;:!?)\]}>]+$/, "");
    const url = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const goodreadsId = goodreadsBookId(url);
    const key = goodreadsId ? `gr:${goodreadsId}` : url;
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({ url, goodreadsId });
  }
  return links;
}

/** What a looked-up book is matched on against the library. */
export interface BookIdentity {
  title: string;
  author: string;
  isbn?: string;
  goodreadsId?: string;
}

const sameWork = (a: BookIdentity, b: BookIdentity) =>
  normalizeTitle(a.title) !== "" && normalizeTitle(a.title) === normalizeTitle(b.title) && surname(a.author) === surname(b.author);

/**
 * True when two records are the same book: the same Goodreads page, the same ISBN, or the
 * same title by the same author. The last catches another edition of a book already there.
 */
export function sameBook(a: BookIdentity, b: BookIdentity) {
  if (a.goodreadsId && a.goodreadsId === b.goodreadsId) return true;
  const isbn = toIsbn13(a.isbn);
  if (isbn && isbn === toIsbn13(b.isbn)) return true;
  return sameWork(a, b);
}

export function identityOf(book: Book): BookIdentity {
  return { title: book.title, author: book.author, isbn: book.isbn, goodreadsId: goodreadsBookId(book.sourceUrl) };
}

/** The library book this one repeats, if any. */
export function findInLibrary(books: Book[], candidate: BookIdentity) {
  return books.find((book) => sameBook(identityOf(book), candidate));
}

/** Runs `task` over `items` with at most `limit` running at once. Stops starting new ones once aborted. */
export async function runQueue<T>(items: T[], limit: number, task: (item: T) => Promise<void>, signal?: AbortSignal) {
  let next = 0;
  const worker = async () => {
    while (next < items.length && !signal?.aborted) await task(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}
