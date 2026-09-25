/**
 * Server-side HTTP for the catalog clients: timeouts, a small in-memory cache,
 * and base URLs that can be pointed at a local mock through environment variables.
 */

// Getters so a test or a mock setup can change the environment after import.
export const endpoints = {
  get googleBooks() {
    return process.env.GOOGLE_BOOKS_API ?? "https://www.googleapis.com/books/v1";
  },
  get openLibrary() {
    return process.env.OPEN_LIBRARY_BASE ?? "https://openlibrary.org";
  },
  get openLibraryCovers() {
    return process.env.OPEN_LIBRARY_COVERS ?? "https://covers.openlibrary.org";
  },
  get goodreads() {
    return process.env.GOODREADS_BASE ?? "https://www.goodreads.com";
  },
  get wikidataSparql() {
    return process.env.WIKIDATA_SPARQL ?? "https://query.wikidata.org/sparql";
  },
};

export const googleBooksKey = () => process.env.GOOGLE_BOOKS_API_KEY;
export const goodreadsEnabled = () => process.env.LUMINAREAD_GOODREADS !== "off";

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
// Wikimedia asks API clients to identify themselves.
export const TOOL_UA = "LuminaRead/0.1 (personal reading journal; local use)";

const TTL_MS = 30 * 60 * 1000;
const MAX_ENTRIES = 300;
const cache = new Map<string, { at: number; value: unknown }>();

function remember<T>(key: string, value: T) {
  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value!);
  cache.set(key, { at: Date.now(), value });
  return value;
}

function recall<T>(key: string): T | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return hit.value as T;
}

export function clearCache() {
  cache.clear();
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public url: string,
  ) {
    super(`HTTP ${status} for ${url}`);
  }
}

interface FetchOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
  /** Send a desktop browser user agent. Goodreads serves bots a different page. */
  browser?: boolean;
}

async function request(url: string, { timeoutMs = 8000, headers = {}, browser = false }: FetchOptions) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    redirect: "follow",
    headers: {
      "User-Agent": browser ? BROWSER_UA : TOOL_UA,
      "Accept-Language": "en-US,en;q=0.9",
      ...headers,
    },
  });
  if (!res.ok) throw new HttpError(res.status, url);
  return res;
}

export async function getJSON<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const cached = recall<T>(url);
  if (cached !== undefined) return cached;
  const res = await request(url, { ...options, headers: { Accept: "application/json", ...options.headers } });
  return remember(url, (await res.json()) as T);
}

/** Returns the body and the final URL after redirects. */
export async function getText(url: string, options: FetchOptions = {}): Promise<{ text: string; url: string }> {
  const cached = recall<{ text: string; url: string }>(url);
  if (cached !== undefined) return cached;
  const res = await request(url, { ...options, headers: { Accept: "text/html,application/xhtml+xml", ...options.headers } });
  return remember(url, { text: await res.text(), url: res.url || url });
}

export function describeFailure(error: unknown) {
  if (error instanceof HttpError) return error.status === 429 ? "rate limited" : `returned ${error.status}`;
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) return "timed out";
  return "could not be reached";
}
