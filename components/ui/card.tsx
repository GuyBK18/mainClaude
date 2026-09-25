import { cn } from "@/lib/utils";

/** Flat card: surface, 1px hairline, 8px radius. Never a shadow. */
export function Card({ className, ...props }: React.ComponentProps<"section">) {
  return <section className={cn("rounded-lg border border-border bg-surface", className)} {...props} />;
}
