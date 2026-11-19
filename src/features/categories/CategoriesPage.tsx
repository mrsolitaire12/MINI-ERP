import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Plus, Tags, Trash2 } from 'lucide-react'
import type { Category } from '@/types'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { selectCategories, selectProductCountByCategory } from '@/store/selectors'
import { deleteCategory } from '@/store/thunks'
import { formatDate } from '@/lib/format'
import { useDelayedLoading } from '@/hooks/useDelayedLoading'
import { Button, IconButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader, PageTransition } from '@/components/ui/PageHeader'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { CategoryFormModal } from './CategoryForm'

export default function CategoriesPage() {
  const dispatch = useAppDispatch()
  const categories = useAppSelector(selectCategories)
  const counts = useAppSelector(selectProductCountByCategory)
  const loading = useDelayedLoading()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [deleting, setDeleting] = useState<Category | null>(null)

  // Keep the name visible while the confirmation dialog fades out.
  const lastDeleting = useRef<Category | null>(null)
  if (deleting) lastDeleting.current = deleting
  const shownDeleting = deleting ?? lastDeleting.current

  const openAdd = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (category: Category) => {
    setEditing(category)
    setFormOpen(true)
  }

  // A category that products use cannot be deleted. We say so straight away
  // instead of asking for a confirmation that could only fail.
  const requestDelete = (category: Category) => {
    if ((counts[category.id] ?? 0) > 0) {
      dispatch(deleteCategory(category.id))
      return
    }
    setDeleting(category)
  }

  const confirmDelete = () => {
    if (deleting) dispatch(deleteCategory(deleting.id))
    setDeleting(null)
  }

  return (
    <PageTransition>
      <PageHeader
        title="Categories"
        description="Group your products so they are easy to find."
        actions={
          <Button icon={<Plus className="h-4 w-4" aria-hidden />} onClick={openAdd}>
            Add category
          </Button>
        }
      />

      <Card className="overflow-hidden">
        {loading ? (
          <TableSkeleton rows={5} columns={4} />
        ) : categories.length === 0 ? (
          <EmptyState
            icon={Tags}
            title="No categories yet"
            description="Create a category before adding products."
            action={
              <Button icon={<Plus className="h-4 w-4" aria-hidden />} onClick={openAdd}>
                Add category
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] divide-y divide-slate-200">
              <thead className="bg-brand-50/60">
                <tr>
                  <th scope="col" className="th">Category</th>
                  <th scope="col" className="th hidden md:table-cell">Description</th>
                  <th scope="col" className="th text-right">Products</th>
                  <th scope="col" className="th hidden sm:table-cell">Created</th>
                  <th scope="col" className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categories.map((category) => {
                  const count = counts[category.id] ?? 0
                  return (
                    <tr key={category.id} className="hover:bg-slate-50">
                      <td className="td font-medium text-slate-900">{category.name}</td>
                      <td className="td hidden max-w-xs truncate md:table-cell" title={category.description}>
                        {category.description || <span className="text-slate-400">—</span>}
                      </td>
                      <td className="td text-right tabular-nums">
                        {count > 0 ? (
                          <Link
                            to={`/products?category=${category.id}`}
                            className="font-medium text-brand-600 hover:text-brand-800"
                            title="View these products"
                          >
                            {count}
                          </Link>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="td hidden whitespace-nowrap sm:table-cell">{formatDate(category.createdAt)}</td>
                      <td className="td">
                        <div className="flex justify-end gap-0.5">
                          <IconButton label={`Edit ${category.name}`} onClick={() => openEdit(category)}>
                            <Pencil className="h-4 w-4" aria-hidden />
                          </IconButton>
                          <IconButton label={`Delete ${category.name}`} tone="danger" onClick={() => requestDelete(category)}>
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <CategoryFormModal open={formOpen} onClose={() => setFormOpen(false)} category={editing} />

      <ConfirmDialog
        open={deleting !== null}
        title="Delete category?"
        confirmLabel="Delete category"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      >
        {shownDeleting && (
          <p>
            You are about to delete <strong className="text-slate-900">{shownDeleting.name}</strong>. No products use it.
            This cannot be undone.
          </p>
        )}
      </ConfirmDialog>
    </PageTransition>
  )
}
