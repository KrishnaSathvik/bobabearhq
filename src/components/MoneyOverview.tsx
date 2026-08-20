import { FileText, Plus, ReceiptIndianRupee } from 'lucide-react'
import { useMemo } from 'react'
import type { WorkspaceItem } from '../types'

type Props = {
  records: WorkspaceItem[]
  onAddQuote: () => void
  onAddExpense: () => void
}

function total(records: WorkspaceItem[]) {
  return records.reduce((sum, item) => sum + Number(item.amount || 0), 0)
}

function rupees(value: number) {
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

export function MoneyOverview({ records, onAddQuote, onAddExpense }: Props) {
  const totals = useMemo(() => {
    const quotes = records.filter(item => item.kind === 'Quote')
    const expenses = records.filter(item => item.kind === 'Expense')
    return { quoteTotal: total(quotes), expenseTotal: total(expenses), quoteCount: quotes.length, expenseCount: expenses.length }
  }, [records])

  return (
    <section className="money-overview" aria-label="Money totals">
      <header>
        <div><ReceiptIndianRupee size={18} /><strong>Money records</strong></div>
        <div className="money-actions"><button onClick={onAddQuote}><FileText size={15} /> Add quote</button><button onClick={onAddExpense}><Plus size={15} /> Add expense</button></div>
      </header>
      <div className="money-totals">
        <div><span>Quotes</span><strong>{rupees(totals.quoteTotal)}</strong><small>{totals.quoteCount} {totals.quoteCount === 1 ? 'record' : 'records'} · not treated as spending</small></div>
        <div><span>Recorded expenses</span><strong>{rupees(totals.expenseTotal)}</strong><small>{totals.expenseCount} {totals.expenseCount === 1 ? 'record' : 'records'}</small></div>
      </div>
      {records.length === 0 && <p>Add quotes while comparing options. Add expenses only when money is actually spent or a purchase is recorded.</p>}
    </section>
  )
}
