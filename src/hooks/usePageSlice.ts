import { useState } from 'react'

/** Keeps track of the current page and returns the items for it. */
export function usePageSlice<T>(items: T[], pageSize: number) {
  const [requestedPage, setPage] = useState(1)
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  // If items disappear (filtering, deleting), never stay on a page that no longer exists.
  const page = Math.min(requestedPage, pageCount)
  const pageItems = items.slice((page - 1) * pageSize, page * pageSize)
  return { page, setPage, pageItems }
}
