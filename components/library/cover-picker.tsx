"use client";

import { useEffect, useId, useRef, useState } from "react";
import { RadioGroup } from "radix-ui";
import { Check, Loader2, Plus } from "lucide-react";
import type { BookDetails, CoverOption } from "@/lib/metadata/types";
import { SOURCE_LABEL } from "@/lib/metadata/types";
import { fetchMoreCovers, proxiedCover } from "@/lib/metadata/client";
import { checkCover, distinctCovers, type CoverCheck } from "@/lib/cover-compare";
import { generatedCover } from "@/lib/cover";
import { cn } from "@/lib/utils";
import { BookCover } from "@/components/book/book-cover";

const DESIGNED = "designed";
/** Covers shown at first and added per "Find more covers". */
const STEP = 5;
/** Empty pages in a row before the search for more gives up. */
const MAX_EMPTY_PAGES = 2;

/**
 * Covers of different editions, compared in the browser so the same image found in two
 * catalogs shows once, plus a typeset cover in the library's own palettes. The chosen
 * image's URL goes into the form; the typeset cover stores no URL.
 */
export function CoverPicker({
  details,
  title,
  value,
  onChange,
}: {
  details: BookDetails;
  /** The title as the reader has it in the form, so the typeset cover matches what is saved. */
  title: string;
  value: string;
  onChange: (coverUrl: string) => void;
}) {
  const id = useId();
  const [pool, setPool] = useState<CoverOption[]>(details.covers);
  const [checks, setChecks] = useState<Map<string, CoverCheck>>(new Map());
  const [visible, setVisible] = useState(STEP);
  const [page, setPage] = useState(1);
  const [fetching, setFetching] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const [failed, setFailed] = useState<string[]>([]);
  const requested = useRef(new Set<string>());

  // Check each cover once, as it joins the pool.
  useEffect(() => {
    const pending = pool.filter((c) => !requested.current.has(c.url));
    pending.forEach((c) => requested.current.add(c.url));
    for (const c of pending) {
      void checkCover(c.url).then((check) => setChecks((prev) => new Map(prev).set(c.url, check)));
    }
  }, [pool]);

  // Covers are compared in pool order and only up to the first one still being checked,
  // so tiles are added at the end and never jump around.
  const firstUnchecked = pool.findIndex((c) => !checks.has(c.url));
  const settled = firstUnchecked === -1;
  const checkedPool = settled ? pool : pool.slice(0, firstUnchecked);
  const distinct = distinctCovers(checkedPool, checks).filter((c) => !failed.includes(c.url));
  const shown = distinct.slice(0, visible);
  const firstLoad = details.covers.some((c) => !checks.has(c.url));
  const bookTitle = title.trim() || details.title;
  const selected = value || DESIGNED;

  // The default pick is the first cover found. If that one turned out to be a duplicate, a
  // square audiobook image or broken, move the pick to the first cover that is shown.
  const shownKey = shown.map((c) => c.url).join("|");
  useEffect(() => {
    if (!settled || !value || !pool.some((c) => c.url === value) || shown.some((c) => c.url === value)) return;
    onChange(shown[0]?.url ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- shownKey stands for `shown`.
  }, [settled, value, shownKey]);

  const findMore = async () => {
    if (distinct.length > visible) {
      setVisible((v) => v + STEP);
      return;
    }
    setFetching(true);
    let next = page;
    let added: CoverOption[] = [];
    let done = false;
    try {
      for (let empty = 0; empty < MAX_EMPTY_PAGES && !added.length && !done; empty++) {
        next += 1;
        const res = await fetchMoreCovers(details.coverQuery, next, pool.map((c) => c.url));
        added = res.covers.filter((c) => !pool.some((p) => p.url === c.url));
        done = res.done;
      }
    } catch {
      done = true;
    }
    setPage(next);
    if (added.length) {
      setPool((prev) => [...prev, ...added]);
      setVisible((v) => v + STEP);
    }
    if (!added.length || done) setExhausted(true);
    setFetching(false);
  };

  const busy = fetching || !settled;
  const nothingLeft = exhausted && distinct.length <= visible && settled;

  return (
    <div className="grid gap-3">
      <div className="flex items-baseline justify-between gap-4">
        <span id={`${id}-label`} className="label-meta">
          Cover
        </span>
        {!settled && <span className="font-display text-[11px] text-muted-foreground">Comparing covers…</span>}
      </div>

      <RadioGroup.Root
        value={selected}
        onValueChange={(v) => onChange(v === DESIGNED ? "" : v)}
        aria-labelledby={`${id}-label`}
        className="grid grid-cols-3 gap-x-4 gap-y-5 sm:grid-cols-5"
      >
        {firstLoad
          ? Array.from({ length: Math.min(details.covers.length, STEP) }, (_, i) => (
              <div key={i} aria-hidden className="aspect-[2/3] rounded-[2px_4px_4px_2px] border border-border bg-ink-3" />
            ))
          : shown.map((c) => (
              <Tile
                key={c.url}
                value={c.url}
                checked={selected === c.url}
                label={SOURCE_LABEL[c.source]}
                detail={c.format}
                book={{
                  title: bookTitle,
                  author: details.author,
                  series: details.series,
                  // Readable covers show through the same-origin copy the check already loaded.
                  cover: { ...generatedCover(bookTitle), url: checks.get(c.url)?.status === "ok" ? proxiedCover(c.url) : c.url },
                }}
                onImageError={() => setFailed((f) => [...f, c.url])}
              />
            ))}
        <Tile
          value={DESIGNED}
          checked={selected === DESIGNED}
          label="Designed"
          book={{ title: bookTitle, author: details.author, series: details.series, cover: generatedCover(bookTitle) }}
        />
      </RadioGroup.Root>

      {(details.covers.length > 0 || details.coverQuery.goodreadsWorkId || details.coverQuery.openLibraryWork) && (
        <button
          type="button"
          onClick={() => void findMore()}
          disabled={busy || nothingLeft}
          className="inline-flex w-fit items-center gap-1.5 font-display text-xs text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none"
        >
          {fetching ? <Loader2 className="size-3.5 animate-spin" /> : !nothingLeft && <Plus className="size-3.5" />}
          {fetching ? "Looking for more covers…" : nothingLeft ? "No more covers found" : "Find more covers"}
        </button>
      )}
    </div>
  );
}

function Tile({
  value,
  checked,
  label,
  detail,
  book,
  onImageError,
}: {
  value: string;
  checked: boolean;
  label: string;
  detail?: string;
  book: React.ComponentProps<typeof BookCover>["book"];
  onImageError?: () => void;
}) {
  return (
    <RadioGroup.Item
      value={value}
      aria-label={detail ? `${label} cover, ${detail}` : `${label} cover`}
      className="group pressable grid min-w-0 content-start gap-2.5 text-left outline-none"
    >
      <BookCover
        book={book}
        onImageError={onImageError}
        className={cn(
          "w-full outline-1 outline-offset-[3px] transition-[outline-color] duration-150",
          checked ? "outline-foreground" : "outline-transparent group-hover:outline-border",
        )}
      />
      <span className="grid gap-0.5">
        <span
          className={cn(
            "flex items-center gap-1 font-display text-[11px] underline-offset-4 transition-colors duration-150 group-focus-visible:underline",
            checked ? "text-foreground" : "text-muted-foreground group-hover:text-foreground",
          )}
        >
          <span className="truncate">{label}</span>
          <Check aria-hidden className={cn("size-3 shrink-0 transition-opacity duration-150", checked ? "opacity-100" : "opacity-0")} />
        </span>
        {detail && <span className="truncate font-display text-[10px] text-muted-foreground">{detail}</span>}
      </span>
    </RadioGroup.Item>
  );
}
