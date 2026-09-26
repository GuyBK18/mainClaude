"use client";

import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Book } from "@/types/reading";
import { useLibrary } from "@/lib/library-context";
import { Slider } from "@/components/ui/slider";

/** Arrow keys commit on every press; saves wait this long so a run of presses logs once. */
const SAVE_DELAY = 450;
/** Holding a step button waits this long, then steps every REPEAT_MS. */
const HOLD_DELAY = 400;
const REPEAT_MS = 70;

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
  const id = useId();
  // The newest page, read by the hold-to-repeat timer between renders. Steps move it at once.
  const latest = useRef(page);
  useEffect(() => {
    latest.current = page;
  }, [page]);

  // Nothing is stored until the run of changes ends, so book.currentPage is still the starting page.
  const save = async (next: number) => {
    timer.current = null;
    const delta = next - book.currentPage;
    if (delta !== 0) {
      const change = await setProgress(book.id, next);
      // One toast per book, replaced by each save, so stepping page by page does not stack them.
      const toastId = `progress-${book.id}`;
      if (next === book.pageCount) toast(`Finished ${book.title}`, { id: toastId });
      else if (change && change.log > 0) toast(`Logged ${change.log} ${change.log === 1 ? "page" : "pages"} today`, { id: toastId });
      else if (change && change.delta > 0) toast(`Tracking from page ${next}. Reading from here counts in your stats.`, { id: toastId });
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
    latest.current = clamped;
    setPending(clamped);
    if (!immediate) return schedule(clamped);
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    void save(clamped);
  };

  const percent = Math.round((page / book.pageCount) * 100);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-4 font-display text-[13px]">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <label htmlFor={id}>Page</label>
          <StepButton dir={-1} disabled={page <= 0} onStep={() => commit(latest.current - 1)} />
          <input
            id={id}
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
          <StepButton dir={1} disabled={page >= book.pageCount} onStep={() => commit(latest.current + 1)} />
          <span>
            of <span className="tabular">{book.pageCount}</span>
          </span>
        </div>
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

/**
 * One page back or forward. A click steps once; holding steps on until released. Each step goes
 * through the same delayed save as the slider, so a run of steps is logged once.
 */
function StepButton({ dir, disabled, onStep }: { dir: 1 | -1; disabled: boolean; onStep: () => void }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeat = useRef<ReturnType<typeof setInterval> | null>(null);
  // Set once holding has stepped, so the click that ends the hold does not step again.
  const held = useRef(false);
  const step = useRef(onStep);
  useEffect(() => {
    step.current = onStep;
  });

  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    if (repeat.current) clearInterval(repeat.current);
    timer.current = repeat.current = null;
  };
  useEffect(() => stop, []);
  // Reaching the first or last page ends a hold.
  useEffect(() => {
    if (disabled) stop();
  }, [disabled]);

  const Icon = dir < 0 ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={dir < 0 ? "One page back" : "One page forward"}
      disabled={disabled}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        held.current = false;
        stop();
        timer.current = setTimeout(() => {
          held.current = true;
          step.current();
          repeat.current = setInterval(() => step.current(), REPEAT_MS);
        }, HOLD_DELAY);
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onClick={() => {
        if (held.current) held.current = false;
        else step.current();
      }}
      className="pressable -my-1 inline-flex size-6 items-center justify-center rounded-sm text-muted-foreground transition-colors duration-150 hover:bg-ink-6 hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
    >
      <Icon className="size-3.5" strokeWidth={1.75} />
    </button>
  );
}
