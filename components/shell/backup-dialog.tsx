"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/dates";
import { useLibrary } from "@/lib/library-context";
import { useUI } from "@/lib/ui-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Copy {
  id: string;
  date: string;
  beforeRestore: boolean;
  books: number;
  updatedAt?: string;
}

const time = new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" });
const stamp = new Intl.DateTimeFormat("en", { day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });

/** Where the backup lives, when it last saved, and the daily copies to go back to. */
export function BackupDialog() {
  const { data, backup, restoreCopy } = useLibrary();
  const { backupOpen, setBackupOpen } = useUI();
  const [copies, setCopies] = useState<Copy[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Copy | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    if (!backupOpen) return;
    setCopies(null);
    setError(null);
    setConfirming(null);
    fetch("/api/library/copies", { cache: "no-store" })
      .then(async (res) => {
        const body = (await res.json()) as { copies?: Copy[]; error?: string };
        if (!res.ok) throw new Error(body.error ?? "Could not list the copies.");
        setCopies(body.copies ?? []);
      })
      .catch((e: Error) => setError(e.message));
  }, [backupOpen]);

  const restore = async (copy: Copy) => {
    setRestoring(true);
    try {
      await restoreCopy(copy.id);
      setBackupOpen(false);
      toast(`Restored the copy from ${formatDate(copy.date)}`, { description: "The library it replaced is kept as a copy." });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRestoring(false);
    }
  };

  let status: string;
  if (backup.state === "saved") {
    status = `Every change is saved to ${backup.where}.${backup.savedAt ? ` Last change saved ${stamp.format(new Date(backup.savedAt))}.` : ""}`;
  } else if (backup.state === "failed") {
    status = `The backup is not working: ${backup.error}`;
  } else {
    status = "Checking the backup…";
  }

  return (
    <Dialog open={backupOpen} onOpenChange={setBackupOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Backup</DialogTitle>
          <DialogDescription>{status}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
          <p className="label-meta mb-3">Daily copies</p>
          {error ? (
            <p role="alert" className="text-sm">
              {error}
            </p>
          ) : !copies ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : copies.length === 0 ? (
            <p className="text-sm text-muted-foreground">No copies yet. The first one is made with your next change.</p>
          ) : (
            <ul className="divide-y divide-border">
              {copies.map((copy) => (
                <li key={copy.id} className="flex items-center justify-between gap-4 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm">
                      {formatDate(copy.date)}
                      {copy.beforeRestore && <span className="text-muted-foreground"> · before a restore</span>}
                    </p>
                    <p className="tabular text-xs text-muted-foreground">
                      {copy.books} {copy.books === 1 ? "book" : "books"}
                      {copy.updatedAt && ` · last change ${time.format(new Date(copy.updatedAt))}`}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setConfirming(copy)} disabled={backup.state !== "saved"}>
                    Restore
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {confirming && (
          <DialogFooter className="sm:items-center">
            <p className="mr-auto text-sm">
              Replace your {data?.books.length ?? 0} books with the {confirming.books} from {formatDate(confirming.date)}? The current
              library is kept as a copy.
            </p>
            <Button variant="ghost" onClick={() => setConfirming(null)} disabled={restoring}>
              Cancel
            </Button>
            <Button onClick={() => void restore(confirming)} disabled={restoring}>
              {restoring && <Loader2 className="animate-spin" />}
              Restore
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
