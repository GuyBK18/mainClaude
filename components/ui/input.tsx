import * as React from "react";
import { cn } from "@/lib/utils";

const fieldBase =
  "w-full min-w-0 rounded-sm border border-border bg-surface px-3 text-sm text-foreground transition-[border-color] duration-150 outline-none placeholder:text-muted-foreground hover:border-ink-12 focus-visible:border-foreground focus-visible:outline-none disabled:opacity-50";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return <input type={type} data-slot="input" className={cn(fieldBase, "h-9", className)} {...props} />;
}

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={cn(fieldBase, "min-h-20 py-2 leading-relaxed", className)} {...props} />;
}

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label data-slot="label" className={cn("label-meta block", className)} {...props} />;
}

export { Input, Textarea, Label, fieldBase };
