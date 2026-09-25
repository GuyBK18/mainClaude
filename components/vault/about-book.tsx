"use client";

import { useState } from "react";

const CLAMP_CHARS = 520;

/** The publisher's description. Rendered as text nodes, never as HTML. */
export function AboutBook({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const paragraphs = text.split(/\n{2,}/).filter(Boolean);
  const long = text.length > CLAMP_CHARS || paragraphs.length > 2;

  return (
    <section className="mb-16 max-w-3xl" aria-labelledby="about-book">
      <h2 id="about-book" className="label-meta mb-4 text-foreground">
        About the book
      </h2>
      <div dir="auto" className={long && !open ? "line-clamp-5" : undefined}>
        {paragraphs.map((p, i) => (
          <p key={i} className="font-serif text-[18px] leading-[1.6] [&+&]:mt-3">
            {p}
          </p>
        ))}
      </div>
      {long && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="mt-2 font-display text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {open ? "Show less" : "Read more"}
        </button>
      )}
    </section>
  );
}
