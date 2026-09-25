"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ImageIcon, Plus, Trash2 } from "lucide-react";
import type { Book, Highlight } from "@/types/reading";
import { useLibrary } from "@/lib/library-context";
import { formatDate } from "@/lib/dates";
import { layoutSpring } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";

export function HighlightsPanel({
  book,
  highlights,
  onMakeCard,
}: {
  book: Book;
  highlights: Highlight[];
  onMakeCard: (text: string) => void;
}) {
  const { addHighlight, deleteHighlight } = useLibrary();
  const [text, setText] = useState("");
  const [page, setPage] = useState("");
  const [note, setNote] = useState("");

  const add = async () => {
    if (!text.trim()) return;
    await addHighlight({
      bookId: book.id,
      text: text.trim(),
      page: page ? Number(page) : undefined,
      note: note.trim() || undefined,
    });
    setText("");
    setPage("");
    setNote("");
  };

  return (
    <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        {highlights.length === 0 ? (
          <p className="border-t border-border pt-6 font-serif text-xl text-muted-foreground italic">
            No highlights yet. Passages you save here can become quote cards.
          </p>
        ) : (
          <motion.ul layout className="border-t border-border">
            <AnimatePresence initial={false} mode="popLayout">
              {highlights.map((h) => (
                <motion.li
                  layout
                  key={h.id}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, transition: { duration: 0.15 } }}
                  transition={layoutSpring}
                  className="group border-b border-border py-7"
                >
                  <blockquote className="font-serif text-[22px] leading-[1.45] tracking-[-0.005em]">“{h.text}”</blockquote>
                  {h.note && <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted-foreground">{h.note}</p>}
                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span className="tabular font-display text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
                      {[h.page ? `p. ${h.page}` : null, h.chapter, formatDate(h.createdAt.slice(0, 10))].filter(Boolean).join(" · ")}
                    </span>
                    <div className="ml-auto flex items-center gap-1 transition-opacity duration-150 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100">
                      <Button variant="ghost" size="sm" onClick={() => onMakeCard(h.text)}>
                        <ImageIcon /> Make a card
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label="Delete highlight" onClick={() => void deleteHighlight(h.id)}>
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        )}
      </div>

      <form
        className="grid h-fit gap-4 rounded-lg border border-border bg-surface p-5 lg:sticky lg:top-24"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <p className="label-meta text-foreground">New highlight</p>
        <div className="grid gap-2">
          <Label htmlFor="hl-text">Passage</Label>
          <Textarea id="hl-text" value={text} onChange={(e) => setText(e.target.value)} rows={4} className="font-serif text-[15px]" />
        </div>
        <div className="grid grid-cols-[6rem_1fr] gap-3">
          <div className="grid gap-2">
            <Label htmlFor="hl-page">Page</Label>
            <Input id="hl-page" inputMode="numeric" value={page} onChange={(e) => setPage(e.target.value.replace(/\D/g, ""))} className="tabular" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="hl-note">Note</Label>
            <Input id="hl-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <Button type="submit" variant="outline" disabled={!text.trim()}>
          <Plus /> Save highlight
        </Button>
      </form>
    </div>
  );
}
