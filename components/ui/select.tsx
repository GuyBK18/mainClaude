"use client";

import * as React from "react";
import { Select as SelectPrimitive } from "radix-ui";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Option<T extends string> = { value: T; label: string };

/** Compact wrapper over Radix Select for the common "pick one of these" case. */
function Select<T extends string>({
  value,
  onValueChange,
  options,
  placeholder,
  className,
  id,
  "aria-label": ariaLabel,
}: {
  value: T | undefined;
  onValueChange: (value: T) => void;
  options: Option<T>[];
  placeholder?: string;
  className?: string;
  id?: string;
  "aria-label"?: string;
}) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={(v) => onValueChange(v as T)}>
      <SelectPrimitive.Trigger
        id={id}
        aria-label={ariaLabel}
        className={cn(
          "pressable flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-sm border border-border bg-surface px-3 text-left text-sm [&>span]:truncate transition-[border-color] duration-150 outline-none hover:border-ink-12 focus-visible:border-foreground data-[placeholder]:text-muted-foreground",
          className,
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon>
          <ChevronDown className="size-4 text-muted-foreground" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className="floating-panel z-50 max-h-72 min-w-(--radix-select-trigger-width) origin-(--radix-select-content-transform-origin) overflow-hidden rounded-lg border border-border bg-surface p-1"
        >
          <SelectPrimitive.Viewport>
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                className="relative flex h-8 cursor-default items-center rounded-sm pr-8 pl-2.5 text-sm outline-none select-none data-[highlighted]:bg-ink-6"
              >
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-2.5">
                  <Check className="size-3.5" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

export { Select };
