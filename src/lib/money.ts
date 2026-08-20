// Amounts travel as strings from the form inputs and as numbers from the
// database, and either can be empty or unparseable. Everything money-shaped
// goes through here so a bad value shows as "not added" instead of NaN.
export function parseAmount(value?: string | number | null) {
  if (value === undefined || value === null || value === '') return null
  const amount = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(amount) ? amount : null
}

export function formatRupees(value?: string | number | null) {
  const amount = parseAmount(value)
  if (amount === null) return null
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// The editor defaults this select to "Paid", so a record saved without ever
// touching it reads as paid on screen and must be counted the same way.
export function isOutstanding(item: { details?: Record<string, string> }) {
  const status = item.details?.paymentStatus
  return status === 'Not paid' || status === 'Part paid'
}
