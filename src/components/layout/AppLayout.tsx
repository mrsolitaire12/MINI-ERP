import { Suspense, useCallback, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Boxes, Menu, Search, X } from 'lucide-react'
import { SidebarContent } from './Sidebar'
import { QuickActionsProvider, useQuickActions } from './QuickActions'
import { ToastContainer } from '@/components/ui/ToastContainer'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAosRefresh } from '@/hooks/useAosRefresh'

const COLLAPSE_KEY = 'mini-erp:sidebar-collapsed'

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

/** Soft blurred colour patches behind everything. */
function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#eef1e3]">
      <div className="absolute -left-40 top-1/3 h-[30rem] w-[30rem] rounded-full bg-brand-300/45 blur-3xl" />
      <div className="absolute -right-32 -top-24 h-[32rem] w-[32rem] rounded-full bg-amber-100/90 blur-3xl" />
      <div className="absolute -bottom-40 right-1/4 h-[28rem] w-[28rem] rounded-full bg-brand-200/55 blur-3xl" />
    </div>
  )
}

function Shell() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const { pathname } = useLocation()
  const { openPalette } = useQuickActions()

  useAosRefresh(pathname)

  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => {
      const next = !current
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
      } catch {
        // The choice just will not be remembered.
      }
      return next
    })
  }, [])

  // Close the mobile menu with the Escape key.
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) setMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menuOpen])

  // Always start a new page at the top.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="min-h-screen">
      <Backdrop />

      {/* Desktop sidebar: a floating card */}
      <aside
        className={`fixed inset-y-4 left-4 z-30 hidden transition-[width] duration-300 lg:block ${
          collapsed ? 'w-[4.75rem]' : 'w-64'
        }`}
      >
        <SidebarContent collapsed={collapsed} onToggleCollapse={toggleCollapsed} />
      </aside>

      {/* Mobile and tablet top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/60 bg-white/70 px-4 py-3 backdrop-blur-xl lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-700 text-white">
            <Boxes className="h-4 w-4" aria-hidden />
          </div>
          <span className="text-lg font-medium tracking-tight text-slate-900">Mini ERP</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={openPalette}
            aria-label="Search and quick actions"
            className="rounded-xl p-2 text-slate-600 hover:bg-slate-900/5"
          >
            <Search className="h-5 w-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="rounded-xl p-2 text-slate-600 hover:bg-slate-900/5"
          >
            <Menu className="h-6 w-6" aria-hidden />
          </button>
        </div>
      </header>

      {/* Mobile and tablet drawer */}
      <AnimatePresence>
        {menuOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <motion.div
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
              aria-hidden
            />
            <motion.aside
              className="absolute inset-y-0 left-0 w-80 max-w-[88vw] p-3"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.22 }}
              aria-label="Menu"
            >
              <SidebarContent onNavigate={() => setMenuOpen(false)} />
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
                className="absolute right-6 top-6 rounded-lg p-1.5 text-slate-400 hover:bg-slate-900/5 hover:text-slate-700"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <main className={`transition-[padding] duration-300 ${collapsed ? 'lg:pl-[6.5rem]' : 'lg:pl-72'}`}>
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
          <Suspense
            fallback={
              <div role="status" aria-label="Loading page" className="space-y-4">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-64 w-full" />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </div>
      </main>

      <ToastContainer />
    </div>
  )
}

export function AppLayout() {
  return (
    <QuickActionsProvider>
      <Shell />
    </QuickActionsProvider>
  )
}
