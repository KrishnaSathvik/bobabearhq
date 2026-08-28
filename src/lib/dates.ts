// Dates arrive as whatever a date input stored: '2026-08-16'. Printing that
// raw next to "Aug 24, 2026" in the same column is the sort of thing that makes
// a workspace feel half finished, so every date a person reads comes from here.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

// Parsed at midday rather than midnight: a date-only string is UTC, and west of
// Greenwich that lands on the previous day once it is shown locally.
export function formatDate(value?: string | null) {
  const trimmed = value?.trim()
  if (!trimmed) return null
  const date = ISO_DATE.test(trimmed) ? new Date(`${trimmed}T12:00:00`) : new Date(trimmed)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Only the values that really are dates get rewritten; a free-text field that
// happens to hold "2026 stock" is left exactly as it was typed.
export function formatIfDate(value: string) {
  return ISO_DATE.test(value.trim()) ? formatDate(value) ?? value : value
}

// "Updated 20 min ago" is the third line of every Inbox row, and it is the one
// piece of metadata that has to stay honest without the page being reloaded —
// so it is computed from the timestamp on every render rather than stored.
export function timeAgo(value?: string | null) {
  const stamp = value ? Date.parse(value) : NaN
  if (Number.isNaN(stamp)) return null
  const seconds = Math.round((Date.now() - stamp) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  const days = Math.round(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  // Past a week the exact day is more use than a count of weeks.
  return formatDate(value)
}
