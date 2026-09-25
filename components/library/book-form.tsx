"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import type { Book, BookFormat, Genre, NewBook, RatingSource, ReadingStatus } from "@/types/reading";
import type { BookDetails } from "@/lib/metadata/types";
import { FORMAT_LABEL, FORMATS, GENRES, RATING_SOURCE_LABEL, STATUS_LABEL, STATUSES } from "@/lib/labels";
import { extractPalette, generatedCover } from "@/lib/cover";
import { today } from "@/lib/dates";
import { easeOut } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { RatingInput } from "@/components/book/rating";

export interface BookFormValues {
  title: string;
  author: string;
  pageCount: string;
  genres: Genre[];
  format: BookFormat;
  status: ReadingStatus;
  currentPage: string;
  personalRating: number | null;
  goodreadsRating: string;
  publishedYear: string;
  publisher: string;
  seriesName: string;
  seriesPosition: string;
  coverUrl: string;
  sourceUrl: string;
  subtitle: string;
  isbn: string;
  language: string;
  description: string;
  /** Carried from an import; not edited directly. */
  ratingSource?: RatingSource;
  ratingsCount?: number;
  seriesTotal?: number;
}

export function emptyValues(): BookFormValues {
  return {
    title: "",
    author: "",
    pageCount: "",
    genres: [],
    format: "paperback",
    status: "tbr",
    currentPage: "",
    personalRating: null,
    goodreadsRating: "",
    publishedYear: "",
    publisher: "",
    seriesName: "",
    seriesPosition: "",
    coverUrl: "",
    sourceUrl: "",
    subtitle: "",
    isbn: "",
    language: "",
    description: "",
  };
}

export function valuesFromBook(book: Book): BookFormValues {
  return {
    title: book.title,
    author: book.author,
    pageCount: String(book.pageCount),
    genres: book.genres,
    format: book.format,
    status: book.status,
    currentPage: String(book.currentPage),
    personalRating: book.personalRating,
    goodreadsRating: book.goodreadsRating?.toString() ?? "",
    publishedYear: book.publishedYear?.toString() ?? "",
    publisher: book.publisher ?? "",
    seriesName: book.series?.name ?? "",
    seriesPosition: book.series?.position.toString() ?? "",
    coverUrl: book.cover.url ?? "",
    sourceUrl: book.sourceUrl ?? "",
    subtitle: book.subtitle ?? "",
    isbn: book.isbn ?? "",
    language: book.language ?? "",
    description: book.description ?? "",
    ratingSource: book.ratingSource,
    ratingsCount: book.ratingsCount,
    seriesTotal: book.series?.total,
  };
}

/** Prefills the form from an imported record. Reading status and format stay the reader's call. */
export function valuesFromDetails(details: BookDetails, base: BookFormValues = emptyValues()): BookFormValues {
  return {
    ...base,
    title: details.title,
    author: details.author,
    pageCount: details.pageCount?.toString() ?? base.pageCount,
    genres: details.genres.length ? details.genres : base.genres,
    goodreadsRating: details.rating ? details.rating.value.toFixed(2) : "",
    ratingSource: details.rating?.source,
    ratingsCount: details.rating?.count,
    publishedYear: details.publishedYear?.toString() ?? "",
    publisher: details.publisher ?? "",
    seriesName: details.series?.name ?? "",
    seriesPosition: details.series?.position.toString() ?? "",
    seriesTotal: details.series?.total,
    coverUrl: details.coverUrl ?? "",
    sourceUrl: details.sourceUrl ?? "",
    subtitle: details.subtitle ?? "",
    isbn: details.isbn ?? "",
    language: details.language ?? "",
    description: details.description ?? "",
  };
}

export function validate(values: BookFormValues) {
  const pages = Number(values.pageCount);
  if (!values.title.trim()) return "Add a title.";
  if (!values.author.trim()) return "Add an author.";
  if (!Number.isInteger(pages) || pages <= 0) return "Page count must be a whole number above zero.";
  if (values.status === "reading" && Number(values.currentPage) > pages) return "Current page is past the last page.";
  return null;
}

const num = (value: string) => (value.trim() === "" || Number.isNaN(Number(value)) ? undefined : Number(value));

