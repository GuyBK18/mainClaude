"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowDownUp, ArrowUp, Box, LayoutGrid, Library, ListPlus, Plus, Rows3 } from "lucide-react";
import type { ReadingStatus } from "@/types/reading";
import { useLibrary } from "@/lib/library-context";
import { useUI } from "@/lib/ui-context";
import { STATUS_LABEL } from "@/lib/labels";
import {
  DEFAULT_FILTERS,
  SORT_DEFAULT_DIR,
  SORT_LABEL,
  filterBooks,
  sortBooks,
  type LibraryFilters,
  type SortDir,
  type SortKey,
} from "@/lib/library-filter";
import { easeOut, type Direction } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs } from "@/components/ui/tabs";
import { LoadingBlock, PageHeader } from "@/components/shell/page-header";
import { LibraryFilterBar } from "./library-filters";
import { LeaningSettingsButton, useLeaningSettings } from "./leaning-settings";
import { LeaningShelf } from "./leaning-shelf";
import { LibraryGrid } from "./library-grid";
import { LibraryShelf } from "./library-shelf";
import { LibraryTable } from "./library-table";

/** Stored names. "shelf" shows as Display and "leaning" as Spines; the stored names stay so saved choices still work. */
type View = "grid" | "shelf" | "leaning" | "table";
const STATUS_ORDER: (ReadingStatus | "all")[] = ["all", "reading", "tbr", "completed", "dnf"];
const VIEW_KEY = "luminaread:library-view";
const SORT_KEY = "luminaread:library-sort";

function readView(): View {
  try {
    const v = window.localStorage.getItem(VIEW_KEY);
    if (v === "grid" || v === "shelf" || v === "leaning" || v === "table") return v;
  } catch {
    // Storage blocked; fall back to the grid.
  }
  return "grid";
}

type Sort = { key: SortKey; dir: SortDir };
const DEFAULT_SORT: Sort = { key: "added", dir: "desc" };

function readSort(): Sort {
  try {
    const saved = JSON.parse(window.localStorage.getItem(SORT_KEY) ?? "null") as Partial<Sort> | null;
    if (saved?.key && saved.key in SORT_LABEL && (saved.dir === "asc" || saved.dir === "desc")) return saved as Sort;
  } catch {
    // Storage blocked or unreadable; fall back to newest first.
  }
  return DEFAULT_SORT;
}

function saveSort(sort: Sort) {
  try {
    window.localStorage.setItem(SORT_KEY, JSON.stringify(sort));
  } catch {
    // Not persisted; the sort still applies.
  }
}

