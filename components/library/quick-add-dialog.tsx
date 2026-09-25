"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Link2, Loader2, PenLine, Search } from "lucide-react";
import { toast } from "sonner";
import type { BookCandidate, BookDetails } from "@/lib/metadata/types";
import { fetchDetails } from "@/lib/metadata/client";
import { generatedCover } from "@/lib/cover";
import { useLibrary } from "@/lib/library-context";
import { useUI } from "@/lib/ui-context";
import { easeOut } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { Tabs } from "@/components/ui/tabs";
import { BookForm, emptyValues, toBookInput, validate, valuesFromDetails, type BookFormValues } from "./book-form";
import { BookSearch } from "./book-search";
import { CoverPicker } from "./cover-picker";
import { DetailsPreview } from "./details-preview";

type Mode = "search" | "manual" | "url";

export function QuickAddDialog() {
  const router = useRouter();
  const { addBook } = useLibrary();
  const { quickAddOpen, setQuickAddOpen } = useUI();
  const [mode, setMode] = useState<Mode>("search");
  const [values, setValues] = useState<BookFormValues>(emptyValues);
  const [details, setDetails] = useState<BookDetails | null>(null);
  const [url, setUrl] = useState("");
  const [urlChoices, setUrlChoices] = useState<BookCandidate[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setQuickAddOpen(false);
    // Reset after the dialog has gone so the form does not flash empty while closing.
    setTimeout(() => {
      setMode("search");
      setValues(emptyValues());
      setDetails(null);
      setUrl("");
      setUrlChoices(null);
      setError(null);
    }, 150);
  };

  const applyDetails = (d: BookDetails) => {
    setDetails(d);
    // Keep what the reader already chose for their own copy.
    setValues((v) => valuesFromDetails(d, { ...emptyValues(), status: v.status, format: v.format }));
    setError(null);
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
    try {
      const res = await fetchDetails({ url: url.trim() });
      if ("details" in res) applyDetails(res.details);
      else if (res.candidates.length) setUrlChoices(res.candidates);
      else setError("Nothing in the catalogs matches that link. Try the Search tab.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
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

  const reviewing = details !== null && mode !== "manual";
  const canSave = mode === "manual" || reviewing;

  const review = details && (
    <>
      <DetailsPreview
        details={details}
        cover={{ ...generatedCover(values.title || details.title), url: values.coverUrl.trim() || undefined }}
        onBack={() => {
          setDetails(null);
          setError(null);
        }}
      />
      <div className="mt-8 border-t border-foreground pt-5">
        <p className="label-meta mb-5 text-foreground">Your copy</p>
        <div className="grid gap-6">
          <CoverPicker
            details={details}
            title={values.title}
            value={values.coverUrl}
            onChange={(coverUrl) => setValues((v) => ({ ...v, coverUrl }))}
          />
          <BookForm values={values} onChange={setValues} autoFocus={false} />
        </div>
      </div>
    </>
  );

  let panel: React.ReactNode = null;
  if (mode === "manual") {
    panel = <BookForm values={values} onChange={setValues} />;
  } else if (reviewing) {
    panel = review;
  } else if (mode === "url" && urlChoices) {
    panel = (
      <>
        <p className="mb-4 text-sm text-muted-foreground">That link names a title but not an edition. Pick the one you mean.</p>
        <BookSearch onDetails={applyDetails} initialCandidates={urlChoices} />
      </>
    );
  } else if (mode === "url") {
    panel = (
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
            placeholder="https://www.goodreads.com/book/show/…"
            autoFocus
          />
          <Button type="submit" variant="outline" disabled={!url.trim() || busy}>
            {busy ? <Loader2 className="animate-spin" /> : null}
            Fetch
          </Button>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          A Goodreads book page is the most exact: every field loads from that page. Links with an ISBN (Open Library,
          Amazon) also load the full record. Other links are searched by the title in the address and give you a list
          to pick from.
        </p>
      </form>
    );
  }

  return (
    <Dialog open={quickAddOpen} onOpenChange={(open) => (open ? setQuickAddOpen(true) : close())}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add a book</DialogTitle>
          <DialogDescription>Search the catalogs and pick the right edition, or type the details yourself.</DialogDescription>
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
              { value: "search", label: "Search", icon: <Search /> },
              { value: "manual", label: "Manual entry", icon: <PenLine /> },
              { value: "url", label: "Import from URL", icon: <Link2 /> },
            ]}
          />
        </DialogHeader>

        <div className="min-h-[320px] overflow-y-auto px-6 py-6">
          {/* Search stays mounted under the review, so "Back to results" returns to the same list. */}
          <div hidden={mode !== "search" || reviewing}>
            <BookSearch onDetails={applyDetails} />
          </div>
          <AnimatePresence mode="wait" initial={false}>
            {panel && (
              <motion.div
                key={`${mode}-${reviewing ? "review" : urlChoices ? "choices" : "start"}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16, ease: easeOut }}
              >
                {panel}
              </motion.div>
            )}
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
          {canSave && (
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
