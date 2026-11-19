import type { AppStore, RootState } from './index'
import { addToast } from './slices/toastsSlice'

const STORAGE_KEY = 'mini-erp:v1'

type PersistedState = Pick<RootState, 'products' | 'categories' | 'stock' | 'activity'>

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isCount = (value: unknown): boolean =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0

const isText = (value: unknown): boolean => typeof value === 'string'

/** Makes sure saved data has the shape the app expects, so bad data never crashes the screens. */
function isValidPersisted(data: unknown): data is PersistedState {
  if (!isObject(data)) return false
  const { products, categories, stock, activity } = data as Record<string, unknown>
  if (!isObject(products) || !Array.isArray(products.items)) return false
  if (!isObject(categories) || !Array.isArray(categories.items)) return false
  if (!isObject(stock) || !Array.isArray(stock.movements)) return false
  if (!isObject(activity) || !Array.isArray(activity.items)) return false

  const categoryIds = new Set<unknown>()
  for (const category of categories.items) {
    if (!isObject(category) || !isText(category.id) || !isText(category.name)) return false
    categoryIds.add(category.id)
  }

  for (const product of products.items) {
    if (!isObject(product)) return false
    if (!isText(product.id) || !isText(product.name) || !isText(product.sku)) return false
    if (!isText(product.description) || !isText(product.createdAt)) return false
    if (!categoryIds.has(product.categoryId)) return false
    if (!isCount(product.quantity) || !isCount(product.minStock)) return false
    if (typeof product.unitPrice !== 'number' || !(product.unitPrice >= 0)) return false
  }

  for (const movement of stock.movements) {
    if (!isObject(movement) || !isText(movement.id) || !isText(movement.productId)) return false
    if (movement.type !== 'in' && movement.type !== 'out') return false
    if (!isCount(movement.quantity) || !isCount(movement.previousQuantity)) return false
    if (!isCount(movement.newQuantity) || !isText(movement.createdAt)) return false
  }

  for (const item of activity.items) {
    if (!isObject(item) || !isText(item.id) || !isText(item.message) || !isText(item.createdAt)) {
      return false
    }
  }
  return true
}

export interface LoadResult {
  state: PersistedState | null
  /** True when something was saved but could not be used. */
  recovered: boolean
}

export function loadPersisted(): LoadResult {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null) return { state: null, recovered: false }
    const parsed: unknown = JSON.parse(raw)
    if (isObject(parsed) && parsed.version === 1 && isValidPersisted(parsed.data)) {
      return { state: parsed.data, recovered: false }
    }
    return { state: null, recovered: true }
  } catch {
    return { state: null, recovered: true }
  }
}

function save(state: RootState): void {
  const data: PersistedState = {
    products: state.products,
    categories: state.categories,
    stock: state.stock,
    activity: state.activity,
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, data }))
}

/** Saves to the browser whenever inventory data changes (not for toasts). */
export function attachPersistence(store: AppStore): void {
  let previous = store.getState()
  let warned = false

  store.subscribe(() => {
    const current = store.getState()
    const changed =
      current.products !== previous.products ||
      current.categories !== previous.categories ||
      current.stock !== previous.stock ||
      current.activity !== previous.activity
    previous = current
    if (!changed) return

    try {
      save(current)
      warned = false
    } catch {
      if (!warned) {
        warned = true
        store.dispatch(
          addToast('error', 'Could not save your changes in this browser. They will be lost on refresh.'),
        )
      }
    }
  })
}
