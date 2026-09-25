import { promises as fs } from "fs";
import os from "os";
import path from "path";
import type { LibrarySnapshot } from "@/lib/data/repository";
import { toISODate } from "@/lib/dates";

/**
 * The backup on disk, written by the local server. One file holds the whole library, and a
 * copy per day sits next to it. Server only: it touches the file system.
 */

const FILE = "library.json";
const COPIES = "daily";
// Daily copies are kept for this many days, counted by the days that have one.
const KEEP_DAYS = 30;
const COPY_NAME = /^(\d{4}-\d{2}-\d{2})(-before-restore)?\.json$/;

export interface Copy {
  /** File name without the extension, e.g. "2026-09-24" or "2026-09-25-before-restore". */
  id: string;
  date: string;
  beforeRestore: boolean;
  books: number;
  updatedAt?: string;
}

function expandHome(dir: string) {
  return dir.startsWith("~") ? path.join(os.homedir(), dir.slice(1)) : dir;
}

async function exists(p: string) {
  return fs.stat(p).then(
    () => true,
    () => false,
  );
}

/** `LUMINAREAD_DATA_DIR` when set, then iCloud Drive when this Mac has it, then Documents. */
export async function backupDir() {
  const configured = process.env.LUMINAREAD_DATA_DIR?.trim();
  if (configured) return path.resolve(expandHome(configured));
  const icloud = path.join(os.homedir(), "Library", "Mobile Documents", "com~apple~CloudDocs");
  if (await exists(icloud)) return path.join(icloud, "LuminaRead");
  return path.join(os.homedir(), "Documents", "LuminaRead");
}

/** The folder as a person would name it: "iCloud Drive/LuminaRead", "~/Documents/LuminaRead". */
export function describeDir(dir: string) {
  const icloud = path.join(os.homedir(), "Library", "Mobile Documents", "com~apple~CloudDocs");
  if (dir === icloud || dir.startsWith(icloud + path.sep)) return `iCloud Drive${dir.slice(icloud.length)}`;
  const home = os.homedir();
  return dir.startsWith(home + path.sep) ? `~${dir.slice(home.length)}` : dir;
}

export function isSnapshot(value: unknown): value is LibrarySnapshot {
  const v = value as LibrarySnapshot | null;
  return (
    typeof v === "object" &&
    v !== null &&
    Array.isArray(v.books) &&
    Array.isArray(v.highlights) &&
    Array.isArray(v.sessions) &&
    Array.isArray(v.goals) &&
    v.books.every((b) => typeof b?.id === "string" && typeof b?.title === "string")
  );
}

async function readJson(file: string): Promise<LibrarySnapshot> {
  const parsed: unknown = JSON.parse(await fs.readFile(file, "utf8"));
  if (!isSnapshot(parsed)) throw new Error(`${path.basename(file)} is not a LuminaRead library.`);
  return parsed;
}

/** The saved library, or null when there is none yet. Throws when the file cannot be read. */
export async function readLibrary(dir: string): Promise<LibrarySnapshot | null> {
  const file = path.join(dir, FILE);
  if (!(await exists(file))) {
    // iCloud's "Optimize Mac Storage" can leave only a placeholder until the file is opened in Finder.
    if (await exists(path.join(dir, `.${FILE}.icloud`))) {
      throw new Error("The backup is in iCloud but not downloaded to this Mac. Open the LuminaRead folder in Finder, then reload.");
    }
    return null;
  }
  return readJson(file);
}

async function writeAtomic(file: string, text: string) {
  // Unique per write, so two saves at once never share a temp file.
  const temp = `${file}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`;
  await fs.writeFile(temp, text, "utf8");
  await fs.rename(temp, file);
}

/**
 * Saves the library and today's copy. Before a restore, the library being replaced is kept
 * as its own copy, so a restore can itself be undone. Returns whether the file is new.
 */
export async function writeLibrary(dir: string, library: LibrarySnapshot, options: { restore?: boolean; now?: Date } = {}) {
  const copies = path.join(dir, COPIES);
  await fs.mkdir(copies, { recursive: true });
  const file = path.join(dir, FILE);
  const created = !(await exists(file));
  const day = toISODate(options.now ?? new Date());

  if (options.restore && !created) await fs.copyFile(file, path.join(copies, `${day}-before-restore.json`));

  const text = JSON.stringify(library);
  await writeAtomic(file, text);
  await writeAtomic(path.join(copies, `${day}.json`), text);
  await prune(copies);
  return { created };
}

async function prune(copies: string) {
  const names = (await fs.readdir(copies)).filter((n) => COPY_NAME.test(n));
  const days = [...new Set(names.map((n) => n.slice(0, 10)))].sort().reverse();
  const keep = new Set(days.slice(0, KEEP_DAYS));
  await Promise.all(names.filter((n) => !keep.has(n.slice(0, 10))).map((n) => fs.unlink(path.join(copies, n))));
}

/** Daily copies, newest first. */
export async function listCopies(dir: string): Promise<Copy[]> {
  const copies = path.join(dir, COPIES);
  if (!(await exists(copies))) return [];
  const names = (await fs.readdir(copies)).filter((n) => COPY_NAME.test(n)).sort().reverse();
  const list = await Promise.all(
    names.map(async (name): Promise<Copy | null> => {
      const [, date, before] = name.match(COPY_NAME)!;
      try {
        const library = await readJson(path.join(copies, name));
        return { id: name.slice(0, -5), date, beforeRestore: Boolean(before), books: library.books.length, updatedAt: library.updatedAt };
      } catch {
        return null;
      }
    }),
  );
  return list.filter((c): c is Copy => c !== null);
}

export async function readCopy(dir: string, id: string) {
  if (!COPY_NAME.test(`${id}.json`)) throw new Error("No such copy.");
  return readJson(path.join(dir, COPIES, `${id}.json`));
}
