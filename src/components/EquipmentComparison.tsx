import { Package, Plus } from 'lucide-react'
import { useMemo } from 'react'
import { formatRupees, parseAmount } from '../lib/money'
import type { WorkspaceItem } from '../types'

type Props = {
  products: WorkspaceItem[]
  onAdd: () => void
  onOpen: (item: WorkspaceItem) => void
}

// Comparing options meant opening each record one at a time. This puts the
// competing products for one category side by side without deciding anything.
// Rows are ordered cheapest first purely so they are easy to scan; no option is
// highlighted, recommended, or marked as chosen.
export function EquipmentComparison({ products, onAdd, onOpen }: Props) {
  const groups = useMemo(() => {
    const byCategory = products.reduce<Record<string, WorkspaceItem[]>>((result, product) => {
      const category = product.details?.category?.trim() || 'Uncategorised'
      result[category] = [...(result[category] ?? []), product]
      return result
    }, {})
    return Object.entries(byCategory).sort(([a], [b]) => a.localeCompare(b))
  }, [products])

  if (products.length === 0) return (
    <section className="sample-empty">
      <div className="sample-empty-icon"><Package size={20} /></div>
      <div><strong>Compare equipment options</strong><p>Add each product you are considering as its own record. Options in the same category line up side by side here, and nothing is marked as chosen.</p></div>
      <button onClick={onAdd}>Add equipment</button>
    </section>
  )

  return (
    <section className="equipment-comparison" aria-label="Equipment comparison">
      <header>
        <div><Package size={18} /><strong>Equipment comparison</strong></div>
        <button onClick={onAdd}><Plus size={15} /> Add equipment</button>
      </header>
      {groups.map(([category, options]) => (
        <div className="comparison-group" key={category}>
          <h3>{category} <span>{options.length} {options.length === 1 ? 'option' : 'options'}</span></h3>
          <div className="comparison-scroll">
            <table>
              <thead>
                <tr><th>Option</th><th>Supplier</th><th>Price / quote</th><th>MOQ</th><th>Lead time</th><th>Status</th></tr>
              </thead>
              <tbody>
                {[...options]
                  .sort((a, b) => (parseAmount(a.amount) ?? Infinity) - (parseAmount(b.amount) ?? Infinity))
                  .map(option => (
                    <tr key={option.id}>
                      <td><button onClick={() => onOpen(option)}>{option.title}</button></td>
                      <td>{option.details?.supplier || '—'}</td>
                      <td>{formatRupees(option.amount) ?? 'Not quoted'}</td>
                      <td>{option.details?.moq || '—'}</td>
                      <td>{option.details?.leadTime || '—'}</td>
                      <td>{option.status ?? 'Not set'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </section>
  )
}
