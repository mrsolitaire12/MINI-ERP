import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { MovementType } from '@/types'
import { StockFormModal } from '@/features/stock/StockForm'
import { ProductFormModal } from '@/features/products/ProductForm'
import { CategoryFormModal } from '@/features/categories/CategoryForm'
import { CommandPalette } from './CommandPalette'

interface QuickActions {
  openPalette: () => void
  /** Opens the receive / issue dialog, optionally with a product already chosen. */
  openStock: (type?: MovementType, productId?: string) => void
  openAddProduct: () => void
  openAddCategory: () => void
}

const QuickActionsContext = createContext<QuickActions | null>(null)

export function useQuickActions(): QuickActions {
  const value = useContext(QuickActionsContext)
  if (!value) throw new Error('useQuickActions must be used inside QuickActionsProvider')
  return value
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
export const SHORTCUT_LABEL = isMac ? '⌘K' : 'Ctrl K'

interface StockRequest {
  type: MovementType
  productId: string
}

/**
 * Keeps one copy of the search panel and the "add / receive / issue" dialogs,
 * so any screen can open them, and Ctrl/⌘ + K works everywhere.
 */
export function QuickActionsProvider({ children }: { children: ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [stockRequest, setStockRequest] = useState<StockRequest | null>(null)
  const [productFormOpen, setProductFormOpen] = useState(false)
  const [categoryFormOpen, setCategoryFormOpen] = useState(false)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen((open) => !open)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const openStock = useCallback((type: MovementType = 'in', productId = '') => {
    setStockRequest({ type, productId })
  }, [])
  const openAddProduct = useCallback(() => setProductFormOpen(true), [])
  const openAddCategory = useCallback(() => setCategoryFormOpen(true), [])
  const closePalette = useCallback(() => setPaletteOpen(false), [])
  const closeStock = useCallback(() => setStockRequest(null), [])
  const closeProduct = useCallback(() => setProductFormOpen(false), [])
  const closeCategory = useCallback(() => setCategoryFormOpen(false), [])
  const openPalette = useCallback(() => setPaletteOpen(true), [])
  const openStockFromPalette = useCallback((type: MovementType) => openStock(type), [openStock])

  const value = useMemo<QuickActions>(
    () => ({ openPalette, openStock, openAddProduct, openAddCategory }),
    [openPalette, openStock, openAddProduct, openAddCategory],
  )

  return (
    <QuickActionsContext.Provider value={value}>
      {children}
      <CommandPalette
        open={paletteOpen}
        onClose={closePalette}
        onOpenStock={openStockFromPalette}
        onAddProduct={openAddProduct}
        onAddCategory={openAddCategory}
      />
      <StockFormModal
        open={stockRequest !== null}
        onClose={closeStock}
        initialType={stockRequest?.type}
        initialProductId={stockRequest?.productId}
      />
      <ProductFormModal open={productFormOpen} onClose={closeProduct} />
      <CategoryFormModal open={categoryFormOpen} onClose={closeCategory} />
    </QuickActionsContext.Provider>
  )
}
