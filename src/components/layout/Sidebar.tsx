import { useId, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeftRight,
  Boxes,
  LayoutDashboard,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  Search,
  Tags,
  type LucideIcon,
} from 'lucide-react'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { selectCategories, selectProducts, selectSummary } from '@/store/selectors'
import { resetDemoData } from '@/store/thunks'
import { COMPANY } from '@/data/company'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { SHORTCUT_LABEL, useQuickActions } from './QuickActions'

interface NavItemDef {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  badge?: { value: number; tone: 'neutral' | 'warn'; title: string }
}

function NavItem({
  item,
  collapsed,
  pillId,
  onNavigate,
}: {
  item: NavItemDef
  collapsed: boolean
  pillId: string
  onNavigate?: () => void
}) {
  const Icon = item.icon
  const badge = item.badge && item.badge.value > 0 ? item.badge : null

  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        `relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
          collapsed ? 'justify-center' : ''
        } ${
          isActive
            ? 'font-medium text-slate-900'
            : 'text-slate-600 hover:bg-slate-900/[0.04] hover:text-slate-900'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId={pillId}
              className="absolute inset-0 rounded-xl bg-slate-900/[0.07]"
              transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              aria-hidden
            />
          )}
          <Icon className="relative h-[18px] w-[18px] shrink-0" aria-hidden />
          <span className={collapsed ? 'sr-only' : 'relative flex-1 truncate'}>{item.label}</span>
          {!collapsed && badge && (
            <span
              title={badge.title}
              className={`relative rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${
                badge.tone === 'warn' ? 'bg-amber-100 text-amber-800' : 'bg-slate-900/[0.07] text-slate-600'
              }`}
            >
              {badge.value}
            </span>
          )}
        </>
      )}
    </NavLink>
  )
}

interface SidebarContentProps {
  collapsed?: boolean
  /** When given, a button to shrink or expand the sidebar is shown. */
  onToggleCollapse?: () => void
  onNavigate?: () => void
}

export function SidebarContent({ collapsed = false, onToggleCollapse, onNavigate }: SidebarContentProps) {
  const dispatch = useAppDispatch()
  const { openPalette } = useQuickActions()
  const pillId = useId()
  const [confirmReset, setConfirmReset] = useState(false)

  const productCount = useAppSelector(selectProducts).length
  const categoryCount = useAppSelector(selectCategories).length
  const summary = useAppSelector(selectSummary)
  const needRestock = summary.lowStock + summary.outOfStock

  const overview: NavItemDef[] = [{ to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true }]
  const inventory: NavItemDef[] = [
    {
      to: '/products',
      label: 'Products',
      icon: Package,
      badge: { value: productCount, tone: 'neutral', title: `${productCount} products` },
    },
    {
      to: '/stock',
      label: 'Stock',
      icon: ArrowLeftRight,
      badge: { value: needRestock, tone: 'warn', title: `${needRestock} products need restocking` },
    },
    {
      to: '/categories',
      label: 'Categories',
      icon: Tags,
      badge: { value: categoryCount, tone: 'neutral', title: `${categoryCount} categories` },
    },
  ]

  const sectionLabel = (text: string) =>
    collapsed ? (
      <div className="mx-3 my-3 border-t border-slate-900/5" />
    ) : (
      <p className="px-3 pb-1 pt-5 text-[11px] font-medium uppercase tracking-wider text-slate-400">{text}</p>
    )

  return (
    <div className="glass flex h-full flex-col rounded-3xl p-3">
      <div className={`flex items-center px-1.5 pb-3 pt-1 ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {collapsed ? (
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-700 text-white">
            <Boxes className="h-[18px] w-[18px]" aria-hidden />
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-700 text-white">
              <Boxes className="h-4 w-4" aria-hidden />
            </div>
            <span className="text-xl font-medium tracking-tight text-slate-900">Mini ERP</span>
          </div>
        )}
        {onToggleCollapse && !collapsed && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-900/5 hover:text-slate-700"
          >
            <PanelLeftClose className="h-[18px] w-[18px]" aria-hidden />
          </button>
        )}
      </div>

      {/* The business this demo belongs to */}
      <div
        className={`flex items-center gap-3 rounded-2xl bg-white/60 ring-1 ring-black/5 ${
          collapsed ? 'justify-center p-1.5' : 'p-2.5'
        }`}
        title={collapsed ? COMPANY.name : undefined}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-300 to-brand-700 text-xs font-semibold text-white">
          {COMPANY.initials}
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-900">{COMPANY.name}</p>
            <p className="truncate text-xs text-slate-500">{COMPANY.location}</p>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          onNavigate?.()
          openPalette()
        }}
        aria-label="Search and quick actions"
        title={collapsed ? `Search (${SHORTCUT_LABEL})` : undefined}
        className={`mt-3 flex items-center gap-2 rounded-xl border border-slate-900/10 bg-white/60 text-sm text-slate-500 transition-colors hover:bg-white ${
          collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2'
        }`}
      >
        <Search className="h-4 w-4 shrink-0" aria-hidden />
        {!collapsed && (
          <>
            <span className="flex-1 text-left">Search…</span>
            <span className="kbd">{SHORTCUT_LABEL}</span>
          </>
        )}
      </button>

      <nav aria-label="Main" className="mt-2 flex-1 overflow-y-auto">
        {sectionLabel('Overview')}
        <div className="space-y-0.5">
          {overview.map((item) => (
            <NavItem key={item.to} item={item} collapsed={collapsed} pillId={pillId} onNavigate={onNavigate} />
          ))}
        </div>
        {sectionLabel('Inventory')}
        <div className="space-y-0.5">
          {inventory.map((item) => (
            <NavItem key={item.to} item={item} collapsed={collapsed} pillId={pillId} onNavigate={onNavigate} />
          ))}
        </div>
      </nav>

      <div className="border-t border-slate-900/5 pt-2">
        {onToggleCollapse && collapsed && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className="mb-1 flex w-full items-center justify-center rounded-xl px-3 py-2.5 text-slate-500 hover:bg-slate-900/5 hover:text-slate-800"
          >
            <PanelLeftOpen className="h-[18px] w-[18px]" aria-hidden />
          </button>
        )}
        <button
          type="button"
          onClick={() => setConfirmReset(true)}
          title={collapsed ? 'Reset demo data' : undefined}
          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-500 transition-colors hover:bg-slate-900/5 hover:text-slate-800 ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <RotateCcw className="h-4 w-4 shrink-0" aria-hidden />
          <span className={collapsed ? 'sr-only' : ''}>Reset demo data</span>
        </button>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Reset demo data?"
        confirmLabel="Reset data"
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          dispatch(resetDemoData())
          setConfirmReset(false)
          onNavigate?.()
        }}
      >
        This replaces all products, categories and stock history with the original demo data. Any changes
        you made will be lost.
      </ConfirmDialog>
    </div>
  )
}
