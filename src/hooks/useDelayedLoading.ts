import { useEffect, useState } from 'react'

/**
 * There is no server, so data is instant. This adds a very short loading
 * state when a screen opens, so loading placeholders are shown and can be tested.
 */
export function useDelayedLoading(milliseconds = 350): boolean {
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), milliseconds)
    return () => window.clearTimeout(timer)
  }, [milliseconds])
  return loading
}
