import { useMemo, useState, type FormEvent } from 'react'
import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react'
import type { MovementType } from '@/types'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { selectProducts } from '@/store/selectors'
import { recordStockMovement } from '@/store/thunks'
import { addToast } from '@/store/slices/toastsSlice'
import { getStockStatus, validateMovement } from '@/lib/inventory'
import { hasRequiredError, parseWholeNumber, validateStockDraft, type StockDraft, type StockErrors } from '@/lib/validation'
import { formatNumber } from '@/lib/format'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { SelectField, TextField } from '@/components/ui/Fields'
import { StatusBadge } from '@/components/ui/Badge'

interface StockFormModalProps {
  open: boolean
  onClose: () => void
  initialType?: MovementType
  initialProductId?: string
}

export function StockFormModal({ open, onClose, initialType = 'in', initialProductId = '' }: StockFormModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Record stock movement">
      <StockFormBody initialType={initialType} initialProductId={initialProductId} onClose={onClose} />
    </Modal>
  )
}

function StockFormBody({
  initialType,
  initialProductId,
  onClose,
}: {
  initialType: MovementType
  initialProductId: string
  onClose: () => void
}) {
  const dispatch = useAppDispatch()
  const products = useAppSelector(selectProducts)

  const [type, setType] = useState<MovementType>(initialType)
  const [draft, setDraft] = useState<StockDraft>({ productId: initialProductId, quantity: '', reason: '' })
  const [errors, setErrors] = useState<StockErrors>({})

  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => a.name.localeCompare(b.name)),
    [products],
  )
  const product = products.find((p) => p.id === draft.productId)

  const change = (field: keyof StockDraft) => (value: string) => {
    setDraft((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  // Tell the person straight away if the number will not work (for example, more than is in stock).
  const parsed = draft.quantity.trim() === '' ? null : parseWholeNumber(draft.quantity, 'Quantity', 1)
  const liveError =
    parsed?.error ?? (parsed?.value !== undefined && product ? validateMovement(product.quantity, type, parsed.value) : null)
  const quantityError = errors.quantity ?? liveError ?? undefined

  const preview =
    product && parsed?.value !== undefined && !liveError
      ? type === 'in'
        ? product.quantity + parsed.value
        : product.quantity - parsed.value
      : null

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const result = validateStockDraft(draft)
    setErrors(result.errors)

    if (result.quantity === undefined) {
      dispatch(
        addToast(
          'error',
          hasRequiredError(result.errors) ? 'Required fields are missing.' : 'Please correct the highlighted fields.',
        ),
      )
      return
    }

    const outcome = dispatch(
      recordStockMovement({ productId: draft.productId, type, quantity: result.quantity, reason: draft.reason }),
    )
    if (outcome.ok) onClose()
    else if (outcome.field) setErrors({ [outcome.field]: outcome.error })
  }

  const tab = (value: MovementType, label: string, Icon: typeof ArrowDownToLine) => {
    const active = type === value
    return (
      <button
        type="button"
        role="radio"
        aria-checked={active}
        onClick={() => {
          setType(value)
          setErrors((current) => ({ ...current, quantity: undefined }))
        }}
        className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <Icon className="h-4 w-4" aria-hidden />
        {label}
      </button>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div role="radiogroup" aria-label="Movement type" className="flex gap-1 rounded-xl bg-slate-100 p-1">
        {tab('in', 'Receive stock', ArrowDownToLine)}
        {tab('out', 'Issue stock', ArrowUpFromLine)}
      </div>

      <SelectField
        label="Product"
        required
        value={draft.productId}
        onChange={(e) => change('productId')(e.target.value)}
        error={errors.productId}
      >
        <option value="">Select a product…</option>
        {sortedProducts.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name} ({item.sku})
          </option>
        ))}
      </SelectField>

      {product && (
        <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
          <span className="text-slate-600">
            Available now: <strong className="text-slate-900">{formatNumber(product.quantity)}</strong>
          </span>
          <StatusBadge status={getStockStatus(product)} />
        </div>
      )}

      <TextField
        label={type === 'in' ? 'Quantity to receive' : 'Quantity to issue'}
        required
        inputMode="numeric"
        value={draft.quantity}
        onChange={(e) => change('quantity')(e.target.value)}
        error={quantityError}
        placeholder="e.g. 25"
        hint={preview !== null ? `New quantity will be ${formatNumber(preview)}.` : undefined}
      />

      <TextField
        label="Reason or reference"
        value={draft.reason}
        onChange={(e) => change('reason')(e.target.value)}
        error={errors.reason}
        placeholder={type === 'in' ? 'e.g. Supplier delivery, PO-1042' : 'e.g. Sales order SO-2210'}
        maxLength={220}
      />

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit">{type === 'in' ? 'Receive stock' : 'Issue stock'}</Button>
      </div>
    </form>
  )
}
