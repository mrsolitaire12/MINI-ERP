import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowDownRight,
  ArrowUpFromLine,
  ArrowUpRight,
  Boxes,
  Check,
  CircleDollarSign,
  History,
  Layers,
  Minus,
  Package,
  PackageCheck,
  PackagePlus,
  PackageX,
  Tags,
  type LucideIcon,
} from 'lucide-react'
import type { ActivityType } from '@/types'
import { useAppSelector } from '@/store/hooks'
import {
  selectActivities,
  selectCategories,
  selectLowStockProducts,
  selectOutOfStockProducts,
  selectStockTrend,
  selectSummary,
} from '@/store/selectors'
import { COMPANY } from '@/data/company'
import { formatCurrency, formatNumber, timeAgo } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageTransition } from '@/components/ui/PageHeader'
import { CardSkeleton } from '@/components/ui/Skeleton'
import { Sparkline } from '@/components/ui/Sparkline'
import { useDelayedLoading } from '@/hooks/useDelayedLoading'
import { useAosRefresh } from '@/hooks/useAosRefresh'
import { SHORTCUT_LABEL, useQuickActions } from '@/components/layout/QuickActions'
import { StatCard } from './StatCard'
import { MovementsChart, StatusChart, StockByCategoryChart } from './Charts'

const ACTIVITY_ICONS: Record<ActivityType, { icon: LucideIcon; style: string }> = {
  'stock-in': { icon: ArrowDownToLine, style: 'bg-sky-100 text-sky-700' },
  'stock-out': { icon: ArrowUpFromLine, style: 'bg-orange-100 text-orange-700' },
  'product-created': { icon: Package, style: 'bg-emerald-100 text-emerald-700' },
  'product-updated': { icon: Package, style: 'bg-slate-100 text-slate-600' },
  'product-deleted': { icon: Package, style: 'bg-red-100 text-red-700' },
  'category-created': { icon: Tags, style: 'bg-emerald-100 text-emerald-700' },
  'category-updated': { icon: Tags, style: 'bg-slate-100 text-slate-600' },
  'category-deleted': { icon: Tags, style: 'bg-red-100 text-red-700' },
}

function greeting(now: Date = new Date()): string {
  const hour = now.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

/** Share of products that are comfortably stocked, shown as a pill under the greeting. */
function HealthChip() {
  const { totalProducts, inStock } = useAppSelector(selectSummary)
  if (totalProducts === 0) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-white/60 px-3.5 py-1.5 text-sm text-slate-600 ring-1 ring-black/5">
        No products yet
      </span>
    )
  }
  const percent = Math.round((inStock / totalProducts) * 100)
  const tone = percent >= 75 ? 'bg-brand-700' : percent >= 50 ? 'bg-amber-500' : 'bg-red-600'
  return (
    <span className="inline-flex items-center gap-2.5 rounded-full bg-white/60 py-1.5 pl-1.5 pr-4 text-sm text-slate-600 ring-1 ring-black/5">
      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-white ${tone}`}>
        <Check className="h-3.5 w-3.5" aria-hidden />
      </span>
      <span>
        <strong className="font-semibold text-slate-900">{percent}%</strong> of products well stocked
      </span>
    </span>
  )
}

function TrendNote({ delta }: { delta: number | null }) {
  if (delta === null) return <span>Not enough history yet</span>
  const rounded = Math.round(delta * 10) / 10
  if (rounded === 0) {
    return (
      <span className="inline-flex items-center gap-1 font-medium text-slate-500">
        <Minus className="h-3.5 w-3.5" aria-hidden /> No change in 7 days
      </span>
    )
  }
  const up = rounded > 0
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap font-medium ${up ? 'text-emerald-700' : 'text-orange-700'}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {up ? '+' : '−'}
      {Math.abs(rounded)}% in 7 days
    </span>
  )
}

function ProductAlertList({
  title,
  subtitle,
  status,
  viewAllHref,
}: {
  title: string
  subtitle: string
  status: 'low-stock' | 'out-of-stock'
  viewAllHref: string
}) {
  const products = useAppSelector(status === 'low-stock' ? selectLowStockProducts : selectOutOfStockProducts)
  const { openStock } = useQuickActions()
  const shown = products.slice(0, 6)

  return (
    <Card data-aos="fade-up">
      <CardHeader
        title={title}
        subtitle={subtitle}
        action={
          products.length > 0 ? (
            <Link to={viewAllHref} className="text-xs font-medium text-brand-700 hover:text-brand-900">
              View all ({products.length})
            </Link>
          ) : undefined
        }
      />
      {products.length === 0 ? (
        <EmptyState
          icon={PackageCheck}
          title={status === 'low-stock' ? 'No low-stock products' : 'Nothing is out of stock'}
          description="Everything is above its minimum level."
        />
      ) : (
        <ul className="divide-y divide-slate-900/5">
          {shown.map((product) => (
            <li key={product.id} className="flex items-center gap-2 pr-4 hover:bg-white/50">
              <Link to={`/products/${product.id}`} className="flex min-w-0 flex-1 items-center justify-between gap-3 py-3 pl-6">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{product.name}</p>
                  <p className="text-xs text-slate-500">{product.sku}</p>
                </div>
                <p className={`shrink-0 text-sm font-semibold ${status === 'low-stock' ? 'text-amber-700' : 'text-red-600'}`}>
                  {formatNumber(product.quantity)}
                  <span className="ml-1 text-xs font-normal text-slate-400">/ min {product.minStock}</span>
                </p>
              </Link>
              <Button
                size="sm"
                variant="secondary"
                aria-label={`Restock ${product.name}`}
                icon={<PackagePlus className="h-3.5 w-3.5" aria-hidden />}
                onClick={() => openStock('in', product.id)}
              >
                Restock
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function RecentActivity() {
  const activities = useAppSelector(selectActivities).slice(0, 8)

  return (
    <Card data-aos="fade-up">
      <CardHeader title="Recent activity" subtitle="Latest inventory changes" />
      {activities.length === 0 ? (
        <EmptyState icon={History} title="No activity yet" description="Changes you make will appear here." />
      ) : (
        <ul className="divide-y divide-slate-900/5">
          <AnimatePresence initial={false}>
            {activities.map((activity) => {
              const { icon: Icon, style } = ACTIVITY_ICONS[activity.type]
              return (
                <motion.li
                  key={activity.id}
                  layout
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="flex items-start gap-3 px-6 py-3"
                >
                  <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${style}`}>
                    <Icon className="h-4 w-4" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-700">{activity.message}</p>
                    <p className="text-xs text-slate-400">{timeAgo(activity.createdAt)}</p>
                  </div>
                </motion.li>
              )
            })}
          </AnimatePresence>
        </ul>
      )}
    </Card>
  )
}

