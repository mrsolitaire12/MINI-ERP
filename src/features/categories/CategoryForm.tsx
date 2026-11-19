import { useState, type FormEvent } from 'react'
import type { Category } from '@/types'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { selectCategories } from '@/store/selectors'
import { createCategory, updateCategory } from '@/store/thunks'
import { addToast } from '@/store/slices/toastsSlice'
import { hasRequiredError, validateCategoryDraft, type CategoryDraft, type CategoryErrors } from '@/lib/validation'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { TextareaField, TextField } from '@/components/ui/Fields'

interface CategoryFormModalProps {
  open: boolean
  onClose: () => void
  category?: Category | null
}

export function CategoryFormModal({ open, onClose, category }: CategoryFormModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={category ? 'Edit category' : 'Add category'} size="sm">
      <CategoryFormBody category={category ?? null} onClose={onClose} />
    </Modal>
  )
}

function CategoryFormBody({ category, onClose }: { category: Category | null; onClose: () => void }) {
  const dispatch = useAppDispatch()
  const categories = useAppSelector(selectCategories)

  const [draft, setDraft] = useState<CategoryDraft>({
    name: category?.name ?? '',
    description: category?.description ?? '',
  })
  const [errors, setErrors] = useState<CategoryErrors>({})

  const change = (field: keyof CategoryDraft) => (value: string) => {
    setDraft((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const result = validateCategoryDraft(draft, { categories, editingId: category?.id })
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

    const outcome = category
      ? dispatch(updateCategory(category.id, result.value))
      : dispatch(createCategory(result.value))

    if (outcome.ok) onClose()
    else if (outcome.field) setErrors({ [outcome.field]: outcome.error })
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <TextField
        label="Category name"
        required
        value={draft.name}
        onChange={(e) => change('name')(e.target.value)}
        error={errors.name}
        placeholder="e.g. Electronics"
        maxLength={50}
        autoFocus
      />
      <TextareaField
        label="Description"
        rows={3}
        value={draft.description}
        onChange={(e) => change('description')(e.target.value)}
        error={errors.description}
        hint="Optional. Up to 200 characters."
      />
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit">{category ? 'Save changes' : 'Add category'}</Button>
      </div>
    </form>
  )
}
