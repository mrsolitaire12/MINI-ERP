import type { ThunkAction, UnknownAction } from '@reduxjs/toolkit'
import type { ActionResult, Category, MovementType, Product, ProductFields, UndoAction } from '@/types'
import type { RootState } from './index'
import { buildMovement, describeMovement, validateMovement } from '@/lib/inventory'
import { normalizeSku } from '@/lib/validation'
import { createId } from '@/lib/id'
import { buildSeed } from '@/data/seed'
import { dataReset, stockMoved } from './actions'
import { productAdded, productDeleted, productUpdated } from './slices/productsSlice'
import { categoryAdded, categoryDeleted, categoryUpdated } from './slices/categoriesSlice'
import { activityLogged } from './slices/activitySlice'
import { addToast } from './slices/toastsSlice'

type AppThunk<R = ActionResult> = ThunkAction<R, RootState, unknown, UnknownAction>

const OK: ActionResult = { ok: true }

/** A failed action: shows an error toast and tells the caller what went wrong. */
function failure(
  dispatch: (action: UnknownAction) => unknown,
  error: string,
  field?: string,
): ActionResult {
  dispatch(addToast('error', error))
  return { ok: false, error, field }
}

// ---------- Stock ----------

export interface StockInput {
  productId: string
  type: MovementType
  quantity: number
  reason: string
}

/**
 * Records one stock movement.
 * The checks happen here (not only in the form) so no screen can ever
 * push a product's stock below zero.
 */
export const recordStockMovement =
  (input: StockInput): AppThunk =>
  (dispatch, getState) => {
    const product = getState().products.items.find((item) => item.id === input.productId)
    if (!product) return failure(dispatch, 'Operation failed: product not found.', 'productId')

    const problem = validateMovement(product.quantity, input.type, input.quantity)
    if (problem) return failure(dispatch, problem, 'quantity')

    const movement = buildMovement(product, input.type, input.quantity, input.reason)
    dispatch(stockMoved(movement))
    dispatch(activityLogged(input.type === 'in' ? 'stock-in' : 'stock-out', describeMovement(movement)))
    dispatch(
      addToast(
        'success',
        input.type === 'in'
          ? `Stock successfully received: +${input.quantity} × ${product.name}.`
          : `Stock successfully issued: −${input.quantity} × ${product.name}.`,
      ),
    )
    return OK
  }

// ---------- Products ----------

export const createProduct =
  (input: ProductFields & { quantity: number }): AppThunk =>
  (dispatch, getState) => {
    const state = getState()
    const sku = normalizeSku(input.sku)

    if (state.products.items.some((product) => product.sku === sku)) {
      return failure(dispatch, 'This product code is already used by another product.', 'sku')
    }
    if (!state.categories.items.some((category) => category.id === input.categoryId)) {
      return failure(dispatch, 'Operation failed: the chosen category no longer exists.', 'categoryId')
    }
    if (!Number.isInteger(input.quantity) || input.quantity < 0) {
      return failure(dispatch, 'Quantity cannot be negative.', 'quantity')
    }

    const { quantity, ...fields } = input
    const product: Product = {
      ...fields,
      sku,
      id: createId('prd'),
      quantity,
      createdAt: new Date().toISOString(),
    }

    dispatch(productAdded(product))
    // Starting stock is recorded as a movement so the history adds up.
    if (quantity > 0) {
      dispatch(
        stockMoved({
          ...buildMovement({ ...product, quantity: 0 }, 'in', quantity, 'Opening stock'),
        }),
      )
    }
    dispatch(activityLogged('product-created', `Product created: ${product.name}`))
    dispatch(addToast('success', `Product "${product.name}" successfully created.`))
    return OK
  }

export const updateProduct =
  (id: string, fields: ProductFields): AppThunk =>
  (dispatch, getState) => {
    const state = getState()
    const existing = state.products.items.find((product) => product.id === id)
    if (!existing) return failure(dispatch, 'Operation failed: product not found.')

    const sku = normalizeSku(fields.sku)
    if (state.products.items.some((product) => product.sku === sku && product.id !== id)) {
      return failure(dispatch, 'This product code is already used by another product.', 'sku')
    }
    if (!state.categories.items.some((category) => category.id === fields.categoryId)) {
      return failure(dispatch, 'Operation failed: the chosen category no longer exists.', 'categoryId')
    }

    // Quantity is not editable here: it only changes through stock movements.
    dispatch(productUpdated({ ...existing, ...fields, sku }))
    dispatch(activityLogged('product-updated', `Product updated: ${fields.name}`))
    dispatch(addToast('success', `Product "${fields.name}" successfully updated.`))
    return OK
  }