export default function DashboardPage() {
  const loading = useDelayedLoading()
  const summary = useAppSelector(selectSummary)
  const categories = useAppSelector(selectCategories)
  const trend = useAppSelector(selectStockTrend)
  const { openStock, openAddProduct } = useQuickActions()

  useAosRefresh(loading)

  return (
    <PageTransition>
      <header className="mb-8 lg:mb-10">
        <h1 className="text-[2rem] font-medium leading-[1.08] tracking-tight text-slate-900 sm:text-5xl xl:text-6xl">
          {greeting()},
          <br className="hidden sm:block" /> <span className="text-brand-700">{COMPANY.name}</span>
        </h1>
        <p className="mt-4 max-w-xl text-sm text-slate-600 sm:text-base">
          Inventory status for {COMPANY.name} across {formatNumber(summary.totalProducts)}{' '}
          {summary.totalProducts === 1 ? 'product' : 'products'} in {formatNumber(categories.length)}{' '}
          {categories.length === 1 ? 'category' : 'categories'}.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <HealthChip />
          <div className="flex flex-wrap items-center gap-2">
            <Button icon={<ArrowDownToLine className="h-4 w-4" aria-hidden />} onClick={() => openStock('in')}>
              Receive stock
            </Button>
            <Button
              variant="secondary"
              icon={<ArrowUpFromLine className="h-4 w-4" aria-hidden />}
              onClick={() => openStock('out')}
            >
              Issue stock
            </Button>
            <Button variant="secondary" icon={<PackagePlus className="h-4 w-4" aria-hidden />} onClick={openAddProduct}>
              Add product
            </Button>
          </div>
        </div>
        <p className="mt-4 hidden items-center gap-2 text-xs text-slate-500 sm:flex">
          Tip: press <span className="kbd">{SHORTCUT_LABEL}</span> to search or jump anywhere.
        </p>
      </header>

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {Array.from({ length: 5 }, (_, i) => (
              <CardSkeleton key={i} className="h-40" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <CardSkeleton className="h-80 lg:col-span-2" />
            <CardSkeleton className="h-80" />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard
              label="Total products"
              value={summary.totalProducts}
              format={formatNumber}
              icon={Boxes}
              footer={`Across ${categories.length} ${categories.length === 1 ? 'category' : 'categories'}`}
            />
            <StatCard
              label="Total stock (units)"
              value={summary.totalStock}
              format={formatNumber}
              icon={Layers}
              delay={50}
              footer={
                <div className="space-y-1.5">
                  <TrendNote delta={trend.delta} />
                  <Sparkline
                    stretch
                    values={trend.values}
                    label={`Total units in stock over the last 7 days, from ${formatNumber(trend.values[0] ?? 0)} to ${formatNumber(trend.values[trend.values.length - 1] ?? 0)}`}
                  />
                </div>
              }
            />
            <StatCard
              label="Inventory value"
              value={summary.totalValue}
              format={formatCurrency}
              icon={CircleDollarSign}
              delay={100}
              footer="Units × unit price"
            />
            <StatCard
              label="Low-stock products"
              value={summary.lowStock}
              format={formatNumber}
              icon={AlertTriangle}
              delay={150}
              footer="At or below minimum level"
            />
            <StatCard
              label="Out-of-stock products"
              value={summary.outOfStock}
              format={formatNumber}
              icon={PackageX}
              delay={200}
              footer="Nothing left to sell"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2" data-aos="fade-up">
              <CardHeader title="Stock by category" subtitle="Units in stock. Click a bar to see its products." />
              <div className="px-4 pb-4">
                <StockByCategoryChart />
              </div>
            </Card>
            <Card data-aos="fade-up" data-aos-delay="100">
              <CardHeader title="Stock status" subtitle="Click a slice to filter products" />
              <div className="px-4 pb-4">
                <StatusChart />
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2" data-aos="fade-up">
              <CardHeader title="Stock movements" subtitle="Units received and issued, last 7 days" />
              <div className="px-4 pb-4">
                <MovementsChart />
              </div>
            </Card>
            <RecentActivity />
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <ProductAlertList
              title="Low-stock products"
              subtitle="At or below the minimum level"
              status="low-stock"
              viewAllHref="/products?status=low-stock"
            />
            <ProductAlertList
              title="Out-of-stock products"
              subtitle="Nothing left to sell"
              status="out-of-stock"
              viewAllHref="/products?status=out-of-stock"
            />
          </div>
        </div>
      )}
    </PageTransition>
  )
}
