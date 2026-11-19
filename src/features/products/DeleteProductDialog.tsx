import { useRef } from 'react'
import type { Product } from '@/types'
import { formatCurrency } from '@/lib/format'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

interface DeleteProductDialogProps {
  product: Product | null
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteProductDialog({ product, onConfirm, onCancel }: DeleteProductDialogProps) {
  // Keep showing the last product while the dialog fades out, so its text does not vanish early.
  const lastProduct = useRef<Product | null>(null)
  if (product) lastProduct.current = product
  const shown = product ?? lastProduct.current

  return (
    <ConfirmDialog
      open={product !== null}
      title="Delete product?"
      confirmLabel="Delete product"
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      {shown && (
        <>
          <p>
            You are about to delete <strong className="text-slate-900">{shown.name}</strong> ({shown.sku}).
            This cannot be undone.
          </p>
          {shown.quantity > 0 && (
            <p className="mt-2">
              It still has {shown.quantity.toLocaleString('en-US')} units in stock, worth{' '}
              {formatCurrency(shown.quantity * shown.unitPrice)}. Its stock history will be kept.
            </p>
          )}
        </>
      )}
    </ConfirmDialog>
  )
}
