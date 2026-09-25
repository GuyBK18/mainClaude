"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Search, X } from "lucide-react";
import type { Genre } from "@/types/reading";
import { GENRES } from "@/lib/labels";
import { LENGTH_BUCKETS, type LengthBucket } from "@/lib/stats";
import type { LibraryFilters } from "@/lib/library-filter";
import { snappySpring } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const RATINGS = [
  { value: 0, label: "Any rating" },
  { value: 3, label: "3 stars and up" },
  { value: 4, label: "4 stars and up" },
  { value: 4.5, label: "4.5 stars and up" },
  { value: 5, label: "5 stars only" },
];

function FilterButton({ label, count, children }: { label: string; count: number; children: React.ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "pressable flex h-8 items-center gap-1.5 rounded-sm px-2.5 font-display text-xs transition-colors duration-150 data-[state=open]:bg-ink-6",
          count > 0 ? "text-foreground" : "text-muted-foreground hover:text-foreground",
        )}
      >
        {label}
        {count > 0 && <span className="tabular underline underline-offset-4">{count}</span>}
        <ChevronDown className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent className="w-56">{children}</PopoverContent>
    </Popover>
  );
}

function Option({ checked, onSelect, children }: { checked: boolean; onSelect: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      onClick={onSelect}
      className="flex h-8 w-full items-center gap-2.5 rounded-sm px-2 text-left text-sm transition-colors duration-100 hover:bg-ink-6"
    >
      <span
        className={cn(
          "grid size-3.5 place-items-center rounded-[3px] border transition-colors duration-100",
          checked ? "border-foreground bg-foreground text-background" : "border-ink-12",
        )}
      >
        {checked && <Check className="size-2.5 stroke-[3]" />}
      </span>
      {children}
    </button>
  );
}

export function LibraryFilterBar({
  filters,
  onChange,
  resultCount,
}: {
  filters: LibraryFilters;
  onChange: (next: LibraryFilters) => void;
  resultCount: number;
}) {
  const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

  const chips: { key: string; label: string; remove: () => void }[] = [
    ...filters.genres.map((g) => ({
      key: `g-${g}`,
      label: g,
      remove: () => onChange({ ...filters, genres: filters.genres.filter((x) => x !== g) }),
    })),
    ...filters.lengths.map((l) => ({
      key: `l-${l}`,
      label: LENGTH_BUCKETS[l].label,
      remove: () => onChange({ ...filters, lengths: filters.lengths.filter((x) => x !== l) }),
    })),
    ...(filters.minRating > 0
      ? [{ key: "r", label: RATINGS.find((r) => r.value === filters.minRating)!.label, remove: () => onChange({ ...filters, minRating: 0 }) }]
      : []),
  ];

  return (
    <div className="border-y border-border">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2">
        <label className="flex h-8 min-w-0 flex-1 basis-48 items-center gap-2 text-muted-foreground">
          <Search className="size-3.5 shrink-0" />
          <input
            value={filters.query}
            onChange={(e) => onChange({ ...filters, query: e.target.value })}
            placeholder="Filter by title, author or series"
            aria-label="Filter books"
            className="h-full w-full min-w-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </label>

        <div className="flex items-center">
          <FilterButton label="Genre" count={filters.genres.length}>
            {GENRES.map((g: Genre) => (
              <Option key={g} checked={filters.genres.includes(g)} onSelect={() => onChange({ ...filters, genres: toggle(filters.genres, g) })}>
                {g}
              </Option>
            ))}
          </FilterButton>
          <FilterButton label="Length" count={filters.lengths.length}>
            {(Object.keys(LENGTH_BUCKETS) as LengthBucket[]).map((l) => (
              <Option key={l} checked={filters.lengths.includes(l)} onSelect={() => onChange({ ...filters, lengths: toggle(filters.lengths, l) })}>
                {LENGTH_BUCKETS[l].label}
              </Option>
            ))}
          </FilterButton>
          <FilterButton label="Rating" count={filters.minRating > 0 ? 1 : 0}>
            {RATINGS.map((r) => (
              <Option key={r.value} checked={filters.minRating === r.value} onSelect={() => onChange({ ...filters, minRating: r.value })}>
                {r.label}
              </Option>
            ))}
          </FilterButton>
        </div>

        <span className="tabular ml-auto pl-2 font-display text-xs text-muted-foreground">
          {resultCount} {resultCount === 1 ? "book" : "books"}
        </span>
      </div>

      <AnimatePresence initial={false}>
        {chips.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap items-center gap-1.5 pb-3">
              <AnimatePresence initial={false} mode="popLayout">
                {chips.map((chip) => (
                  <motion.button
                    layout
                    key={chip.key}
                    type="button"
                    onClick={chip.remove}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={snappySpring}
                    className="pressable flex h-7 items-center gap-1.5 rounded-sm border border-border bg-surface pr-1.5 pl-2.5 font-display text-xs hover:border-ink-12"
                  >
                    {chip.label}
                    <X className="size-3 text-muted-foreground" />
                  </motion.button>
                ))}
              </AnimatePresence>
              <button
                type="button"
                onClick={() => onChange({ ...filters, genres: [], lengths: [], minRating: 0 })}
                className="ml-1 font-display text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Clear filters
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