/** Builds the stored record. Palette extraction runs only when the cover URL changed. */
export async function toBookInput(values: BookFormValues, existing?: Book): Promise<NewBook> {
  const pageCount = Number(values.pageCount);
  const date = today();
  const status = values.status;

  let cover = existing?.cover ?? generatedCover(values.title);
  const url = values.coverUrl.trim();
  if (url !== (existing?.cover.url ?? "")) {
    const base = existing ? { ...existing.cover } : generatedCover(values.title);
    const palette = url ? await extractPalette(url) : null;
    cover = { ...base, url: url || undefined, palette: palette ?? base.palette };
  }

  const currentPage =
    status === "completed" ? pageCount : status === "tbr" ? 0 : Math.min(pageCount, num(values.currentPage) ?? 0);

  return {
    title: values.title.trim(),
    author: values.author.trim(),
    genres: values.genres.length ? values.genres : ["Literary Fiction"],
    pageCount,
    currentPage,
    format: values.format,
    status,
    personalRating: values.personalRating,
    goodreadsRating: num(values.goodreadsRating) ?? null,
    ratingSource: num(values.goodreadsRating) !== undefined ? (values.ratingSource ?? existing?.ratingSource) : undefined,
    ratingsCount: num(values.goodreadsRating) !== undefined ? (values.ratingsCount ?? existing?.ratingsCount) : undefined,
    publishedYear: num(values.publishedYear),
    publisher: values.publisher.trim() || undefined,
    series: values.seriesName.trim()
      ? { name: values.seriesName.trim(), position: num(values.seriesPosition) ?? 1, total: values.seriesTotal }
      : undefined,
    cover,
    startedAt: status === "tbr" ? existing?.startedAt : (existing?.startedAt ?? date),
    finishedAt: status === "completed" ? (existing?.finishedAt ?? date) : undefined,
    review: existing?.review ?? "",
    summary: existing?.summary ?? "",
    sourceUrl: values.sourceUrl.trim() || undefined,
    subtitle: values.subtitle.trim() || undefined,
    isbn: values.isbn.trim() || undefined,
    language: values.language.trim() || undefined,
    description: values.description.trim() || undefined,
    addedAt: existing?.addedAt,
  };
}

