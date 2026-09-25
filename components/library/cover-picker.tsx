"use client";

import { useId, useState } from "react";
import { RadioGroup } from "radix-ui";
import { Check } from "lucide-react";
import type { BookDetails } from "@/lib/metadata/types";
import { SOURCE_LABEL } from "@/lib/metadata/types";
import { generatedCover } from "@/lib/cover";
import { cn } from "@/lib/utils";
import { BookCover } from "@/components/book/book-cover";

const DESIGNED = "designed";

/**
 * The covers the catalogs found for this edition, plus a typeset one in the library's own
 * palettes. The chosen image's URL goes into the form; the typeset cover stores no URL.
 */
export function CoverPicker({
  details,
  title,
  value,
  onChange,
}: {
  details: BookDetails;
  /** The title as the reader has it in the form, so the typeset cover matches what is saved. */
  title: string;
  value: string;
  onChange: (coverUrl: string) => void;
}) {
  const id = useId();
  const [failed, setFailed] = useState<string[]>([]);
  const found = details.covers.filter((c) => !failed.includes(c.url));
  const bookTitle = title.trim() || details.title;
  const options = [
    ...found.map((c) => ({ value: c.url, label: SOURCE_LABEL[c.source], cover: { ...generatedCover(bookTitle), url: c.url } })),
    { value: DESIGNED, label: "Designed", cover: generatedCover(bookTitle) },
  ];
  const selected = value || DESIGNED;

  const drop = (url: string) => {
    setFailed((f) => [...f, url]);
    // A broken image cannot stay chosen: move to the next found cover, or to the typeset one.
    if (url === value) onChange(found.find((c) => c.url !== url)?.url ?? "");
  };

  return (
    <div className="grid gap-3">
      <span id={`${id}-label`} className="label-meta">
        Cover
      </span>
      <RadioGroup.Root
        value={selected}
        onValueChange={(v) => onChange(v === DESIGNED ? "" : v)}
        aria-labelledby={`${id}-label`}
        orientation="horizontal"
        className="grid max-w-[26rem] grid-cols-3 gap-4"
      >
        {options.map((o) => {
          const checked = selected === o.value;
          return (
            <RadioGroup.Item
              key={o.value}
              value={o.value}
              aria-label={`${o.label} cover`}
              className="group pressable grid min-w-0 gap-2.5 text-left outline-none"
            >
              <BookCover
                book={{ title: bookTitle, author: details.author, cover: o.cover, series: details.series }}
                onImageError={drop}
                className={cn(
                  "w-full outline-1 outline-offset-[3px] transition-[outline-color] duration-150",
                  checked ? "outline-foreground" : "outline-transparent group-hover:outline-border",
                )}
              />
              <span
                className={cn(
                  "flex items-center gap-1 font-display text-[11px] underline-offset-4 transition-colors duration-150 group-focus-visible:underline",
                  checked ? "text-foreground" : "text-muted-foreground group-hover:text-foreground",
                )}
              >
                <span className="truncate">{o.label}</span>
                <Check aria-hidden className={cn("size-3 shrink-0 transition-opacity duration-150", checked ? "opacity-100" : "opacity-0")} />
              </span>
            </RadioGroup.Item>
          );
        })}
      </RadioGroup.Root>
    </div>
  );
}
