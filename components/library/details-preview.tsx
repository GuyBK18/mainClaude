"use client";

import { useState } from "react";
import { ArrowLeft, Info } from "lucide-react";
import type { CoverArt } from "@/types/reading";
import type { BookDetails, DetailField, SourceId } from "@/lib/metadata/types";
import { SOURCE_LABEL } from "@/lib/metadata/types";
import { generatedCover } from "@/lib/cover";
import { BookCover } from "@/components/book/book-cover";
import { RatingStars } from "@/components/book/rating";

const FIELD_LABEL: Record<DetailField, string> = {
  pageCount: "pages",
  publishedYear: "year",
  publisher: "publisher",
  isbn: "ISBN",
  language: "language",
  description: "description",
  genres: "genres",
  series: "series",
  rating: "rating",
  coverUrl: "cover",
};

/** "Goodreads: rating, series, cover. Google Books: description." */
function provenanceLine(provenance: BookDetails["provenance"]) {
  const bySource = new Map<SourceId, string[]>();
  for (const [field, source] of Object.entries(provenance) as [DetailField, SourceId][]) {
    bySource.set(source, [...(bySource.get(source) ?? []), FIELD_LABEL[field]]);
  }
  return [...bySource.entries()].map(([source, fields]) => `${SOURCE_LABEL[source]}: ${fields.join(", ")}.`).join(" ");
}

export function DetailsPreview({
  details,
  cover: chosen,
  onBack,
}: {
  details: BookDetails;
  /** The cover the reader picked; defaults to the first one found. */
  cover?: CoverArt;
  onBack?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cover = chosen ?? { ...generatedCover(details.title), url: details.coverUrl };
  const paragraphs = details.description?.split(/\n{2,}/) ?? [];
  const facts = [
    details.pageCount ? `${details.pageCount} pages` : null,
    details.publishedYear ? String(details.publishedYear) : null,
    details.publisher,
    details.language && details.language !== "English" ? details.language : null,
  ].filter(Boolean);

  return (
    <div>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="group mb-5 inline-flex items-center gap-1.5 font-display text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5 transition-transform duration-200 ease-out group-hover:-translate-x-0.5" />
          Back to results
        </button>
      )}

      <div className="flex gap-5">
        <BookCover book={{ title: details.title, author: details.author, cover, series: details.series }} elevated className="w-24 shrink-0 self-start sm:w-28" />
        <div className="min-w-0">
          {details.genres.length > 0 && <p className="label-meta">{details.genres.join(" / ")}</p>}
          <h3 dir="auto" className="mt-2 font-serif text-[24px] leading-tight">
            {details.title}
          </h3>
          {details.subtitle && (
            <p dir="auto" className="font-serif text-[15px] text-muted-foreground italic">
              {details.subtitle}
            </p>
          )}
          <p dir="auto" className="mt-1 text-sm">
            <span className="text-muted-foreground">by</span> {details.author}
          </p>
          {details.series && (
            <p className="mt-1 text-sm text-muted-foreground">
              {details.series.name}, book {details.series.position}
            </p>
          )}
          {details.rating && (
            <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
              <RatingStars value={Math.round(details.rating.value * 2) / 2} size="size-3.5" />
              <span className="tabular font-display text-xs">{details.rating.value.toFixed(2)}</span>
              <span className="tabular font-display text-xs text-muted-foreground">
                {details.rating.count.toLocaleString("en")} ratings on {SOURCE_LABEL[details.rating.source]}
              </span>
            </p>
          )}
          {facts.length > 0 && <p className="mt-2 font-display text-xs text-muted-foreground">{facts.join(" · ")}</p>}
        </div>
      </div>

      {paragraphs.length > 0 && (
        <div className="mt-5">
          <div dir="auto" className={expanded ? "" : "line-clamp-4"}>
            {paragraphs.map((p, i) => (
              <p key={i} className="font-serif text-[15px] leading-relaxed [&+&]:mt-2">
                {p}
              </p>
            ))}
          </div>
          {(paragraphs.length > 1 || (details.description?.length ?? 0) > 320) && (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="mt-1.5 font-display text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {expanded ? "Show less" : "Read more"}
            </button>
          )}
        </div>
      )}

      <div className="mt-5 grid gap-1.5 border-t border-border pt-4 font-display text-[11px] leading-relaxed text-muted-foreground">
        {Object.keys(details.provenance).length > 0 && <p>{provenanceLine(details.provenance)}</p>}
        {details.notes.map((note) => (
          <p key={note} className="flex items-start gap-1.5">
            <Info className="mt-px size-3 shrink-0" />
            {note}
          </p>
        ))}
      </div>
    </div>
  );
}
