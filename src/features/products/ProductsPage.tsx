import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  ArrowUpDown,
  Download,
  Eye,
  Package,
  Pencil,
  Plus,
  SearchX,
  Trash2,
} from 'lucide-react'
import type { Product, StockStatus } from '@/types'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { selectCategories, selectProducts } from '@/store/selectors'
import { deleteProduct } from '@/store/thunks'
import { addToast } from '@/store/slices/toastsSlice'
import {
  filterProducts,
  getStockStatus,
  sortProducts,
  STATUS_LABELS,
  type SortDirection,
  type SortKey,
} from '@/lib/inventory'
import { downloadCsv, todayStamp, type CsvValue } from '@/lib/csv'
import { formatCurrency, formatNumber } from '@/lib/format'
import { usePageSlice } from '@/hooks/usePageSlice'
import { useDelayedLoading } from '@/hooks/useDelayedLoading'
import { useQuickActions } from '@/components/layout/QuickActions'
import { Button, IconButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { FilterSelect, SearchInput } from '@/components/ui/Filters'
import { PageHeader, PageTransition } from '@/components/ui/PageHeader'
import { Pagination } from '@/components/ui/Pagination'
import { StatusBadge } from '@/components/ui/Badge'
import { StockBar } from '@/components/ui/StockBar'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { ProductFormModal } from './ProductForm'
import { DeleteProductDialog } from './DeleteProductDialog'

const PAGE_SIZE = 8
const STATUSES = Object.keys(STATUS_LABELS) as StockStatus[]
const SORT_KEYS: SortKey[] = ['name', 'price', 'quantity', 'status']

const isStatus = (value: string | null): value is StockStatus =>
  value !== null && (STATUSES as string[]).includes(value)
const isSortKey = (value: string | null): value is SortKey =>
  value !== null && (SORT_KEYS as string[]).includes(value)

interface SortHeaderProps {
  label: string
  sortKey: SortKey
  current: SortKey | ''
  direction: SortDirection
  onSort: (key: SortKey) => void
  className?: string
}

function SortHeader({ label, sortKey, current, direction, onSort, className = '' }: SortHeaderProps) {
  const active = current === sortKey
  const Icon = !active ? ArrowUpDown : direction === 'asc' ? ArrowUp : ArrowDown
  return (
    <th
      scope="col"
      aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={`th ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        title={`Sort by ${label.toLowerCase()}`}
        className={`inline-flex items-center gap-1 rounded uppercase tracking-wide transition-colors hover:text-slate-900 ${
          active ? 'text-slate-900' : ''
        }`}
      >
        {label}
        <Icon className={`h-3.5 w-3.5 ${active ? '' : 'opacity-50'}`} aria-hidden />
      </button>
    </th>
  )
}

export default function ProductsPage() {
  const dispatch = useAppDispatch()
  const products = useAppSelector(selectProducts)
  const categories = useAppSelector(selectCategories)
  const loading = useDelayedLoading()
  const { openStock } = useQuickActions()

  // Filters and sorting live in the address bar, so a refresh or a shared link keeps them.
  const [params, setParams] = useSearchParams()
  const search = params.get('q') ?? ''
  const categoryParam = params.get('category') ?? ''
  const categoryId = categories.some((c) => c.id === categoryParam) ? categoryParam : ''
  const statusParam = params.get('status')
  const status: StockStatus | '' = isStatus(statusParam) ? statusParam : ''
  const sortParam = params.get('sort')
  const sortKey: SortKey | '' = isSortKey(sortParam) ? sortParam : ''
  const sortDirection: SortDirection = params.get('dir') === 'desc' ? 'desc' : 'asc'

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [deleting, setDeleting] = useState<Product | null>(null)

  const categoryNames = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories])

  const visible = useMemo(
    () => sortProducts(filterProducts(products, { search, categoryId, status }), sortKey, sortDirection),
    [products, search, categoryId, status, sortKey, sortDirection],
  )
  const { page, setPage, pageItems } = usePageSlice(visible, PAGE_SIZE)

  const hasFilters = Boolean(search || categoryId || status)

  const updateParams = (changes: Record<string, string>) => {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value)
          else next.delete(key)
        }
        return next
      },
      { replace: true },
    )
    setPage(1)
  }

  const clearFilters = () => updateParams({ q: '', category: '', status: '' })

  // First click sorts A to Z (or low to high), second reverses, third goes back to the default order.
  const onSort = (key: SortKey) => {
    if (sortKey !== key) updateParams({ sort: key, dir: 'asc' })
    else if (sortDirection === 'asc') updateParams({ sort: key, dir: 'desc' })
    else updateParams({ sort: '', dir: '' })
  }

  const openAdd = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (product: Product) => {
    setEditing(product)
    setFormOpen(true)
  }

  const confirmDelete = () => {
    if (deleting) dispatch(deleteProduct(deleting.id))
    setDeleting(null)
  }

  const exportCsv = () => {
    const rows: CsvValue[][] = [
      [
        'Product name',
        'Product code (SKU)',
        'Category',
        'Description',
        'Unit price',
        'Quantity',
        'Minimum stock level',
        'Status',
        'Stock value',
        'Created',
      ],
      ...visible.map((product): CsvValue[] => [
        product.name,
        product.sku,
        categoryNames.get(product.categoryId) ?? '',
        product.description,
        product.unitPrice,
        product.quantity,
        product.minStock,
        STATUS_LABELS[getStockStatus(product)],
        (Math.round(product.unitPrice * 100) * product.quantity) / 100,
        product.createdAt.slice(0, 10),
      ]),
    ]
    downloadCsv(`products-${todayStamp()}.csv`, rows)
    dispatch(addToast('success', `Exported ${visible.length} ${visible.length === 1 ? 'product' : 'products'} to CSV.`))
  }

  return (
    <PageTransition>
      <PageHeader
        title="Products"
        description="Manage everything you keep in stock."
        actions={
          <>
            <Button
              variant="secondary"
              icon={<Download className="h-4 w-4" aria-hidden />}
              onClick={exportCsv}
              disabled={visible.length === 0}
              title="Download the products shown (with current filters) as a CSV file"
            >
              Export CSV
            </Button>
            <Button icon={<Plus className="h-4 w-4" aria-hidden />} onClick={openAdd}>
              Add product
            </Button>
          </>
        }
      />

      <Card className="mb-4 p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
          <SearchInput
            label="Search products"
            placeholder="Search by name or product code"
            value={search}
            onChange={(value) => updateParams({ q: value })}
          />
          <FilterSelect label="Filter by category" value={categoryId} onChange={(e) => updateParams({ category: e.target.value })}>
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="Filter by stock status" value={status} onChange={(e) => updateParams({ status: e.target.value })}>
            <option value="">All stock statuses</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABELS[value]}
              </option>
            ))}
          </FilterSelect>
          <Button variant="secondary" onClick={clearFilters} disabled={!hasFilters}>
            Clear filters
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <TableSkeleton rows={6} columns={5} />
        ) : products.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No products yet"
            description="Add your first product to start tracking stock."
            action={
              <Button icon={<Plus className="h-4 w-4" aria-hidden />} onClick={openAdd}>
                Add product
              </Button>
            }
          />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No products match"
            description="Try a different search or clear the filters."
            action={
              <Button variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <>
            <p className="sr-only" role="status">
              {visible.length} products found
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] divide-y divide-slate-900/5">
                <thead className="bg-brand-50/60">
                  <tr>
                    <SortHeader label="Product" sortKey="name" current={sortKey} direction={sortDirection} onSort={onSort} />
                    <th scope="col" className="th hidden lg:table-cell">Category</th>
                    <SortHeader label="Price" sortKey="price" current={sortKey} direction={sortDirection} onSort={onSort} className="text-right" />
                    <SortHeader label="Quantity" sortKey="quantity" current={sortKey} direction={sortDirection} onSort={onSort} className="text-right" />
                    <SortHeader label="Status" sortKey="status" current={sortKey} direction={sortDirection} onSort={onSort} />
                    <th scope="col" className="th text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/5">
                  {pageItems.map((product) => {
                    const productStatus = getStockStatus(product)
                    return (
                      <motion.tr
                        key={product.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2 }}
                        className="transition-colors hover:bg-white/60"
                      >
                        <td className="td">
                          <Link
                            to={`/products/${product.id}`}
                            className="font-medium text-slate-900 hover:text-brand-700"
                          >
                            {product.name}
                          </Link>
                          <p className="text-xs text-slate-500">{product.sku}</p>
                        </td>
                        <td className="td hidden lg:table-cell">{categoryNames.get(product.categoryId) ?? '—'}</td>
                        <td className="td text-right tabular-nums">{formatCurrency(product.unitPrice)}</td>
                        <td className="td text-right tabular-nums">
                          <span className="font-medium text-slate-900">{formatNumber(product.quantity)}</span>
                          <StockBar
                            quantity={product.quantity}
                            minStock={product.minStock}
                            status={productStatus}
                            className="ml-auto mt-1.5 w-20"
                          />
                          <p className="mt-1 text-xs text-slate-400">min {formatNumber(product.minStock)}</p>
                        </td>
                        <td className="td">
                          <StatusBadge status={productStatus} />
                        </td>
                        <td className="td">
                          <div className="flex justify-end gap-0.5">
                            <IconButton
                              label={`Receive or issue stock for ${product.name}`}
                              tone="brand"
                              onClick={() => openStock('in', product.id)}
                            >
                              <ArrowLeftRight className="h-4 w-4" aria-hidden />
                            </IconButton>
                            <Link
                              to={`/products/${product.id}`}
                              aria-label={`View ${product.name}`}
                              title="View details"
                              className="rounded-xl p-2 text-slate-500 transition duration-150 hover:bg-slate-900/5 hover:text-slate-800 active:scale-95"
                            >
                              <Eye className="h-4 w-4" aria-hidden />
                            </Link>
                            <IconButton label={`Edit ${product.name}`} onClick={() => openEdit(product)}>
                              <Pencil className="h-4 w-4" aria-hidden />
                            </IconButton>
                            <IconButton label={`Delete ${product.name}`} tone="danger" onClick={() => setDeleting(product)}>
                              <Trash2 className="h-4 w-4" aria-hidden />
                            </IconButton>
                          </div>
                        </td>
                      </motion.tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={visible.length} onPageChange={setPage} />
          </>
        )}
      </Card>

      <ProductFormModal open={formOpen} onClose={() => setFormOpen(false)} product={editing} />
      <DeleteProductDialog product={deleting} onConfirm={confirmDelete} onCancel={() => setDeleting(null)} />
    </PageTransition>
  )
}
