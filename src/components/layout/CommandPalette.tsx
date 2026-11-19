import { useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useIsPresent } from 'framer-motion'
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  CornerDownLeft,
  LayoutDashboard,
  Package,
  PackagePlus,
  Search,
  Tag,
  Tags,
  type LucideIcon,
} from 'lucide-react'
import type { MovementType, StockStatus } from '@/types'
import { useAppSelector } from '@/store/hooks'
import { selectCategories, selectProductCountByCategory, selectProducts } from '@/store/selectors'
import { getStockStatus } from '@/lib/inventory'
import { StatusBadge } from '@/components/ui/Badge'

interface PaletteItem {
  id: string
  group: string
  label: string
  detail?: string
  icon: LucideIcon
  haystack: string
  status?: StockStatus
  run: () => void
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  onOpenStock: (type: MovementType) => void
  onAddProduct: () => void
  onAddCategory: () => void
}

export function CommandPalette(props: CommandPaletteProps) {
  // Rendered in <body>, and the content starts fresh every time it opens.
  return createPortal(
    <AnimatePresence>{props.open && <PaletteBody {...props} />}</AnimatePresence>,
    document.body,
  )
}

function PaletteBody({ onClose, onOpenStock, onAddProduct, onAddCategory }: CommandPaletteProps) {
  const navigate = useNavigate()
  const listId = useId()
  const isPresent = useIsPresent()
  const products = useAppSelector(selectProducts)
  const categories = useAppSelector(selectCategories)
  const counts = useAppSelector(selectProductCountByCategory)

  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const items = useMemo(() => {
    const make = (
      id: string,
      group: string,
      label: string,
      icon: LucideIcon,
      run: () => void,
      detail?: string,
      extra = '',
      status?: StockStatus,
      search?: string,
    ): PaletteItem => ({
      id,
      group,
      label,
      detail,
      icon,
      status,
      run,
      haystack: (search ?? `${label} ${detail ?? ''} ${extra}`).toLowerCase(),
    })

    const actions = [
      make('act-receive', 'Actions', 'Receive stock', ArrowDownToLine, () => onOpenStock('in'), 'Record incoming stock', 'add incoming in'),
      make('act-issue', 'Actions', 'Issue stock', ArrowUpFromLine, () => onOpenStock('out'), 'Record outgoing stock', 'remove outgoing out sell'),
      make('act-product', 'Actions', 'Add product', PackagePlus, onAddProduct, 'Create a new product', 'new create'),
      make('act-category', 'Actions', 'Add category', Tag, onAddCategory, 'Create a new category', 'new create'),
    ]
    const pages = [
      make('page-dashboard', 'Pages', 'Go to Dashboard', LayoutDashboard, () => navigate('/'), undefined, 'overview home'),
      make('page-products', 'Pages', 'Go to Products', Package, () => navigate('/products'), undefined, 'items inventory'),
      make('page-stock', 'Pages', 'Go to Stock', ArrowLeftRight, () => navigate('/stock'), 'Movement history', 'history movements'),
      make('page-categories', 'Pages', 'Go to Categories', Tags, () => navigate('/categories'), undefined, 'groups'),
    ]
    const categoryNames = new Map(categories.map((category) => [category.id, category.name]))
    const productItems = products.map((product) =>
      make(
        `prd-${product.id}`,
        'Products',
        product.name,
        Package,
        () => navigate(`/products/${product.id}`),
        `${product.sku} · ${categoryNames.get(product.categoryId) ?? 'No category'}`,
        '',
        getStockStatus(product),
        // Products are found by name or code; typing a category name should show the category itself.
        `${product.name} ${product.sku}`,
      ),
    )
    const categoryItems = categories.map((category) =>
      make(
        `cat-${category.id}`,
        'Categories',
        category.name,
        Tags,
        () => navigate(`/products?category=${category.id}`),
        `${counts[category.id] ?? 0} products`,
        '',
        undefined,
        category.name,
      ),
    )

    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (tokens.length === 0) return [...actions, ...pages]

    const matches = (item: PaletteItem) => tokens.every((token) => item.haystack.includes(token))
    return [
      ...productItems.filter(matches).slice(0, 6),
      ...categoryItems.filter(matches).slice(0, 4),
      ...actions.filter(matches),
      ...pages.filter(matches),
    ]
  }, [query, products, categories, counts, navigate, onOpenStock, onAddProduct, onAddCategory])

  const selected = items.length === 0 ? 0 : Math.min(active, items.length - 1)

  useEffect(() => {
    document.getElementById(`${listId}-option-${selected}`)?.scrollIntoView({ block: 'nearest' })
  }, [selected, listId])

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  const choose = (item: PaletteItem | undefined) => {
    if (!item) return
    onClose()
    item.run()
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive(items.length ? (selected + 1) % items.length : 0)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive(items.length ? (selected - 1 + items.length) % items.length : 0)
    } else if (event.key === 'Home') {
      event.preventDefault()
      setActive(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      setActive(Math.max(0, items.length - 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      choose(items[selected])
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[9vh]" inert={!isPresent}>
      <motion.div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        aria-hidden
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Search and quick actions"
        className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-white/70 bg-white/95 shadow-2xl backdrop-blur-2xl"
        initial={{ opacity: 0, y: -14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -14, scale: 0.98 }}
        transition={{ duration: 0.16 }}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-slate-200/70 px-5">
          <Search className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
          <input
            autoFocus
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={items.length ? `${listId}-option-${selected}` : undefined}
            aria-label="Search products, categories and actions"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setActive(0)
            }}
            placeholder="Search products, categories or actions…"
            autoComplete="off"
            spellCheck={false}
            className="h-14 w-full bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <span className="kbd" aria-hidden>
            Esc
          </span>
        </div>

        <ul id={listId} role="listbox" aria-label="Results" className="max-h-[52vh] overflow-y-auto p-2">
          {items.length === 0 && (
            <li role="presentation" className="px-4 py-10 text-center text-sm text-slate-500">
              Nothing found for “{query.trim()}”.
            </li>
          )}
          {items.map((item, index) => {
            const Icon = item.icon
            const isActive = index === selected
            const startsGroup = index === 0 || items[index - 1].group !== item.group
            return (
              <li key={item.id} role="presentation">
                {startsGroup && (
                  <p className="px-3 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wider text-slate-400">
                    {item.group}
                  </p>
                )}
                <div
                  id={`${listId}-option-${index}`}
                  role="option"
                  aria-selected={isActive}
                  onMouseMove={() => setActive(index)}
                  onClick={() => choose(item)}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 ${
                    isActive ? 'bg-brand-50 text-slate-900' : 'text-slate-700'
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      isActive ? 'bg-brand-100 text-brand-700' : 'bg-slate-900/5 text-slate-500'
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{item.label}</span>
                    {item.detail && <span className="block truncate text-xs text-slate-500">{item.detail}</span>}
                  </span>
                  {item.status && <StatusBadge status={item.status} />}
                  {isActive && !item.status && <CornerDownLeft className="h-4 w-4 text-slate-400" aria-hidden />}
                </div>
              </li>
            )
          })}
        </ul>

        <div className="flex items-center gap-4 border-t border-slate-200/70 bg-slate-50/60 px-5 py-2.5 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="kbd">↑</span>
            <span className="kbd">↓</span> to move
          </span>
          <span className="flex items-center gap-1.5">
            <span className="kbd">↵</span> to open
          </span>
        </div>
      </motion.div>
    </div>
  )
}
