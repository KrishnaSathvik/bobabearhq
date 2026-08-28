import { statusIsTelling } from './ItemRow'
import type { WorkspaceItem } from '../types'

// Who we are considering buying from, what they can supply, and where we are in
// the process. Three facts, three lines — not a generic row with the same two
// facts every other record shows.
//
// The categories line is what a supplier is actually *for*. It comes from the
// supplier's own field when it has one, and otherwise from the products filed
// against it, because "Tapioca · Popping boba · Taro" is the thing you are
// scanning for and it is already written down somewhere.
function categoriesOf(supplier: WorkspaceItem, items: WorkspaceItem[]) {
  const stated = supplier.details?.categories?.trim()
  if (stated) return stated
  const linked = new Set((supplier.links ?? []).map(link => link.itemId))
  const products = items.filter(item => item.kind === 'SupplierProduct'
    && (linked.has(item.id) || item.details?.supplier?.trim().toLowerCase() === supplier.title.trim().toLowerCase()))
  // Four names is a glance; the rest is a record page.
  return products.slice(0, 4).map(product => product.title).join(' · ')
}

export function SupplierList({ suppliers, items, selectedId, onOpen }: {
  suppliers: WorkspaceItem[]
  items: WorkspaceItem[]
  selectedId: string | null
  onOpen: (item: WorkspaceItem) => void
}) {
  if (suppliers.length === 0) return null

  // A column where every supplier says "New" is decoration, not information.
  const showStatus = statusIsTelling(suppliers)

  return (
    <section className="supplier-list" aria-label="Suppliers">
      <p className="view-summary">{suppliers.length} {suppliers.length === 1 ? 'supplier' : 'suppliers'}</p>
      <div className="item-list">
        {suppliers.map(supplier => {
          const where = supplier.details?.location?.trim()
          const categories = categoriesOf(supplier, items)
          return (
            <div className={supplier.id === selectedId ? 'item-row supplier-row selected' : 'item-row supplier-row'} key={supplier.id}>
              <button className="item-open" onClick={() => onOpen(supplier)} aria-current={supplier.id === selectedId ? 'true' : undefined}>
                <span className="item-copy">
                  <strong>{supplier.title}</strong>
                  {where && <small>{where}</small>}
                  {categories && <small className="supplier-categories">{categories}</small>}
                </span>
                {showStatus && supplier.status && <span className="item-meta">{supplier.status}</span>}
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}
