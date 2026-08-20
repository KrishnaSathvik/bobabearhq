import { FileText, Plus, ReceiptIndianRupee } from 'lucide-react'
import { useMemo } from 'react'
import { formatRupees, isOutstanding, parseAmount } from '../lib/money'
import type { WorkspaceItem } from '../types'

type Props = {
  records: WorkspaceItem[]
  onAddQuote: () => void
  onAddExpense: () => void
}

function total(records: WorkspaceItem[]) {
  return records.reduce((sum, item) => sum + (parseAmount(item.amount) ?? 0), 0)
}

export function MoneyOverview({ records, onAddQuote, onAddExpense }: Props) {
  const totals = useMemo(() => {
    const quotes = records.filter(item => item.kind === 'Quote')
    const expenses = records.filter(item => item.kind === 'Expense')
    // Money still owed is not money already spent, so the two never share a tile.
    const outstanding = expenses.filter(isOutstanding)
    const paid = expenses.filter(item => !isOutstanding(item))
    return {
      quotes: { amount: total(quotes), count: quotes.length },
      paid: { amount: total(paid), count: paid.length },
      outstanding: { amount: total(outstanding), count: outstanding.length },
    }
  }, [records])

  return (
    <section className="money-overview" aria-label="Money totals">
      <header>
        <div><ReceiptIndianRupee size={18} /><strong>Money records</strong></div>
        <div className="money-actions"><button onClick={onAddQuote}><FileText size={15} /> Add quote</button><button onClick={onAddExpense}><Plus size={15} /> Add expense</button></div>
      </header>
      <div className="money-totals">
        <div>
          <span>Paid</span>
          <strong>{formatRupees(totals.paid.amount)}</strong>
          <small>{totals.paid.count} {totals.paid.count === 1 ? 'record' : 'records'} · actually spent</small>
        </div>
        <div>
          <span>Outstanding</span>
          <strong>{formatRupees(totals.outstanding.amount)}</strong>
          <small>{totals.outstanding.count} {totals.outstanding.count === 1 ? 'record' : 'records'} · not paid or part paid</small>
        </div>
        <div>
          <span>Quotes</span>
          <strong>{formatRupees(totals.quotes.amount)}</strong>
          <small>{totals.quotes.count} {totals.quotes.count === 1 ? 'record' : 'records'} · not treated as spending</small>
        </div>
      </div>
      {records.length === 0 && <p>Add quotes while comparing options. Add expenses only when money is actually spent or a purchase is recorded.</p>}
    </section>
  )
}
