"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useLibrary } from "@/lib/library-context";
import { completedIn, goalProgress, kpis } from "@/lib/stats";
import { daysBetween, formatDate, today } from "@/lib/dates";
import { easeOut } from "@/lib/motion";
import { LoadingBlock, PageHeader, SectionHeading } from "@/components/shell/page-header";
import { FinishedGrid } from "@/components/book/finished-grid";
import { CurrentlyReading } from "./currently-reading";
import { GoalTracker } from "./goal-tracker";
import { KpiCards } from "./kpi-cards";
import { ReadingHeatmap } from "./reading-heatmap";

const WEEKDAY = new Intl.DateTimeFormat("en", { weekday: "long" });

export function DashboardView() {
  const { data } = useLibrary();
  const todayISO = today();

  const derived = useMemo(() => {
    if (!data) return null;
    const year = Number(todayISO.slice(0, 4));
    const target = data.goals.find((g) => g.year === year)?.target ?? 24;
    // Every book finished this year, dated by day or by year only.
    const recent = completedIn(data.books, year);
    return {
      reading: data.books
        .filter((b) => b.status === "reading")
        .sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? "")),
      goal: goalProgress(data.books, target, todayISO),
      daysLeft: daysBetween(todayISO, `${year + 1}-01-01`),
      stats: kpis(data.books),
      recent,
    };
  }, [data, todayISO]);

  if (!data || !derived) {
    // The date waits for the client so server and browser time zones never disagree during hydration.
    return (
      <>
        <PageHeader eyebrow="Dashboard" title="Reading" />
        <div className="grid gap-4 lg:grid-cols-12">
          <LoadingBlock className="h-[380px] lg:col-span-8" />
          <LoadingBlock className="h-[380px] lg:col-span-4" />
        </div>
      </>
    );
  }

  const { reading, goal, daysLeft, stats, recent } = derived;
  const eyebrow = `${WEEKDAY.format(new Date())}, ${formatDate(todayISO)}`;

  return (
    <>
      <PageHeader eyebrow={eyebrow} title={`Reading, ${goal.year}`} />

      <motion.div
        className="grid grid-cols-1 gap-4"
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.05 } } }}
      >
        <motion.div variants={fadeUp} className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <CurrentlyReading books={reading} />
            {/* With nothing on the nightstand, this year's books fill the space instead of a section below. */}
            {reading.length === 0 && recent.length > 0 && (
              <div className="mt-10">
                <SectionHeading title={`Read in ${todayISO.slice(0, 4)}`} />
                <FinishedGrid books={recent} />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-4 lg:col-span-4">
            <GoalTracker {...goal} daysLeft={daysLeft} />
            <KpiCards {...stats} />
          </div>
        </motion.div>

        <motion.div variants={fadeUp}>
          <ReadingHeatmap sessions={data.sessions} todayISO={todayISO} />
        </motion.div>

        {reading.length > 0 && recent.length > 0 && (
          <motion.section variants={fadeUp} className="mt-12">
            <SectionHeading
              title={`Read in ${todayISO.slice(0, 4)}`}
              meta={
                <Link href="/analytics" className="underline-offset-4 hover:text-foreground hover:underline">
                  Stats
                </Link>
              }
            />
            <FinishedGrid books={recent} />
          </motion.section>
        )}
      </motion.div>
    </>
  );
}

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: easeOut } },
};
