"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

/**
 * A preference kept in this browser's localStorage, such as the library view. The server render
 * and hydration use `fallback`; the stored value follows right after, with no mismatch.
 */

const listeners = new Set<() => void>();
// Values that could not be stored (storage blocked or full), so the choice still applies this session.
const memory = new Map<string, string>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function readRaw(key: string) {
  if (memory.has(key)) return memory.get(key)!;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export interface StoredValueOptions<T> {
  /** Turns the stored text into a value, or undefined when it is not usable. */
  parse: (raw: string) => T | undefined;
  serialize?: (value: T) => string;
}

const json = (value: unknown) => JSON.stringify(value);

/** `parse`, `serialize` and `fallback` should be stable (defined outside the component). */
export function useStoredValue<T>(key: string, fallback: T, { parse, serialize = json }: StoredValueOptions<T>) {
  const raw = useSyncExternalStore(
    subscribe,
    () => readRaw(key),
    () => null,
  );

  const value = useMemo(() => {
    if (raw === null) return fallback;
    try {
      return parse(raw) ?? fallback;
    } catch {
      return fallback;
    }
  }, [raw, fallback, parse]);

  const set = useCallback(
    (next: T) => {
      const text = serialize(next);
      try {
        window.localStorage.setItem(key, text);
        memory.delete(key);
      } catch {
        // Not persisted; the in-memory copy keeps the choice for this session.
        memory.set(key, text);
      }
      for (const listener of listeners) listener();
    },
    [key, serialize],
  );

  return [value, set] as const;
}
