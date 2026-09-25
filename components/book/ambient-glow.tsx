import { cn } from "@/lib/utils";

/**
 * The only color on screen besides covers: a heavily blurred, low-opacity wash
 * built from a cover's palette. Position it behind the cover with `className`.
 */
export function AmbientGlow({
  palette,
  className,
  intensity = 1,
}: {
  palette: [string, string, string];
  className?: string;
  intensity?: number;
}) {
  const [ground, ink, accent] = palette;
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute -z-10", className)}
      style={{ opacity: `calc(var(--glow-opacity) * ${intensity})` }}
    >
      <div
        className="size-full blur-3xl saturate-[1.35]"
        style={{
          background: [
            `radial-gradient(48% 52% at 36% 42%, ${ground} 0%, transparent 72%)`,
            `radial-gradient(42% 46% at 66% 60%, ${accent} 0%, transparent 72%)`,
            `radial-gradient(28% 30% at 58% 28%, ${ink} 0%, transparent 70%)`,
          ].join(", "),
        }}
      />
    </div>
  );
}
