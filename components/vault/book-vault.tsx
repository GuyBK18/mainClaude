"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ExternalLink, Highlighter, ImageIcon, NotebookPen, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { ReadingStatus } from "@/types/reading";
import { useLibrary } from "@/lib/library-context";
import { FORMAT_LABEL, RATING_SOURCE_LABEL, STATUS_LABEL, STATUSES } from "@/lib/labels";
import { daysBetween, formatDate } from "@/lib/dates";
import { easeOut } from "@/lib/motion";
import { statusPatch } from "@/lib/status";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import { Tooltip } from "@/components/ui/tooltip";
import { LoadingBlock } from "@/components/shell/page-header";
import { AmbientGlow } from "@/components/book/ambient-glow";
import { BookCover } from "@/components/book/book-cover";
import { ProgressControl } from "@/components/book/progress-control";
import { RatingInput, RatingStars } from "@/components/book/rating";
import { AboutBook } from "./about-book";
import { EditBookDialog } from "./edit-book-dialog";
import { HighlightsPanel } from "./highlights-panel";
import { QuoteStudio } from "./quote-studio";
import { RichTextEditor } from "./rich-text-editor";

type Tab = "notes" | "highlights" | "studio";
const TABS: Tab[] = ["notes", "highlights", "studio"];

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border pt-3">
      <dt className="label-meta">{label}</dt>
      <dd className="mt-1.5 text-[15px]">{children}</dd>
    </div>
  );
}

