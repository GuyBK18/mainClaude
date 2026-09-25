"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Book } from "@/types/reading";
import { useLibrary } from "@/lib/library-context";
import { Slider } from "@/components/ui/slider";

/** Arrow keys commit on every press; saves wait this long so a run of presses logs once. */
const SAVE_DELAY = 450;

export function ProgressControl({ book }: { book: Book }) {
  const { setProgress } = useLibrary();
  // Local values exist only while the reader is mid-change; otherwise the stored page shows.
  const [pending, setPending] = useState<number | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flush = useRef<(() => void) | null>(null);

  // Leaving the page mid-debounce still saves the last value.
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        flush.current?.();
      }
    },
    [],
  );

  const page = pending ?? book.currentPage;

  // Nothing is stored until the run of changes ends, so book.currentPage is still the starting page.
  const save = async (next: number) => {
    timer.current = null;
    const delta = next - book.currentPage;
    if (delta !== 0) {
      await setProgress(book.id, next);
      if (next === book.pageCount) toast(`Finished ${book.title}`);
      else if (delta > 0) toast(`Logged ${delta} ${delta === 1 ? "page" : "pages"} today`);
    }
    setPending(null);
    setDraft(null);
  };

  const schedule = (value: number) => {
    if (timer.current) clearTimeout(timer.current);
    flush.current = () => void save(value);
    timer.current = setTimeout(() => void save(value), SAVE_DELAY);
  };

  const commit = (next: number, immediate = false) => {
    const clamped = Math.max(0, Math.min(book.pageCount, Math.round(next)));
    setPending(clamped);
    if (!immediate) return schedule(clamped);
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    void save(clamped);
  };

  const percent = Math.round((page / book.pageCount) * 100);

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-4 font-display text-[13px]">
        <label className="flex items-baseline gap-1.5 text-muted-foreground">
          Page
          <input
            aria-label="Current page"
            inputMode="numeric"
            value={draft ?? String(page)}
            onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
            onBlur={() => {
              if (draft !== null) commit(Number(draft || 0), true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setDraft(null);
            }}
            className="tabular w-[4.5ch] border-b border-transparent bg-transparent text-center text-foreground transition-colors outline-none hover:border-border focus:border-foreground"
          />
          of <span className="tabular">{book.pageCount}</span>
        </label>
        <span className="tabular text-foreground">{percent}%</span>
      </div>
      <Slider
        aria-label={`Reading progress for ${book.title}`}
        value={[page]}
        max={book.pageCount}
        step={1}
        onValueChange={([v]) => {
          setPending(v);
          setDraft(null);
          // Radix fires commit before change on key presses. Keep any scheduled save, moved to the newest value.
          if (timer.current) schedule(v);
        }}
        onValueCommit={([v]) => commit(v)}
      />
    </div>
  );
}
