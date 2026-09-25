"use client";

import { useEffect, useRef, useState } from "react";
import { AlignCenter, AlignLeft, AlignRight, Copy, Download } from "lucide-react";
import { toast } from "sonner";
import type { Book, Highlight } from "@/types/reading";
import {
  CARD_WIDTH,
  RATIO_HEIGHT,
  drawQuoteCard,
  fontFamily,
  themeColors,
  type QuoteAlign,
  type QuoteRatio,
  type QuoteTheme,
} from "@/lib/quote-card";
import { slugify } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; aria?: string }[];
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col rounded-sm border border-border p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          aria-label={o.aria}
          onClick={() => onChange(o.value)}
          className={cn(
            "pressable flex h-7 items-center justify-center rounded-[3px] font-display text-xs transition-colors duration-150 [&_svg]:size-3.5",
            value === o.value ? "bg-ink-6 text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="border-b border-border px-5 py-5 last:border-b-0">
      <div className="mb-3 flex items-center justify-between">
        <span className="label-meta">{title}</span>
        {aside}
      </div>
      {children}
    </div>
  );
}

export function QuoteStudio({ book, highlights, initialText }: { book: Book; highlights: Highlight[]; initialText?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [text, setText] = useState(initialText ?? highlights[0]?.text ?? "");
  const [author, setAuthor] = useState(book.author);
  const [source, setSource] = useState(book.title);
  const [fontSize, setFontSize] = useState(64);
  const [align, setAlign] = useState<QuoteAlign>("left");
  const [theme, setTheme] = useState<QuoteTheme>("cover");
  const [ratio, setRatio] = useState<QuoteRatio>("4:5");
  const [italic, setItalic] = useState(false);
  const [usedSize, setUsedSize] = useState(fontSize);
  const [fontsReady, setFontsReady] = useState(false);

  // Canvas does not wait for web fonts, so load the two faces before the first real draw.
  useEffect(() => {
    const serif = fontFamily("--font-newsreader", "Georgia");
    const display = fontFamily("--font-space-grotesk", "system-ui");
    Promise.all([
      document.fonts.load(`400 64px ${serif}`),
      document.fonts.load(`italic 400 64px ${serif}`),
      document.fonts.load(`500 26px ${display}`),
    ])
      .catch(() => undefined)
      .finally(() => setFontsReady(true));
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    setUsedSize(
      drawQuoteCard(canvasRef.current, { text, author, source, fontSize, align, theme, ratio, italic, palette: book.cover.palette }),
    );
  }, [text, author, source, fontSize, align, theme, ratio, italic, book.cover.palette, fontsReady]);

  const fileName = `${slugify(book.title)}-quote.png`;

  const download = () => {
    canvasRef.current?.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  };

  const copy = () => {
    canvasRef.current?.toBlob(async (blob) => {
      if (!blob) return;
      try {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        toast("Card copied to clipboard");
      } catch {
        toast("This browser blocked the clipboard. Use Download instead.");
      }
    }, "image/png");
  };

  const swatches: { value: QuoteTheme; label: string }[] = [
    { value: "paper", label: "Paper" },
    { value: "obsidian", label: "Obsidian" },
    { value: "cover", label: "Cover" },
  ];

  return (
    <div className="grid grid-cols-1 overflow-hidden rounded-lg border border-border bg-surface lg:grid-cols-[minmax(0,1fr)_340px]">
      {/* Canvas stage */}
      <div className="flex min-h-[420px] items-center justify-center border-b border-border bg-ink-3 p-6 sm:p-10 lg:border-r lg:border-b-0">
        <canvas
          ref={canvasRef}
          width={CARD_WIDTH}
          height={RATIO_HEIGHT[ratio]}
          aria-label={`Quote card preview: ${text}`}
          role="img"
          className="h-auto max-h-[min(72vh,680px)] w-auto max-w-full rounded-[2px] shadow-cover-lg"
        />
      </div>

      {/* Control panel */}
      <div className="flex flex-col">
        <Section
          title="Quote"
          aside={
            usedSize < fontSize ? (
              <span className="font-display text-[11px] text-muted-foreground">Shrunk to fit</span>
            ) : undefined
          }
        >
          {highlights.length > 0 && (
            <Select
              aria-label="Use a highlight"
              value={highlights.find((h) => h.text === text)?.id}
              onValueChange={(id) => setText(highlights.find((h) => h.id === id)?.text ?? text)}
              placeholder="Use a highlight…"
              options={highlights.map((h) => ({ value: h.id, label: h.text.length > 48 ? `${h.text.slice(0, 48)}…` : h.text }))}
              className="mb-2"
            />
          )}
          <Textarea
            aria-label="Quote text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            className="font-serif text-[15px]"
            placeholder="Type or paste a passage"
          />
        </Section>

        <Section title="Attribution">
          <div className="grid gap-2">
            <Label htmlFor="qs-author" className="sr-only">
              Author
            </Label>
            <Input id="qs-author" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Author" />
            <Label htmlFor="qs-source" className="sr-only">
              Source
            </Label>
            <Input id="qs-source" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Book title" />
          </div>
        </Section>

        <Section title="Type" aside={<span className="tabular font-display text-xs text-muted-foreground">{usedSize}px</span>}>
          <Slider aria-label="Font size" value={[fontSize]} min={32} max={112} step={2} onValueChange={([v]) => setFontSize(v)} />
          <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
            <Segmented
              label="Alignment"
              value={align}
              onChange={setAlign}
              options={[
                { value: "left", label: <AlignLeft />, aria: "Align left" },
                { value: "center", label: <AlignCenter />, aria: "Align center" },
                { value: "right", label: <AlignRight />, aria: "Align right" },
              ]}
            />
            <button
              type="button"
              aria-pressed={italic}
              onClick={() => setItalic((i) => !i)}
              className={cn(
                "pressable h-8 rounded-sm border border-border px-3 font-serif text-sm italic transition-colors duration-150",
                italic ? "bg-ink-6 text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              Italic
            </button>
          </div>
        </Section>

        <Section title="Theme">
          <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2">
            {swatches.map((s) => {
              const colors = themeColors(s.value, book.cover.palette);
              const on = theme === s.value;
              return (
                <button
                  key={s.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setTheme(s.value)}
                  className="pressable group flex flex-col items-center gap-1.5"
                >
                  <span
                    className={cn(
                      "grid h-10 w-full place-items-center rounded-sm border font-serif text-lg transition-colors duration-150",
                      on ? "border-foreground" : "border-border group-hover:border-ink-12",
                    )}
                    style={{ backgroundColor: colors.bg, color: colors.ink }}
                  >
                    Aa
                  </span>
                  <span className={cn("font-display text-[11px]", on ? "text-foreground underline underline-offset-4" : "text-muted-foreground")}>
                    {s.label}
                  </span>
                </button>
              );
            })}
          </div>
        </Section>

        <Section title="Format">
          <Segmented
            label="Aspect ratio"
            value={ratio}
            onChange={setRatio}
            options={[
              { value: "1:1", label: "Square" },
              { value: "4:5", label: "Portrait" },
              { value: "9:16", label: "Story" },
            ]}
          />
        </Section>

        <div className="mt-auto grid grid-cols-2 gap-2 border-t border-border p-5">
          <Button variant="outline" onClick={copy} disabled={!text.trim()}>
            <Copy /> Copy
          </Button>
          <Button onClick={download} disabled={!text.trim()}>
            <Download /> PNG
          </Button>
        </div>
      </div>
    </div>
  );
}
