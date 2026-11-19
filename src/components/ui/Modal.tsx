import { useEffect, useId, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useIsPresent } from 'framer-motion'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

const WIDTHS = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-2xl' }

interface PanelProps {
  title: string
  onClose: () => void
  children: ReactNode
  size: 'sm' | 'md' | 'lg'
}

function ModalPanel({ title, onClose, children, size }: PanelProps) {
  const titleId = useId()
  // While the dialog is fading out it is already "closed", so it must not accept clicks.
  // Without this, a quick double-click on a submit button could send the form twice.
  const isPresent = useIsPresent()

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" inert={!isPresent}>
      <motion.div
        className="absolute inset-0 bg-slate-900/50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        aria-hidden
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative flex max-h-[92vh] w-full flex-col rounded-t-3xl border border-white/70 bg-white/90 shadow-2xl backdrop-blur-2xl sm:rounded-3xl ${WIDTHS[size]}`}
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.98 }}
        transition={{ duration: 0.18 }}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 id={titleId} className="text-base font-semibold text-slate-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </motion.div>
    </div>
  )
}

export function Modal({ open, title, onClose, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) onClose()
    }
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  // Rendered in <body> so it always covers the whole screen.
  return createPortal(
    <AnimatePresence>
      {open && (
        <ModalPanel title={title} onClose={onClose} size={size}>
          {children}
        </ModalPanel>
      )}
    </AnimatePresence>,
    document.body,
  )
}
