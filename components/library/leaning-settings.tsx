"use client";

import { useEffect, useId, useState } from "react";
import { RadioGroup } from "radix-ui";
import { SlidersHorizontal } from "lucide-react";
import {
  ANGLE_RANGE,
  DEFAULT_LEANING,
  REVEAL_RANGE,
  toLeaningSettings,
  type LeaningMode,
  type LeaningSettings,
} from "@/lib/leaning-shelf";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";

const KEY = "luminaread:leaning-shelf";

/** The reader's leaning shelf settings, kept in this browser. */
export function useLeaningSettings() {
  const [settings, setSettings] = useState<LeaningSettings>(DEFAULT_LEANING);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) setSettings(toLeaningSettings(JSON.parse(raw)));
    } catch {
      // Unreadable or blocked storage: keep the defaults.
    }
  }, []);

  const update = (next: LeaningSettings) => {
    setSettings(next);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Not persisted; the shelf still changes.
    }
  };

  return [settings, update] as const;
}

const MODES: { value: LeaningMode; label: string }[] = [
  { value: "turn", label: "Turns to face you" },
  { value: "slide", label: "Slides out" },
];

export function LeaningSettingsButton({
  settings,
  onChange,
}: {
  settings: LeaningSettings;
  onChange: (next: LeaningSettings) => void;
}) {
  const id = useId();
  const atDefaults = settings.angle === DEFAULT_LEANING.angle && settings.reveal === DEFAULT_LEANING.reveal;

  return (
    <Popover>
      <PopoverTrigger
        aria-label="Spines view settings"
        className="pressable flex h-9 items-center gap-1.5 font-display text-[13px] text-muted-foreground transition-colors hover:text-foreground data-[state=open]:text-foreground"
      >
        <SlidersHorizontal className="size-3.5" />
        <span className="hidden sm:inline">Adjust</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="grid w-64 gap-5 p-3">
        <div className="grid gap-2">
          <span id={`${id}-mode`} className="label-meta">
            When you point at a book
          </span>
          <RadioGroup.Root
            value={settings.mode}
            onValueChange={(mode) => onChange({ ...settings, mode: mode as LeaningMode })}
            aria-labelledby={`${id}-mode`}
            className="grid"
          >
            {MODES.map((m) => (
              <RadioGroup.Item
                key={m.value}
                value={m.value}
                className="group flex h-8 items-center gap-2.5 rounded-sm px-2 text-left text-sm outline-none transition-colors duration-100 hover:bg-ink-6 focus-visible:bg-ink-6"
              >
                <span
                  className={cn(
                    "grid size-3.5 place-items-center rounded-full border transition-colors duration-100",
                    settings.mode === m.value ? "border-foreground" : "border-ink-12",
                  )}
                >
                  <RadioGroup.Indicator className="size-1.5 rounded-full bg-foreground" />
                </span>
                {m.label}
              </RadioGroup.Item>
            ))}
          </RadioGroup.Root>
        </div>

        <Setting
          label="Book angle"
          value={`${settings.angle}°`}
          range={ANGLE_RANGE}
          current={settings.angle}
          onValueChange={(angle) => onChange({ ...settings, angle })}
        />
        <Setting
          label="Cover showing"
          value={`${settings.reveal} px`}
          range={REVEAL_RANGE}
          current={settings.reveal}
          onValueChange={(reveal) => onChange({ ...settings, reveal })}
        />

        <button
          type="button"
          onClick={() => onChange({ ...settings, angle: DEFAULT_LEANING.angle, reveal: DEFAULT_LEANING.reveal })}
          disabled={atDefaults}
          className="w-fit font-display text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline disabled:pointer-events-none disabled:opacity-50"
        >
          Back to {DEFAULT_LEANING.angle}° and {DEFAULT_LEANING.reveal} px
        </button>
      </PopoverContent>
    </Popover>
  );
}

function Setting({
  label,
  value,
  range,
  current,
  onValueChange,
}: {
  label: string;
  value: string;
  range: { min: number; max: number };
  current: number;
  onValueChange: (value: number) => void;
}) {
  return (
    <div className="grid gap-1">
      <div className="flex items-baseline justify-between">
        <span className="label-meta">{label}</span>
        <span className="tabular font-display text-xs">{value}</span>
      </div>
      <Slider aria-label={label} min={range.min} max={range.max} step={1} value={[current]} onValueChange={([v]) => onValueChange(v)} />
    </div>
  );
}
