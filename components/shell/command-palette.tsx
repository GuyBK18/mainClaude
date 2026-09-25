"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Dialog as DialogPrimitive } from "radix-ui";
import { BarChart3, BookOpen, LayoutDashboard, Library, ListPlus, Moon, Plus, Quote, Sun } from "lucide-react";
import { useLibrary } from "@/lib/library-context";
import { useUI } from "@/lib/ui-context";
import { STATUS_LABEL } from "@/lib/labels";
import { BookCover } from "@/components/book/book-cover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";

/** Every typed word must appear somewhere in the item. Fuzzy letter matching finds too much in long quotes. */
function matchAllWords(value: string, search: string) {
  const haystack = value.toLowerCase();
  return search
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word))
    ? 1
    : 0;
}

/**
 * Global search. Opens instantly with no enter animation: it is a keyboard action
 * used many times a day, and any motion there reads as lag.
 */
export function CommandPalette() {
  const router = useRouter();
  const { data } = useLibrary();
  const { commandOpen, setCommandOpen, setQuickAddOpen, setBulkAddOpen } = useUI();
  const { resolvedTheme, setTheme } = useTheme();
  const [search, setSearch] = useState("");

  const books = useMemo(() => data?.books ?? [], [data]);
  const bookById = useMemo(() => new Map(books.map((b) => [b.id, b])), [books]);
  const reading = books.filter((b) => b.status === "reading");
  const searching = search.trim().length > 0;

  const run = (fn: () => void) => {
    setCommandOpen(false);
    setSearch("");
    fn();
  };

  return (
    <DialogPrimitive.Root
      open={commandOpen}
      onOpenChange={(open) => {
        setCommandOpen(open);
        if (!open) setSearch("");
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/55 backdrop-blur-xl" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed top-[12dvh] left-1/2 z-50 w-[calc(100vw-32px)] max-w-[600px] -translate-x-1/2 overflow-hidden rounded-lg border border-border bg-surface outline-none"
        >
          <DialogPrimitive.Title className="sr-only">Search the library</DialogPrimitive.Title>
          <Command loop filter={matchAllWords}>
            <CommandInput
              value={search}
              onValueChange={setSearch}
              placeholder="Search books, authors, highlights…"
            />
            <CommandList>
              <CommandEmpty>Nothing matches “{search}”.</CommandEmpty>

              {!searching && reading.length > 0 && (
                <CommandGroup heading="Reading now">
                  {reading.map((book) => (
                    <CommandItem key={book.id} value={`reading ${book.title} ${book.author}`} onSelect={() => run(() => router.push(`/book/${book.id}`))}>
                      <BookCover book={book} className="w-6 shrink-0" />
                      <span className="truncate">{book.title}</span>
                      <span className="truncate text-muted-foreground">{book.author}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {searching && (
                <CommandGroup heading="Books">
                  {books.map((book) => (
                    <CommandItem
                      key={book.id}
                      value={`${book.title} ${book.author} ${book.genres.join(" ")} ${book.series?.name ?? ""}`}
                      onSelect={() => run(() => router.push(`/book/${book.id}`))}
                    >
                      <BookCover book={book} className="w-6 shrink-0" />
                      <span className="min-w-0 truncate">{book.title}</span>
                      <span className="hidden min-w-0 truncate text-muted-foreground sm:inline">{book.author}</span>
                      <CommandShortcut>{STATUS_LABEL[book.status]}</CommandShortcut>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {searching && (data?.highlights.length ?? 0) > 0 && (
                <CommandGroup heading="Highlights">
                  {data!.highlights.map((h) => {
                    const book = bookById.get(h.bookId);
                    return (
                      <CommandItem
                        key={h.id}
                        value={`${h.text} ${book?.title ?? ""} ${book?.author ?? ""}`}
                        onSelect={() => run(() => router.push(`/book/${h.bookId}?tab=highlights`))}
                        className="items-start"
                      >
                        <Quote className="mt-1 size-3.5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0">
                          <span className="line-clamp-2 font-serif text-[15px] leading-snug italic">{h.text}</span>
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{book?.title}</span>
                        </span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}

              <CommandGroup heading="Go to">
                <CommandItem value="go dashboard home" onSelect={() => run(() => router.push("/"))}>
                  <LayoutDashboard className="size-4 text-muted-foreground" /> Dashboard
                </CommandItem>
                <CommandItem value="go library books shelf" onSelect={() => run(() => router.push("/library"))}>
                  <Library className="size-4 text-muted-foreground" /> Library
                </CommandItem>
                <CommandItem value="go analytics charts stats" onSelect={() => run(() => router.push("/analytics"))}>
                  <BarChart3 className="size-4 text-muted-foreground" /> Analytics
                </CommandItem>
              </CommandGroup>

              <CommandGroup heading="Actions">
                <CommandItem value="add new book import url" onSelect={() => run(() => setQuickAddOpen(true))}>
                  <Plus className="size-4 text-muted-foreground" /> Add a book
                </CommandItem>
                <CommandItem value="add many books bulk list links goodreads import" onSelect={() => run(() => setBulkAddOpen(true))}>
                  <ListPlus className="size-4 text-muted-foreground" /> Add many books from links
                </CommandItem>
                <CommandItem
                  value="theme toggle dark light paper obsidian"
                  onSelect={() => run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))}
                >
                  {resolvedTheme === "dark" ? (
                    <Sun className="size-4 text-muted-foreground" />
                  ) : (
                    <Moon className="size-4 text-muted-foreground" />
                  )}
                  Switch to {resolvedTheme === "dark" ? "Paper" : "Obsidian"}
                </CommandItem>
                {!searching && reading[0] && (
                  <CommandItem value="continue reading" onSelect={() => run(() => router.push(`/book/${reading[0].id}`))}>
                    <BookOpen className="size-4 text-muted-foreground" /> Continue {reading[0].title}
                  </CommandItem>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
