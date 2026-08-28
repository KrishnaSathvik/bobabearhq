import { Columns3 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { formatRupees, parseAmount } from '../lib/money'
import { preview } from '../lib/richText'
import { statusesFor, type WorkspaceItem } from '../types'

type Props = {
  products: WorkspaceItem[]
  onOpen: (item: WorkspaceItem) => void
}

// Equipment's own words, in the order a machine moves through them. These used
// to be New / Doing / Waiting / Done — the same four the properties list showed,
// which is what made two different jobs look like one screen. "Ordered" and
// "Received" are things you would actually say about a cup sealer.
const tabs = ['All', ...statusesFor('Product')] as const

function totalCost(product: WorkspaceItem) {
  const price = parseAmount(product.amount)
  const shipping = parseAmount(product.details?.shipping)
  if (price === null && shipping === null) return null
  return (price ?? 0) + (shipping ?? 0)
}

// Only the fields that actually help a decision, and only the ones at least one
// of the selected options has filled in. An empty row is noise on a phone.
const comparisonFields: Array<[string, (product: WorkspaceItem) => string | null]> = [
  ['Supplier', product => product.details?.supplier || null],
  ['Product price', product => formatRupees(product.amount)],
  ['Shipping', product => formatRupees(product.details?.shipping)],
  ['Total', product => formatRupees(totalCost(product))],
  ['MOQ', product => product.details?.moq || null],
  ['Lead time', product => product.details?.leadTime || null],
  ['Warranty', product => product.details?.warranty || null],
  ['Voltage', product => product.details?.voltage || null],
  ['Model / size', product => product.details?.model || null],
  ['Status', product => product.status ?? null],
  ['Notes', product => preview(product.body) || null],
]

export function EquipmentComparison({ products, onOpen }: Props) {
  const [tab, setTab] = useState<string>('All')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [comparing, setComparing] = useState(false)

  const counts = useMemo(() => Object.fromEntries(tabs.map(name =>
    [name, name === 'All' ? products.length : products.filter(product => product.status === name).length])), [products])

  const visible = useMemo(() => {
    const pool = tab === 'All' ? products : products.filter(product => product.status === tab)
    // Cheapest first only so the list is easy to scan. Nothing is recommended.
    return [...pool].sort((a, b) => (totalCost(a) ?? Infinity) - (totalCost(b) ?? Infinity))
  }, [products, tab])

  const selected = useMemo(() => products.filter(product => selectedIds.includes(product.id)), [products, selectedIds])
  const rows = useMemo(() => comparisonFields
    .map(([label, read]) => [label, selected.map(read)] as const)
    .filter(([, values]) => values.some(Boolean)), [selected])

  // No Add button: the floating + is on this screen and already adds equipment.
  if (products.length === 0) return <p className="quiet-offer">No equipment yet.</p>

  const summary = `${products.length} ${products.length === 1 ? 'item' : 'items'}`
  const quoted = products.map(totalCost).filter((cost): cost is number => cost !== null)
  const estimated = quoted.reduce((sum, cost) => sum + cost, 0)

  return (
    <section className="equipment-comparison" aria-label="Equipment">
      {/* What the whole pile costs, before any of it is bought. That is the
          question the equipment list exists to answer. */}
      <p className="view-summary">{[summary, quoted.length ? `${formatRupees(estimated)} estimated` : ''].filter(Boolean).join(' · ')}</p>

      <div className="comparison-tabs" role="tablist" aria-label="Equipment status">
        {tabs.map(name => (
          <button key={name} role="tab" aria-selected={tab === name} className={tab === name ? 'comparison-tab active' : 'comparison-tab'}
            onClick={() => setTab(name)}>{name} <span>{counts[name]}</span></button>
        ))}
      </div>

      {visible.length > 1 && <div className="comparison-toolbar">
        <span>{selectedIds.length ? `${selectedIds.length} selected` : 'Select two or more to compare'}</span>
        <span className="comparison-toolbar-actions">
          {selectedIds.length > 0 && <button className="link-button" onClick={() => { setSelectedIds([]); setComparing(false) }}>Clear</button>}
          <button className="compare-button" disabled={selectedIds.length < 2} onClick={() => setComparing(value => !value)}>
            <Columns3 size={15} /> {comparing ? 'Hide comparison' : 'Compare'}
          </button>
        </span>
      </div>}

      {comparing && selected.length >= 2 && (
        <div className="comparison-scroll">
          <table className="compare-table">
            <thead>
              <tr><th scope="col">Field</th>{selected.map(option => <th scope="col" key={option.id}><button onClick={() => onOpen(option)}>{option.title}</button></th>)}</tr>
            </thead>
            <tbody>
              {rows.map(([label, values]) => (
                <tr key={label}><th scope="row">{label}</th>{values.map((value, index) => <td key={selected[index].id}>{value ?? '—'}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {visible.length === 0
        ? <p className="comparison-empty">No equipment is marked “{tab}” yet.</p>
        : <div className={products.length > 1 ? 'comparison-list equipment-table selectable' : 'comparison-list equipment-table'}>
          <div className="equipment-head" aria-hidden="true">
            {products.length > 1 && <span />}
            <span>Item</span>
            <span>Estimate</span>
            <span>Status</span>
          </div>
          {visible.map(product => {
            const checked = selectedIds.includes(product.id)
            return (
              <div className={checked ? 'comparison-row selected' : 'comparison-row'} key={product.id}>
                <label className="comparison-select" hidden={products.length < 2}>
                  <input type="checkbox" checked={checked} aria-label={`Select ${product.title} for comparison`}
                    onChange={event => setSelectedIds(current => event.target.checked
                      ? [...current, product.id]
                      : current.filter(id => id !== product.id))} />
                </label>
                <button className="comparison-open" onClick={() => onOpen(product)}>
                  <strong>{product.title}</strong>
                  <small>{[product.details?.category, product.details?.supplier].filter(Boolean).join(' · ') || 'No supplier yet'}</small>
                </button>
                <span className="comparison-price" data-label="Estimate">{formatRupees(totalCost(product)) ?? 'Not quoted'}</span>
                <span className="comparison-status" data-label="Status">{product.status ?? 'Not set'}</span>
              </div>
            )
          })}
        </div>}
    </section>
  )
}
