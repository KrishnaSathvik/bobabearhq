import { useMemo } from 'react'
import { ItemRow, statusIsTelling } from './ItemRow'
import { formatRupees } from '../lib/money'
import type { WorkspaceItem } from '../types'

// A flat list of twenty-two drinks throws away the one piece of structure the
// menu already has. Milk tea, fruit tea and lassi are how the menu is read on
// the wall and how it is argued about, so they are how it is listed here.
const knownOrder = ['Milk tea', 'Fruit tea', 'Boba lassi', 'Toppings']

// Somebody will type "Milk Tea" and somebody else "milk tea", and those are one
// category. The first spelling seen wins the heading.
const key = (value: string) => value.trim().toLowerCase()

// What a drink costs, in the two sizes it is sold in. A lassi has one price
// and prints one; a topping has none and prints nothing, rather than a dash
// standing in for a decision nobody has made yet.
function price(drink: WorkspaceItem) {
  const sizes = [formatRupees(drink.details?.planningPriceSmall), formatRupees(drink.details?.planningPriceRegular)].filter(Boolean)
  return sizes.length ? sizes.join(' / ') : null
}

function rank(category: string) {
  const index = knownOrder.findIndex(name => key(name) === key(category))
  return index < 0 ? knownOrder.length : index
}

export function MenuOverview({ items, selectedId, onOpen }: {
  items: WorkspaceItem[]
  selectedId: string | null
  onOpen: (item: WorkspaceItem) => void
}) {
  const groups = useMemo(() => {
    const byCategory = new Map<string, { label: string; drinks: WorkspaceItem[] }>()
    const loose: WorkspaceItem[] = []
    for (const item of items) {
      if (item.kind !== 'Drink') { loose.push(item); continue }
      // A drink with no category still has to be somewhere it can be found.
      const label = item.details?.category?.trim() || item.area?.trim() || 'Uncategorised'
      const existing = byCategory.get(key(label))
      if (existing) existing.drinks.push(item)
      else byCategory.set(key(label), { label, drinks: [item] })
    }
    const ordered = [...byCategory.values()].sort((a, b) =>
      rank(a.label) - rank(b.label) || a.label.localeCompare(b.label))
    return { ordered, loose }
  }, [items])

  if (!groups.ordered.length && !groups.loose.length) return null

  const drinks = groups.ordered.reduce((count, group) => count + group.drinks.length, 0)

  return (
    <section className="menu-groups" aria-label="Menu by category">
      {/* What we are actually planning to sell, in one number. */}
      {drinks > 0 && <p className="view-summary">{drinks} launch {drinks === 1 ? 'drink' : 'drinks'}</p>}
      {groups.ordered.map(group => (
        <div className="menu-group" key={group.label}>
          <h2>{group.label}<span>{group.drinks.length}</span></h2>
          <div className="item-list">
            {group.drinks.map(drink => (
              <ItemRow key={drink.id} item={drink} onOpen={onOpen} facts="none" alignForChecks={false}
                trailing={price(drink)}
                showStatus={statusIsTelling(group.drinks)} selected={drink.id === selectedId} />
            ))}
          </div>
        </div>
      ))}
      {groups.loose.length > 0 && (
        <div className="menu-group" key="__notes">
          <h2>Notes<span>{groups.loose.length}</span></h2>
          <div className="item-list">
            {groups.loose.map(item => (
              <ItemRow key={item.id} item={item} onOpen={onOpen} alignForChecks={false}
                showStatus={statusIsTelling(groups.loose)} selected={item.id === selectedId} />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
