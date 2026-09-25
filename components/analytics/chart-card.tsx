"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { easeOut } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";

/**
 * Every chart ships with a table twin so no value is gated behind a hover.
 * Single-series charts have no legend: the title says what is plotted.
 */
export function ChartCard({
  title,
  description,
  chart,
  table,
  className,
}: {
  title: string;
  description: string;
  chart: React.ReactNode;
  table: React.ReactNode;
  className?: string;
}) {
  const id = useId();
  const [mode, setMode] = useState<"chart" | "table">("chart");

  return (
    <Card className={cn("flex flex-col", className)}>
      <div className="flex items-start justify-between gap-6 border-b border-border px-6 py-5">
        <div className="min-w-0">
          <h2 className="label-meta text-foreground">{title}</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
        </div>
        <Tabs
          value={mode}
          onValueChange={setMode}
          layoutId={`chart-mode-${id}`}
          aria-label={`${title} view`}
          className="-mt-2 shrink-0 gap-4"
          items={[
            { value: "chart", label: "Chart" },
            { value: "table", label: "Table" },
          ]}
        />
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={mode}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: easeOut }}
          className="flex flex-1 flex-col p-6 [&>*]:grow"
        >
          {mode === "chart" ? chart : table}
        </motion.div>
      </AnimatePresence>
    </Card>
  );
}

export function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="max-h-[320px] overflow-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead className="sticky top-0 bg-surface">
          <tr className="border-b border-border">
            {head.map((h, i) => (
              <th key={h} scope="col" className={`label-meta h-9 font-normal ${i === 0 ? "text-left" : "text-right"}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="border-b border-border last:border-b-0">
              {row.map((cell, i) => (
                <td key={i} className={`h-9 ${i === 0 ? "pr-4 text-left" : "tabular pl-4 text-right text-muted-foreground"}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Tooltip body shared by every chart: surface, hairline, text tokens only. */
export function ChartTooltip({ title, lines }: { title: string; lines: [string, string][] }) {
  return (
    <div className="min-w-40 rounded-sm border border-border bg-surface px-3 py-2">
      <p className="mb-1 font-serif text-[15px] leading-snug">{title}</p>
      {lines.map(([k, v]) => (
        <p key={k} className="flex justify-between gap-6 text-xs">
          <span className="text-muted-foreground">{k}</span>
          <span className="tabular">{v}</span>
        </p>
      ))}
    </div>
  );
}
