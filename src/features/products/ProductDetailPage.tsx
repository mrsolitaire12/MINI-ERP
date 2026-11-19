import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowDownToLine, ArrowLeft, ArrowUpFromLine, History, PackageSearch, Pencil, Trash2 } from 'lucide-react'
import type { MovementType } from '@/types'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { selectCategories, selectMovements, selectProducts } from '@/store/selectors'
import { deleteProduct } from '@/store/thunks'
import { getStockStatus } from '@/lib/inventory'
import { formatCurrency, formatDate, formatNumber } from '@/lib/format'
import { usePageSlice } from '@/hooks/usePageSlice'
import { useAosRefresh } from '@/hooks/useAosRefresh'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader, PageTransition } from '@/components/ui/PageHeader'
import { Pagination } from '@/components/ui/Pagination'
import { StatusBadge } from '@/components/ui/Badge'
import { StockBar } from '@/components/ui/StockBar'
import { ProductStockChart } from './ProductStockChart'
import { StockFormModal } from '@/features/stock/StockForm'
import { MovementsTable } from '@/features/stock/MovementsTable'
import { ProductFormModal } from './ProductForm'
import { DeleteProductDialog } from './DeleteProductDialog'

const PAGE_SIZE = 8

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-slate-900">{children}</dd>
    </div>
  )
}

export default function ProductDetailPage() {
  const { productId } = useParams()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()

  const products = useAppSelector(selectProducts)
  const categories = useAppSelector(selectCategories)
  const allMovements = useAppSelector(selectMovements)

  const product = products.find((p) => p.id === productId)
  const history = useMemo(
    () => allMovements.filter((movement) => movement.productId === productId),
    [allMovements, productId],
  )
  const { page, setPage, pageItems } = usePageSlice(history, PAGE_SIZE)

  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [stockOpen, setStockOpen] = useState(false)
  const [stockType, setStockType] = useState<MovementType>('in')

  useAosRefresh(productId)

  if (!product) {
    return (
      <PageTransition>
        <Card>
          <EmptyState
            icon={PackageSearch}
            title="Product not found"
            description="It may have been deleted, or the link is wrong."
            action={
              <Link
                to="/products"
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                Back to products
              </Link>
            }
          />
        </Card>
      </PageTransition>
    )
  }

  const status = getStockStatus(product)
  const categoryName = categories.find((c) => c.id === product.categoryId)?.name ?? '—'
  const existingIds = new Set([product.id])

  const openStock = (type: MovementType) => {
    setStockType(type)
    setStockOpen(true)
  }

  const confirmDelete = () => {
    dispatch(deleteProduct(product.id))
    setDeleteOpen(false)
    navigate('/products', { replace: true })
  }

  return (
    <PageTransition>
      <Link
        to="/products"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        All products
      </Link>

      <PageHeader
        title={product.name}
        description={`Product code ${product.sku}`}
        actions={
          <>
            <Button variant="secondary" icon={<ArrowUpFromLine className="h-4 w-4" aria-hidden />} onClick={() => openStock('out')}>
              Issue
            </Button>
            <Button variant="secondary" icon={<ArrowDownToLine className="h-4 w-4" aria-hidden />} onClick={() => openStock('in')}>
              Receive
            </Button>
            <Button variant="secondary" icon={<Pencil className="h-4 w-4" aria-hidden />} onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            <Button variant="danger" icon={<Trash2 className="h-4 w-4" aria-hidden />} onClick={() => setDeleteOpen(true)}>
              Delete
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" data-aos="fade-up">
          <CardHeader title="Product details" />
          <dl className="grid gap-5 p-5 sm:grid-cols-2">
            <Detail label="Name">{product.name}</Detail>
            <Detail label="Product code (SKU)">{product.sku}</Detail>
            <Detail label="Category">{categoryName}</Detail>
            <Detail label="Unit price">{formatCurrency(product.unitPrice)}</Detail>
            <Detail label="Created">{formatDate(product.createdAt)}</Detail>
            <Detail label="Minimum stock level">{formatNumber(product.minStock)}</Detail>
            <div className="sm:col-span-2">
              <Detail label="Description">
                {product.description || <span className="text-slate-400">No description.</span>}
              </Detail>
            </div>
          </dl>
        </Card>

        <Card data-aos="fade-up" data-aos-delay="100">
          <CardHeader title="Stock" />
          <div className="space-y-4 p-5">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Available quantity</p>
              <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900">{formatNumber(product.quantity)}</p>
            </div>
            <div>
              <StockBar quantity={product.quantity} minStock={product.minStock} status={status} className="w-full" />
              <p className="mt-1.5 text-xs text-slate-500">
                Minimum level {formatNumber(product.minStock)}. A full bar means at least double that.
              </p>
            </div>
            <StatusBadge status={status} />
            <div className="border-t border-slate-100 pt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Stock value</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {formatCurrency(Math.round(product.unitPrice * 100) * product.quantity / 100)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="mt-6" data-aos="fade-up">
        <CardHeader title="Stock level over time" subtitle="Hover the line to see each change" />
        <div className="px-4 pb-4">
          <ProductStockChart product={product} history={history} />
        </div>
      </Card>

      <Card className="mt-6 overflow-hidden" data-aos="fade-up">
        <CardHeader title="Stock history" subtitle="Every change to this product's quantity" />
        {history.length === 0 ? (
          <EmptyState
            icon={History}
            title="No stock movements yet"
            description="Receive or issue stock to start this product's history."
          />
        ) : (
          <>
            <MovementsTable movements={pageItems} existingProductIds={existingIds} showProduct={false} />
            <Pagination page={page} pageSize={PAGE_SIZE} total={history.length} onPageChange={setPage} />
          </>
        )}
      </Card>

      <ProductFormModal open={editOpen} onClose={() => setEditOpen(false)} product={product} />
      <StockFormModal
        open={stockOpen}
        onClose={() => setStockOpen(false)}
        initialType={stockType}
        initialProductId={product.id}
      />
      <DeleteProductDialog product={deleteOpen ? product : null} onConfirm={confirmDelete} onCancel={() => setDeleteOpen(false)} />
    </PageTransition>
  )
}
