"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const next = resolvedTheme === "dark" ? "light" : "dark";

  return (
    <Tooltip content={resolvedTheme === "dark" ? "Paper" : "Obsidian"}>
      <Button variant="ghost" size="icon-sm" onClick={() => setTheme(next)} aria-label="Toggle theme">
        {/* Both icons render; CSS picks one so the server markup never disagrees with the client. */}
        <Sun className="hidden dark:block" />
        <Moon className="dark:hidden" />
      </Button>
    </Tooltip>
  );
}
