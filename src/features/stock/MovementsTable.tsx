import { Link } from 'react-router-dom'
import type { StockMovement } from '@/types'
import { formatDateTime, formatNumber } from '@/lib/format'
import { MovementBadge } from '@/components/ui/Badge'

interface MovementsTableProps {
  movements: StockMovement[]
  /** Set of product ids that still exist, so deleted products are not linked. */
  existingProductIds: Set<string>
  /** Hide the product column when the table is already about one product. */
  showProduct?: boolean
}

export function MovementsTable({ movements, existingProductIds, showProduct = true }: MovementsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] divide-y divide-slate-200">
        <thead className="bg-brand-50/60">
          <tr>
            <th scope="col" className="th">Date</th>
            {showProduct && <th scope="col" className="th">Product</th>}
            <th scope="col" className="th">Type</th>
            <th scope="col" className="th text-right">Quantity</th>
            <th scope="col" className="th text-right">Previous</th>
            <th scope="col" className="th text-right">New</th>
            <th scope="col" className="th hidden lg:table-cell">Reason</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {movements.map((movement) => (
            <tr key={movement.id} className="hover:bg-slate-50">
              <td className="td whitespace-nowrap">{formatDateTime(movement.createdAt)}</td>
              {showProduct && (
                <td className="td">
                  {existingProductIds.has(movement.productId) ? (
                    <Link
                      to={`/products/${movement.productId}`}
                      className="font-medium text-slate-900 hover:text-brand-600"
                    >
                      {movement.productName}
                    </Link>
                  ) : (
                    <span className="font-medium text-slate-500">
                      {movement.productName} <span className="text-xs font-normal">(deleted)</span>
                    </span>
                  )}
                  <p className="text-xs text-slate-500">{movement.sku}</p>
                </td>
              )}
              <td className="td">
                <MovementBadge type={movement.type} />
              </td>
              <td
                className={`td text-right font-medium tabular-nums ${
                  movement.type === 'in' ? 'text-sky-700' : 'text-orange-700'
                }`}
              >
                {movement.type === 'in' ? '+' : '−'}
                {formatNumber(movement.quantity)}
              </td>
              <td className="td text-right tabular-nums">{formatNumber(movement.previousQuantity)}</td>
              <td className="td text-right font-medium tabular-nums text-slate-900">
                {formatNumber(movement.newQuantity)}
              </td>
              <td className="td hidden max-w-[16rem] truncate lg:table-cell" title={movement.reason}>
                {movement.reason || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
