import type {
  Category,
  MovementType,
  Product,
  StockMovement,
  StockStatus,
} from '@/types'
import { createId } from './id'

/** Largest quantity allowed in a single stock movement. */
export const MAX_MOVEMENT_QUANTITY = 1_000_000
/** Largest quantity a product may hold in total. */
export const MAX_STOCK = 10_000_000

export const STATUS_LABELS: Record<StockStatus, string> = {
  'in-stock': 'In stock',
  'low-stock': 'Low stock',
  'out-of-stock': 'Out of stock',
}

/**
 * Out of stock: nothing left.
 * Low stock: some left, but no more than the minimum stock level.
 * In stock: more than the minimum stock level.
 */
export function getStockStatus(product: Pick<Product, 'quantity' | 'minStock'>): StockStatus {
  if (product.quantity <= 0) return 'out-of-stock'
  if (product.quantity <= product.minStock) return 'low-stock'
  return 'in-stock'
}

/** Returns an error message if the movement is not allowed, otherwise null. */
export function validateMovement(
  available: number,
  type: MovementType,
  quantity: number,
): string | null {
  if (!Number.isFinite(quantity) || !Number.isInteger(quantity)) {
    return 'Quantity must be a whole number.'
  }
  if (quantity < 0) return 'Quantity cannot be negative.'
  if (quantity === 0) return 'Quantity must be greater than zero.'
  if (quantity > MAX_MOVEMENT_QUANTITY) {
    return `Quantity cannot be more than ${MAX_MOVEMENT_QUANTITY.toLocaleString('en-US')} in one movement.`
  }
  if (type === 'out' && quantity > available) {
    return `Insufficient stock available. Only ${available.toLocaleString('en-US')} in stock.`
  }
  if (type === 'in' && available + quantity > MAX_STOCK) {
    return `Stock cannot exceed ${MAX_STOCK.toLocaleString('en-US')} units per product.`
  }
  return null
}

export function buildMovement(
  product: Product,
  type: MovementType,
  quantity: number,
  reason: string,
  now: Date = new Date(),
): StockMovement {
  const newQuantity = type === 'in' ? product.quantity + quantity : product.quantity - quantity
  return {
    id: createId('mov'),
    productId: product.id,
    productName: product.name,
    sku: product.sku,
    type,
    quantity,
    previousQuantity: product.quantity,
    newQuantity,
    reason: reason.trim(),
    createdAt: now.toISOString(),
  }
}

export function describeMovement(movement: Pick<StockMovement, 'type' | 'quantity' | 'productName'>): string {
  const units = `${movement.quantity.toLocaleString('en-US')} unit${movement.quantity === 1 ? '' : 's'}`
  return movement.type === 'in'
    ? `Received ${units} of ${movement.productName}`
    : `Issued ${units} of ${movement.productName}`
}

export interface InventorySummary {
  totalProducts: number
  totalStock: number
  totalValue: number
  inStock: number
  lowStock: number
  outOfStock: number
}

export function computeSummary(products: Product[]): InventorySummary {
  let totalStock = 0
  let valueInCents = 0
  let inStock = 0
  let lowStock = 0
  let outOfStock = 0

  for (const product of products) {
    totalStock += product.quantity
    // Work in cents so totals do not pick up floating point noise.
    valueInCents += Math.round(product.unitPrice * 100) * product.quantity
    const status = getStockStatus(product)
    if (status === 'in-stock') inStock += 1
    else if (status === 'low-stock') lowStock += 1
    else outOfStock += 1
  }

  return {
    totalProducts: products.length,
    totalStock,
    totalValue: valueInCents / 100,
    inStock,
    lowStock,
    outOfStock,
  }
}

export function stockByCategory(products: Product[], categories: Category[]) {
  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    units: products
      .filter((product) => product.categoryId === category.id)
      .reduce((sum, product) => sum + product.quantity, 0),
  }))
}

