import { describe, expect, it } from 'vitest'
import type { Category, Product } from '@/types'
import {
  parsePrice,
  parseWholeNumber,
  validateCategoryDraft,
  validateProductDraft,
  validateStockDraft,
} from './validation'

const categories: Category[] = [{ id: 'c1', name: 'Electronics', description: '', createdAt: '' }]
const products: Product[] = [
  {
    id: 'p1',
    name: 'Mouse',
    sku: 'WM-200',
    categoryId: 'c1',
    description: '',
    unitPrice: 10,
    quantity: 1,
    minStock: 1,
    createdAt: '',
  },
]

const goodDraft = {
  name: 'Keyboard',
  sku: 'kb-410',
  categoryId: 'c1',
  description: '',
  unitPrice: '79.50',
  quantity: '12',
  minStock: '5',
}

describe('parseWholeNumber', () => {
  it('accepts whole numbers', () => {
    expect(parseWholeNumber(' 12 ', 'Quantity').value).toBe(12)
    expect(parseWholeNumber('0', 'Quantity').value).toBe(0)
  })
  it.each(['', '  ', '-5', '2.5', '1e3', 'abc', '+4', '1,000'])('rejects %j', (raw) => {
    expect(parseWholeNumber(raw, 'Quantity').error).toBeTruthy()
  })
  it('enforces a minimum', () => {
    expect(parseWholeNumber('0', 'Quantity', 1).error).toMatch(/greater than zero/)
  })
  it('rejects numbers too large to be safe', () => {
    expect(parseWholeNumber('99999999999999999999', 'Quantity').error).toBeTruthy()
  })
})

describe('parsePrice', () => {
  it('accepts up to two decimals', () => {
    expect(parsePrice('24.99', 'Unit price').value).toBe(24.99)
    expect(parsePrice('5', 'Unit price').value).toBe(5)
  })
  it.each(['', '-1', '0', '1.999', 'abc', '1e2'])('rejects %j', (raw) => {
    expect(parsePrice(raw, 'Unit price').error).toBeTruthy()
  })
})

describe('validateProductDraft', () => {
  it('accepts a good draft and tidies the code', () => {
    const { errors, value } = validateProductDraft(goodDraft, { products, categories })
    expect(errors).toEqual({})
    expect(value).toMatchObject({ sku: 'KB-410', unitPrice: 79.5, quantity: 12, minStock: 5 })
  })
  it('reports every missing required field', () => {
    const { errors } = validateProductDraft(
      { name: '', sku: '', categoryId: '', description: '', unitPrice: '', quantity: '', minStock: '' },
      { products, categories },
    )
    expect(Object.keys(errors).sort()).toEqual(
      ['categoryId', 'minStock', 'name', 'quantity', 'sku', 'unitPrice'].sort(),
    )
  })
  it('rejects a duplicate code (any letter case) but allows keeping your own', () => {
    expect(validateProductDraft({ ...goodDraft, sku: 'wm-200' }, { products, categories }).errors.sku).toMatch(/already used/)
    expect(
      validateProductDraft({ ...goodDraft, sku: 'WM-200' }, { products, categories, editingId: 'p1' }).errors.sku,
    ).toBeUndefined()
  })
  it('rejects a name made only of spaces', () => {
    expect(validateProductDraft({ ...goodDraft, name: '   ' }, { products, categories }).errors.name).toBeTruthy()
  })
  it('does not ask for quantity when editing', () => {
    const { errors, value } = validateProductDraft({ ...goodDraft, quantity: '' }, { products, categories, editingId: 'p1', })
    expect(errors.quantity).toBeUndefined()
    expect(value?.quantity).toBeUndefined()
  })
})

describe('validateCategoryDraft', () => {
  it('requires a name and blocks duplicates', () => {
    expect(validateCategoryDraft({ name: ' ', description: '' }, { categories }).errors.name).toBeTruthy()
    expect(validateCategoryDraft({ name: 'electronics', description: '' }, { categories }).errors.name).toMatch(/already exists/)
    expect(validateCategoryDraft({ name: 'Electronics', description: '' }, { categories, editingId: 'c1' }).errors.name).toBeUndefined()
  })
})

describe('validateStockDraft', () => {
  it('requires a product and a positive whole quantity', () => {
    expect(validateStockDraft({ productId: '', quantity: '', reason: '' }).errors).toMatchObject({
      productId: expect.any(String),
      quantity: expect.any(String),
    })
    expect(validateStockDraft({ productId: 'p1', quantity: '-4', reason: '' }).errors.quantity).toMatch(/negative/)
    expect(validateStockDraft({ productId: 'p1', quantity: '0', reason: '' }).errors.quantity).toBeTruthy()
    expect(validateStockDraft({ productId: 'p1', quantity: '3', reason: '' }).quantity).toBe(3)
  })
})
