import { useMemo } from 'react'
import { ItemRow } from './ItemRow'
import { formatRupees, normalizePaymentStatus, outstandingPortion, paidPortion, parseAmount } from '../lib/money'
import type { WorkspaceItem } from '../types'

type Props = {
  records: WorkspaceItem[]
}

function total(records: WorkspaceItem[]) {
  return records.reduce((sum, item) => sum + (parseAmount(item.amount) ?? 0), 0)
}

function sumBy(records: WorkspaceItem[], read: (item: WorkspaceItem) => number) {
  return records.reduce((sum, item) => sum + read(item), 0)
}

// What is still owed on a record, split by why it is owed. An agreed bill and
// an expected one are two different feelings about the same rupee: one you have
// promised, the other you have only budgeted. Lumping them into "outstanding"
// was the thing that made this screen read like a ledger instead of a plan.
function committedPortion(item: WorkspaceItem) {
  const status = normalizePaymentStatus(item.details?.paymentStatus) ?? 'Paid'
  return status === 'Committed' || status === 'Part paid' ? outstandingPortion(item) : 0
}

function plannedPortion(item: WorkspaceItem) {
  return (normalizePaymentStatus(item.details?.paymentStatus) ?? 'Paid') === 'Planned' ? outstandingPortion(item) : 0
}

export function MoneyOverview({ records }: Props) {
  const totals = useMemo(() => {
    const quotes = records.filter(item => item.kind === 'Quote')
    const expenses = records.filter(item => item.kind === 'Expense')
    return {
      paid: sumBy(expenses, paidPortion),
      committed: sumBy(expenses, committedPortion),
      planned: sumBy(expenses, plannedPortion),
      // A quote is not spending at all — nobody has agreed to it and nothing is
      // budgeted for it yet. It stays out of the three, and appears only when
      // there is one, rather than adding a permanent ₹0 to the line.
      quoted: { amount: total(quotes), any: quotes.length > 0 },
    }
  }, [records])

  return (
    // Three numbers in the order money moves through the shop — spent, owed,
    // expected — written as a sentence rather than a wall of tiles.
    <p className="money-totals" aria-label="Money totals">
      <span><strong>{formatRupees(totals.paid)}</strong> <span>paid</span></span>
      <span><strong>{formatRupees(totals.committed)}</strong> <span>committed</span></span>
      <span><strong>{formatRupees(totals.planned)}</strong> <span>planned</span></span>
      {totals.quoted.any && <span><strong>{formatRupees(totals.quoted.amount)}</strong> <span>quoted</span></span>}
    </p>
  )
}

// The money list. Every row is the standard row — a part-paid purchase is the
// one case that cannot be said on one line, because "₹40,000 · Part paid" hides
// the only two numbers you wanted: what has gone out and what is still owed.
export function MoneyActivity({ records, selectedId, onOpen }: {
  records: WorkspaceItem[]
  selectedId: string | null
  onOpen: (item: WorkspaceItem) => void
}) {
  const recent = useMemo(() => [...records]
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)), [records])

  if (recent.length === 0) return null

  return (
    <div className="money-activity">
      <p className="eyebrow">Recent</p>
      <div className="item-list">
        {recent.map(item => {
          const split = normalizePaymentStatus(item.details?.paymentStatus) === 'Part paid'
          return (
            <div key={item.id} className="money-entry">
              {/* An expense is never "New / Doing / Waiting / Done" on screen.
                  Its status is its payment, and the row already prints that. */}
              <ItemRow item={item} onOpen={onOpen} alignForChecks={false} showWhen={false}
                showStatus={item.kind !== 'Expense'} selected={item.id === selectedId} />
              {split && <p className="money-split">
                {formatRupees(paidPortion(item))} paid · {formatRupees(outstandingPortion(item))} outstanding
              </p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
