"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import type { Book } from "@/types/reading";
import { RATING_SOURCE_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";

function StarGlyph({ fill, size }: { fill: number; size: string }) {
  return (
    <span className={cn("relative inline-block", size)}>
      <Star className={cn("absolute inset-0 stroke-[1.5] text-ink-12", size)} fill="currentColor" />
      <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
        <Star className={cn("stroke-[1.5] text-foreground", size)} fill="currentColor" />
      </span>
    </span>
  );
}

/** Read-only stars in ink. Half values render as half-filled glyphs. */
export function RatingStars({ value, size = "size-3.5", className }: { value: number | null; size?: string; className?: string }) {
  if (value === null) return <span className={cn("text-xs text-muted-foreground", className)}>Unrated</span>;
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${value} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <StarGlyph key={i} fill={Math.max(0, Math.min(1, value - i))} size={size} />
      ))}
    </span>
  );
}

/**
 * The public average rating, usually Goodreads, as one star and the number. The exact number
 * tells 4.1 from 4.4, which half-star glyphs would round together. A dash when there is none.
 */
export function CatalogRating({ book, className }: { book: Pick<Book, "goodreadsRating" | "ratingSource" | "ratingsCount">; className?: string }) {
  if (book.goodreadsRating === null) return <span className={cn("text-muted-foreground", className)}>—</span>;
  const source = RATING_SOURCE_LABEL[book.ratingSource ?? "goodreads"];
  const count = book.ratingsCount ? `, ${book.ratingsCount.toLocaleString("en")} ratings` : "";
  return (
    <span className={cn("tabular inline-flex items-center gap-1", className)} title={`${book.goodreadsRating.toFixed(2)} on ${source}${count}`}>
      <Star className="size-3 stroke-[1.5]" fill="currentColor" aria-hidden />
      <span aria-label={`${book.goodreadsRating.toFixed(2)} out of 5 on ${source}`}>{book.goodreadsRating.toFixed(2)}</span>
    </span>
  );
}

/** Half-step star input. Click the left half of a star for .5; click the current value again to clear. */
export function RatingInput({
  value,
  onChange,
  size = "size-5",
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  size?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;

  return (
    <div
      className="inline-flex items-center gap-1"
      role="radiogroup"
      aria-label="Your rating"
      onPointerLeave={() => setHover(null)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowUp") {
          e.preventDefault();
          onChange(Math.min(5, (value ?? 0) + 0.5));
        } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
          e.preventDefault();
          const next = (value ?? 0) - 0.5;
          onChange(next <= 0 ? null : next);
        }
      }}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className="relative">
          <StarGlyph fill={Math.max(0, Math.min(1, shown - i))} size={size} />
          {[0.5, 1].map((part) => {
            const target = i + part;
            return (
              <button
                key={part}
                type="button"
                role="radio"
                aria-checked={value === target}
                aria-label={`${target} stars`}
                tabIndex={(value ?? 0.5) === target ? 0 : -1}
                className={cn("absolute inset-y-0 w-1/2 cursor-pointer outline-none", part === 0.5 ? "left-0" : "right-0")}
                onPointerEnter={() => setHover(target)}
                onClick={() => onChange(value === target ? null : target)}
              />
            );
          })}
        </span>
      ))}
      <span className="tabular ml-2 w-8 font-display text-xs text-muted-foreground">{shown ? shown.toFixed(1) : "—"}</span>
    </div>
  );
}
