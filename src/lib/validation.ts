import type { Category, Product, ProductFields } from '@/types'

export const normalizeSku = (sku: string): string => sku.trim().toUpperCase()

export function hasRequiredError(errors: Record<string, string | undefined>): boolean {
  return Object.values(errors).some((message) => message?.endsWith('is required.'))
}

interface NumberResult {
  value?: number
  error?: string
}

/** Reads a whole number typed by a person. Rejects negatives, decimals, letters and "1e3". */
export function parseWholeNumber(raw: string, label: string, min = 0): NumberResult {
  const text = raw.trim()
  if (text === '') return { error: `${label} is required.` }
  if (/^-/.test(text)) return { error: `${label} cannot be negative.` }
  if (!/^\d+$/.test(text)) return { error: `${label} must be a whole number.` }
  const value = Number(text)
  if (!Number.isSafeInteger(value)) return { error: `${label} is too large.` }
  if (value < min) {
    return { error: min === 1 ? `${label} must be greater than zero.` : `${label} must be at least ${min}.` }
  }
  return { value }
}

/** Reads a price with up to two decimals. */
export function parsePrice(raw: string, label: string): NumberResult {
  const text = raw.trim()
  if (text === '') return { error: `${label} is required.` }
  if (/^-/.test(text)) return { error: `${label} cannot be negative.` }
  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    return { error: `${label} must be a number with up to 2 decimals.` }
  }
  const value = Number(text)
  if (value <= 0) return { error: `${label} must be greater than zero.` }
  if (value > 1_000_000) return { error: `${label} cannot be more than 1,000,000.` }
  return { value }
}

// ---------- Product ----------

export interface ProductDraft {
  name: string
  sku: string
  categoryId: string
  description: string
  unitPrice: string
  quantity: string
  minStock: string
}

export type ProductErrors = Partial<Record<keyof ProductDraft, string>>

export interface ProductValidation {
  errors: ProductErrors
  /** Present only when there are no errors. `quantity` is only set when creating. */
  value?: ProductFields & { quantity?: number }
}

export function validateProductDraft(
  draft: ProductDraft,
  context: { products: Product[]; categories: Category[]; editingId?: string },
): ProductValidation {
  const errors: ProductErrors = {}
  const isEdit = Boolean(context.editingId)

  const name = draft.name.trim()
  if (!name) errors.name = 'Product name is required.'
  else if (name.length > 100) errors.name = 'Product name must be 100 characters or fewer.'

  const sku = normalizeSku(draft.sku)
  if (!sku) errors.sku = 'Product code (SKU) is required.'
  else if (sku.length > 30) errors.sku = 'Product code must be 30 characters or fewer.'
  else if (!/^[A-Z0-9][A-Z0-9_-]*$/.test(sku)) {
    errors.sku = 'Use only letters, numbers, dashes and underscores.'
  } else if (context.products.some((p) => p.sku === sku && p.id !== context.editingId)) {
    errors.sku = 'This product code is already used by another product.'
  }

  if (!draft.categoryId) errors.categoryId = 'Category is required.'
  else if (!context.categories.some((c) => c.id === draft.categoryId)) {
    errors.categoryId = 'Choose an existing category.'
  }

  if (draft.description.trim().length > 500) {
    errors.description = 'Description must be 500 characters or fewer.'
  }

  const price = parsePrice(draft.unitPrice, 'Unit price')
  if (price.error) errors.unitPrice = price.error

  const minStock = parseWholeNumber(draft.minStock, 'Minimum stock level')
  if (minStock.error) errors.minStock = minStock.error

  let quantity: number | undefined
  if (!isEdit) {
    const result = parseWholeNumber(draft.quantity, 'Quantity')
    if (result.error) errors.quantity = result.error
    else quantity = result.value
  }

  if (Object.keys(errors).length > 0) return { errors }

  return {
    errors,
    value: {
      name,
      sku,
      categoryId: draft.categoryId,
      description: draft.description.trim(),
      unitPrice: price.value as number,
      minStock: minStock.value as number,
      ...(quantity !== undefined ? { quantity } : {}),
    },
  }
}

// ---------- Category ----------

export interface CategoryDraft {
  name: string
  description: string
}

export type CategoryErrors = Partial<Record<keyof CategoryDraft, string>>

export function validateCategoryDraft(
  draft: CategoryDraft,
  context: { categories: Category[]; editingId?: string },
): { errors: CategoryErrors; value?: CategoryDraft } {
  const errors: CategoryErrors = {}
  const name = draft.name.trim()

  if (!name) errors.name = 'Category name is required.'
  else if (name.length > 40) errors.name = 'Category name must be 40 characters or fewer.'
  else if (
    context.categories.some(
      (c) => c.name.toLowerCase() === name.toLowerCase() && c.id !== context.editingId,
    )
  ) {
    errors.name = 'A category with this name already exists.'
  }

  if (draft.description.trim().length > 200) {
    errors.description = 'Description must be 200 characters or fewer.'
  }

  if (Object.keys(errors).length > 0) return { errors }
  return { errors, value: { name, description: draft.description.trim() } }
}

// ---------- Stock movement ----------

export interface StockDraft {
  productId: string
  quantity: string
  reason: string
}

export type StockErrors = Partial<Record<keyof StockDraft, string>>

export function validateStockDraft(
  draft: StockDraft,
): { errors: StockErrors; quantity?: number } {
  const errors: StockErrors = {}
  if (!draft.productId) errors.productId = 'Product is required.'

  const quantity = parseWholeNumber(draft.quantity, 'Quantity', 1)
  if (quantity.error) errors.quantity = quantity.error

  if (draft.reason.trim().length > 200) {
    errors.reason = 'Reason must be 200 characters or fewer.'
  }

  if (Object.keys(errors).length > 0) return { errors }
  return { errors, quantity: quantity.value }
}
