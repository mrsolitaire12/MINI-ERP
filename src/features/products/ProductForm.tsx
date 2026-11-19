import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Info } from 'lucide-react'
import type { Product } from '@/types'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { selectCategories, selectProducts } from '@/store/selectors'
import { createProduct, updateProduct } from '@/store/thunks'
import { addToast } from '@/store/slices/toastsSlice'
import {
  hasRequiredError,
  validateProductDraft,
  type ProductDraft,
  type ProductErrors,
} from '@/lib/validation'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { SelectField, TextareaField, TextField } from '@/components/ui/Fields'

interface ProductFormModalProps {
  open: boolean
  onClose: () => void
  /** Pass a product to edit it. Leave empty to add a new one. */
  product?: Product | null
}

export function ProductFormModal({ open, onClose, product }: ProductFormModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={product ? 'Edit product' : 'Add product'} size="lg">
      <ProductFormBody product={product ?? null} onClose={onClose} />
    </Modal>
  )
}

const EMPTY_DRAFT: ProductDraft = {
  name: '',
  sku: '',
  categoryId: '',
  description: '',
  unitPrice: '',
  quantity: '0',
  minStock: '10',
}

function toDraft(product: Product | null): ProductDraft {
  if (!product) return EMPTY_DRAFT
  return {
    name: product.name,
    sku: product.sku,
    categoryId: product.categoryId,
    description: product.description,
    unitPrice: String(product.unitPrice),
    quantity: String(product.quantity),
    minStock: String(product.minStock),
  }
}

function ProductFormBody({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const dispatch = useAppDispatch()
  const products = useAppSelector(selectProducts)
  const categories = useAppSelector(selectCategories)

  // The form starts fresh each time the dialog opens, because this component mounts then.
  const [draft, setDraft] = useState<ProductDraft>(() => toDraft(product))
  const [errors, setErrors] = useState<ProductErrors>({})
  const isEdit = product !== null

  const change = (field: keyof ProductDraft) => (value: string) => {
    setDraft((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const result = validateProductDraft(draft, { products, categories, editingId: product?.id })
    setErrors(result.errors)

    if (!result.value) {
      dispatch(
        addToast(
          'error',
          hasRequiredError(result.errors) ? 'Required fields are missing.' : 'Please correct the highlighted fields.',
        ),
      )
      return
    }

    const { name, sku, categoryId, description, unitPrice, minStock, quantity } = result.value
    const fields = { name, sku, categoryId, description, unitPrice, minStock }
    const outcome = product
      ? dispatch(updateProduct(product.id, fields))
      : dispatch(createProduct({ ...fields, quantity: quantity ?? 0 }))

    if (outcome.ok) onClose()
    else if (outcome.field) setErrors({ [outcome.field]: outcome.error })
  }

  const noCategories = categories.length === 0

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {noCategories && (
        <div className="flex gap-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            You need at least one category before adding products.{' '}
            <Link to="/categories" onClick={onClose} className="font-medium underline">
              Create a category
            </Link>
            .
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Product name"
          required
          value={draft.name}
          onChange={(e) => change('name')(e.target.value)}
          error={errors.name}
          placeholder="e.g. Wireless Mouse"
          maxLength={120}
          autoFocus
        />
        <TextField
          label="Product code (SKU)"
          required
          value={draft.sku}
          onChange={(e) => change('sku')(e.target.value)}
          error={errors.sku}
          placeholder="e.g. WM-200"
          maxLength={40}
        />
      </div>

      <SelectField
        label="Category"
        required
        value={draft.categoryId}
        onChange={(e) => change('categoryId')(e.target.value)}
        error={errors.categoryId}
      >
        <option value="">Select a category…</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </SelectField>

      <TextareaField
        label="Description"
        rows={3}
        value={draft.description}
        onChange={(e) => change('description')(e.target.value)}
        error={errors.description}
        hint="Optional. Up to 500 characters."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <TextField
          label="Unit price (USD)"
          required
          inputMode="decimal"
          value={draft.unitPrice}
          onChange={(e) => change('unitPrice')(e.target.value)}
          error={errors.unitPrice}
          placeholder="0.00"
        />
        <TextField
          label={isEdit ? 'Available quantity' : 'Starting quantity'}
          required={!isEdit}
          inputMode="numeric"
          value={draft.quantity}
          onChange={(e) => change('quantity')(e.target.value)}
          error={errors.quantity}
          disabled={isEdit}
          hint={isEdit ? 'Change it on the Stock page.' : undefined}
        />
        <TextField
          label="Minimum stock level"
          required
          inputMode="numeric"
          value={draft.minStock}
          onChange={(e) => change('minStock')(e.target.value)}
          error={errors.minStock}
          hint="Low-stock warning level."
        />
      </div>

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={noCategories}>
          {isEdit ? 'Save changes' : 'Add product'}
        </Button>
      </div>
    </form>
  )
}