export const deleteProduct =
  (id: string): AppThunk =>
  (dispatch, getState) => {
    const existing = getState().products.items.find((product) => product.id === id)
    if (!existing) return failure(dispatch, 'Operation failed: product not found.')

    dispatch(productDeleted(id))
    dispatch(activityLogged('product-deleted', `Product deleted: ${existing.name}`))
    dispatch(
      addToast('success', `Product "${existing.name}" successfully deleted.`, {
        kind: 'product',
        product: existing,
      }),
    )
    return OK
  }

// ---------- Categories ----------

export const createCategory =
  (input: { name: string; description: string }): AppThunk =>
  (dispatch, getState) => {
    const name = input.name.trim()
    const exists = getState().categories.items.some(
      (category) => category.name.toLowerCase() === name.toLowerCase(),
    )
    if (exists) return failure(dispatch, 'A category with this name already exists.', 'name')

    const category: Category = {
      id: createId('cat'),
      name,
      description: input.description.trim(),
      createdAt: new Date().toISOString(),
    }
    dispatch(categoryAdded(category))
    dispatch(activityLogged('category-created', `Category created: ${name}`))
    dispatch(addToast('success', `Category "${name}" successfully created.`))
    return OK
  }

export const updateCategory =
  (id: string, input: { name: string; description: string }): AppThunk =>
  (dispatch, getState) => {
    const categories = getState().categories.items
    const existing = categories.find((category) => category.id === id)
    if (!existing) return failure(dispatch, 'Operation failed: category not found.')

    const name = input.name.trim()
    const duplicate = categories.some(
      (category) => category.id !== id && category.name.toLowerCase() === name.toLowerCase(),
    )
    if (duplicate) return failure(dispatch, 'A category with this name already exists.', 'name')

    dispatch(categoryUpdated({ ...existing, name, description: input.description.trim() }))
    dispatch(activityLogged('category-updated', `Category updated: ${name}`))
    dispatch(addToast('success', `Category "${name}" successfully updated.`))
    return OK
  }

export const deleteCategory =
  (id: string): AppThunk =>
  (dispatch, getState) => {
    const state = getState()
    const existing = state.categories.items.find((category) => category.id === id)
    if (!existing) return failure(dispatch, 'Operation failed: category not found.')

    const inUse = state.products.items.filter((product) => product.categoryId === id).length
    if (inUse > 0) {
      return failure(
        dispatch,
        `Cannot delete "${existing.name}": it is used by ${inUse} product${inUse === 1 ? '' : 's'}.`,
      )
    }

    dispatch(categoryDeleted(id))
    dispatch(activityLogged('category-deleted', `Category deleted: ${existing.name}`))
    dispatch(
      addToast('success', `Category "${existing.name}" successfully deleted.`, {
        kind: 'category',
        category: existing,
      }),
    )
    return OK
  }

// ---------- Undo ----------

/**
 * Puts back something that was just deleted. A deleted product keeps its stock
 * history, so bringing it back keeps its quantity and history in step.
 */
export const undoDelete =
  (undo: UndoAction): AppThunk =>
  (dispatch, getState) => {
    const state = getState()

    if (undo.kind === 'product') {
      const { product } = undo
      if (state.products.items.some((item) => item.id === product.id)) return OK
      if (state.products.items.some((item) => item.sku === product.sku)) {
        return failure(
          dispatch,
          `Cannot restore "${product.name}": its product code is now used by another product.`,
        )
      }
      if (!state.categories.items.some((category) => category.id === product.categoryId)) {
        return failure(dispatch, `Cannot restore "${product.name}": its category no longer exists.`)
      }
      dispatch(productAdded(product))
      dispatch(activityLogged('product-created', `Product restored: ${product.name}`))
      dispatch(addToast('success', `Product "${product.name}" restored.`))
      return OK
    }

    const { category } = undo
    if (state.categories.items.some((item) => item.id === category.id)) return OK
    if (state.categories.items.some((item) => item.name.toLowerCase() === category.name.toLowerCase())) {
      return failure(
        dispatch,
        `Cannot restore "${category.name}": a category with this name already exists.`,
      )
    }
    dispatch(categoryAdded(category))
    dispatch(activityLogged('category-created', `Category restored: ${category.name}`))
    dispatch(addToast('success', `Category "${category.name}" restored.`))
    return OK
  }

// ---------- Demo data ----------

export const resetDemoData = (): AppThunk => (dispatch) => {
  dispatch(dataReset(buildSeed()))
  dispatch(addToast('success', 'Demo data restored.'))
  return OK
}
