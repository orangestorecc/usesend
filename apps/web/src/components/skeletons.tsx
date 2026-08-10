import { Skeleton } from "@usesend/ui/src/skeleton";
import { TableCell, TableRow } from "@usesend/ui/src/table";

/**
 * Skeleton rows for table-based list screens. Renders `rows` × `cols`
 * shimmering placeholders that match the table layout during loading.
 */
export function TableRowsSkeleton({
  rows = 6,
  cols = 4,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <TableRow key={r} className="hover:bg-transparent">
          {Array.from({ length: cols }).map((_, c) => (
            <TableCell key={c} className="py-4">
              <Skeleton
                className="h-4 rounded-md"
                style={{ width: c === 0 ? "60%" : c === cols - 1 ? "40%" : "50%" }}
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

/**
 * Skeleton cards for card-based list screens (campaigns, domains).
 */
export function CardsSkeleton({
  count = 4,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-6 ${className ?? ""}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between rounded-lg border border-border bg-card p-5"
        >
          <div className="flex flex-col gap-2.5">
            <Skeleton className="h-4 w-48 rounded-md" />
            <Skeleton className="h-3 w-32 rounded-md" />
          </div>
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
      ))}
    </div>
  );
}
