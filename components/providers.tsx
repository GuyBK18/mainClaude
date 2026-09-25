"use client";

import { MotionConfig } from "framer-motion";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { LibraryProvider } from "@/lib/library-context";
import { UIProvider } from "@/lib/ui-context";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CommandPalette } from "@/components/shell/command-palette";
import { QuickAddDialog } from "@/components/library/quick-add-dialog";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <LibraryProvider>
        <UIProvider>
          <TooltipProvider>
            <MotionConfig reducedMotion="user">
              {children}
              <CommandPalette />
              <QuickAddDialog />
              <Toaster
                position="bottom-right"
                toastOptions={{
                  unstyled: true,
                  classNames: {
                    toast:
                      "flex w-full items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 font-display text-[13px] text-foreground",
                    description: "text-muted-foreground",
                    actionButton: "ml-auto rounded-sm px-2 py-1 font-medium underline-offset-4 hover:underline",
                  },
                }}
              />
            </MotionConfig>
          </TooltipProvider>
        </UIProvider>
      </LibraryProvider>
    </ThemeProvider>
  );
}
