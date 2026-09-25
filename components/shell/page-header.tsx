import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-12 flex flex-wrap items-end justify-between gap-6 sm:mb-16", className)}>
      <div className="max-w-2xl">
        {eyebrow && <p className="label-meta mb-3">{eyebrow}</p>}
        <h1 className="font-display text-[34px] leading-[1.05] font-medium tracking-[-0.02em] sm:text-[44px]">{title}</h1>
        {description && <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionHeading({
  title,
  meta,
  className,
}: {
  title: React.ReactNode;
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-5 flex items-baseline justify-between gap-4", className)}>
      <h2 className="label-meta text-foreground">{title}</h2>
      {meta && <div className="font-display text-xs text-muted-foreground">{meta}</div>}
    </div>
  );
}

/** Quiet placeholder while LocalStorage loads on the client. Holds layout, no shimmer. */
export function LoadingBlock({ className }: { className?: string }) {
  return <div aria-hidden className={cn("rounded-lg border border-border bg-surface", className)} />;
}
