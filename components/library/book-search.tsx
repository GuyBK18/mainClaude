"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import type { BookCandidate, BookDetails } from "@/lib/metadata/types";
import { SOURCE_LABEL } from "@/lib/metadata/types";
import { fetchDetails, searchBooks } from "@/lib/metadata/client";
import { generatedCover } from "@/lib/cover";
import { languageName } from "@/lib/metadata/text";
import { cn } from "@/lib/utils";
import { BookCover } from "@/components/book/book-cover";
import { RatingStars } from "@/components/book/rating";

const DEBOUNCE_MS = 450;

function Meta({ c }: { c: BookCandidate }) {
  const parts = [
    c.pageCount ? `${c.pageCount} pages` : null,
    c.publisher,
    c.editionCount && c.editionCount > 1 ? `${c.editionCount} editions` : null,
    c.language && c.language !== (c.lang ?? "en") ? languageName(c.language) : null,
    c.isbn ? `ISBN ${c.isbn}` : null,
  ].filter(Boolean);
  if (!parts.length) return null;
  return <p className="mt-1.5 font-display text-[11px] leading-relaxed text-muted-foreground">{parts.join(" · ")}</p>;
}

function ResultRow({
  c,
  loading,
  disabled,
  onPick,
  onKeyDown,
  buttonRef,
}: {
  c: BookCandidate;
  loading: boolean;
  disabled: boolean;
  onPick: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  buttonRef: (el: HTMLButtonElement | null) => void;
}) {
  const cover = { ...generatedCover(c.title), url: c.coverUrl };
  return (
    <li>
      <button
        ref={buttonRef}
        type="button"
        onClick={onPick}
        onKeyDown={onKeyDown}
        disabled={disabled}
        aria-busy={loading}
        className={cn(
          "flex w-full items-start gap-4 rounded-sm px-3 py-3 text-left transition-[background-color,opacity] duration-150 outline-none hover:bg-ink-3 focus-visible:bg-ink-6 disabled:cursor-default",
          disabled && !loading && "opacity-40",
          loading && "bg-ink-6",
        )}
      >
        <BookCover book={{ title: c.title, author: c.authors[0] ?? "", cover }} className="w-11 shrink-0" />
        <div className="min-w-0 flex-1">
          <p dir="auto" className="font-serif text-[17px] leading-snug">
            {c.title}
            {c.subtitle && <span className="text-muted-foreground">: {c.subtitle}</span>}
          </p>
          <p dir="auto" className="mt-0.5 truncate text-[13px] text-muted-foreground">
            {c.authors.slice(0, 3).join(", ") || "Unknown author"}
            {c.year ? ` · ${c.year}` : ""}
          </p>
          {/* On narrow screens the rating and sources move under the author. */}
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 sm:hidden">
            {loading && <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden />}
            {c.rating && <RatingStars value={Math.round(c.rating.value * 2) / 2} size="size-3" />}
            <span className="font-display text-[10px] tracking-wide text-muted-foreground">{c.sources.map((s) => SOURCE_LABEL[s]).join(" + ")}</span>
          </p>
          <Meta c={c} />
          {c.snippet && (
            <p dir="auto" className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
              {c.snippet}
            </p>
          )}
        </div>
        <div className="hidden shrink-0 flex-col items-end gap-1.5 pt-1 sm:flex">
          {loading ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Loading details" />
          ) : (
            c.rating && (
              <span className="flex items-center gap-1.5" title={`${c.rating.count.toLocaleString("en")} ratings on ${SOURCE_LABEL[c.rating.source]}`}>
                <RatingStars value={Math.round(c.rating.value * 2) / 2} size="size-3" />
                <span className="tabular font-display text-[11px] text-muted-foreground">{c.rating.value.toFixed(1)}</span>
              </span>
            )
          )}
          <span className="font-display text-[10px] tracking-wide text-muted-foreground">
            {c.sources.map((s) => SOURCE_LABEL[s]).join(" + ")}
          </span>
        </div>
      </button>
    </li>
  );
}

/**
 * Type a title, author or ISBN; Google Books and Open Library answer together and
 * the reader picks the right edition. Picking fetches the full record from every catalog.
 */
