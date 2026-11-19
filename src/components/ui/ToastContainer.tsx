import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, Info, Undo2, X, XCircle } from 'lucide-react'
import type { Toast } from '@/types'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { removeToast } from '@/store/slices/toastsSlice'
import { undoDelete } from '@/store/thunks'

const STYLES = {
  success: { icon: CheckCircle2, color: 'text-emerald-600', border: 'border-emerald-200' },
  error: { icon: XCircle, color: 'text-red-600', border: 'border-red-200' },
  info: { icon: Info, color: 'text-sky-600', border: 'border-sky-200' },
}

const DISPLAY_MS = 4500
/** Notifications with an Undo button stay a little longer. */
const UNDO_DISPLAY_MS = 8000

function ToastItem({ toast }: { toast: Toast }) {
  const dispatch = useAppDispatch()
  const { icon: Icon, color, border } = STYLES[toast.type]
  const duration = toast.undo ? UNDO_DISPLAY_MS : DISPLAY_MS

  useEffect(() => {
    const timer = window.setTimeout(() => dispatch(removeToast(toast.id)), duration)
    return () => window.clearTimeout(timer)
  }, [dispatch, toast.id, duration])

  const undo = () => {
    if (!toast.undo) return
    dispatch(removeToast(toast.id))
    dispatch(undoDelete(toast.undo))
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 40, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ duration: 0.2 }}
      role={toast.type === 'error' ? 'alert' : 'status'}
      className={`pointer-events-auto relative overflow-hidden rounded-2xl border bg-white/95 shadow-glass backdrop-blur-xl ${border}`}
    >
      <div className="flex items-start gap-3 p-4">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${color}`} aria-hidden />
        <p className="flex-1 text-sm text-slate-700">{toast.message}</p>
        {toast.undo && (
          <button
            type="button"
            onClick={undo}
            className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-800 hover:bg-brand-100"
          >
            <Undo2 className="h-3.5 w-3.5" aria-hidden />
            Undo
          </button>
        )}
        <button
          type="button"
          onClick={() => dispatch(removeToast(toast.id))}
          aria-label="Dismiss notification"
          className="rounded p-0.5 text-slate-400 hover:text-slate-700"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      {/* A thin bar that shows how long the notification will stay. */}
      <motion.div
        className={`h-0.5 origin-left ${toast.type === 'error' ? 'bg-red-300' : 'bg-brand-300'}`}
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: duration / 1000, ease: 'linear' }}
        aria-hidden
      />
    </motion.div>
  )
}

export function ToastContainer() {
  const toasts = useAppSelector((state) => state.toasts.items)
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 top-4 z-[60] flex flex-col gap-2 sm:left-auto sm:right-4 sm:w-96"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </AnimatePresence>
    </div>
  )
}
