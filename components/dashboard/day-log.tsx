"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useLibrary } from "@/lib/library-context";
import { booksForDay } from "@/lib/progress";
import { formatDate, parseISODate } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { BookCover } from "@/components/book/book-cover";

const WEEKDAY = new Intl.DateTimeFormat("en", { weekday: "long" });

/**
 * Fills in or fixes the pages read on one day, book by book. A book in progress moves its page
 * by the difference; a finished book only takes pages that were never logged.
 */
export function DayLog({ date, onDone }: { date: string; onDone: () => void }) {
  const { data, setDayPages } = useLibrary();
  // The list is fixed when the panel opens, so saving does not reshuffle it.
  const [rows] = useState(() => (data ? booksForDay(data.books, data.sessions, date) : []));
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.book.id, r.pages ? String(r.pages) : ""])),
  );
  const [busy, setBusy] = useState(false);
  const changed = useMemo(() => rows.filter((r) => Number(values[r.book.id] || 0) !== r.pages), [rows, values]);

  const save = async () => {
    if (!changed.length) return onDone();
    setBusy(true);
    const count = await setDayPages(
      date,
      changed.map((r) => ({ bookId: r.book.id, pages: Number(values[r.book.id] || 0) })),
    );
    setBusy(false);
    toast(count ? `Saved reading for ${formatDate(date)}` : "Nothing to change on that day");
    onDone();
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="border-b border-border px-4 pt-3.5 pb-3">
        <p className="label-meta">{WEEKDAY.format(parseISODate(date))}</p>
        <p className="mt-1 font-display text-sm">{formatDate(date)}</p>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-5 text-sm text-muted-foreground">No book was being read around this day.</p>
      ) : (
        <ul className="max-h-72 overflow-y-auto px-2 py-2">
          {rows.map(({ book }) => (
            <li key={book.id} className="flex items-center gap-3 rounded-sm px-2 py-1.5">
              <BookCover book={book} className="w-6 shrink-0" />
              <span className="min-w-0 flex-1 truncate text-[13px]">{book.title}</span>
              <label className="flex items-center gap-1.5 font-display text-xs text-muted-foreground">
                <input
                  aria-label={`Pages of ${book.title} read that day`}
                  inputMode="numeric"
                  placeholder="0"
                  value={values[book.id]}
                  onChange={(e) => setValues((v) => ({ ...v, [book.id]: e.target.value.replace(/\D/g, "") }))}
                  className="tabular w-[5ch] border-b border-border bg-transparent text-right text-[13px] text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-foreground"
                />
                pages
              </label>
            </li>
          ))}
        </ul>
      )}

      <div className="flex justify-end gap-2 border-t border-border px-3 py-2.5">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={busy || rows.length === 0}>
          Save
        </Button>
      </div>
    </form>
  );
}
