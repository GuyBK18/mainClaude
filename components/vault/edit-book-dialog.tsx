"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { Book } from "@/types/reading";
import { useLibrary } from "@/lib/library-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BookForm, toBookInput, validate, valuesFromBook, type BookFormValues } from "@/components/library/book-form";

export function EditBookDialog({ book, open, onOpenChange }: { book: Book; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { updateBook } = useLibrary();
  const [values, setValues] = useState<BookFormValues>(() => valuesFromBook(book));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const problem = validate(values);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    await updateBook(book.id, await toBookInput(values, book));
    setBusy(false);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setValues(valuesFromBook(book));
          setError(null);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit details</DialogTitle>
          <DialogDescription>{book.title}</DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto px-6 py-6">
          <BookForm values={values} onChange={setValues} defaultExpanded />
          {error && (
            <p role="alert" className="mt-4 text-sm">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
