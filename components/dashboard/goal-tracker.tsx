"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Pencil } from "lucide-react";
import { useLibrary } from "@/lib/library-context";
import { layoutSpring } from "@/lib/motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function paceSentence(done: number, target: number, ahead: number, daysLeft: number) {
  if (done >= target) return `Goal reached. ${done - target > 0 ? `${done - target} past it so far.` : "Anything now is extra."}`;
  const left = target - done;
  const every = Math.max(1, Math.round(daysLeft / left));
  const gap = Math.round(Math.abs(ahead));
  const status =
    gap === 0 ? "On pace." : ahead > 0 ? `${gap} ${gap === 1 ? "book" : "books"} ahead of pace.` : `${gap} ${gap === 1 ? "book" : "books"} behind pace.`;
  return `${status} ${left} to go, about one every ${every} ${every === 1 ? "day" : "days"}.`;
}

export function GoalTracker({
  year,
  done,
  target,
  expected,
  ahead,
  daysLeft,
}: {
  year: number;
  done: number;
  target: number;
  expected: number;
  ahead: number;
  daysLeft: number;
}) {
  const { setGoal } = useLibrary();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(target));
  const progress = Math.min(1, done / Math.max(1, target));
  const pacePosition = Math.min(1, expected / Math.max(1, target));

  const save = () => {
    const next = Number(draft);
    if (Number.isInteger(next) && next > 0) void setGoal({ year, target: next });
    else setDraft(String(target));
    setEditing(false);
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <p className="label-meta">{year} reading goal</p>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={editing ? "Save goal" : "Edit goal"}
          onClick={() => (editing ? save() : (setDraft(String(target)), setEditing(true)))}
          className="-mr-2"
        >
          {editing ? <Check /> : <Pencil />}
        </Button>
      </div>

      <div className="mt-3 flex items-baseline gap-2 font-display">
        <span className="text-[56px] leading-none font-medium tracking-[-0.03em]">{done}</span>
        <span className="text-muted-foreground">of</span>
        {editing ? (
          <input
            autoFocus
            aria-label="Books to read this year"
            inputMode="numeric"
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setEditing(false);
            }}
            className="tabular w-[3.5ch] border-b border-foreground bg-transparent text-center text-lg outline-none"
          />
        ) : (
          <span className="text-lg">{target}</span>
        )}
        <span className="text-muted-foreground">books</span>
      </div>

      <div className="relative mt-6 h-[3px] rounded-full bg-ink-12" role="progressbar" aria-valuemin={0} aria-valuemax={target} aria-valuenow={done} aria-label="Books finished this year">
        <motion.div
          className="absolute inset-y-0 left-0 w-full origin-left rounded-full bg-foreground"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: progress }}
          transition={layoutSpring}
        />
        {/* Where a steady reader would be today. */}
        <span className="absolute -top-1.5 h-[15px] w-px bg-muted-foreground" style={{ left: `${pacePosition * 100}%` }} />
      </div>
      <div className="mt-2 flex justify-between font-display text-[11px] text-muted-foreground">
        <span>Jan</span>
        <span>Dec</span>
      </div>

      <p className="mt-5 text-sm leading-relaxed text-muted-foreground">{paceSentence(done, target, ahead, daysLeft)}</p>
    </Card>
  );
}