export function LibraryView() {
  const { data } = useLibrary();
  const { setQuickAddOpen, setBulkAddOpen } = useUI();
  const [view, setView] = useState<View>("grid");
  const [filters, setFilters] = useState<LibraryFilters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<Sort>(DEFAULT_SORT);
  // Books slide toward the side of the status tab picked; other filters change the list in place.
  const [direction, setDirection] = useState<Direction>(0);
  const [leaning, setLeaning] = useLeaningSettings();

  useEffect(() => {
    setView(readView());
    setSort(readSort());
  }, []);

  const changeView = (next: View) => {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Not persisted; the view still switches.
    }
  };

  const changeStatus = (status: ReadingStatus | "all") => {
    setDirection(Math.sign(STATUS_ORDER.indexOf(status) - STATUS_ORDER.indexOf(filters.status)) as Direction);
    setFilters((f) => ({ ...f, status }));
  };

  const changeFilters = (next: LibraryFilters) => {
    setDirection(0);
    setFilters(next);
  };

  const onSort = (key: SortKey) =>
    setSort((s) => {
      const next: Sort = s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: SORT_DEFAULT_DIR[key] };
      saveSort(next);
      return next;
    });

  const books = useMemo(() => data?.books ?? [], [data]);
  const visible = useMemo(() => sortBooks(filterBooks(books, filters), sort.key, sort.dir), [books, filters, sort]);

  const counts = useMemo(() => {
    const c: Record<ReadingStatus, number> = { reading: 0, tbr: 0, completed: 0, dnf: 0 };
    for (const b of books) c[b.status]++;
    return c;
  }, [books]);

  const statusTabs: { value: ReadingStatus | "all"; label: React.ReactNode }[] = [
    { value: "all", label: <>All <span className="tabular text-muted-foreground">{books.length}</span></> },
    ...(["reading", "tbr", "completed", "dnf"] as ReadingStatus[]).map((s) => ({
      value: s,
      label: (
        <>
          {STATUS_LABEL[s]} <span className="tabular text-muted-foreground">{counts[s]}</span>
        </>
      ),
    })),
  ];

  return (
    <>
      <PageHeader
        eyebrow="Library"
        title={data ? `${books.length} books` : "Library"}
        description={
          data
            ? `${counts.reading} in progress, ${counts.completed} finished, ${counts.tbr} waiting and ${counts.dnf} set aside.`
            : undefined
        }
        actions={
          <>
            <Button variant="ghost" onClick={() => setBulkAddOpen(true)}>
              <ListPlus /> Add many
            </Button>
            <Button variant="outline" onClick={() => setQuickAddOpen(true)}>
              <Plus /> Quick add
            </Button>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <Tabs
          value={filters.status}
          onValueChange={changeStatus}
          items={statusTabs}
          layoutId="library-status"
          aria-label="Reading status"
          className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0"
        />
        <div className="flex items-center gap-4">
          {view === "leaning" && <LeaningSettingsButton settings={leaning} onChange={setLeaning} />}
          <Popover>
            <PopoverTrigger className="pressable flex h-9 items-center gap-1.5 font-display text-[13px] text-muted-foreground transition-colors hover:text-foreground data-[state=open]:text-foreground">
              <ArrowDownUp className="size-3.5" />
              {SORT_LABEL[sort.key]}
            </PopoverTrigger>
            <PopoverContent align="end" className="w-48">
              {(Object.keys(SORT_LABEL) as SortKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onSort(key)}
                  className="flex h-8 w-full items-center justify-between rounded-sm px-2 text-sm hover:bg-ink-6"
                >
                  <span className={sort.key === key ? "underline underline-offset-4" : undefined}>{SORT_LABEL[key]}</span>
                  {sort.key === key &&
                    (sort.dir === "asc" ? (
                      <ArrowUp className="size-3.5 text-muted-foreground" aria-label="Ascending" />
                    ) : (
                      <ArrowDown className="size-3.5 text-muted-foreground" aria-label="Descending" />
                    ))}
                </button>
              ))}
            </PopoverContent>
          </Popover>
          <Tabs
            value={view}
            onValueChange={changeView}
            layoutId="library-view"
            aria-label="View"
            items={[
              { value: "grid", label: <ViewLabel>Grid</ViewLabel>, icon: <LayoutGrid /> },
              { value: "shelf", label: <ViewLabel>Display</ViewLabel>, icon: <Box /> },
              { value: "leaning", label: <ViewLabel>Spines</ViewLabel>, icon: <Library /> },
              { value: "table", label: <ViewLabel>Table</ViewLabel>, icon: <Rows3 /> },
            ]}
          />
        </div>
      </div>

      <LibraryFilterBar filters={filters} onChange={changeFilters} resultCount={visible.length} />

      <div className="mt-10">
        {!data ? (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 6 }, (_, i) => (
              <LoadingBlock key={i} className="aspect-[2/3]" />
            ))}
          </div>
        ) : books.length === 0 ? (
          <div className="py-24 text-center">
            <p className="font-serif text-2xl">Your library is empty.</p>
            <p className="mt-2 text-sm text-muted-foreground">Paste a list of Goodreads links to add many books at once, or add them one at a time.</p>
            <div className="mt-6 flex justify-center gap-2">
              <Button onClick={() => setBulkAddOpen(true)}>
                <ListPlus /> Add many
              </Button>
              <Button variant="outline" onClick={() => setQuickAddOpen(true)}>
                <Plus /> Quick add
              </Button>
            </div>
          </div>
        ) : visible.length === 0 ? (
          <div className="py-24 text-center">
            <p className="font-serif text-2xl">No books match.</p>
            <button
              type="button"
              onClick={() => changeFilters(DEFAULT_FILTERS)}
              className="mt-3 font-display text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: easeOut }}
            >
              {view === "grid" && <LibraryGrid books={visible} direction={direction} showSeries={sort.key === "series"} />}
              {view === "shelf" && <LibraryShelf books={visible} direction={direction} />}
              {view === "leaning" && <LeaningShelf books={visible} settings={leaning} direction={direction} />}
              {view === "table" && <LibraryTable books={visible} sort={sort} onSort={onSort} />}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </>
  );
}

/** View names give way to their icons on phones, where four views share the row with sorting. */
function ViewLabel({ children }: { children: string }) {
  return <span className="sr-only sm:not-sr-only">{children}</span>;
}
