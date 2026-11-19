const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const numberFormat = new Intl.NumberFormat('en-US')
const dateFormat = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
const dateTimeFormat = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export const formatCurrency = (value: number): string => currency.format(value)
export const formatNumber = (value: number): string => numberFormat.format(value)

function toDate(iso: string): Date | null {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDate(iso: string): string {
  const date = toDate(iso)
  return date ? dateFormat.format(date) : '—'
}

export function formatDateTime(iso: string): string {
  const date = toDate(iso)
  return date ? dateTimeFormat.format(date) : '—'
}

/** "just now", "5 min ago", "3 h ago", "2 days ago", or a date for older items. */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const date = toDate(iso)
  if (!date) return '—'
  const minutes = Math.floor((now - date.getTime()) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  return formatDate(iso)
}
