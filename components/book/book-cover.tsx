"use client";

import { useState } from "react";
import type { Book } from "@/types/reading";
import { cn } from "@/lib/utils";

type CoverBook = Pick<Book, "title" | "author" | "cover" | "series">;

/** Fits a title into a width budget (in container-width units) by its longest word and overall length. */
function fitTitle(title: string, max: number, budget: number) {
  const longest = Math.max(...title.split(/\s+/).map((w) => w.length));
  const byWord = budget / (longest * 0.52);
  const byLength = max * Math.sqrt(12 / Math.max(12, title.length));
  return `${Math.min(max, byWord, byLength).toFixed(2)}cqw`;
}

function TypesetCover({ book }: { book: CoverBook }) {
  const [ground, ink, accent] = book.cover.palette;
  const { title, author, series } = book;
  const seriesMark = series ? `${series.name} · ${series.position}` : null;

  switch (book.cover.style) {
    case "band":
      return (
        <div className="absolute inset-0 flex flex-col">
          <div className="flex h-[28%] items-end justify-center pb-[4cqw]">
            {seriesMark && (
              <span className="font-display text-[3.4cqw] tracking-[0.2em] uppercase" style={{ color: ink, opacity: 0.8 }}>
                {seriesMark}
              </span>
            )}
          </div>
          <div
            className="flex h-[44%] flex-col items-center justify-center px-[9%] text-center"
            style={{ backgroundColor: ink, color: ground }}
          >
            <p className="font-serif leading-[1.02] font-medium" style={{ fontSize: fitTitle(title, 12, 78) }}>
              {title}
            </p>
            <span className="my-[4.5cqw] block h-px w-[16%]" style={{ backgroundColor: accent }} />
            <p className="font-display text-[4cqw] tracking-[0.18em] uppercase">{author}</p>
          </div>
        </div>
      );
    case "frame":
      return (
        <div className="absolute inset-[6%] flex flex-col items-center justify-between border px-[8%] py-[12%] text-center" style={{ borderColor: accent }}>
          <span className="font-display text-[3.4cqw] tracking-[0.24em] uppercase" style={{ color: accent }}>
            {seriesMark ?? "A Novel"}
          </span>
          <p className="font-serif leading-[1.05] italic" style={{ fontSize: fitTitle(title, 13, 70), color: ink }}>
            {title}
          </p>
          <p className="font-display text-[3.8cqw] tracking-[0.2em] uppercase" style={{ color: ink }}>
            {author}
          </p>
        </div>
      );
    case "disc":
      return (
        <>
          <div
            className="absolute -top-[12%] -right-[22%] aspect-square w-[86%] rounded-full"
            style={{ backgroundColor: accent }}
          />
          <div className="absolute inset-x-[9%] bottom-[9%] flex flex-col gap-[3cqw]" style={{ color: ink }}>
            <p className="font-serif leading-[1.0] font-medium tracking-[-0.01em]" style={{ fontSize: fitTitle(title, 14, 80) }}>
              {title}
            </p>
            <p className="font-display text-[3.8cqw] tracking-[0.18em] uppercase opacity-80">{author}</p>
          </div>
        </>
      );
    case "split":
      return (
        <div className="absolute inset-0 flex flex-col">
          <div className="flex h-[54%] items-start justify-between p-[9%]" style={{ backgroundColor: accent, color: ground }}>
            <span className="font-display text-[3.6cqw] tracking-[0.2em] uppercase">{author}</span>
          </div>
          <div className="flex flex-1 flex-col justify-center px-[9%]" style={{ color: ink }}>
            <p className="font-serif leading-[1.02]" style={{ fontSize: fitTitle(title, 13, 80) }}>
              {title}
            </p>
          </div>
        </div>
      );
    case "type":
    default:
      return (
        <div className="absolute inset-0 flex flex-col justify-between p-[9%]">
          <p
            className="font-serif leading-[0.94] font-medium tracking-[-0.02em] [overflow-wrap:anywhere]"
            style={{ fontSize: fitTitle(title, 19, 80), color: ink }}
          >
            {title}
          </p>
          <p className="font-display text-[3.8cqw] tracking-[0.18em] uppercase" style={{ color: accent }}>
            {author}
          </p>
        </div>
      );
  }
}

/**
 * A book cover at 2:3. Uses the image when there is one and typesets the cover otherwise.
 * Covers are the one element allowed depth, so `elevated` adds a cast shadow.
 */
export function BookCover({
  book,
  className,
  elevated = false,
  onImageError,
}: {
  book: CoverBook;
  className?: string;
  elevated?: boolean;
  /** Called when the image fails to load; the cover falls back to the typeset design either way. */
  onImageError?: (url: string) => void;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = book.cover.url && book.cover.url !== failedUrl ? book.cover.url : null;
  const [ground, ink] = book.cover.palette;

  return (
    <div
      className={cn(
        "@container relative isolate aspect-[2/3] overflow-hidden rounded-[2px_4px_4px_2px] select-none",
        elevated && "shadow-cover",
        className,
      )}
      style={{ backgroundColor: ground, color: ink }}
      role="img"
      aria-label={`Cover of ${book.title} by ${book.author}`}
    >
      {url ? (
        // Remote covers come from arbitrary hosts, so next/image's allowlist does not fit here.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          className="absolute inset-0 size-full object-cover"
          onError={() => {
            setFailedUrl(url);
            onImageError?.(url);
          }}
        />
      ) : (
        <TypesetCover book={book} />
      )}
      {/* Hinge crease and a faint sheen so the cover reads as printed board, not a flat card. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgb(0 0 0 / 0.24) 0%, rgb(255 255 255 / 0.16) 1.6%, rgb(0 0 0 / 0.08) 3.2%, transparent 7%), linear-gradient(120deg, rgb(255 255 255 / 0.12) 0%, transparent 38%)",
        }}
      />
    </div>
  );
}
