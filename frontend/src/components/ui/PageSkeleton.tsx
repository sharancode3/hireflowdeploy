import { Skeleton } from "./Skeleton";

/** Full-page skeleton loader for data-heavy pages */
export function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      {/* Stat cards row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      {/* Content rows */}
      <div className="space-y-3">
        {[...Array(rows)].map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

/** Table skeleton for list pages */
export function TableSkeleton({ cols = 4, rows = 5 }: { cols?: number; rows?: number }) {
  return (
    <div className="animate-fade-in rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      {/* Header row */}
      <div className="flex gap-4 border-b border-[var(--border)] px-5 py-3">
        {[...Array(cols)].map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1 max-w-[120px]" />
        ))}
      </div>
      {/* Body rows */}
      {[...Array(rows)].map((_, r) => (
        <div key={r} className="flex gap-4 border-b border-[var(--border)] px-5 py-4 last:border-0">
          {[...Array(cols)].map((_, c) => (
            <Skeleton key={c} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Card grid skeleton */
export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 animate-fade-in">
      {[...Array(count)].map((_, i) => (
        <Skeleton key={i} className="h-32 rounded-2xl" />
      ))}
    </div>
  );
}
