import { useMemo, useState } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, Download, History, SearchX } from 'lucide-react'
import type { MovementType } from '@/types'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { selectMovements, selectProducts } from '@/store/selectors'
import { addToast } from '@/store/slices/toastsSlice'
import { downloadCsv, todayStamp, type CsvValue } from '@/lib/csv'
import { usePageSlice } from '@/hooks/usePageSlice'
import { useDelayedLoading } from '@/hooks/useDelayedLoading'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { FilterSelect } from '@/components/ui/Filters'
import { PageHeader, PageTransition } from '@/components/ui/PageHeader'
import { Pagination } from '@/components/ui/Pagination'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { StockFormModal } from './StockForm'
import { MovementsTable } from './MovementsTable'

const PAGE_SIZE = 10

export default function StockPage() {
  const dispatch = useAppDispatch()
  const products = useAppSelector(selectProducts)
  const movements = useAppSelector(selectMovements)
  const loading = useDelayedLoading()

  const [productId, setProductId] = useState('')
  const [type, setType] = useState<MovementType | ''>('')
  const [formOpen, setFormOpen] = useState(false)
  const [formType, setFormType] = useState<MovementType>('in')

  const existingProductIds = useMemo(() => new Set(products.map((p) => p.id)), [products])

  // The filter also lists products that were deleted but still have history.
  const productOptions = useMemo(() => {
    const byId = new Map<string, string>()
    for (const movement of movements) byId.set(movement.productId, movement.productName)
    for (const product of products) byId.set(product.id, product.name)
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [movements, products])

  const filtered = useMemo(
    () =>
      movements.filter(
        (movement) => (!productId || movement.productId === productId) && (!type || movement.type === type),
      ),
    [movements, productId, type],
  )
  const { page, setPage, pageItems } = usePageSlice(filtered, PAGE_SIZE)
  const hasFilters = Boolean(productId || type)

  const open = (movementType: MovementType) => {
    setFormType(movementType)
    setFormOpen(true)
  }

  const clearFilters = () => {
    setProductId('')
    setType('')
    setPage(1)
  }

  const exportCsv = () => {
    const rows: CsvValue[][] = [
      ['Date', 'Product', 'Product code (SKU)', 'Type', 'Quantity', 'Previous quantity', 'New quantity', 'Reason'],
      ...filtered.map((movement): CsvValue[] => [
        movement.createdAt,
        movement.productName,
        movement.sku,
        movement.type === 'in' ? 'Received' : 'Issued',
        movement.quantity,
        movement.previousQuantity,
        movement.newQuantity,
        movement.reason,
      ]),
    ]
    downloadCsv(`stock-movements-${todayStamp()}.csv`, rows)
    dispatch(addToast('success', `Exported ${filtered.length} ${filtered.length === 1 ? 'movement' : 'movements'} to CSV.`))
  }

  return (
    <PageTransition>
      <PageHeader
        title="Stock"
        description="Receive and issue stock, and review every movement."
        actions={
          <>
            <Button
              variant="ghost"
              icon={<Download className="h-4 w-4" aria-hidden />}
              onClick={exportCsv}
              disabled={filtered.length === 0}
              title="Download the movements shown (with current filters) as a CSV file"
            >
              Export CSV
            </Button>
            <Button variant="secondary" icon={<ArrowUpFromLine className="h-4 w-4" aria-hidden />} onClick={() => open('out')}>
              Issue stock
            </Button>
            <Button icon={<ArrowDownToLine className="h-4 w-4" aria-hidden />} onClick={() => open('in')}>
              Receive stock
            </Button>
          </>
        }
      />

      <Card className="mb-4 p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]">
          <FilterSelect
            label="Filter by product"
            value={productId}
            onChange={(e) => {
              setProductId(e.target.value)
              setPage(1)
            }}
          >
            <option value="">All products</option>
            {productOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            label="Filter by movement type"
            value={type}
            onChange={(e) => {
              setType(e.target.value as MovementType | '')
              setPage(1)
            }}
          >
            <option value="">Received and issued</option>
            <option value="in">Received only</option>
            <option value="out">Issued only</option>
          </FilterSelect>
          <Button variant="secondary" onClick={clearFilters} disabled={!hasFilters}>
            Clear filters
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <TableSkeleton rows={6} columns={6} />
        ) : movements.length === 0 ? (
          <EmptyState
            icon={History}
            title="No stock movements yet"
            description="Receive or issue stock and every movement will be listed here."
            action={
              <Button icon={<ArrowDownToLine className="h-4 w-4" aria-hidden />} onClick={() => open('in')}>
                Receive stock
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No movements match"
            description="Try a different product or movement type."
            action={
              <Button variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <>
            <MovementsTable movements={pageItems} existingProductIds={existingProductIds} />
            <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
          </>
        )}
      </Card>

      <StockFormModal open={formOpen} onClose={() => setFormOpen(false)} initialType={formType} />
    </PageTransition>
  )
}