export function BookVault({ id }: { id: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { data, updateBook, deleteBook } = useLibrary();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [studioSeed, setStudioSeed] = useState<{ text: string; n: number } | null>(null);

  const requested = params.get("tab");
  const tab: Tab = TABS.includes(requested as Tab) ? (requested as Tab) : "notes";
  const setTab = (next: Tab) => router.replace(next === "notes" ? pathname : `${pathname}?tab=${next}`, { scroll: false });

  const book = data?.books.find((b) => b.id === id);
  const highlights = useMemo(
    () => (data?.highlights ?? []).filter((h) => h.bookId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data, id],
  );

  if (!data) {
    return (
      <div className="grid grid-cols-1 gap-12 md:grid-cols-[300px_1fr]">
        <LoadingBlock className="aspect-[2/3]" />
        <LoadingBlock className="h-80" />
      </div>
    );
  }

  if (!book) {
    return (
      <div className="py-24 text-center">
        <p className="font-serif text-3xl">This book is not in your library.</p>
        <Link href="/library" className="mt-4 inline-block font-display text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
          Back to the library
        </Link>
      </div>
    );
  }

  const readingDays = book.startedAt && book.finishedAt ? daysBetween(book.startedAt, book.finishedAt) + 1 : null;
  const series = book.series
    ? `${book.series.name}, book ${book.series.position}${book.series.total ? ` of ${book.series.total}` : ""}`
    : null;

  const changeStatus = async (status: ReadingStatus) => {
    await updateBook(book.id, statusPatch(book, status));
    toast(`Moved to ${STATUS_LABEL[status]}`);
  };

  return (
    <article>
      <Link
        href="/library"
        className="group -mt-4 mb-10 inline-flex items-center gap-1.5 font-display text-xs text-muted-foreground transition-colors hover:text-foreground sm:-mt-6"
      >
        <ArrowLeft className="size-3.5 transition-transform duration-200 ease-out group-hover:-translate-x-0.5" />
        Library
      </Link>

      <header className="relative isolate grid grid-cols-1 gap-12 pb-20 md:grid-cols-[minmax(220px,300px)_minmax(0,1fr)] lg:gap-20">
        {/* The cover floats over a large blur of itself. */}
        <div className="relative mx-auto w-52 sm:w-60 md:mx-0 md:w-full">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 scale-[1.35] opacity-[var(--glow-opacity)] blur-3xl saturate-150">
            <BookCover book={book} className="size-full" />
          </div>
          <AmbientGlow palette={book.cover.palette} className="-inset-[60%]" intensity={0.8} />
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: easeOut }}
          >
            <BookCover book={book} className="w-full shadow-cover-lg" />
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: easeOut, delay: 0.05 }}
          className="min-w-0"
        >
          <p className="label-meta">
            {book.genres.join(" / ")}
            {book.publishedYear ? ` · ${book.publishedYear}` : ""}
          </p>
          <h1 className="mt-4 font-serif text-[42px] leading-[1.02] font-normal tracking-[-0.02em] text-balance sm:text-[60px]">
            {book.title}
          </h1>
          {book.subtitle && <p className="mt-3 font-serif text-xl text-muted-foreground italic">{book.subtitle}</p>}
          <p className="mt-4 text-lg">
            <span className="text-muted-foreground">by</span> {book.author}
          </p>
          {series && <p className="mt-1 text-sm text-muted-foreground">{series}</p>}

          <div className="mt-8 flex flex-wrap items-center gap-2">
            <Select
              aria-label="Reading status"
              value={book.status}
              onValueChange={(s) => void changeStatus(s)}
              options={STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
              className="h-8 w-40"
            />
            <div className="ml-auto flex items-center gap-1">
              {book.sourceUrl && (
                <Tooltip content="Open source link">
                  <Button variant="ghost" size="icon-sm" asChild>
                    <a href={book.sourceUrl} target="_blank" rel="noreferrer" aria-label="Open source link">
                      <ExternalLink />
                    </a>
                  </Button>
                </Tooltip>
              )}
              <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil /> Edit
              </Button>
              <Tooltip content="Remove from library">
                <Button variant="ghost" size="icon-sm" aria-label="Remove from library" onClick={() => setDeleteOpen(true)}>
                  <Trash2 />
                </Button>
              </Tooltip>
            </div>
          </div>

          {(book.status === "reading" || book.status === "dnf") && (
            <div className="mt-8 max-w-md">
              <ProgressControl book={book} />
            </div>
          )}

          <div className="mt-10 grid gap-x-8 gap-y-6 sm:grid-cols-2">
            <div className="border-t border-foreground pt-3">
              <p className="label-meta text-foreground">Your rating</p>
              <div className="mt-2">
                <RatingInput value={book.personalRating} onChange={(v) => void updateBook(book.id, { personalRating: v })} />
              </div>
            </div>
            <div className="border-t border-border pt-3">
              <p className="label-meta">{RATING_SOURCE_LABEL[book.ratingSource ?? "goodreads"]} average</p>
              <div className="mt-2 flex min-h-5 flex-wrap items-center gap-x-2.5 gap-y-1">
                {book.goodreadsRating === null ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <>
                    <RatingStars value={Math.round(book.goodreadsRating * 2) / 2} size="size-4" />
                    <span className="tabular font-display text-xs text-muted-foreground">
                      {book.goodreadsRating.toFixed(2)}
                      {book.ratingsCount ? ` · ${book.ratingsCount.toLocaleString("en")} ratings` : ""}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-6 lg:grid-cols-3">
            <Fact label="Pages">
              <span className="tabular">{book.pageCount.toLocaleString("en")}</span>
            </Fact>
            <Fact label="Format">{FORMAT_LABEL[book.format]}</Fact>
            <Fact label="Publisher">{book.publisher ?? "—"}</Fact>
            <Fact label="Started">{formatDate(book.startedAt)}</Fact>
            <Fact label="Finished">{book.finishedAt ? formatDate(book.finishedAt) : (book.finishedYear ?? "—")}</Fact>
            <Fact label="Read in">{readingDays ? `${readingDays} ${readingDays === 1 ? "day" : "days"}` : "—"}</Fact>
            {book.language && (
              <div className="col-span-2 lg:col-span-3">
                <Fact label="Language">{book.language}</Fact>
              </div>
            )}
          </dl>
        </motion.div>
      </header>

      {book.description && <AboutBook key={book.id} text={book.description} />}

      <div className="border-b border-border">
        <Tabs
          value={tab}
          onValueChange={setTab}
          layoutId="vault-tabs"
          aria-label="Book sections"
          items={[
            { value: "notes", label: "Summary & review", icon: <NotebookPen /> },
            {
              value: "highlights",
              label: (
                <>
                  Highlights <span className="tabular text-muted-foreground">{highlights.length}</span>
                </>
              ),
              icon: <Highlighter />,
            },
            { value: "studio", label: "Quote studio", icon: <ImageIcon /> },
          ]}
        />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.section
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22, ease: easeOut }}
          className="pt-10"
        >
          {tab === "notes" && (
            <div className="grid grid-cols-1 gap-14 lg:grid-cols-2 lg:gap-16">
              <RichTextEditor
                key={`${book.id}-summary`}
                label="Summary"
                initialValue={book.summary}
                placeholder="What happens, who it follows, how it is built…"
                onSave={(summary) => updateBook(book.id, { summary })}
              />
              <RichTextEditor
                key={`${book.id}-review`}
                label="Review"
                initialValue={book.review}
                placeholder="What you thought. Nobody else reads this."
                onSave={(review) => updateBook(book.id, { review })}
              />
            </div>
          )}
          {tab === "highlights" && (
            <HighlightsPanel
              book={book}
              highlights={highlights}
              onMakeCard={(text) => {
                setStudioSeed((s) => ({ text, n: (s?.n ?? 0) + 1 }));
                setTab("studio");
              }}
            />
          )}
          {tab === "studio" && (
            <QuoteStudio key={studioSeed?.n ?? 0} book={book} highlights={highlights} initialText={studioSeed?.text} />
          )}
        </motion.section>
      </AnimatePresence>

      <EditBookDialog key={editOpen ? "open" : "closed"} book={book} open={editOpen} onOpenChange={setEditOpen} />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remove {book.title}?</DialogTitle>
            <DialogDescription>
              Its highlights, notes and reading sessions go with it. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Keep it
            </Button>
            <Button
              onClick={async () => {
                setDeleteOpen(false);
                router.push("/library");
                await deleteBook(book.id);
                toast(`Removed ${book.title}`);
              }}
            >
              Remove book
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}
