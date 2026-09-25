"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

interface UIContextValue {
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
  quickAddOpen: boolean;
  setQuickAddOpen: (open: boolean) => void;
  /** The dialog that adds a pasted list of links in one go. */
  bulkAddOpen: boolean;
  setBulkAddOpen: (open: boolean) => void;
}

const UIContext = createContext<UIContextValue | null>(null);

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [commandOpen, setCommandOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpenState] = useState(false);
  const [bulkAddOpen, setBulkAddOpenState] = useState(false);

  const setQuickAddOpen = useCallback((open: boolean) => {
    if (open) {
      setCommandOpen(false);
      setBulkAddOpenState(false);
    }
    setQuickAddOpenState(open);
  }, []);

  const setBulkAddOpen = useCallback((open: boolean) => {
    if (open) {
      setCommandOpen(false);
      setQuickAddOpenState(false);
    }
    setBulkAddOpenState(open);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setCommandOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const value = useMemo(
    () => ({ commandOpen, setCommandOpen, quickAddOpen, setQuickAddOpen, bulkAddOpen, setBulkAddOpen }),
    [commandOpen, quickAddOpen, setQuickAddOpen, bulkAddOpen, setBulkAddOpen],
  );
  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error("useUI must be used inside <UIProvider>");
  return ctx;
}
