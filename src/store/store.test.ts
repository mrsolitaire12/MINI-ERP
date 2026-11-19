import { beforeEach, describe, expect, it } from 'vitest'
import { buildSeed } from '@/data/seed'
import { computeSummary } from '@/lib/inventory'
import { createAppStore, type AppStore } from './index'
import {
  createCategory,
  createProduct,
  deleteCategory,
  deleteProduct,
  recordStockMovement,
  resetDemoData,
  undoDelete,
  updateCategory,
  updateProduct,
} from './thunks'
import { selectSummary } from './selectors'

let store: AppStore

function freshStore(): AppStore {
  const seed = buildSeed()
  return createAppStore({
    products: { items: seed.products },
    categories: { items: seed.categories },
    stock: { movements: seed.movements },
    activity: { items: seed.activities },
  })
}

const lastToast = () => store.getState().toasts.items.at(-1)

beforeEach(() => {
  store = freshStore()
})

describe('seed data', () => {
  it('has movement history that adds up to each product quantity', () => {
    const { products, stock } = store.getState()
    for (const product of products.items) {
      const history = stock.movements
        .filter((m) => m.productId === product.id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      let running = 0
      for (const movement of history) {
        expect(movement.previousQuantity).toBe(running)
        running = movement.newQuantity
        expect(running).toBeGreaterThanOrEqual(0)
      }
      expect(running).toBe(product.quantity)
    }
  })
  it('includes low-stock and out-of-stock demo products', () => {
    const summary = computeSummary(store.getState().products.items)
    expect(summary.lowStock).toBeGreaterThan(0)
    expect(summary.outOfStock).toBeGreaterThan(0)
  })
})

describe('recordStockMovement', () => {
  const product = () => store.getState().products.items.find((p) => p.sku === 'WM-200')!

  it('receiving increases the quantity and records the movement', () => {
    const before = product().quantity
    const result = store.dispatch(
      recordStockMovement({ productId: product().id, type: 'in', quantity: 15, reason: 'Delivery' }),
    )
    expect(result.ok).toBe(true)
    expect(product().quantity).toBe(before + 15)
    const movement = store.getState().stock.movements[0]
    expect(movement).toMatchObject({ type: 'in', quantity: 15, previousQuantity: before, newQuantity: before + 15 })
    expect(lastToast()?.type).toBe('success')
  })

  it('issuing decreases the quantity', () => {
    const before = product().quantity
    store.dispatch(recordStockMovement({ productId: product().id, type: 'out', quantity: 10, reason: '' }))
    expect(product().quantity).toBe(before - 10)
  })

  it('can issue exactly all remaining stock, which makes the product out of stock', () => {
    const before = product().quantity
    const result = store.dispatch(
      recordStockMovement({ productId: product().id, type: 'out', quantity: before, reason: '' }),
    )
    expect(result.ok).toBe(true)
    expect(product().quantity).toBe(0)
    expect(selectSummary(store.getState()).outOfStock).toBe(5)
  })

  it('refuses to issue more than is available and changes nothing', () => {
    const before = product().quantity
    const movementsBefore = store.getState().stock.movements.length
    const result = store.dispatch(
      recordStockMovement({ productId: product().id, type: 'out', quantity: before + 1, reason: '' }),
    )
    expect(result.ok).toBe(false)
    expect(product().quantity).toBe(before)
    expect(store.getState().stock.movements).toHaveLength(movementsBefore)
    expect(lastToast()).toMatchObject({ type: 'error', message: expect.stringMatching(/insufficient stock/i) })
  })

  it.each([-5, 0, 2.5, Number.NaN])('refuses the quantity %s', (quantity) => {
    const before = product().quantity
    const result = store.dispatch(
      recordStockMovement({ productId: product().id, type: 'in', quantity, reason: '' }),
    )
    expect(result.ok).toBe(false)
    expect(product().quantity).toBe(before)
  })

  it('refuses an unknown product', () => {
    const result = store.dispatch(
      recordStockMovement({ productId: 'nope', type: 'in', quantity: 1, reason: '' }),
    )
    expect(result.ok).toBe(false)
  })

  it('keeps dashboard totals in step with stock changes', () => {
    const before = selectSummary(store.getState())
    const p = product()
    store.dispatch(recordStockMovement({ productId: p.id, type: 'in', quantity: 4, reason: '' }))
    const after = selectSummary(store.getState())
    expect(after.totalStock).toBe(before.totalStock + 4)
    expect(after.totalValue).toBeCloseTo(before.totalValue + 4 * p.unitPrice, 2)
  })

  it('moves a product out of low stock when it is restocked', () => {
    const low = store.getState().products.items.find((p) => p.sku === 'KB-410')!
    const before = selectSummary(store.getState()).lowStock
    store.dispatch(recordStockMovement({ productId: low.id, type: 'in', quantity: 50, reason: '' }))
    expect(selectSummary(store.getState()).lowStock).toBe(before - 1)
  })

  it('logs the movement in recent activity', () => {
    store.dispatch(recordStockMovement({ productId: product().id, type: 'in', quantity: 2, reason: '' }))
    expect(store.getState().activity.items[0].type).toBe('stock-in')
  })
})

describe('products', () => {
  const input = {
    name: 'Desk Lamp',
    sku: 'lamp-1',
    categoryId: 'cat_seed_1',
    description: 'LED lamp',
    unitPrice: 19.9,
    quantity: 8,
    minStock: 3,
  }

  it('creates a product with an opening stock movement', () => {
    const count = store.getState().products.items.length
    expect(store.dispatch(createProduct(input)).ok).toBe(true)
    const created = store.getState().products.items[0]
    expect(store.getState().products.items).toHaveLength(count + 1)
    expect(created).toMatchObject({ sku: 'LAMP-1', quantity: 8 })
    expect(store.getState().stock.movements[0]).toMatchObject({
      productId: created.id,
      previousQuantity: 0,
      newQuantity: 8,
    })
  })

  it('creates a product with zero stock and no movement', () => {
    const movements = store.getState().stock.movements.length
    store.dispatch(createProduct({ ...input, quantity: 0 }))
    expect(store.getState().stock.movements).toHaveLength(movements)
  })

  it('refuses a duplicate product code', () => {
    const result = store.dispatch(createProduct({ ...input, sku: 'wm-200' }))
    expect(result).toMatchObject({ ok: false, field: 'sku' })
  })

  it('edits a product without touching its quantity', () => {
    const target = store.getState().products.items[0]
    const { quantity, ...fields } = { ...target, name: 'Renamed' }
    void quantity
    expect(store.dispatch(updateProduct(target.id, fields)).ok).toBe(true)
    const updated = store.getState().products.items.find((p) => p.id === target.id)!
    expect(updated.name).toBe('Renamed')
    expect(updated.quantity).toBe(target.quantity)
  })

  it('refuses to edit into another product code', () => {
    const [a, b] = store.getState().products.items
    const result = store.dispatch(
      updateProduct(a.id, { name: a.name, sku: b.sku, categoryId: a.categoryId, description: '', unitPrice: 1, minStock: 1 }),
    )
    expect(result.ok).toBe(false)
  })

  it('deletes a product but keeps its history', () => {
    const target = store.getState().products.items[0]
    const historyCount = store.getState().stock.movements.filter((m) => m.productId === target.id).length
    expect(store.dispatch(deleteProduct(target.id)).ok).toBe(true)
    expect(store.getState().products.items.find((p) => p.id === target.id)).toBeUndefined()
    expect(store.getState().stock.movements.filter((m) => m.productId === target.id)).toHaveLength(historyCount)
  })
})

describe('categories', () => {
  it('creates, renames and deletes an unused category', () => {
    expect(store.dispatch(createCategory({ name: 'Garden', description: '' })).ok).toBe(true)
    const garden = store.getState().categories.items.find((c) => c.name === 'Garden')!
    expect(store.dispatch(updateCategory(garden.id, { name: 'Outdoor', description: 'x' })).ok).toBe(true)
    expect(store.getState().categories.items.find((c) => c.id === garden.id)?.name).toBe('Outdoor')
    expect(store.dispatch(deleteCategory(garden.id)).ok).toBe(true)
    expect(store.getState().categories.items.find((c) => c.id === garden.id)).toBeUndefined()
  })

  it('refuses a duplicate name, ignoring letter case', () => {
    expect(store.dispatch(createCategory({ name: 'electronics', description: '' })).ok).toBe(false)
  })

  it('refuses to delete a category that products use', () => {
    const count = store.getState().categories.items.length
    const result = store.dispatch(deleteCategory('cat_seed_1'))
    expect(result.ok).toBe(false)
    expect(store.getState().categories.items).toHaveLength(count)
    expect(lastToast()?.message).toMatch(/used by \d+ products?/)
  })
})

describe('resetDemoData', () => {
  it('restores the demo data', () => {
    store.dispatch(deleteProduct(store.getState().products.items[0].id))
    const total = buildSeed().products.length
    expect(store.getState().products.items).toHaveLength(total - 1)
    store.dispatch(resetDemoData())
    expect(store.getState().products.items).toHaveLength(total)
  })
})

describe('undo after delete', () => {
  it('puts a deleted product back with its quantity, and its history still matches', () => {
    const target = store.getState().products.items.find((p) => p.sku === 'WM-200')!
    store.dispatch(deleteProduct(target.id))
    const toast = lastToast()!
    expect(toast.undo).toMatchObject({ kind: 'product' })

    expect(store.dispatch(undoDelete(toast.undo!)).ok).toBe(true)
    const restored = store.getState().products.items.find((p) => p.id === target.id)!
    expect(restored.quantity).toBe(target.quantity)
    const history = store.getState().stock.movements.filter((m) => m.productId === target.id)
    expect(history[0].newQuantity).toBe(target.quantity)
    expect(lastToast()?.message).toMatch(/restored/)
  })

  it('does nothing if the product is already back (for example, undo pressed twice)', () => {
    const target = store.getState().products.items[0]
    store.dispatch(deleteProduct(target.id))
    const undo = lastToast()!.undo!
    store.dispatch(undoDelete(undo))
    const count = store.getState().products.items.length
    expect(store.dispatch(undoDelete(undo)).ok).toBe(true)
    expect(store.getState().products.items).toHaveLength(count)
  })

  it('refuses to restore a product whose code is now used by another product', () => {
    const target = store.getState().products.items.find((p) => p.sku === 'WM-200')!
    store.dispatch(deleteProduct(target.id))
    const undo = lastToast()!.undo!
    store.dispatch(
      createProduct({ name: 'Other', sku: 'WM-200', categoryId: 'cat_seed_1', description: '', unitPrice: 1, quantity: 0, minStock: 0 }),
    )
    const result = store.dispatch(undoDelete(undo))
    expect(result.ok).toBe(false)
    expect(store.getState().products.items.filter((p) => p.sku === 'WM-200')).toHaveLength(1)
  })

  it('refuses to restore a product whose category was deleted', () => {
    store.dispatch(createCategory({ name: 'Temp', description: '' }))
    const temp = store.getState().categories.items.find((c) => c.name === 'Temp')!
    store.dispatch(createProduct({ name: 'Tmp item', sku: 'TMP-1', categoryId: temp.id, description: '', unitPrice: 1, quantity: 0, minStock: 0 }))
    const item = store.getState().products.items.find((p) => p.sku === 'TMP-1')!
    store.dispatch(deleteProduct(item.id))
    const undo = lastToast()!.undo!
    store.dispatch(deleteCategory(temp.id))
    expect(store.dispatch(undoDelete(undo)).ok).toBe(false)
  })

  it('puts a deleted category back', () => {
    store.dispatch(createCategory({ name: 'Garden', description: 'x' }))
    const garden = store.getState().categories.items.find((c) => c.name === 'Garden')!
    store.dispatch(deleteCategory(garden.id))
    expect(store.dispatch(undoDelete(lastToast()!.undo!)).ok).toBe(true)
    expect(store.getState().categories.items.some((c) => c.id === garden.id)).toBe(true)
  })

  it('refuses to restore a category if the name was taken meanwhile', () => {
    store.dispatch(createCategory({ name: 'Garden', description: '' }))
    const garden = store.getState().categories.items.find((c) => c.name === 'Garden')!
    store.dispatch(deleteCategory(garden.id))
    const undo = lastToast()!.undo!
    store.dispatch(createCategory({ name: 'garden', description: '' }))
    expect(store.dispatch(undoDelete(undo)).ok).toBe(false)
  })
})
