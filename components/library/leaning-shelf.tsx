"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { Book } from "@/types/reading";
import { spinePalette } from "@/lib/cover";
import { swapVariants, type Direction } from "@/lib/motion";
import {
  boardLines,
  DEFAULT_LEANING,
  EYE_ABOVE,
  layoutRows,
  PERSPECTIVE,
  PLINTH,
  pullTarget,
  shadowShift,
  SHELF_HEIGHT,
  slabOf,
  springStep,
  transformAt,
  type LeaningSettings,
  type Placed,
  type Slab,
} from "@/lib/leaning-shelf";
import { boardInsides, pageFaces } from "@/lib/book-shape";
import { BookCover } from "@/components/book/book-cover";
import { shelfBoard } from "./shelf-board";

const swap = swapVariants({ opacity: 0, y: 12 });

/**
 * The Spines view: books standing at an angle, pressed one against the next, the way they lean on a desk.
 * Pointing at a book slides it out along its cover and, in the "turn" mode, turns it to
 * face the reader. The motion math lives in `lib/leaning-shelf.ts`, where it is tested.
 */
export function LeaningShelf({
  books,
  settings,
  direction = 0,
}: {
  books: Book[];
  settings: LeaningSettings;
  direction?: Direction;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // A new set of books swaps in as a whole, sliding toward the status tab picked.
  const setKey = books.map((b) => b.id).join(",");

  return (
    <div ref={ref} className="relative">
      <AnimatePresence mode="popLayout" initial={false} custom={{ direction, index: 0 }}>
        <motion.div key={setKey} variants={swap} custom={{ direction, index: 0 }} initial="hidden" animate="shown" exit="gone">
          {width > 0 && <Shelves books={books} settings={settings} width={width} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function Shelves({ books, settings, width }: { books: Book[]; settings: LeaningSettings; width: number }) {
  const slabs = useMemo(() => books.map(slabOf), [books]);
  // Room on the left for the first book of a row to slide out. Phones have no page margin to spare.
  const inset = width < 640 ? 40 : 8;
  const rows = useMemo(() => layoutRows(slabs, settings, width, inset), [slabs, settings, width, inset]);
  const reduce = useReducedMotion() ?? false;
  const [motionState] = useState(() => new ShelfMotion());

  useLayoutEffect(() => {
    motionState.setup(rows, slabs, books.map((b) => b.id), settings, reduce);
  }, [motionState, rows, slabs, books, settings, reduce]);

  useEffect(() => {
    // Touch has no pointer leaving: a tap anywhere else puts the book back.
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" && !(e.target instanceof Element && e.target.closest("[data-leaning-book]"))) motionState.setUp(null);
    };
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      motionState.stop();
    };
  }, [motionState]);

  return (
    <div className="grid gap-2">
      {rows.map((row, r) => (
        <div
          key={r}
          className="relative"
          style={{
            height: SHELF_HEIGHT,
            perspective: PERSPECTIVE,
            perspectiveOrigin: `50% -${EYE_ABOVE}px`,
            backgroundImage: shelfBoard({ ...boardLines(), row: SHELF_HEIGHT }),
          }}
        >
          {/* Contact shadows, flat and behind every book. Depth belongs to the cover layer, so this is allowed. */}
          <div aria-hidden className="absolute inset-0">
            {row.map((placed) => (
              <span key={books[placed.index].id} ref={motionState.shadowRef(books[placed.index].id)} className="absolute h-3 origin-[30%_50%]" style={{ bottom: PLINTH - 6 }}>
                <span className="absolute inset-0 rounded-[50%] bg-black opacity-45 blur-[7px] dark:opacity-70" />
              </span>
            ))}
          </div>

          {/* One shared 3D scene, so the browser works out which book is in front at every frame. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 [transform-style:preserve-3d]">
            {row.map((placed) => (
              <LeaningBook key={books[placed.index].id} book={books[placed.index]} slab={slabs[placed.index]} ref={motionState.bookRef(books[placed.index].id)} />
            ))}
          </div>

          {/* Flat hover areas that do not move with the books, so a moving book never loses the pointer. */}
          <div className="absolute inset-0">
            {row.map((placed) => {
              const book = books[placed.index];
              return (
                <Link
                  key={book.id}
                  ref={motionState.hitRef(book.id)}
                  href={`/book/${book.id}`}
                  aria-label={`${book.title} by ${book.author}`}
                  data-leaning-book
                  onPointerDown={(e) => (motionState.pointer = e.pointerType)}
                  onKeyDown={() => (motionState.pointer = "keyboard")}
                  onPointerEnter={(e) => e.pointerType === "mouse" && motionState.setUp(book.id)}
                  onPointerLeave={(e) => e.pointerType === "mouse" && motionState.leave(book.id)}
                  onPointerMove={(e) => e.pointerType === "mouse" && motionState.point(book.id, e.clientX, e.clientY)}
                  onFocus={(e) => e.currentTarget.matches(":focus-visible") && motionState.setUp(book.id)}
                  onBlur={() => motionState.leave(book.id)}
                  onClick={(e) => {
                    // A first tap pulls the book out; a second tap opens it.
                    if (motionState.pointer !== "mouse" && motionState.pointer !== "keyboard" && !motionState.isUp(book.id)) {
                      e.preventDefault();
                      motionState.setUp(book.id);
                    }
                  }}
                  className="absolute block outline-none focus-visible:after:absolute focus-visible:after:inset-x-0 focus-visible:after:-bottom-2 focus-visible:after:h-px focus-visible:after:bg-foreground"
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function LeaningBook({ book, slab, ref }: { book: Book; slab: Slab; ref: (el: HTMLDivElement | null) => void }) {
  const { w: W, h: H, t: T } = slab;
  // Books with a cover image take their spine color from the image's left edge. Until it is read,
  // and for books without an image, the cover's own palette is used.
  const [read, setRead] = useState<{ url: string; palette: [string, string, string] } | null>(null);
  useEffect(() => {
    const url = book.cover.url;
    if (!url) return;
    let live = true;
    void spinePalette(url).then((p) => live && p && setRead({ url, palette: p }));
    return () => {
      live = false;
    };
  }, [book.cover.url]);
  const palette = read && read.url === book.cover.url ? read.palette : book.cover.palette;
  const [ground, ink, accent] = palette;
  const face = "absolute left-1/2 top-1/2 [backface-visibility:hidden]";
  const pages = pageFaces(book.format, W, H);

  return (
    <div ref={ref} className="absolute left-0 [transform-style:preserve-3d]" style={{ bottom: PLINTH, width: W, height: H }}>
      <div data-face="front" className={face} style={{ width: W, height: H, transform: `translate(-50%, -50%) translateZ(${T / 2}px)` }}>
        <BookCover book={book} className="size-full" />
      </div>

      <div
        className={face}
        style={{ width: W, height: H, background: `color-mix(in oklab, ${ground} 85%, black)`, transform: `translate(-50%, -50%) rotateY(180deg) translateZ(${T / 2}px)` }}
      />

      {/* A hardcover's boards seen from inside, above and beside the pages. */}
      {boardInsides(book.format, T).map((board) => (
        <div
          key={board.transform}
          aria-hidden
          className={face}
          style={{ width: W, height: H, borderStyle: "solid", borderColor: `color-mix(in oklab, ${ground} 70%, black)`, ...board }}
        />
      ))}

      {/* The spine is the face you see most on this shelf, so it carries the title at a readable size. */}
      <div
        data-face="spine"
        className={`${face} flex flex-col items-center gap-2 overflow-hidden pt-4 pb-3`}
        style={{ width: T, height: H, backgroundColor: ground, color: ink, transform: `translate(-50%, -50%) rotateY(-90deg) translateZ(${W / 2}px)` }}
      >
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: "linear-gradient(90deg, rgb(0 0 0 / 0.3) 0%, rgb(255 255 255 / 0.2) 28%, rgb(255 255 255 / 0.04) 55%, rgb(0 0 0 / 0.28) 100%)" }}
        />
        <span className="absolute inset-x-0 top-[7px] h-px opacity-75" style={{ backgroundColor: accent }} />
        <span className="absolute inset-x-0 bottom-[7px] h-px opacity-75" style={{ backgroundColor: accent }} />
        <span
          className="relative min-h-0 flex-1 truncate font-serif leading-none font-medium [writing-mode:vertical-rl]"
          style={{ fontSize: Math.min(17, Math.max(10, T * 0.4)) }}
        >
          {book.title}
        </span>
        <span className="relative max-h-[40%] shrink-0 truncate font-display text-[8px] tracking-[0.16em] uppercase [writing-mode:vertical-rl]" style={{ color: accent }}>
          {book.author.split(" ").pop()}
        </span>
      </div>

      {/* Page block on the fore-edge. */}
      <div
        className={face}
        style={{
          width: T,
          height: pages.foreEdge.height,
          transform: pages.foreEdge.transform,
          background: "repeating-linear-gradient(90deg, #efeadf 0 1px, #e3ddd0 1px 2px)",
        }}
      />

      {/* Top edge of the pages. */}
      <div
        className={face}
        style={{
          width: pages.top.width,
          height: T,
          transform: pages.top.transform,
          background: "repeating-linear-gradient(0deg, #f1ece2 0 1px, #e2dccf 1px 2px)",
        }}
      />
    </div>
  );
}

type Rect = { l: number; r: number; t: number; b: number };

interface Entry {
  id: string;
  slab: Slab;
  placed: Placed;
  /** Progress out of the shelf, and its speed. */
  p: number;
  v: number;
  /** Pointer tilt, current and wanted, from -0.5 to 0.5 across the hover area. */
  tx: number;
  ty: number;
  gx: number;
  gy: number;
  /** Hover area on the shelf, and grown to cover where the book comes out to. */
  strip: Rect | null;
  out: Rect | null;
}

/**
 * Runs the books' motion outside React: one spring per book, written straight to the
 * elements each frame, so pointing at books never re-renders the shelf.
 */
class ShelfMotion {
  pointer = "mouse";
  private entries = new Map<string, Entry>();
  private books = new Map<string, HTMLDivElement>();
  private shadows = new Map<string, HTMLSpanElement>();
  private hits = new Map<string, HTMLAnchorElement>();
  private refs = new Map<string, unknown>();
  private settings: LeaningSettings = DEFAULT_LEANING;
  private reduce = false;
  private up: string | null = null;
  private frame = 0;
  private last = 0;

  private refInto<T extends HTMLElement>(map: Map<string, T>, kind: string, id: string) {
    const key = `${kind}:${id}`;
    let fn = this.refs.get(key) as ((el: T | null) => void) | undefined;
    if (!fn) {
      fn = (el) => {
        // React detaches a ref before attaching it elsewhere, so a book that moves rows keeps its element.
        if (el) map.set(id, el);
        else map.delete(id);
      };
      this.refs.set(key, fn);
    }
    return fn;
  }

  bookRef = (id: string) => this.refInto(this.books, "book", id);
  shadowRef = (id: string) => this.refInto(this.shadows, "shadow", id);
  hitRef = (id: string) => this.refInto(this.hits, "hit", id);

  isUp(id: string) {
    return this.up === id;
  }

  setup(rows: Placed[][], slabs: Slab[], ids: string[], settings: LeaningSettings, reduce: boolean) {
    this.stop();
    this.settings = settings;
    this.reduce = reduce;
    this.up = null;
    this.entries = new Map(
      rows.flat().map((placed) => [
        ids[placed.index],
        { id: ids[placed.index], slab: slabs[placed.index], placed, p: 0, v: 0, tx: 0, ty: 0, gx: 0, gy: 0, strip: null, out: null },
      ]),
    );
    for (const e of this.entries.values()) this.render(e);
    for (const row of rows) this.measure(row.map((placed) => this.entries.get(ids[placed.index])!));
  }

  stop() {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  setUp(id: string | null) {
    if (this.up !== id) {
      const before = this.up;
      this.up = id;
      if (before && this.entries.has(before)) this.placeHit(this.entries.get(before)!);
      if (id && this.entries.has(id)) this.placeHit(this.entries.get(id)!);
    }
    this.run();
  }

  leave(id: string) {
    if (this.up === id) this.setUp(null);
  }

  point(id: string, clientX: number, clientY: number) {
    const e = this.entries.get(id);
    const hit = this.hits.get(id);
    if (!e || !hit || this.up !== id) return;
    const r = hit.getBoundingClientRect();
    e.gx = Math.max(-0.5, Math.min(0.5, (clientX - r.left) / r.width - 0.5));
    e.gy = Math.max(-0.5, Math.min(0.5, (clientY - r.top) / r.height - 0.5));
    this.run();
  }

  private run() {
    if (this.frame) return;
    this.last = performance.now();
    this.frame = requestAnimationFrame(this.step);
  }

  private step = (now: number) => {
    const dt = Math.min(0.032, (now - this.last) / 1000);
    this.last = now;
    let moving = false;
    const all = [...this.entries.values()];
    for (const e of all) {
      const wanted = e.id === this.up;
      const target = pullTarget(
        wanted,
        e.p,
        all.filter((o) => o !== e).map((o) => o.p),
        this.settings.mode,
      );
      if (target !== (wanted ? 1 : 0)) moving = true;
      if (this.reduce) {
        e.p = target;
        e.v = 0;
      } else {
        const next = springStep(e.p, e.v, target, dt);
        e.p = next.p;
        e.v = next.v;
        if (!next.done) moving = true;
      }
      // The tilt follows the pointer with a little lag and eases back when the book goes home.
      const f = this.reduce ? 1 : 1 - Math.exp(-dt * 12);
      const gx = wanted ? e.gx : 0;
      const gy = wanted ? e.gy : 0;
      e.tx += (gx - e.tx) * f;
      e.ty += (gy - e.ty) * f;
      if (Math.abs(gx - e.tx) > 0.002 || Math.abs(gy - e.ty) > 0.002) moving = true;
      this.render(e);
    }
    this.frame = moving ? requestAnimationFrame(this.step) : 0;
  };

  private render(e: Entry) {
    const book = this.books.get(e.id);
    if (book) book.style.transform = transformAt(e.slab, e.placed, this.settings, e.p, { x: e.ty * -8, y: e.tx * -10 });
    const shadow = this.shadows.get(e.id);
    if (shadow) {
      shadow.style.transform = `translateX(${shadowShift(e.placed, this.settings, e.p).toFixed(1)}px) scaleX(${(1 - 0.18 * e.p).toFixed(3)})`;
      shadow.style.opacity = String(1 - 0.45 * e.p);
    }
  }

  /** Reads where each book of a row shows on screen, at rest and fully out, for the hover areas. */
  private measure(row: Entry[]) {
    const scene = this.books.get(row[0]?.id)?.parentElement;
    if (!scene) return;
    const box = scene.getBoundingClientRect();
    const rectOf = (id: string): Rect => {
      const faces = [...(this.books.get(id)?.querySelectorAll<HTMLElement>('[data-face="spine"], [data-face="front"]') ?? [])];
      const rs = faces.map((f) => f.getBoundingClientRect());
      return {
        l: Math.min(...rs.map((q) => q.left)) - box.left,
        r: Math.max(...rs.map((q) => q.right)) - box.left,
        t: Math.min(...rs.map((q) => q.top)) - box.top,
        b: Math.max(...rs.map((q) => q.bottom)) - box.top,
      };
    };
    const rest = row.map((e) => rectOf(e.id));
    row.forEach((e, i) => {
      e.strip = { ...rest[i], r: i + 1 < row.length ? Math.max(rest[i].l + 4, rest[i + 1].l) : rest[i].r };
      const book = this.books.get(e.id)!;
      book.style.transform = transformAt(e.slab, e.placed, this.settings, 1);
      const out = rectOf(e.id);
      book.style.transform = transformAt(e.slab, e.placed, this.settings, 0);
      e.out = { l: Math.min(e.strip.l, out.l - 6), r: Math.max(e.strip.r, out.r + 6), t: Math.min(e.strip.t, out.t - 6), b: e.strip.b };
      const shadow = this.shadows.get(e.id);
      if (shadow) {
        shadow.style.left = `${rest[i].l + 2}px`;
        shadow.style.width = `${rest[i].r - rest[i].l}px`;
      }
      this.placeHit(e);
    });
  }

  private placeHit(e: Entry) {
    const hit = this.hits.get(e.id);
    const q = this.up === e.id ? e.out : e.strip;
    if (!hit || !q) return;
    Object.assign(hit.style, { left: `${q.l}px`, top: `${q.t}px`, width: `${q.r - q.l}px`, height: `${q.b - q.t}px`, zIndex: this.up === e.id ? "2" : "" });
  }
}
