"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useLibrary } from "@/lib/library-context";

/** Speaks up only when something changes: the first backup, a failure, and the recovery after it. */
export function BackupNotices() {
  const { backup } = useLibrary();
  const failing = useRef(false);

  useEffect(() => {
    if (backup.state === "failed") {
      if (!failing.current) {
        toast("Backup failed", {
          description: `${backup.error} Your library is still saved in this browser.`,
          duration: 12_000,
        });
      }
      failing.current = true;
    } else if (backup.state === "saved") {
      if (failing.current) toast("Backup is working again", { description: `Saved to ${backup.where}.` });
      else if (backup.firstSave) toast("Your library is backed up", { description: `Every change is saved to ${backup.where}.` });
      failing.current = false;
    }
  }, [backup]);

  return null;
}
