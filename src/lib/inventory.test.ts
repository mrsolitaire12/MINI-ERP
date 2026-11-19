import { describe, expect, it } from 'vitest'
import type { Product, StockMovement } from '@/types'
import {
  computeSummary,
  filterProducts,
  getStockStatus,
  movementsByDay,
  sortProducts,
  stockTrend,
  validateMovement,
} from './inventory'

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'p1',
  name: 'Wireless Mouse',
  sku: 'WM-200',
  categoryId: 'c1',
  description: '',
  unitPrice: 10,
  quantity: 20,
  minStock: 5,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

describe('getStockStatus', () => {
  it('is out of stock at zero', () => {
    expect(getStockStatus({ quantity: 0, minStock: 5 })).toBe('out-of-stock')
    expect(getStockStatus({ quantity: 0, minStock: 0 })).toBe('out-of-stock')
  })
  it('is low stock at or below the minimum level', () => {
    expect(getStockStatus({ quantity: 1, minStock: 5 })).toBe('low-stock')
    expect(getStockStatus({ quantity: 5, minStock: 5 })).toBe('low-stock')
  })
  it('is in stock above the minimum level', () => {
    expect(getStockStatus({ quantity: 6, minStock: 5 })).toBe('in-stock')
  })
})

describe('validateMovement', () => {
  it('accepts a normal receipt and issue', () => {
    expect(validateMovement(10, 'in', 5)).toBeNull()
    expect(validateMovement(10, 'out', 10)).toBeNull()
  })
  it('rejects issuing more than is available', () => {
    expect(validateMovement(10, 'out', 11)).toMatch(/insufficient stock/i)
    expect(validateMovement(0, 'out', 1)).toMatch(/insufficient stock/i)
  })
  it('rejects negative, zero, decimal and non-finite quantities', () => {
    expect(validateMovement(10, 'in', -1)).toMatch(/negative/i)
    expect(validateMovement(10, 'out', -3)).toMatch(/negative/i)
    expect(validateMovement(10, 'in', 0)).toMatch(/greater than zero/i)
    expect(validateMovement(10, 'in', 1.5)).toMatch(/whole number/i)
    expect(validateMovement(10, 'in', Number.NaN)).toMatch(/whole number/i)
    expect(validateMovement(10, 'in', Infinity)).toMatch(/whole number/i)
  })
  it('rejects absurdly large movements', () => {
    expect(validateMovement(0, 'in', 5_000_000)).not.toBeNull()
  })
})

describe('computeSummary', () => {
  it('adds up products, stock, value and statuses', () => {
    const summary = computeSummary([
      product({ id: 'a', quantity: 20, unitPrice: 10 }),
      product({ id: 'b', quantity: 3, unitPrice: 0.1 }),
      product({ id: 'c', quantity: 0, unitPrice: 50 }),
    ])
    expect(summary).toEqual({
      totalProducts: 3,
      totalStock: 23,
      totalValue: 200.3,
      inStock: 1,
      lowStock: 1,
      outOfStock: 1,
    })
  })
  it('handles an empty list', () => {
    expect(computeSummary([]).totalValue).toBe(0)
  })
})

describe('filterProducts', () => {
  const list = [
    product({ id: '1', name: 'Wireless Mouse', sku: 'WM-200', categoryId: 'c1', quantity: 20 }),
    product({ id: '2', name: 'Keyboard', sku: 'KB-410', categoryId: 'c1', quantity: 2 }),
    product({ id: '3', name: 'Paper', sku: 'PP-1', categoryId: 'c2', quantity: 0 }),
  ]
  const none = { search: '', categoryId: '', status: '' as const }

  it('searches by name or code, ignoring case and spaces around the text', () => {
    expect(filterProducts(list, { ...none, search: '  mouse ' }).map((p) => p.id)).toEqual(['1'])
    expect(filterProducts(list, { ...none, search: 'kb-4' }).map((p) => p.id)).toEqual(['2'])
  })
  it('filters by category and status, and combines filters', () => {
    expect(filterProducts(list, { ...none, categoryId: 'c1' })).toHaveLength(2)
    expect(filterProducts(list, { ...none, status: 'out-of-stock' }).map((p) => p.id)).toEqual(['3'])
    expect(filterProducts(list, { search: '', categoryId: 'c1', status: 'low-stock' }).map((p) => p.id)).toEqual(['2'])
  })
  it('returns nothing when nothing matches', () => {
    expect(filterProducts(list, { ...none, search: 'zzz' })).toEqual([])
  })
})