export function BookForm({
  values,
  onChange,
  defaultExpanded = false,
  autoFocus = true,
}: {
  values: BookFormValues;
  onChange: (values: BookFormValues) => void;
  defaultExpanded?: boolean;
  autoFocus?: boolean;
}) {
  const id = useId();
  const [more, setMore] = useState(defaultExpanded);
  const set = <K extends keyof BookFormValues>(key: K, value: BookFormValues[K]) => onChange({ ...values, [key]: value });

  const toggleGenre = (genre: Genre) =>
    set("genres", values.genres.includes(genre) ? values.genres.filter((g) => g !== genre) : [...values.genres, genre]);

  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <Label htmlFor={`${id}-title`}>Title</Label>
        <Input id={`${id}-title`} value={values.title} onChange={(e) => set("title", e.target.value)} placeholder="The Waves" autoFocus={autoFocus} />
      </div>

      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <div className="grid gap-2">
          <Label htmlFor={`${id}-author`}>Author</Label>
          <Input id={`${id}-author`} value={values.author} onChange={(e) => set("author", e.target.value)} placeholder="Virginia Woolf" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-pages`}>Pages</Label>
          <Input
            id={`${id}-pages`}
            inputMode="numeric"
            value={values.pageCount}
            onChange={(e) => set("pageCount", e.target.value.replace(/\D/g, ""))}
            placeholder="297"
            className="tabular"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor={`${id}-status`}>Status</Label>
          <Select
            id={`${id}-status`}
            value={values.status}
            onValueChange={(v) => set("status", v)}
            options={STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-format`}>Format</Label>
          <Select
            id={`${id}-format`}
            value={values.format}
            onValueChange={(v) => set("format", v)}
            options={FORMATS.map((f) => ({ value: f, label: FORMAT_LABEL[f] }))}
          />
        </div>
      </div>

      <AnimatePresence initial={false}>
        {(values.status === "reading" || values.status === "dnf") && (
          <motion.div
            key="current"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: easeOut }}
            className="overflow-hidden"
          >
            <div className="grid gap-2">
              <Label htmlFor={`${id}-current`}>{values.status === "dnf" ? "Stopped at page" : "Current page"}</Label>
              <Input
                id={`${id}-current`}
                inputMode="numeric"
                value={values.currentPage}
                onChange={(e) => set("currentPage", e.target.value.replace(/\D/g, ""))}
                placeholder="0"
                className="tabular"
              />
            </div>
          </motion.div>
        )}
        {(values.status === "completed" || values.status === "dnf") && (
          <motion.div
            key="rating"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: easeOut }}
            className="overflow-hidden"
          >
            <div className="grid gap-2">
              <span className="label-meta">Your rating</span>
              <RatingInput value={values.personalRating} onChange={(v) => set("personalRating", v)} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <fieldset className="grid gap-2">
        <legend className="label-meta mb-2">Genres</legend>
        <div className="flex flex-wrap gap-1.5">
          {GENRES.map((genre) => {
            const on = values.genres.includes(genre);
            return (
              <button
                key={genre}
                type="button"
                aria-pressed={on}
                onClick={() => toggleGenre(genre)}
                className={cn(
                  "pressable h-7 rounded-sm border px-2.5 font-display text-xs transition-colors duration-150",
                  on
                    ? "border-foreground bg-ink-6 text-foreground"
                    : "border-border text-muted-foreground hover:border-ink-12 hover:text-foreground",
                )}
              >
                {genre}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div>
        <button
          type="button"
          onClick={() => setMore((m) => !m)}
          aria-expanded={more}
          className="flex items-center gap-1.5 font-display text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronDown className={cn("size-3.5 transition-transform duration-200", more && "rotate-180")} />
          {more ? "Fewer details" : "More details"}
        </button>
        <AnimatePresence initial={false}>
          {more && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.24, ease: easeOut }}
              className="overflow-hidden"
            >
              <div className="grid gap-4 pt-4">
                <div className="grid grid-cols-[1fr_7rem] gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor={`${id}-publisher`}>Publisher</Label>
                    <Input id={`${id}-publisher`} value={values.publisher} onChange={(e) => set("publisher", e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`${id}-year`}>Year</Label>
                    <Input
                      id={`${id}-year`}
                      inputMode="numeric"
                      value={values.publishedYear}
                      onChange={(e) => set("publishedYear", e.target.value.replace(/[^\d-]/g, ""))}
                      className="tabular"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-[1fr_7rem] gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor={`${id}-series`}>Series</Label>
                    <Input id={`${id}-series`} value={values.seriesName} onChange={(e) => set("seriesName", e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`${id}-pos`}>Number</Label>
                    <Input
                      id={`${id}-pos`}
                      inputMode="numeric"
                      value={values.seriesPosition}
                      onChange={(e) => set("seriesPosition", e.target.value.replace(/\D/g, ""))}
                      className="tabular"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-[1fr_7rem] gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor={`${id}-cover`}>Cover image URL</Label>
                    <Input
                      id={`${id}-cover`}
                      value={values.coverUrl}
                      onChange={(e) => set("coverUrl", e.target.value)}
                      placeholder="https://…"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`${id}-gr`} title={`Public average from ${RATING_SOURCE_LABEL[values.ratingSource ?? "goodreads"]}`}>
                      {values.ratingSource && values.ratingSource !== "goodreads" ? RATING_SOURCE_LABEL[values.ratingSource] : "Goodreads"}
                    </Label>
                    <Input
                      id={`${id}-gr`}
                      inputMode="decimal"
                      value={values.goodreadsRating}
                      onChange={(e) => set("goodreadsRating", e.target.value.replace(/[^\d.]/g, ""))}
                      placeholder="4.12"
                      className="tabular"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-[1fr_9rem] gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor={`${id}-isbn`}>ISBN</Label>
                    <Input
                      id={`${id}-isbn`}
                      value={values.isbn}
                      onChange={(e) => set("isbn", e.target.value.replace(/[^\dXx-]/g, ""))}
                      className="tabular"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`${id}-lang`}>Language</Label>
                    <Input id={`${id}-lang`} value={values.language} onChange={(e) => set("language", e.target.value)} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={`${id}-desc`}>Description</Label>
                  <Textarea
                    id={`${id}-desc`}
                    dir="auto"
                    rows={5}
                    value={values.description}
                    onChange={(e) => set("description", e.target.value)}
                    placeholder="The publisher's description"
                    className="font-serif text-[15px]"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