export function BookSearch({
  onDetails,
  initialQuery = "",
  initialCandidates,
}: {
  onDetails: (details: BookDetails) => void;
  initialQuery?: string;
  initialCandidates?: BookCandidate[];
}) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<BookCandidate[] | null>(initialCandidates ?? null);
  const [notes, setNotes] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const rows = useRef<(HTMLButtonElement | null)[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const skipFirst = useRef(Boolean(initialCandidates));

  const run = async (q: string) => {
    controller.current?.abort();
    if (q.trim().length < 2) {
      setResults(null);
      setSearching(false);
      return;
    }
    const ctrl = new AbortController();
    controller.current = ctrl;
    setSearching(true);
    setError(null);
    try {
      const res = await searchBooks(q, ctrl.signal);
      setResults(res.candidates);
      setNotes(res.notes);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      if (controller.current === ctrl) setSearching(false);
    }
  };

  useEffect(() => {
    // Results handed in from a URL import show as-is until the reader edits the query.
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    const timer = setTimeout(() => void run(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => () => controller.current?.abort(), []);

  const pick = async (c: BookCandidate) => {
    setLoadingKey(c.key);
    setError(null);
    try {
      const res = await fetchDetails({ candidate: c });
      if ("details" in res) onDetails(res.details);
    } catch (e) {
      setError(`${(e as Error).message} You can still add the book by hand.`);
    } finally {
      setLoadingKey(null);
    }
  };

  const moveFocus = (e: React.KeyboardEvent, index: number) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const next = index + (e.key === "ArrowDown" ? 1 : -1);
    if (next < 0) inputRef.current?.focus();
    else rows.current[Math.min(next, (results?.length ?? 1) - 1)]?.focus();
  };

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(query);
        }}
        className="flex h-11 items-center gap-3 rounded-sm border border-border bg-surface px-3 transition-[border-color] duration-150 focus-within:border-foreground"
      >
        {searching ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <Search className="size-4 shrink-0 text-muted-foreground" />
        )}
        <input
          ref={inputRef}
          autoFocus
          dir="auto"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && results?.length) {
              e.preventDefault();
              rows.current[0]?.focus();
            }
          }}
          placeholder="Title, author or ISBN"
          aria-label="Search for a book"
          className="h-full w-full bg-transparent font-display text-[15px] outline-none placeholder:text-muted-foreground"
        />
      </form>

      {loadingKey && (
        <p className="mt-3 font-display text-xs text-muted-foreground" aria-live="polite">
          Reading Goodreads, Open Library and Google Books…
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm">
          {error}
        </p>
      )}

      {results && results.length === 0 && !searching && (
        <p className="py-10 text-center text-sm text-muted-foreground">No matches. Try the author&apos;s surname, or an ISBN.</p>
      )}

      {results && results.length > 0 && (
        <>
          <div className="mt-5 mb-1 flex items-baseline justify-between gap-4 px-3">
            <p className="label-meta">Pick the right book</p>
            <p className="font-display text-[11px] text-muted-foreground">
              {results[0].lang === "he" ? "Hebrew editions" : "English editions"}
            </p>
          </div>
          <ul className={cn("transition-opacity duration-150", searching && "opacity-50")}>
            {results.map((c, i) => (
              <ResultRow
                key={c.key}
                c={c}
                loading={loadingKey === c.key}
                disabled={loadingKey !== null}
                onPick={() => void pick(c)}
                onKeyDown={(e) => moveFocus(e, i)}
                buttonRef={(el) => {
                  rows.current[i] = el;
                }}
              />
            ))}
          </ul>
        </>
      )}

      {notes.length > 0 && (
        <p className="mt-3 px-3 font-display text-[11px] text-muted-foreground">{notes.join(" ")}</p>
      )}

      {!results && !searching && !error && (
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Search Google Books and Open Library at once. Picking a result also reads Goodreads for the rating, series
          and genres, and fills the form for you to check. Results are English editions. Type the title in Hebrew
          to get Hebrew editions.
        </p>
      )}
    </div>
  );
}
