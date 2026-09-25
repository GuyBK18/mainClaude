"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReadingSession } from "@/types/reading";
import { HEAT_STEPS, heatmap, streaks, type HeatCell } from "@/lib/stats";
import { formatDate } from "@/lib/dates";
import { Card } from "@/components/ui/card";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKS = 53;

type Hover = { cell: HeatCell; x: number; y: number };

export function ReadingHeatmap({ sessions, todayISO }: { sessions: ReadingSession[]; todayISO: string }) {
  const grid = useMemo(() => heatmap(sessions, todayISO, WEEKS), [sessions, todayISO]);
  const streak = useMemo(() => streaks(sessions, todayISO), [sessions, todayISO]);
  const yearPages = useMemo(
    () => grid.flat().reduce((sum, c) => sum + c.pages, 0),
    [grid],
  );
  const scroller = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<Hover | null>(null);

  // On narrow screens the grid scrolls; start at the most recent weeks.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  // A month label sits on the week that contains the 1st.
  const monthLabels = grid.map((week) => {
    const first = week.find((d) => d.date.endsWith("-01"));
    return first ? MONTHS[Number(first.date.slice(5, 7)) - 1] : "";
  });

  const showCell = (cell: HeatCell, target: HTMLElement) => {
    const box = frame.current?.getBoundingClientRect();
    const rect = target.getBoundingClientRect();
    if (!box) return;
    setHover({ cell, x: rect.left - box.left + rect.width / 2, y: rect.top - box.top });
  };

  return (
    <Card className="p-6">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 className="label-meta text-foreground">Reading activity</h2>
        <p className="tabular font-display text-xs text-muted-foreground">
          {streak.activeDays} reading days · {yearPages.toLocaleString("en")} pages in the last year · current streak{" "}
          {streak.current} · longest {streak.longest}
        </p>
      </div>

      <div ref={frame} className="relative">
        <div ref={scroller} className="no-scrollbar overflow-x-auto" onPointerLeave={() => setHover(null)}>
          <div className="grid min-w-[700px] grid-cols-[28px_1fr] gap-x-2">
            <div />
            <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${WEEKS}, minmax(0, 1fr))` }}>
              {monthLabels.map((label, i) => (
                <span key={i} className="h-5 font-display text-[10px] whitespace-nowrap text-muted-foreground">
                  {label}
                </span>
              ))}
            </div>

            <div className="grid grid-rows-7 gap-[3px] font-display text-[10px] text-muted-foreground">
              {["", "Mon", "", "Wed", "", "Fri", ""].map((d, i) => (
                <span key={i} className="flex items-center leading-none">
                  {d}
                </span>
              ))}
            </div>
            <div
              role="img"
              aria-label={`Reading activity for the last ${WEEKS} weeks: ${streak.activeDays} days with reading, longest streak ${streak.longest} days.`}
              className="grid grid-flow-col grid-rows-7 gap-[3px]"
              style={{ gridTemplateColumns: `repeat(${WEEKS}, minmax(0, 1fr))` }}
            >
              {grid.flat().map((cell) => (
                <span
                  key={cell.date}
                  onPointerEnter={(e) => !cell.future && showCell(cell, e.currentTarget)}
                  className="aspect-square rounded-[2px] transition-[outline-color] duration-100 outline outline-1 -outline-offset-1 outline-transparent hover:outline-foreground"
                  style={{ backgroundColor: cell.future ? "transparent" : `var(--heat-${cell.level})` }}
                />
              ))}
            </div>
          </div>
        </div>

        {hover && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-sm bg-foreground px-2 py-1 font-display text-[11px] whitespace-nowrap text-background"
            style={{ left: hover.x, top: hover.y - 6 }}
          >
            <span className="tabular">{hover.cell.pages}</span> {hover.cell.pages === 1 ? "page" : "pages"} ·{" "}
            {formatDate(hover.cell.date)}
          </div>
        )}
      </div>

      <div className="mt-5 flex items-center justify-end gap-3 font-display text-[10px] text-muted-foreground">
        <span>Pages a day</span>
        <div className="flex items-end gap-[3px]">
          {[0, 1, 2, 3, 4].map((level) => (
            <span key={level} className="flex flex-col items-center gap-1">
              <span className="size-[11px] rounded-[2px]" style={{ backgroundColor: `var(--heat-${level})` }} />
              <span className="tabular w-5 text-center">{level === 0 ? "0" : level === 4 ? `${HEAT_STEPS[3]}+` : HEAT_STEPS[level - 1]}</span>
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}
