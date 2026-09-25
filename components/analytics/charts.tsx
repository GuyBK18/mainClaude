"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "./chart-card";

// Recharts takes SVG attributes; CSS variables resolve there, so the charts follow the theme.
const INK = "var(--foreground)";
const MUTED = "var(--muted-foreground)";
const GRID = "var(--border)";
const SURFACE = "var(--surface)";
const tick = { fill: MUTED, fontSize: 11, fontFamily: "var(--font-space-grotesk)" };

type TooltipProps<T> = { active?: boolean; payload?: readonly { payload?: T }[] };

function first<T>({ active, payload }: TooltipProps<T>) {
  return active ? payload?.[0]?.payload : undefined;
}

export function GenreChart({ data }: { data: { genre: string; books: number; pages: number }[] }) {
  const height = Math.max(160, data.length * 36 + 24);
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 36, bottom: 0, left: 0 }} barCategoryGap={10}>
          <CartesianGrid horizontal={false} stroke={GRID} strokeWidth={1} />
          <XAxis type="number" allowDecimals={false} tick={tick} tickLine={false} axisLine={false} />
          <YAxis
            type="category"
            dataKey="genre"
            width={128}
            tick={{ ...tick, fill: INK, fontSize: 12, fontFamily: "var(--font-inter)" }}
            tickLine={false}
            axisLine={{ stroke: GRID }}
          />
          <Tooltip
            cursor={{ fill: "var(--ink-3)" }}
            content={(props) => {
              const d = first(props as TooltipProps<{ genre: string; books: number; pages: number }>);
              return d ? (
                <ChartTooltip
                  title={d.genre}
                  lines={[
                    ["Books", String(d.books)],
                    ["Pages", d.pages.toLocaleString("en")],
                  ]}
                />
              ) : null;
            }}
          />
          <Bar dataKey="books" fill={INK} barSize={14} radius={[0, 4, 4, 0]} isAnimationActive={false}>
            <LabelList dataKey="books" position="right" offset={8} style={{ fill: INK, fontSize: 12, fontFamily: "var(--font-space-grotesk)" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

type Speed = { id: string; title: string; author: string; pageCount: number; days: number; pagesPerDay: number };

export function VelocityChart({ data }: { data: Speed[] }) {
  const fastest = data.reduce<Speed | null>((max, d) => (!max || d.pagesPerDay > max.pagesPerDay ? d : max), null);
  const longest = Math.max(1, ...data.map((d) => d.pageCount));
  return (
    <div className="h-full min-h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 16, right: 24, bottom: 20, left: 0 }}>
          <CartesianGrid stroke={GRID} strokeWidth={1} />
          <XAxis
            type="number"
            dataKey="pageCount"
            name="Length"
            tick={tick}
            tickLine={false}
            axisLine={{ stroke: GRID }}
            domain={[0, (max: number) => Math.ceil((max + 1) / 200) * 200]}
            tickCount={5}
            allowDecimals={false}
            tickFormatter={(v: number) => v.toLocaleString("en")}
            label={{ value: "Book length (pages)", position: "insideBottom", offset: -12, style: { ...tick } }}
          />
          <YAxis
            type="number"
            dataKey="pagesPerDay"
            name="Pages a day"
            tick={tick}
            tickLine={false}
            axisLine={false}
            width={44}
            domain={[0, (max: number) => Math.ceil((max + 1) / 10) * 10]}
            tickCount={6}
            allowDecimals={false}
            tickFormatter={(v: number) => String(Math.round(v))}
          />
          <Tooltip
            cursor={{ stroke: GRID }}
            content={(props) => {
              const d = first(props as TooltipProps<Speed>);
              return d ? (
                <ChartTooltip
                  title={d.title}
                  lines={[
                    ["Pages a day", d.pagesPerDay.toFixed(1)],
                    ["Length", `${d.pageCount} pp`],
                    ["Read in", `${d.days} days`],
                  ]}
                />
              ) : null;
            }}
          />
          <Scatter
            data={data}
            isAnimationActive={false}
            shape={(props: unknown) => {
              const { cx, cy, payload } = props as { cx: number; cy: number; payload: Speed };
              const labelled = fastest && payload.id === fastest.id;
              return (
                <g>
                  {/* Hit area larger than the mark so hovering never needs pixel aim. */}
                  <circle cx={cx} cy={cy} r={12} fill="transparent" />
                  <circle cx={cx} cy={cy} r={5} fill={INK} stroke={SURFACE} strokeWidth={2} />
                  {labelled && (
                    // The one direct label: the fastest read. Flip to the left when the dot sits near the right edge.
                    <text
                      x={payload.pageCount > longest * 0.6 ? cx - 12 : cx + 12}
                      y={cy + 4}
                      textAnchor={payload.pageCount > longest * 0.6 ? "end" : "start"}
                      fill={INK}
                      fontSize={13}
                      fontFamily="var(--font-newsreader)"
                      fontStyle="italic"
                    >
                      {payload.title}
                    </text>
                  )}
                </g>
              );
            }}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MonthlyChart({ data }: { data: { key: string; label: string; pages: number }[] }) {
  return (
    <div className="h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 0, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} />
          <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={{ stroke: GRID }} interval={0} />
          <YAxis
            tick={tick}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(v: number) => v.toLocaleString("en")}
          />
          <Tooltip
            cursor={{ fill: "var(--ink-3)" }}
            content={(props) => {
              const d = first(props as TooltipProps<{ label: string; pages: number }>);
              return d ? <ChartTooltip title={d.label} lines={[["Pages", d.pages.toLocaleString("en")]]} /> : null;
            }}
          />
          <Bar dataKey="pages" fill={INK} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
