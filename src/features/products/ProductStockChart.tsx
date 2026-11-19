import { useId, useMemo } from 'react'
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { LineChart } from 'lucide-react'
import type { Product, StockMovement } from '@/types'
import { formatDateTime, formatNumber } from '@/lib/format'
import { EmptyState } from '@/components/ui/EmptyState'

const GREEN = '#5a7828'
const AXIS_TICK = { fontSize: 12, fill: '#64748b' }
const dayFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })

interface Point {
  time: number
  quantity: number
  note: string
}

/** Shows how one product's quantity went up and down over time. Hover to see each change. */
export function ProductStockChart({ product, history }: { product: Product; history: StockMovement[] }) {
  const gradientId = useId()

  const points = useMemo<Point[]>(() => {
    // History is newest first; the chart reads oldest to newest.
    const ordered = [...history].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    const result: Point[] = ordered.map((movement) => ({
      time: new Date(movement.createdAt).getTime(),
      quantity: movement.newQuantity,
      note: `${movement.type === 'in' ? 'Received' : 'Issued'} ${formatNumber(movement.quantity)}${
        movement.reason ? ` (${movement.reason})` : ''
      }`,
    }))
    // Carry the line up to today so it ends at the current quantity.
    if (result.length > 0) {
      result.push({ time: Date.now(), quantity: product.quantity, note: 'Now' })
    }
    return result
  }, [history, product.quantity])

  if (points.length < 2) {
    return (
      <EmptyState
        icon={LineChart}
        title="Not enough history to draw a graph"
        description="Receive or issue stock and the graph will appear."
      />
    )
  }

  return (
    <div
      role="img"
      aria-label={`Quantity of ${product.name} over time, from ${formatNumber(points[0].quantity)} to ${formatNumber(product.quantity)} units`}
      className="h-64"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={GREEN} stopOpacity={0.3} />
              <stop offset="100%" stopColor={GREEN} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#e2e8f0" />
          <XAxis
            dataKey="time"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(value) => dayFormat.format(new Date(value))}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
          />
          <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
          {product.minStock > 0 && (
            <ReferenceLine
              y={product.minStock}
              stroke="#eda100"
              strokeDasharray="4 4"
              label={{ value: 'Minimum level', position: 'insideTopRight', fontSize: 11, fill: '#92400e' }}
            />
          )}
          <Tooltip
            contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
            labelFormatter={(value) => formatDateTime(new Date(Number(value)).toISOString())}
            formatter={(value, _name, item) => [`${formatNumber(Number(value))} units`, (item.payload as Point).note]}
          />
          <Area
            type="stepAfter"
            dataKey="quantity"
            stroke={GREEN}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            activeDot={{ r: 5, stroke: '#ffffff', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
