"use client";

import { FinishedGrid } from "@/components/book/finished-grid";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useLibrary } from "@/lib/library-context";
import { analyticsFor, RANGE_LABEL, type Range } from "@/lib/analytics";
import { formatDate, today } from "@/lib/dates";
import { easeOut } from "@/lib/motion";
import { formatNumber } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { LoadingBlock, PageHeader } from "@/components/shell/page-header";
import { ChartCard, DataTable } from "./chart-card";
import { GenreChart, MonthlyChart, VelocityChart } from "./charts";

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="border-t border-foreground pt-3">
      <p className="label-meta">{label}</p>
      <p className="mt-3 font-display text-[32px] leading-none font-medium tracking-[-0.02em]">
        {value}
        {unit && <span className="ml-1.5 text-sm font-normal tracking-normal text-muted-foreground">{unit}</span>}
      </p>
    </div>
  );
}

export function AnalyticsView() {
  const { data } = useLibrary();
  const [range, setRange] = useState<Range>("year");
  const todayISO = today();
  const a = useMemo(() => (data ? analyticsFor(data, range, todayISO) : null), [data, range, todayISO]);

  return (
    <>
      <PageHeader
        eyebrow="Analytics"
        title="How you read"
        description="Finished books by genre, how fast you move through books of different lengths, and pages logged each month."
      />

      {/* One filter row scopes everything below it. */}
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4 border-b border-border">
        <Tabs
          value={range}
          onValueChange={setRange}
          layoutId="analytics-range"
          aria-label="Time range"
          items={(Object.keys(RANGE_LABEL) as Range[]).map((r) => ({ value: r, label: RANGE_LABEL[r] }))}
        />
        {a && (
          <p className="pb-2 font-display text-xs text-muted-foreground">
            {formatDate(a.start)} to {formatDate(todayISO)}
          </p>
        )}
      </div>

      {!a ? (
        <div className="grid gap-4">
          <LoadingBlock className="h-28" />
          <LoadingBlock className="h-80" />
        </div>
      ) : (
        <motion.div
          key={range}
          initial={{ opacity: 0.4 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25, ease: easeOut }}
          className="grid grid-cols-1 gap-4"
        >
          <div className="mb-8 grid grid-cols-2 gap-x-8 gap-y-8 md:grid-cols-5">
            <Stat label="Books finished" value={formatNumber(a.finishedCount)} />
            <Stat label="Pages read" value={formatNumber(a.pages)} />
            <Stat label="Per reading day" value={a.pagesPerReadingDay === null ? "—" : String(a.pagesPerReadingDay)} unit="pages" />
            <Stat label="Average length" value={a.averageLength === null ? "—" : String(a.averageLength)} unit="pages" />
            <Stat label="Median time" value={a.medianDays === null ? "—" : String(Math.round(a.medianDays))} unit="days a book" />
          </div>

          {a.finishedCount > 0 && (
            <section className="mb-8">
              <p className="label-meta mb-6">Books read · {RANGE_LABEL[range]}</p>
              <FinishedGrid books={a.finished} />
            </section>
          )}

          {a.finishedCount === 0 ? (
            <Card className="py-20 text-center">
              <p className="font-serif text-2xl">No finished books in this range yet.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ChartCard
                title="Genre distribution"
                description="Finished books per genre. A book with two genres counts in both."
                chart={<GenreChart data={a.genres} />}
                table={<DataTable head={["Genre", "Books", "Pages"]} rows={a.genres.map((g) => [g.genre, g.books, g.pages.toLocaleString("en")])} />}
              />
              <ChartCard
                title="Reading velocity"
                description="Pages a day for each finished book, against its length."
                chart={<VelocityChart data={a.velocity} />}
                table={
                  <DataTable
                    head={["Book", "Pages", "Days", "Pages a day"]}
                    rows={[...a.velocity]
                      .sort((x, y) => y.pagesPerDay - x.pagesPerDay)
                      .map((v) => [v.title, v.pageCount, v.days, v.pagesPerDay.toFixed(1)])}
                  />
                }
              />
            </div>
          )}

          <ChartCard
            title="Pages per month"
            description="Pages logged each month, from the progress slider or the page field."
            chart={<MonthlyChart data={a.months} />}
            table={<DataTable head={["Month", "Pages"]} rows={a.months.map((m) => [m.label, m.pages.toLocaleString("en")])} />}
          />
        </motion.div>
      )}
    </>
  );
}