export function statusDistribution(products: Product[]) {
  const summary = computeSummary(products)
  return [
    { key: 'in-stock' as const, name: STATUS_LABELS['in-stock'], value: summary.inStock },
    { key: 'low-stock' as const, name: STATUS_LABELS['low-stock'], value: summary.lowStock },
    { key: 'out-of-stock' as const, name: STATUS_LABELS['out-of-stock'], value: summary.outOfStock },
  ]
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

/** Units received and issued for each of the last `days` days (oldest first). */
export function movementsByDay(movements: StockMovement[], days = 7, now: Date = new Date()) {
  const labelFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric' })
  const buckets = Array.from({ length: days }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1 - index))
    return { key: dayKey(date), label: labelFormat.format(date), received: 0, issued: 0 }
  })
  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]))

  for (const movement of movements) {
    const date = new Date(movement.createdAt)
    if (Number.isNaN(date.getTime())) continue
    const bucket = byKey.get(dayKey(date))
    if (!bucket) continue
    if (movement.type === 'in') bucket.received += movement.quantity
    else bucket.issued += movement.quantity
  }

  return buckets.map(({ label, received, issued }) => ({ label, received, issued }))
}

export interface StockTrend {
  /** Total units in stock at the end of each day, oldest first (today is last). */
  values: number[]
  /** Change in percent from the first day to today. Empty when there was no stock to compare. */
  delta: number | null
}

/**
 * Works out how total stock changed over the last few days by taking today's
 * total and undoing the movements that happened after each day ended.
 */
export function stockTrend(
  products: Product[],
  movements: StockMovement[],
  days = 7,
  now: Date = new Date(),
): StockTrend {
  const existing = new Set(products.map((product) => product.id))
  const current = products.reduce((sum, product) => sum + product.quantity, 0)
  const nowMs = now.getTime()

  const values: number[] = []
  for (let offset = days; offset >= 0; offset -= 1) {
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset + 1).getTime()
    let later = 0
    for (const movement of movements) {
      if (!existing.has(movement.productId)) continue
      const time = new Date(movement.createdAt).getTime()
      if (Number.isNaN(time) || time > nowMs || time < endOfDay) continue
      later += movement.type === 'in' ? movement.quantity : -movement.quantity
    }
    values.push(current - later)
  }

  const first = values[0]
  const last = values[values.length - 1]
  return { values, delta: first > 0 ? ((last - first) / first) * 100 : null }
}

export type SortKey = 'name' | 'price' | 'quantity' | 'status'
export type SortDirection = 'asc' | 'desc'

const STATUS_RANK: Record<StockStatus, number> = { 'out-of-stock': 0, 'low-stock': 1, 'in-stock': 2 }

/** Returns a sorted copy. Without a key the original order (newest first) is kept. */
export function sortProducts(products: Product[], key: SortKey | '', direction: SortDirection): Product[] {
  if (!key) return products
  const factor = direction === 'asc' ? 1 : -1
  const byName = (a: Product, b: Product) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })
  return [...products].sort((a, b) => {
    let result = 0
    if (key === 'name') result = byName(a, b)
    else if (key === 'price') result = a.unitPrice - b.unitPrice
    else if (key === 'quantity') result = a.quantity - b.quantity
    else result = STATUS_RANK[getStockStatus(a)] - STATUS_RANK[getStockStatus(b)]
    // Equal values fall back to the name, so the order never jumps around.
    return result !== 0 ? result * factor : byName(a, b)
  })
}

export interface ProductFilters {
  search: string
  categoryId: string
  status: StockStatus | ''
}

export function filterProducts(products: Product[], filters: ProductFilters): Product[] {
  const term = filters.search.trim().toLowerCase()
  return products.filter((product) => {
    if (term && !product.name.toLowerCase().includes(term) && !product.sku.toLowerCase().includes(term)) {
      return false
    }
    if (filters.categoryId && product.categoryId !== filters.categoryId) return false
    if (filters.status && getStockStatus(product) !== filters.status) return false
    return true
  })
}
