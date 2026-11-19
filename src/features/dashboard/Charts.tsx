import { Link, useNavigate } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { BarChart3 } from 'lucide-react'
import { useAppSelector } from '@/store/hooks'
import {
  selectMovementsByDay,
  selectStatusDistribution,
  selectStockByCategory,
  selectSummary,
} from '@/store/selectors'
import { formatNumber } from '@/lib/format'
import { EmptyState } from '@/components/ui/EmptyState'

// Colours: green for the single "stock by category" series, blue and orange for the
// two movement series, and green / amber / red for stock status (always with a label).
const GREEN = '#5a7828'
const BLUE = '#2a78d6'
const ORANGE = '#eb6834'
const STATUS_COLORS = {
  'in-stock': '#008300',
  'low-stock': '#eda100',
  'out-of-stock': '#e34948',
}

const AXIS_TICK = { fontSize: 12, fill: '#64748b' }
const TOOLTIP_STYLE = {
  borderRadius: 12,
  border: '1px solid #e2e8f0',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.1)',
  fontSize: 12,
}

/** Click a bar to open the products in that category. */
export function StockByCategoryChart() {
  const data = useAppSelector(selectStockByCategory)
  const navigate = useNavigate()
  const sorted = [...data].sort((a, b) => b.units - a.units)

  if (sorted.length === 0) {
    return <EmptyState icon={BarChart3} title="No categories yet" description="Add a category to see stock by category." />
  }

  const summary = sorted.map((item) => `${item.name}: ${item.units} units`).join(', ')
  return (
    <div role="img" aria-label={`Units in stock by category. ${summary}`} className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={sorted} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 4 }}>
          <CartesianGrid horizontal={false} stroke="#e2e8f0" />
          <XAxis type="number" tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="name" width={118} tick={AXIS_TICK} tickLine={false} axisLine={false} />
          <Tooltip
            cursor={{ fill: 'rgba(90, 120, 40, 0.08)' }}
            contentStyle={TOOLTIP_STYLE}
            formatter={(value) => [`${formatNumber(Number(value))} units`, 'In stock']}
          />
          <Bar
            dataKey="units"
            fill={GREEN}
            radius={[0, 6, 6, 0]}
            barSize={18}
            cursor="pointer"
            onClick={(_: unknown, index: number) => {
              const category = sorted[index]
              if (category) navigate(`/products?category=${category.id}`)
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Click a slice, or a row in the list underneath, to open the products with that status. */
export function StatusChart() {
  const data = useAppSelector(selectStatusDistribution)
  const { totalProducts } = useAppSelector(selectSummary)
  const navigate = useNavigate()

  if (totalProducts === 0) {
    return <EmptyState icon={BarChart3} title="No products yet" description="Add products to see stock status." />
  }

  return (
    <div>
      <div
        role="img"
        aria-label={`Products by stock status. ${data.map((d) => `${d.name}: ${d.value}`).join(', ')}`}
        className="h-44"
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={48}
              outerRadius={78}
              paddingAngle={2}
              stroke="#ffffff"
              strokeWidth={2}
              cursor="pointer"
              onClick={(_: unknown, index: number) => {
                const slice = data[index]
                if (slice) navigate(`/products?status=${slice.key}`)
              }}
            >
              {data.map((entry) => (
                <Cell key={entry.key} fill={STATUS_COLORS[entry.key]} />
              ))}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value, name) => [`${value} products`, name]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-3 space-y-1">
        {data.map((entry) => (
          <li key={entry.key}>
            <Link
              to={`/products?status=${entry.key}`}
              className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-slate-900/5"
            >
              <span className="flex items-center gap-2 text-slate-600">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: STATUS_COLORS[entry.key] }} aria-hidden />
                {entry.name}
              </span>
              <span className="font-medium text-slate-900">
                {entry.value}
                <span className="ml-1 font-normal text-slate-400">
                  ({Math.round((entry.value / totalProducts) * 100)}%)
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function MovementsChart() {
  const data = useAppSelector(selectMovementsByDay)
  const hasData = data.some((day) => day.received > 0 || day.issued > 0)

  if (!hasData) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No movements in the last 7 days"
        description="Receive or issue stock to see activity here."
      />
    )
  }

  return (
    <div
      role="img"
      aria-label={`Units received and issued per day for the last 7 days. ${data
        .map((d) => `${d.label}: ${d.received} received, ${d.issued} issued`)
        .join('; ')}`}
      className="h-72"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -8 }}>
          <CartesianGrid vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} />
          <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip cursor={{ fill: 'rgba(90, 120, 40, 0.08)' }} contentStyle={TOOLTIP_STYLE} />
          <Legend iconType="square" wrapperStyle={{ fontSize: 12, color: '#475569' }} />
          <Bar dataKey="received" name="Received" fill={BLUE} radius={[6, 6, 0, 0]} maxBarSize={22} />
          <Bar dataKey="issued" name="Issued" fill={ORANGE} radius={[6, 6, 0, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
