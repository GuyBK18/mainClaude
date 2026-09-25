"use client";

import { useMemo, useRef, useState } from "react";
import { Check, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import type { BookFormat, NewBook, ReadingStatus } from "@/types/reading";
import type { BookDetails } from "@/lib/metadata/types";
import { fetchDetails } from "@/lib/metadata/client";
import { findInLibrary, goodreadsBookId, parseLinks, runQueue, sameBook, type BookIdentity, type BulkLink } from "@/lib/bulk-add";
import { generatedCover } from "@/lib/cover";
import { FORMAT_LABEL, FORMATS, STATUS_LABEL, STATUSES } from "@/lib/labels";
import { useLibrary } from "@/lib/library-context";
import { useUI } from "@/lib/ui-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { BookCover } from "@/components/book/book-cover";
import { emptyValues, toBookInput, valuesFromDetails } from "./book-form";

// Two lookups at a time: a few hundred books still finish in minutes, and Goodreads keeps answering.
const PARALLEL = 2;
// Saved in small groups, so a long list keeps what is done if the tab closes halfway.
const SAVE_GROUP = 10;

type Lookup =
  | { phase: "waiting" | "loading" }
  | { phase: "ready"; details: BookDetails; repeat?: "library" | "list" }
  | { phase: "failed"; message: string };

interface Row {
  link: BulkLink;
  lookup: Lookup;
  status: ReadingStatus;
  include: boolean;
  /** Typed by the reader when no catalog knew the page count. */
  pages: string;
}

type Ready = Row & { lookup: Extract<Lookup, { phase: "ready" }> };

const isReady = (row: Row): row is Ready => row.lookup.phase === "ready";
const isDone = (row: Row) => row.lookup.phase === "ready" || row.lookup.phase === "failed";
const pagesKnown = (row: Ready) => Boolean(row.lookup.details.pageCount) || /^[1-9]\d*$/.test(row.pages);

function identityOf(details: BookDetails, link: BulkLink): BookIdentity {
  return {
    title: details.title,
    author: details.author,
    isbn: details.isbn,
    goodreadsId: link.goodreadsId ?? goodreadsBookId(details.sourceUrl),
  };
}

/** "goodreads.com/book/show/5907.The_Hobbit" */
function shortLink(url: string) {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname}`;
  } catch {
    return url;
  }
}

async function toInput(row: Ready, format: BookFormat): Promise<NewBook> {
  const values = valuesFromDetails(row.lookup.details, { ...emptyValues(), status: row.status, format, pageCount: row.pages });
  const input = await toBookInput(values);
  // The app cannot know when a book on the shelf was read, so finished and abandoned books come in
  // without dates. They show in the library but stay out of the reading stats until dates are added.
  return row.status === "reading" ? input : { ...input, startedAt: undefined, finishedAt: undefined };
}

export function BulkAddDialog() {
  const { data, addBooks } = useLibrary();
  const { bulkAddOpen, setBulkAddOpen } = useUI();
  const [text, setText] = useState("");
  const [status, setStatus] = useState<ReadingStatus>("tbr");
  const [format, setFormat] = useState<BookFormat>("paperback");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState<{ done: number; total: number } | null>(null);
  const run = useRef<AbortController | null>(null);

  const links = useMemo(() => parseLinks(text), [text]);
  const books = data?.books ?? [];

  const stop = () => {
    run.current?.abort();
    run.current = null;
    setRunning(false);
  };

  const close = () => {
    if (saving) return;
    stop();
    setBulkAddOpen(false);
    // Reset after the dialog has gone so the list does not flash empty while closing.
    setTimeout(() => {
      setRows(null);
      setText("");
    }, 150);
  };

  const settle = (index: number, lookup: Lookup) =>
    setRows((current) => {
      if (!current) return current;
      const row = current[index];
      if (lookup.phase !== "ready") return current.map((r, i) => (i === index ? { ...r, lookup, include: false } : r));

      // A book already on the shelf, or one another link in the list already found, starts unticked.
      const identity = identityOf(lookup.details, row.link);
      const repeat = findInLibrary(books, identity)
        ? "library"
        : current.some((r, i) => i !== index && isReady(r) && r.include && sameBook(identityOf(r.lookup.details, r.link), identity))
          ? "list"
          : undefined;
      return current.map((r, i) => (i === index ? { ...r, lookup: { ...lookup, repeat }, include: !repeat } : r));
    });

  const lookUp = (list: BulkLink[], indexes: number[]) => {
    const controller = new AbortController();
    run.current = controller;
    setRunning(true);
    const { signal } = controller;

    void runQueue(
      indexes,
      PARALLEL,
      async (index) => {
        settle(index, { phase: "loading" });
        try {
          const res = await fetchDetails({ url: list[index].url }, signal);
          if ("details" in res) settle(index, { phase: "ready", details: res.details });
          else
            settle(index, {
              phase: "failed",
              message: res.candidates.length
                ? "This link fits more than one book. Add it with Quick add and pick the right one."
                : "No catalog knows this link.",
            });
        } catch (error) {
          if (!signal.aborted) settle(index, { phase: "failed", message: (error as Error).message });
        }
      },
      signal,
    ).then(() => {
      if (run.current === controller) {
        run.current = null;
        setRunning(false);
      }
    });
  };

  const start = () => {
    const next = links.map((link) => ({ link, lookup: { phase: "waiting" } as Lookup, status, include: false, pages: "" }));
    setRows(next);
    lookUp(
      links,
      links.map((_, i) => i),
    );
  };

  const retryFailed = () => {
    if (!rows) return;
    const failed = rows.flatMap((row, i) => (row.lookup.phase === "failed" ? [i] : []));
    setRows(rows.map((row, i) => (failed.includes(i) ? { ...row, lookup: { phase: "waiting" } } : row)));
    lookUp(
      rows.map((row) => row.link),
      failed,
    );
  };

  const patchRow = (index: number, patch: Partial<Row>) =>
    setRows((current) => current && current.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const ready = rows?.filter(isReady) ?? [];
  const chosen = ready.filter((row) => row.include);
  const missingPages = chosen.filter((row) => !pagesKnown(row)).length;
  const failed = rows?.filter((row) => row.lookup.phase === "failed").length ?? 0;
  const repeats = ready.filter((row) => row.lookup.repeat === "library").length;
  const done = rows?.filter(isDone).length ?? 0;

  const save = async () => {
    const list = chosen;
    setSaving({ done: 0, total: list.length });
    let added = 0;
    try {
      for (let from = 0; from < list.length; from += SAVE_GROUP) {
        const inputs: NewBook[] = [];
        for (const row of list.slice(from, from + SAVE_GROUP)) {
          inputs.push(await toInput(row, format));
          setSaving({ done: from + inputs.length, total: list.length });
        }
        added += (await addBooks(inputs)).length;
      }
    } catch (error) {
      setSaving(null);
      toast(`Stopped after ${added} ${added === 1 ? "book" : "books"}`, { description: (error as Error).message });
      return;
    }
    setSaving(null);
    toast(`Added ${added} ${added === 1 ? "book" : "books"}`);
    close();
  };

  const settings = (
    <div className="grid grid-cols-2 gap-3">
      <div className="grid gap-2">
        <Label htmlFor="bulk-status">{rows ? "Status for all" : "Status"}</Label>
        <Select
          id="bulk-status"
          value={status}
          onValueChange={(s) => {
            setStatus(s);
            setRows((current) => current && current.map((row) => ({ ...row, status: s })));
          }}
          options={STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="bulk-format">Format</Label>
        <Select id="bulk-format" value={format} onValueChange={setFormat} options={FORMATS.map((f) => ({ value: f, label: FORMAT_LABEL[f] }))} />
      </div>
    </div>
  );

  return (
    <Dialog open={bulkAddOpen} onOpenChange={(open) => (open ? setBulkAddOpen(true) : close())}>
      <DialogContent
        className="max-w-2xl"
        // A stray click or Escape should not throw away a list that took minutes to look up.
        onInteractOutside={(e) => rows && e.preventDefault()}
        onEscapeKeyDown={(e) => rows && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Add many books</DialogTitle>
          <DialogDescription>
            {rows
              ? "Untick anything you do not want, set each book's status, then add them all."
              : "Paste a list of links. Each one is looked up, and you check the list before anything is added."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-[320px] overflow-y-auto px-6 py-6">
          {!rows ? (
            <div className="grid gap-5">
              <div className="grid gap-2">
                <Label htmlFor="bulk-links">Links</Label>
                <Textarea
                  id="bulk-links"
                  rows={9}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={"https://www.goodreads.com/book/show/…\nhttps://www.goodreads.com/book/show/…"}
                  className="font-mono text-xs"
                  autoFocus
                />
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {links.length > 0 && (
                    <span className="tabular text-foreground">
                      {links.length} {links.length === 1 ? "link" : "links"} found.{" "}
                    </span>
                  )}
                  Goodreads book pages work best, one per line. Text around the links is ignored, so a list copied from
                  notes or a chat works as it is. Links with an ISBN work too.
                </p>
              </div>
              {settings}
              <p className="text-sm leading-relaxed text-muted-foreground">
                Finished books come in without reading dates, so they stay out of your yearly stats. Add the dates on a
                book&apos;s page if you want it counted.
              </p>
            </div>
          ) : (
            <div className="grid gap-5">
              {settings}
              <div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-display text-xs text-muted-foreground">
                  <span className="tabular text-foreground">
                    {running ? `Looking up ${done} of ${rows.length}` : `${ready.length} of ${rows.length} found`}
                  </span>
                  {failed > 0 && <span className="tabular">{failed} not found</span>}
                  {repeats > 0 && <span className="tabular">{repeats} already in your library</span>}
                  {failed > 0 && !running && (
                    <button
                      type="button"
                      onClick={retryFailed}
                      className="ml-auto flex items-center gap-1 underline-offset-4 hover:text-foreground hover:underline"
                    >
                      <RotateCcw className="size-3" /> Try the missing ones again
                    </button>
                  )}
                </div>
                <div className="mt-2 h-px bg-ink-12">
                  <div
                    className="h-px bg-foreground transition-[width] duration-300 ease-out"
                    style={{ width: `${(done / rows.length) * 100}%` }}
                  />
                </div>
                <ul className="divide-y divide-border">
                  {rows.map((row, index) => (
                    <BulkRow key={row.link.url} row={row} onChange={(patch) => patchRow(index, patch)} />
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="sm:items-center">
          {rows && missingPages > 0 && !running && (
            <p className="mr-auto text-sm text-muted-foreground">
              Type the page count for {missingPages} {missingPages === 1 ? "book" : "books"}, or untick {missingPages === 1 ? "it" : "them"}.
            </p>
          )}
          {rows ? (
            <Button
              variant="ghost"
              disabled={Boolean(saving)}
              onClick={() => {
                stop();
                setRows(null);
              }}
            >
              Back to the list
            </Button>
          ) : (
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
          )}
          {rows ? (
            <Button onClick={() => void save()} disabled={running || Boolean(saving) || chosen.length === 0 || missingPages > 0}>
              {saving && <Loader2 className="animate-spin" />}
              {saving
                ? `Adding ${saving.done} of ${saving.total}`
                : `Add ${chosen.length} ${chosen.length === 1 ? "book" : "books"}`}
            </Button>
          ) : (
            <Button onClick={start} disabled={links.length === 0}>
              {links.length ? `Look up ${links.length} ${links.length === 1 ? "book" : "books"}` : "Look up books"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkRow({ row, onChange }: { row: Row; onChange: (patch: Partial<Row>) => void }) {
  const { lookup } = row;

  if (lookup.phase !== "ready") {
    return (
      <li className="flex items-center gap-3 py-3">
        <span className="size-4 shrink-0" />
        <span className="grid aspect-[2/3] w-9 shrink-0 place-items-center rounded-[2px] border border-border bg-ink-3">
          {lookup.phase === "loading" && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-xs text-muted-foreground">{shortLink(row.link.url)}</p>
          <p className={cn("mt-1 text-xs", lookup.phase === "failed" ? "text-foreground" : "text-muted-foreground")}>
            {lookup.phase === "failed" ? lookup.message : lookup.phase === "loading" ? "Looking up…" : "Waiting"}
          </p>
        </div>
      </li>
    );
  }

  const { details, repeat } = lookup;
  const facts = [
    details.author,
    details.series ? `${details.series.name} #${details.series.position}` : null,
    details.pageCount ? `${details.pageCount} pp` : null,
  ].filter(Boolean);

  return (
    <li className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 py-3 transition-opacity duration-150", !row.include && "opacity-55")}>
      <button
        type="button"
        role="checkbox"
        aria-checked={row.include}
        aria-label={`Add ${details.title}`}
        onClick={() => onChange({ include: !row.include })}
        className={cn(
          "grid size-4 shrink-0 place-items-center rounded-[3px] border transition-colors duration-100",
          row.include ? "border-foreground bg-foreground text-background" : "border-ink-12 hover:border-foreground",
        )}
      >
        {row.include && <Check className="size-3 stroke-[3]" />}
      </button>
      <BookCover
        book={{ title: details.title, author: details.author, series: details.series, cover: generatedCover(details.title, details.coverUrl) }}
        className="w-9 shrink-0"
      />
      <div className="min-w-0 flex-1 basis-40">
        <p dir="auto" className="truncate text-left font-serif text-[15px] leading-snug">
          {details.title}
        </p>
        <p dir="auto" className="truncate text-left text-xs text-muted-foreground">
          {facts.join(" · ")}
        </p>
        {repeat && (
          <p className="mt-1 text-xs text-foreground">
            {repeat === "library" ? "Already in your library." : "Same book as another link in this list."}
          </p>
        )}
        {!details.pageCount && row.include && (
          <label className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
            No page count found. Pages:
            <Input
              inputMode="numeric"
              value={row.pages}
              onChange={(e) => onChange({ pages: e.target.value.replace(/\D/g, "") })}
              className="tabular h-7 w-20 text-xs"
            />
          </label>
        )}
      </div>
      <Select
        aria-label={`Status of ${details.title}`}
        value={row.status}
        onValueChange={(s) => onChange({ status: s })}
        options={STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
        className="ml-[76px] w-36 shrink-0 sm:ml-0"
      />
    </li>
  );
}
