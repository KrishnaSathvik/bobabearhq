import { Columns3 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { formatRupees, parseAmount } from '../lib/money'
import { statusesFor, type WorkspaceItem } from '../types'

type Props = {
  locations: WorkspaceItem[]
  onOpen: (item: WorkspaceItem) => void
}

// The things you actually stand in the shop and argue about. No score, no
// ranking, no automatic winner — that decision stays yours.
const comparisonFields: Array<[string, (location: WorkspaceItem) => string | null]> = [
  ['Area', location => location.details?.searchArea || null],
  ['Monthly rent', location => formatRupees(location.details?.monthlyRent)],
  ['Deposit', location => formatRupees(location.details?.deposit)],
  ['Size (sq ft)', location => location.details?.sizeSqFt || null],
  ['Frontage / visibility', location => location.details?.frontage || null],
  ['Student traffic', location => location.details?.footfall || null],
  ['Parking', location => location.details?.parking || null],
  ['Water / power / drainage', location => location.details?.utilities || null],
  ['Delivery access', location => location.details?.deliveryAccess || null],
  ['Fit-out needs', location => location.details?.fitOut || null],
  ['Visit date', location => location.details?.visitDate || null],
  ['Status', location => location.status ?? null],
  ['Pros', location => location.details?.pros || null],
  ['Concerns', location => location.details?.concerns || null],
]

// The same four words, in the same order, and read the same way as the
// equipment list reads them: properties and machines are two piles of options
// being narrowed down, and they were being shown as two different widgets.
// A property's own journey. "To visit" says something a generic "New" cannot:
// nobody has been yet.
const tabs = ['All', ...statusesFor('Location')] as const


// Sizes are stored as a bare number because that is what the form asks for.
// "320" in a column headed SIZE is a number without a unit; "320 sqft" is a
// fact. A value that already carries its own unit is left alone.
function sizeOf(location: WorkspaceItem) {
  const raw = location.details?.sizeSqFt?.trim()
  if (!raw) return null
  return /^[\d.,]+$/.test(raw) ? `${raw} sqft` : raw
}

// "₹19k–₹25k rent" — the spread you are choosing inside, in one glance. Under
// a thousand the shorthand is a lie about the number, so it prints in full.
function shortRupees(amount: number) {
  return amount >= 1000 ? `₹${Math.round(amount / 1000)}k` : formatRupees(amount) ?? '₹0'
}

// The one line above the table. Not a dashboard tile — a sentence saying how
// many properties there are, how many survived the cut, and what they cost.
function summarise(locations: WorkspaceItem[]) {
  const count = `${locations.length} ${locations.length === 1 ? 'property' : 'properties'}`
  // 'Shortlisted' is the status a property being seriously considered carries, and
  // shortlisted is what that means when the thing is a shop.
  const shortlisted = locations.filter(location => location.status === 'Shortlisted').length
  const rents = locations.map(location => parseAmount(location.details?.monthlyRent))
    .filter((rent): rent is number => rent !== null && rent > 0)
  const low = Math.min(...rents)
  const high = Math.max(...rents)
  return [
    count,
    shortlisted > 0 && shortlisted < locations.length ? `${shortlisted} shortlisted` : '',
    rents.length === 0 ? '' : low === high ? `${shortRupees(low)} rent` : `${shortRupees(low)}–${shortRupees(high)} rent`,
  ].filter(Boolean).join(' · ')
}

export function LocationScoutingOverview({ locations, onOpen }: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [comparing, setComparing] = useState(false)
  const [stageFilter, setStageFilter] = useState<string>('All')
  const counts: Record<string, number> = useMemo(() => ({
    All: locations.length,
    ...Object.fromEntries(statusesFor('Location').map(name =>
      [name, locations.filter(item => item.status === name).length])),
  }), [locations])
  const listed = stageFilter === 'All' ? locations : locations.filter(item => item.status === stageFilter)

  const selected = useMemo(() => locations.filter(location => selectedIds.includes(location.id)), [locations, selectedIds])
  const rows = useMemo(() => comparisonFields
    .map(([label, read]) => [label, selected.map(read)] as const)
    .filter(([, values]) => values.some(Boolean)), [selected])

  // No button here. The floating + is already on this screen and already adds a
  // property; a second way to put something on the list is the duplication this
  // pass exists to remove.
  if (locations.length === 0) return <p className="quiet-offer">No properties yet.</p>

  const multiple = locations.length > 1

  return (
    <section className="location-scouting" aria-label="Location scouting">
      <p className="view-summary">{summarise(locations)}</p>

      <div className="comparison-tabs" role="tablist" aria-label="Location status">
        {tabs.map(name => (
          <button key={name} role="tab" aria-selected={stageFilter === name} className={stageFilter === name ? 'comparison-tab active' : 'comparison-tab'}
            onClick={() => setStageFilter(name)}>{name} <span>{counts[name]}</span></button>
        ))}
      </div>

      {multiple && <div className="comparison-toolbar">
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
              <tr><th scope="col">Field</th>{selected.map(location => <th scope="col" key={location.id}><button onClick={() => onOpen(location)}>{location.title}</button></th>)}</tr>
            </thead>
            <tbody>
              {rows.map(([label, values]) => (
                <tr key={label}><th scope="row">{label}</th>{values.map((value, index) => <td key={selected[index].id}>{value ?? '—'}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Filtering to a status nothing holds used to leave the page blank below
          the tabs, with no way to tell an empty filter from a broken screen. */}
      {listed.length === 0
        ? <p className="comparison-empty">No property is marked “{stageFilter}” yet.</p>
        : <div className={multiple ? 'comparison-list property-table selectable' : 'comparison-list property-table'}>
          {/* A property is chosen by comparing five numbers across a column, so
              the column gets a name. Below the table's width the headings would
              be lying about what lines up under them, so CSS hides them and
              each cell says its own name instead. */}
          <div className="property-head" aria-hidden="true">
            {multiple && <span />}
            <span>Property</span>
            <span>Area</span>
            <span>Rent</span>
            <span>Size</span>
            <span>Status</span>
          </div>
          {listed.map(location => {
            const checked = selectedIds.includes(location.id)
            return (
              <div className={checked ? 'comparison-row selected' : 'comparison-row'} key={location.id}>
                <label className="comparison-select" hidden={!multiple}>
                  <input type="checkbox" checked={checked} aria-label={`Select ${location.title} for comparison`}
                    onChange={event => setSelectedIds(current => event.target.checked
                      ? [...current, location.id]
                      : current.filter(id => id !== location.id))} />
                </label>
                <button className="comparison-open" onClick={() => onOpen(location)}>
                  <strong>{location.title}</strong>
                </button>
                <span className="property-area" data-label="Area">{location.details?.searchArea || location.details?.address || '—'}</span>
                <span className="comparison-price" data-label="Rent">{formatRupees(location.details?.monthlyRent) ?? '—'}</span>
                <span className="property-size" data-label="Size">{sizeOf(location) ?? '—'}</span>
                <span className="comparison-status" data-label="Status">{location.status ?? 'Not set'}</span>
              </div>
            )
          })}
        </div>}
    </section>
  )
}
