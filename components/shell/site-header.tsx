"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Plus, Search } from "lucide-react";
import { useUI } from "@/lib/ui-context";
import { snappySpring } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { ThemeToggle } from "./theme-toggle";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/library", label: "Library" },
  { href: "/analytics", label: "Analytics" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  // A book page belongs to the library.
  if (href === "/library") return pathname.startsWith("/library") || pathname.startsWith("/book");
  return pathname.startsWith(href);
}

export function SiteHeader() {
  const pathname = usePathname();
  const { setCommandOpen, setQuickAddOpen } = useUI();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-8 px-4 sm:h-14 sm:flex-nowrap sm:px-8">
        <Link href="/" className="flex h-14 items-center gap-2.5 font-display text-[15px] font-semibold tracking-tight">
          <span aria-hidden className="grid size-5 place-items-center rounded-full border border-foreground">
            <span className="size-1.5 rounded-full bg-foreground" />
          </span>
          LuminaRead
        </Link>

        <nav
          aria-label="Main"
          className="no-scrollbar order-last -mx-4 flex h-11 w-[calc(100%+32px)] items-stretch gap-6 overflow-x-auto border-t border-border px-4 sm:order-none sm:mx-0 sm:h-14 sm:w-auto sm:border-t-0 sm:px-0"
        >
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex items-center font-display text-[13px] tracking-[0.02em] transition-colors duration-150",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
                {active && (
                  <motion.span
                    layoutId="nav-underline"
                    transition={snappySpring}
                    className="absolute inset-x-0 -bottom-px h-px bg-foreground"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            className="pressable flex h-8 items-center gap-2 rounded-sm border border-border bg-surface px-2.5 text-muted-foreground transition-colors duration-150 hover:border-ink-12 hover:text-foreground"
          >
            <Search className="size-3.5" />
            <span className="hidden font-display text-xs md:inline">Search</span>
            <kbd className="hidden font-display text-[11px] tracking-widest md:inline">⌘K</kbd>
            <span className="sr-only md:hidden">Search</span>
          </button>
          <Tooltip content="Add a book">
            <Button size="sm" onClick={() => setQuickAddOpen(true)} className="gap-1.5">
              <Plus />
              <span className="hidden sm:inline">Add book</span>
            </Button>
          </Tooltip>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
