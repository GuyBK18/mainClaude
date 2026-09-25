"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useLibrary } from "@/lib/library-context";
import { goalProgress, kpis } from "@/lib/stats";
import { daysBetween, formatDate, today } from "@/lib/dates";
import { easeOut } from "@/lib/motion";
import { LoadingBlock, PageHeader, SectionHeading } from "@/components/shell/page-header";
import { BookCover } from "@/components/book/book-cover";
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
    const recent = data.books
      .filter((b) => b.status === "completed" && b.finishedAt)
      .sort((a, b) => b.finishedAt!.localeCompare(a.finishedAt!))
      .slice(0, 6);
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
          </div>
          <div className="flex flex-col gap-4 lg:col-span-4">
            <GoalTracker {...goal} daysLeft={daysLeft} />
            <KpiCards {...stats} />
          </div>
        </motion.div>

        <motion.div variants={fadeUp}>
          <ReadingHeatmap sessions={data.sessions} todayISO={todayISO} />
        </motion.div>

        {recent.length > 0 && (
          <motion.section variants={fadeUp} className="mt-12">
            <SectionHeading
              title="Recently finished"
              meta={
                <Link href="/library" className="underline-offset-4 hover:text-foreground hover:underline">
                  All books
                </Link>
              }
            />
            <div className="grid grid-cols-3 gap-x-4 gap-y-8 sm:grid-cols-6 sm:gap-x-6">
              {recent.map((book) => (
                <Link key={book.id} href={`/book/${book.id}`} className="group block">
                  <BookCover
                    book={book}
                    elevated
                    className="transition-transform duration-300 ease-(--ease-out) [@media(hover:hover)]:group-hover:-translate-y-1"
                  />
                  <p className="mt-3 truncate font-serif text-[15px] leading-tight">{book.title}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{formatDate(book.finishedAt)}</p>
                </Link>
              ))}
            </div>
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
