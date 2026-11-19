import { useEffect } from 'react'
import AOS from 'aos'

/** Tells AOS to look for newly shown elements (after a page or loading state changes). */
export function useAosRefresh(...dependencies: unknown[]): void {
  useEffect(() => {
    const timer = window.setTimeout(() => AOS.refreshHard(), 30)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies)
}
