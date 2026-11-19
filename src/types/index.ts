export interface Category {
  id: string
  name: string
  description: string
  createdAt: string
}

export interface Product {
  id: string
  name: string
  sku: string
  categoryId: string
  description: string
  unitPrice: number
  quantity: number
  minStock: number
  createdAt: string
}

/** The editable fields of a product (everything except id, quantity and dates). */
export interface ProductFields {
  name: string
  sku: string
  categoryId: string
  description: string
  unitPrice: number
  minStock: number
}

export type StockStatus = 'in-stock' | 'low-stock' | 'out-of-stock'

export type MovementType = 'in' | 'out'

export interface StockMovement {
  id: string
  productId: string
  /** Name and SKU are copied so history stays readable if the product is deleted. */
  productName: string
  sku: string
  type: MovementType
  quantity: number
  previousQuantity: number
  newQuantity: number
  reason: string
  createdAt: string
}

export type ActivityType =
  | 'stock-in'
  | 'stock-out'
  | 'product-created'
  | 'product-updated'
  | 'product-deleted'
  | 'category-created'
  | 'category-updated'
  | 'category-deleted'

export interface Activity {
  id: string
  type: ActivityType
  message: string
  createdAt: string
}

export type ToastType = 'success' | 'error' | 'info'

/** What a notification's "Undo" button puts back. */
export type UndoAction =
  | { kind: 'product'; product: Product }
  | { kind: 'category'; category: Category }

export interface Toast {
  id: string
  type: ToastType
  message: string
  undo?: UndoAction
}

/** Result returned by actions that can fail for business reasons. */
export type ActionResult = { ok: true } | { ok: false; error: string; field?: string }
