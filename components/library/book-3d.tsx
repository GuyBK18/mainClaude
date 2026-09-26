"use client";

import Link from "next/link";
import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from "framer-motion";
import type { Book, BookFormat } from "@/types/reading";
import { tiltSpring } from "@/lib/motion";
import { pageFaces } from "@/lib/book-shape";
import { BookCover } from "@/components/book/book-cover";

/** Real books are not one size. Height follows format, thickness follows page count. */
const HEIGHT: Record<BookFormat, number> = { hardcover: 212, paperback: 192, ebook: 196, audiobook: 200 };

export function bookDimensions(book: Pick<Book, "format" | "pageCount">) {
  const height = HEIGHT[book.format];
  const width = Math.round(height * 0.655);
  const depth = Math.round(Math.min(58, Math.max(12, book.pageCount / 13)) * (book.format === "hardcover" ? 1.08 : 1));
  return { width, height, depth };
}

/** Distance from the bottom of a shelf row to where a book stands on the board. */
export const SHELF_BASE = 30;

const BASE_Y = 28; // turned so the spine shows on the left
const BASE_X = -4; // seen from slightly above

export function Book3D({ book }: { book: Book }) {
  const { width: W, height: H, depth: T } = bookDimensions(book);
  const [ground, ink, accent] = book.cover.palette;

  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rotateY = useSpring(useTransform(px, (v) => BASE_Y - v * 22), tiltSpring);
  const rotateX = useSpring(useTransform(py, (v) => BASE_X + v * 10), tiltSpring);
  const lift = useSpring(0, tiltSpring);
  const transform = useMotionTemplate`translateY(${lift}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  const shadowScale = useTransform(lift, [0, -10], [1, 0.86]);
  const shadowOpacity = useTransform(lift, [0, -10], [0.5, 0.3]);

  const onMove = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
    lift.set(-10);
  };
  const onLeave = () => {
    px.set(0);
    py.set(0);
    lift.set(0);
  };

  const face = "absolute left-1/2 top-1/2 [backface-visibility:hidden]";
  const pages = pageFaces(book.format, W, H);

  return (
    <Link
      href={`/book/${book.id}`}
      aria-label={`${book.title} by ${book.author}`}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      onFocus={() => lift.set(-10)}
      onBlur={onLeave}
      className="group relative flex h-full items-end justify-center outline-none"
      style={{ perspective: 1100 }}
    >
      {/* Contact shadow on the plinth. Depth belongs to the cover layer, so this is allowed. */}
      <motion.span
        aria-hidden
        className="absolute h-3 rounded-[50%] bg-black blur-md"
        style={{ bottom: SHELF_BASE - 6, width: W * 0.95, scaleX: shadowScale, opacity: shadowOpacity }}
      />
      <motion.div
        className="relative"
        style={{ marginBottom: SHELF_BASE, width: W, height: H, transformStyle: "preserve-3d", transform }}
      >
        {/* Front */}
        <div className={face} style={{ width: W, height: H, transform: `translate(-50%, -50%) translateZ(${T / 2}px)` }}>
          <BookCover book={book} className="size-full" />
        </div>

        {/* Back */}
        <div
          className={face}
          style={{ width: W, height: H, backgroundColor: ground, transform: `translate(-50%, -50%) rotateY(180deg) translateZ(${T / 2}px)` }}
        />

        {/* Spine, with a rounded highlight so it reads as bound board. */}
        <div
          className={`${face} flex items-center justify-center overflow-hidden`}
          style={{
            width: T,
            height: H,
            backgroundColor: ground,
            transform: `translate(-50%, -50%) rotateY(-90deg) translateZ(${W / 2}px)`,
          }}
        >
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, rgb(0 0 0 / 0.28) 0%, rgb(255 255 255 / 0.22) 30%, rgb(255 255 255 / 0.05) 55%, rgb(0 0 0 / 0.25) 100%)",
            }}
          />
          <span className="absolute inset-x-0 top-[7%] h-px opacity-70" style={{ backgroundColor: accent }} />
          <span className="absolute inset-x-0 bottom-[7%] h-px opacity-70" style={{ backgroundColor: accent }} />
          <span
            className="relative max-h-[78%] truncate font-display text-[9px] font-medium tracking-[0.16em] uppercase [writing-mode:vertical-rl]"
            style={{ color: ink }}
          >
            {book.title}
          </span>
        </div>

        {/* Page block on the fore-edge. */}
        <div
          className={face}
          style={{
            width: T,
            height: pages.foreEdge.height,
            transform: pages.foreEdge.transform,
            background:
              "repeating-linear-gradient(90deg, #efeadf 0 1px, #e3ddd0 1px 2px), linear-gradient(90deg, rgb(0 0 0 / 0.18), transparent 40%)",
            backgroundBlendMode: "multiply",
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
      </motion.div>
    </Link>
  );
}
