import { formatNumber } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { RatingStars } from "@/components/book/rating";

function Tile({ label, value, detail }: { label: string; value: React.ReactNode; detail: React.ReactNode }) {
  return (
    <Card className="flex items-end justify-between gap-4 p-5 sm:flex-col sm:items-start lg:flex-row lg:items-end">
      <div className="min-w-0">
        <p className="label-meta">{label}</p>
        <div className="mt-2 text-xs text-muted-foreground">{detail}</div>
      </div>
      <p className="font-display text-[30px] leading-none font-medium tracking-[-0.02em]">{value}</p>
    </Card>
  );
}

export function KpiCards({
  totalBooks,
  totalPages,
  averageRating,
  ratedCount,
}: {
  totalBooks: number;
  totalPages: number;
  averageRating: number | null;
  ratedCount: number;
}) {
  return (
    <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-1">
      <Tile label="Books" value={formatNumber(totalBooks)} detail="finished, all time" />
      <Tile label="Pages" value={formatNumber(totalPages)} detail="read, all time" />
      <Tile
        label="Your avg rating"
        value={averageRating === null ? "—" : averageRating.toFixed(2)}
        detail={
          <span className="flex items-center gap-2">
            <RatingStars value={averageRating === null ? null : Math.round(averageRating * 2) / 2} size="size-3" />
            <span>{ratedCount} rated</span>
          </span>
        }
      />
    </div>
  );
}
