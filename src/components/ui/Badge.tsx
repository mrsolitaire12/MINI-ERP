import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, CheckCircle2, XCircle } from 'lucide-react'
import type { MovementType, StockStatus } from '@/types'
import { STATUS_LABELS } from '@/lib/inventory'

const STATUS_STYLES: Record<StockStatus, string> = {
  'in-stock': 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  'low-stock': 'bg-amber-50 text-amber-800 ring-amber-600/30',
  'out-of-stock': 'bg-red-50 text-red-700 ring-red-600/20',
}

const STATUS_ICONS = {
  'in-stock': CheckCircle2,
  'low-stock': AlertTriangle,
  'out-of-stock': XCircle,
}

const base = 'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset'

/** Status uses an icon and a word as well as colour, so it is clear without colour. */
export function StatusBadge({ status }: { status: StockStatus }) {
  const Icon = STATUS_ICONS[status]
  return (
    <span className={`${base} ${STATUS_STYLES[status]}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {STATUS_LABELS[status]}
    </span>
  )
}

export function MovementBadge({ type }: { type: MovementType }) {
  const received = type === 'in'
  const Icon = received ? ArrowDownToLine : ArrowUpFromLine
  return (
    <span
      className={`${base} ${
        received ? 'bg-sky-50 text-sky-700 ring-sky-600/20' : 'bg-orange-50 text-orange-700 ring-orange-600/20'
      }`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {received ? 'Received' : 'Issued'}
    </span>
  )
}
