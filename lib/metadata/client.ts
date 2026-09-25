import type { BookCandidate, CoverQuery, LookupResponse, MoreCoversResponse, SearchResponse } from "./types";

async function readJson<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? "The lookup failed.");
  return body;
}

export async function searchBooks(query: string, signal?: AbortSignal) {
  const res = await fetch(`/api/books/search?q=${encodeURIComponent(query)}`, { signal });
  return readJson<SearchResponse>(res);
}

export async function fetchDetails(body: { candidate: BookCandidate } | { url: string }, signal?: AbortSignal) {
  const res = await fetch("/api/books/details", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  return readJson<LookupResponse>(res);
}

export async function fetchMoreCovers(query: CoverQuery, page: number, known: string[], signal?: AbortSignal) {
  const res = await fetch("/api/books/covers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, page, known }),
    signal,
  });
  return readJson<MoreCoversResponse>(res);
}

/** Same-origin URL for a remote cover, so canvas can read its pixels. */
export function proxiedCover(url: string) {
  return `/api/cover?url=${encodeURIComponent(url)}`;
}
