export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-200/80 ${className}`} aria-hidden />
}

/** Placeholder rows shown while a table "loads". */
export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div role="status" aria-label="Loading" className="divide-y divide-slate-100">
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex items-center gap-4 px-4 py-4">
          {Array.from({ length: columns }, (_, col) => (
            <Skeleton key={col} className={`h-4 ${col === 0 ? 'w-1/3' : 'flex-1'}`} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function CardSkeleton({ className = 'h-28' }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={`animate-pulse rounded-xl border border-slate-200 bg-white ${className}`}
    />
  )
}