describe('movementsByDay', () => {
  it('groups received and issued units by day', () => {
    const now = new Date(2026, 10, 18, 12, 0, 0)
    const make = (type: 'in' | 'out', quantity: number, date: Date): StockMovement => ({
      id: Math.random().toString(),
      productId: 'p',
      productName: 'P',
      sku: 'P',
      type,
      quantity,
      previousQuantity: 0,
      newQuantity: 0,
      reason: '',
      createdAt: date.toISOString(),
    })
    const result = movementsByDay(
      [
        make('in', 10, new Date(2026, 10, 18, 9)),
        make('out', 4, new Date(2026, 10, 18, 10)),
        make('in', 7, new Date(2026, 10, 17, 10)),
        make('in', 99, new Date(2026, 9, 1)), // too old, ignored
      ],
      7,
      now,
    )
    expect(result).toHaveLength(7)
    expect(result[6]).toMatchObject({ received: 10, issued: 4 })
    expect(result[5]).toMatchObject({ received: 7, issued: 0 })
  })
})

describe('sortProducts', () => {
  const list = [
    product({ id: 'a', name: 'banana', unitPrice: 5, quantity: 10, minStock: 5 }),
    product({ id: 'b', name: 'Apple', unitPrice: 9, quantity: 0, minStock: 5 }),
    product({ id: 'c', name: 'cherry', unitPrice: 1, quantity: 3, minStock: 5 }),
  ]
  const ids = (items: Product[]) => items.map((p) => p.id)

  it('keeps the original order when no key is given', () => {
    expect(ids(sortProducts(list, '', 'asc'))).toEqual(['a', 'b', 'c'])
  })
  it('sorts by name ignoring capital letters, both ways', () => {
    expect(ids(sortProducts(list, 'name', 'asc'))).toEqual(['b', 'a', 'c'])
    expect(ids(sortProducts(list, 'name', 'desc'))).toEqual(['c', 'a', 'b'])
  })
  it('sorts by price and by quantity', () => {
    expect(ids(sortProducts(list, 'price', 'asc'))).toEqual(['c', 'a', 'b'])
    expect(ids(sortProducts(list, 'quantity', 'desc'))).toEqual(['a', 'c', 'b'])
  })
  it('sorts by status with the most urgent first', () => {
    expect(ids(sortProducts(list, 'status', 'asc'))).toEqual(['b', 'c', 'a'])
  })
  it('does not change the list it was given', () => {
    const copy = [...list]
    sortProducts(list, 'price', 'desc')
    expect(list).toEqual(copy)
  })
  it('uses the name to break ties so the order is steady', () => {
    const tied = [product({ id: 'x', name: 'Zed', quantity: 4 }), product({ id: 'y', name: 'Amy', quantity: 4 })]
    expect(ids(sortProducts(tied, 'quantity', 'asc'))).toEqual(['y', 'x'])
    expect(ids(sortProducts(tied, 'quantity', 'desc'))).toEqual(['y', 'x'])
  })
})

describe('stockTrend', () => {
  const now = new Date(2026, 10, 18, 12, 0, 0)
  const move = (productId: string, type: 'in' | 'out', quantity: number, date: Date): StockMovement => ({
    id: Math.random().toString(),
    productId,
    productName: 'P',
    sku: 'P',
    type,
    quantity,
    previousQuantity: 0,
    newQuantity: 0,
    reason: '',
    createdAt: date.toISOString(),
  })

  it('works backwards from today by undoing later movements', () => {
    const products = [product({ id: 'p1', quantity: 100 })]
    const movements = [
      move('p1', 'in', 30, new Date(2026, 10, 18, 9)), // today: +30
      move('p1', 'out', 10, new Date(2026, 10, 16, 9)), // two days ago: -10
    ]
    const { values, delta } = stockTrend(products, movements, 7, now)
    expect(values).toHaveLength(8)
    expect(values[7]).toBe(100) // today
    expect(values[6]).toBe(70) // end of yesterday = today minus the +30
    expect(values[5]).toBe(70) // end of 16th still includes the -10, so unchanged
    expect(values[4]).toBe(80) // end of 15th: before the -10
    expect(values[0]).toBe(80)
    expect(delta).toBeCloseTo(25, 5)
  })
  it('ignores movements of deleted products and movements dated in the future', () => {
    const products = [product({ id: 'p1', quantity: 50 })]
    const movements = [
      move('gone', 'in', 999, new Date(2026, 10, 17, 9)),
      move('p1', 'in', 999, new Date(2026, 10, 25, 9)),
    ]
    expect(stockTrend(products, movements, 7, now).values.every((v) => v === 50)).toBe(true)
  })
  it('has no percentage when there was no stock to compare with', () => {
    const products = [product({ id: 'p1', quantity: 20 })]
    const movements = [move('p1', 'in', 20, new Date(2026, 10, 18, 9))]
    const result = stockTrend(products, movements, 7, now)
    expect(result.values[0]).toBe(0)
    expect(result.delta).toBeNull()
  })
})
