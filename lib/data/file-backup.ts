import type { LibraryRepository, LibrarySnapshot } from "./repository";

/**
 * Keeps a file on this computer in step with the library in the browser. The local server
 * writes it (see app/api/library). On start, whichever copy changed last wins: a browser with
 * nothing in it gets the library back from the file, and changes made while the server was
 * down go to the file. After that, every change is sent within a moment.
 */

export type BackupStatus =
  | { state: "starting" }
  | { state: "saved"; where: string; savedAt?: string; firstSave?: boolean }
  | { state: "failed"; where?: string; error: string };

export interface FileBackup {
  /** Settles once the browser and the file agree, or the file could not be read. */
  ready: Promise<void>;
  /** Replaces the library with a daily copy. The library it replaces is kept as a copy too. */
  restore(copyId: string): Promise<void>;
  stop(): void;
}

// Short enough that closing the tab right after a change rarely misses it. A missed change still
// reaches the file on the next start, since this browser's copy is then the newer one.
const DELAY_MS = 400;
// The first request after `npm run dev` also compiles the route, which can take a few seconds.
const READ_TIMEOUT_MS = 10_000;

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, { cache: "no-store", ...init });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `The backup answered with status ${res.status}.`);
  return body;
}

const hasContent = (s: LibrarySnapshot) => s.books.length + s.highlights.length + s.sessions.length + s.goals.length > 0;
// ISO timestamps sort as text; a library that was never stamped sorts first.
const stampOf = (s: LibrarySnapshot) => s.updatedAt ?? "";

function unionById<T extends { id: string }>(first: T[], second: T[]) {
  const ids = new Set(first.map((x) => x.id));
  return [...first, ...second.filter((x) => !ids.has(x.id))];
}

/**
 * Joins a library that was never backed up into the backup, so neither loses anything. The
 * backup's version wins where both have the same book.
 */
export function mergeLibraries(backup: LibrarySnapshot, local: LibrarySnapshot): LibrarySnapshot {
  const years = new Set(backup.goals.map((g) => g.year));
  return {
    ...backup,
    books: unionById(backup.books, local.books),
    highlights: unionById(backup.highlights, local.highlights),
    sessions: unionById(backup.sessions, local.sessions),
    goals: [...backup.goals, ...local.goals.filter((g) => !years.has(g.year))],
  };
}

export function startFileBackup(repo: LibraryRepository, onStatus: (status: BackupStatus) => void): FileBackup {
  // Nothing is written until the file has been read, so a new or broken browser never replaces a good backup.
  let enabled = false;
  let stopped = false;
  let where: string | undefined;
  let pending: { snapshot: LibrarySnapshot; restore: boolean } | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let sending = false;
  let restoring = false;

  const send = async () => {
    if (sending || !pending || stopped) return;
    const { snapshot, restore } = pending;
    pending = null;
    sending = true;
    try {
      const res = await request<{ where: string; created: boolean; savedAt: string }>(`/api/library${restore ? "?restore=1" : ""}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshot),
      });
      where = res.where;
      if (!stopped) onStatus({ state: "saved", where: res.where, savedAt: res.savedAt, firstSave: res.created });
    } catch (error) {
      if (!stopped) onStatus({ state: "failed", where, error: (error as Error).message });
    } finally {
      sending = false;
      if (pending) void send();
    }
  };

  const save = (snapshot: LibrarySnapshot, restore = false) => {
    pending = { snapshot, restore: restore || Boolean(pending?.restore) };
    clearTimeout(timer);
    timer = setTimeout(() => void send(), DELAY_MS);
  };

  const unsubscribe = repo.subscribe((snapshot, cause) => {
    // Another tab sends its own changes.
    if (!enabled || cause !== "change") return;
    save(snapshot, restoring);
    restoring = false;
  });

  const ready = (async () => {
    try {
      // Compared by what the browser held before asking, so a change made while the file loads
      // cannot make an almost empty browser look newer than the backup.
      const before = await repo.load();
      const res = await request<{ where: string; library: LibrarySnapshot | null }>("/api/library", {
        signal: AbortSignal.timeout(READ_TIMEOUT_MS),
      });
      if (stopped) return;
      where = res.where;
      const local = await repo.load();
      const file = res.library;

      if (!file) {
        // First run: this browser's library becomes the backup.
        if (hasContent(local)) save(await repo.replace(local, { change: true }));
      } else {
        const neverSynced = !before.updatedAt && hasContent(before);
        const fileIsNewer = stampOf(file) > stampOf(before) || (!file.updatedAt && !before.updatedAt && !hasContent(before));
        const changedMeanwhile = local.updatedAt !== before.updatedAt;

        if (neverSynced || (fileIsNewer && changedMeanwhile)) {
          // A library from before backups existed, or a change made while the file loaded: keep both.
          save(await repo.replace(mergeLibraries(file, local), { change: true }));
        } else if (fileIsNewer) {
          // An empty browser, or changes made in another browser.
          await repo.replace(file);
        } else if (local.updatedAt !== file.updatedAt) {
          // Changes made here that never reached the file.
          save(local);
        }
      }
      enabled = true;
      onStatus({ state: "saved", where: res.where, savedAt: file?.updatedAt });
    } catch (error) {
      if (stopped) return;
      const message =
        (error as Error).name === "TimeoutError" ? "The backup did not answer. Is `npm run dev` running?" : (error as Error).message;
      onStatus({ state: "failed", where, error: message });
    }
  })();

  return {
    ready,
    async restore(copyId) {
      if (!enabled) throw new Error("The backup is not available right now.");
      const { library } = await request<{ library: LibrarySnapshot }>(`/api/library/copies?id=${encodeURIComponent(copyId)}`);
      restoring = true;
      await repo.replace(library, { change: true });
    },
    stop() {
      stopped = true;
      clearTimeout(timer);
      unsubscribe();
    },
  };
}
