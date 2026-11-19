import type { StockStatus } from '@/types'

const COLORS: Record<StockStatus, string> = {
  'in-stock': 'bg-emerald-500',
  'low-stock': 'bg-amber-500',
  'out-of-stock': 'bg-red-500',
}

interface StockBarProps {
  quantity: number
  minStock: number
  status: StockStatus
  className?: string
}

/**
 * A small gauge. A full bar means stock is at least double the minimum level.
 * The status badge next to it says the same thing in words.
 */
export function StockBar({ quantity, minStock, status, className = 'w-20' }: StockBarProps) {
  const target = Math.max(minStock * 2, 1)
  const percent = Math.max(0, Math.min(100, Math.round((quantity / target) * 100)))
  return (
    <div className={`h-1.5 overflow-hidden rounded-full bg-slate-200/80 ${className}`} aria-hidden>
      <div
        className={`h-full rounded-full transition-[width] duration-500 ${COLORS[status]}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}
