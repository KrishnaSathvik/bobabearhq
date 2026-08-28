import { paymentStatuses, type PaymentStatus } from '../types'

export { paymentStatuses }
export type { PaymentStatus }

// Amounts travel as strings from the form inputs and as numbers from the
// database, and either can be empty or unparseable. Everything money-shaped
// goes through here so a bad value shows as "not added" instead of NaN.
export function parseAmount(value?: string | number | null) {
  if (value === undefined || value === null || value === '') return null
  const amount = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(amount) ? amount : null
}

// Rent is ₹19,000, not ₹19,000.00. Nobody writes the paise on a whole rupee,
// and a column of trailing zeroes is two characters of noise on every line.
// A real fraction still prints in full, because ₹3,250.50 rounded to ₹3,251
// would be a lie about what was paid.
export function formatRupees(value?: string | number | null) {
  const amount = parseAmount(value)
  if (amount === null) return null
  const whole = Number.isInteger(amount)
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`
}

// Where a payment actually stands. The words themselves live in types.ts with
// every other status vocabulary, because an expense's payment *is* its status —
// it was never a second question, and printing both was the duplication.
export const paymentStatusHints: Record<PaymentStatus, string> = {
  Planned: 'Expected, not agreed yet',
  Committed: 'Agreed and owed',
  'Part paid': 'Some of it has been handed over',
  Paid: 'Settled in full',
  Refunded: 'Paid and given back',
}

// A workspace written before this list existed says 'Not paid'. Rows are never
// rewritten on disk — the word is translated on the way in, the same way the
// four statuses are.
const legacyPaymentStatuses: Record<string, PaymentStatus> = { 'Not paid': 'Planned' }

export function normalizePaymentStatus(value?: string | null): PaymentStatus | undefined {
  if (!value) return undefined
  return paymentStatuses.includes(value as PaymentStatus) ? value as PaymentStatus : legacyPaymentStatuses[value]
}

type MoneyRecord = { amount?: string | number | null; details?: Record<string, string> }

// A record saved without ever opening the select reads as paid, because an
// expense is money you already spent — that is what the word means here.
// A part-paid purchase is partly spending and partly a debt, so it is split by
// what was actually handed over. Money that came back is neither.
export function paidPortion(item: MoneyRecord) {
  const total = parseAmount(item.amount) ?? 0
  const status = normalizePaymentStatus(item.details?.paymentStatus)
  if (status === 'Planned' || status === 'Committed' || status === 'Refunded') return 0
  if (status === 'Part paid') return Math.max(0, Math.min(parseAmount(item.details?.amountPaid) ?? 0, total))
  return total
}

export function outstandingPortion(item: MoneyRecord) {
  if (normalizePaymentStatus(item.details?.paymentStatus) === 'Refunded') return 0
  const total = parseAmount(item.amount) ?? 0
  return Math.max(0, total - paidPortion(item))
}

// An expense's status is its payment, said once. This used to translate the
// payment into a generic workflow word, so a receipt carried "Committed" in one
// place and "Doing" in another and the record disagreed with itself.
export function statusForPayment(value?: string | null): PaymentStatus {
  return normalizePaymentStatus(value) ?? 'Paid'
}
