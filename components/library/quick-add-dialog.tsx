"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Link2, Loader2, PenLine } from "lucide-react";
import { toast } from "sonner";
import { useLibrary } from "@/lib/library-context";
import { useUI } from "@/lib/ui-context";
import { importFromUrl, type ImportResult } from "@/lib/import";
import { easeOut } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { Tabs } from "@/components/ui/tabs";
import { BookForm, emptyValues, toBookInput, validate, type BookFormValues } from "./book-form";

type Mode = "manual" | "url";

export function QuickAddDialog() {
  const router = useRouter();
  const { addBook } = useLibrary();
  const { quickAddOpen, setQuickAddOpen } = useUI();
  const [mode, setMode] = useState<Mode>("manual");
  const [values, setValues] = useState<BookFormValues>(emptyValues);
  const [url, setUrl] = useState("");
  const [imported, setImported] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setQuickAddOpen(false);
    // Reset after the dialog has gone so the form does not flash empty while closing.
    setTimeout(() => {
      setMode("manual");
      setValues(emptyValues());
      setUrl("");
      setImported(null);
      setError(null);
    }, 150);
  };

  const runImport = async () => {
    setError(null);
    try {
      new URL(url.trim());
    } catch {
      setError("That does not look like a full URL.");
      return;
    }
    setBusy(true);
    const result = await importFromUrl(url);
    setBusy(false);
    setImported(result);
    setValues((v) => ({
      ...v,
      title: result.title ?? v.title,
      author: result.author ?? v.author,
      pageCount: result.pageCount?.toString() ?? v.pageCount,
      publishedYear: result.publishedYear?.toString() ?? v.publishedYear,
      publisher: result.publisher ?? v.publisher,
      coverUrl: result.coverUrl ?? v.coverUrl,
      sourceUrl: result.sourceUrl,
    }));
    setMode("manual");
  };

  const save = async () => {
    const problem = validate(values);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    const book = await addBook(await toBookInput(values));
    setBusy(false);
    close();
    toast(`Added ${book.title}`, {
      action: { label: "Open", onClick: () => router.push(`/book/${book.id}`) },
    });
  };

  return (
    <Dialog open={quickAddOpen} onOpenChange={(open) => (open ? setQuickAddOpen(true) : close())}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Add a book</DialogTitle>
          <DialogDescription>Type the details or paste a link to prefill them.</DialogDescription>
          <Tabs
            value={mode}
            onValueChange={(m) => {
              setError(null);
              setMode(m);
            }}
            layoutId="quick-add-tabs"
            aria-label="Add method"
            className="mt-3 -mb-[21px]"
            items={[
              { value: "manual", label: "Manual entry", icon: <PenLine /> },
              { value: "url", label: "Import from URL", icon: <Link2 /> },
            ]}
          />
        </DialogHeader>

        <div className="overflow-y-auto px-6 py-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: easeOut }}
            >
              {mode === "manual" ? (
                <>
                  {imported && (
                    <p className="mb-5 border-l border-foreground pl-3 text-sm text-muted-foreground">
                      {imported.source === "open-library"
                        ? "Filled from Open Library. Check the fields, then save."
                        : "Could not reach a catalog for that link, so only the title came from the URL. Fill in the rest."}
                    </p>
                  )}
                  <BookForm values={values} onChange={setValues} defaultExpanded={Boolean(imported?.coverUrl)} />
                </>
              ) : (
                <form
                  className="grid gap-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void runImport();
                  }}
                >
                  <Label htmlFor="import-url">Book URL</Label>
                  <div className="flex gap-2">
                    <Input
                      id="import-url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://openlibrary.org/works/OL45804W"
                      autoFocus
                    />
                    <Button type="submit" variant="outline" disabled={!url.trim() || busy}>
                      {busy ? <Loader2 className="animate-spin" /> : null}
                      Fetch
                    </Button>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Open Library links and any link with an ISBN fill in title, author, pages and cover. Goodreads,
                    Amazon and other links fill in the title from the address.
                  </p>
                </form>
              )}
            </motion.div>
          </AnimatePresence>
          {error && (
            <p role="alert" className="mt-4 text-sm text-foreground">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          {mode === "manual" && (
            <Button onClick={() => void save()} disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              Add to library
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
