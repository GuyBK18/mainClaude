"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { snappySpring } from "@/lib/motion";
import { cn } from "@/lib/utils";

export type TabItem<T extends string> = { value: T; label: React.ReactNode; icon?: React.ReactNode };

/**
 * Underline tabs. The active marker is a 1px ink rule that slides between items;
 * no accent color, no filled pill.
 */
export function Tabs<T extends string>({
  value,
  onValueChange,
  items,
  layoutId,
  className,
  "aria-label": ariaLabel,
}: {
  value: T;
  onValueChange: (value: T) => void;
  items: TabItem<T>[];
  /** Unique per tab group so underlines never jump between groups. */
  layoutId: string;
  className?: string;
  "aria-label"?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + items.length) % items.length;
    refs.current[next]?.focus();
    onValueChange(items[next].value);
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      // Scrolls sideways when labels outgrow narrow screens; -mb-px lets the underline sit on a parent's border.
      className={cn("no-scrollbar -mb-px flex items-stretch gap-5 overflow-x-auto", className)}
    >
      {items.map((item, index) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onValueChange(item.value)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={cn(
              "pressable relative flex h-9 shrink-0 items-center gap-1.5 font-display whitespace-nowrap text-[13px] tracking-[0.02em] transition-colors duration-150 [&_svg]:size-3.5",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.icon}
            {item.label}
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={snappySpring}
                className="absolute inset-x-0 bottom-0 h-px bg-foreground"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
