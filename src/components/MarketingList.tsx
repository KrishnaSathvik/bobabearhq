import { useMemo } from 'react'
import { ItemRow } from './ItemRow'
import { formatRupees, parseAmount } from '../lib/money'
import type { WorkspaceItem } from '../types'

// Marketing is not only influencers: the section holds print shops, colleges,
// opening promotions and paid ads. What they have in common is the question
// "who could help us reach people, what would they do, and what would it
// cost" — so the view is read down its channels, the way the Menu is read down
// its categories, and every row answers the last two.
//
// Where the conversation stands is written in the record's own notes rather
// than picked from a list, so there is no status column and no filter tabs.

const knownOrder = ['Instagram', 'Print', 'Campus', 'Local page', 'Partnership']

const key = (value: string) => value.trim().toLowerCase()

function rank(channel: string) {
  const index = knownOrder.findIndex(name => key(name) === key(channel))
  return index < 0 ? knownOrder.length : index
}

// The channel is the platform where one is set, and otherwise the drawer the
// record was filed into. It used to be every one of those joined together,
// which is how a print shop filed under Print came to read "Print · Print".
function channelOf(item: WorkspaceItem) {
  return item.details?.platform?.trim() || item.area?.trim() || 'Unsorted'
}

// What this contact would actually do for us. Two facts on one line, in the
// order you weigh them, and absent entirely until somebody has asked — a row
// of dashes says less than a row without them.
function offerOf(item: WorkspaceItem) {
  return [item.details?.reach?.trim(), item.details?.deliverables?.trim()]
    .filter(Boolean).join(' · ')
}

export function MarketingList({ records, selectedId, onOpen }: {
  records: WorkspaceItem[]
  selectedId: string | null
  onOpen: (item: WorkspaceItem) => void
}) {
  const groups = useMemo(() => {
    const byChannel = new Map<string, { label: string; contacts: WorkspaceItem[] }>()
    for (const item of records) {
      const label = channelOf(item)
      const existing = byChannel.get(key(label))
      if (existing) existing.contacts.push(item)
      else byChannel.set(key(label), { label, contacts: [item] })
    }
    return [...byChannel.values()].sort((a, b) =>
      rank(a.label) - rank(b.label) || a.label.localeCompare(b.label))
  }, [records])

  if (records.length === 0) return null

  const contacts = records.length
  // What the whole plan would cost if everyone said yes. A contact nobody has
  // asked for a price is counted as a contact, never as ₹0 — that would be a
  // claim nobody made.
  const quoted = records.filter(item => parseAmount(item.amount) !== null)
  const total = formatRupees(quoted.reduce((sum, item) => sum + (parseAmount(item.amount) ?? 0), 0))

  return (
    <section className="marketing-list" aria-label="Marketing">
      {/* One sentence under the heading, the way every other view opens. */}
      <p className="view-summary">
        {contacts} {contacts === 1 ? 'contact' : 'contacts'}
        {` · ${groups.length} ${groups.length === 1 ? 'channel' : 'channels'}`}
        {quoted.length > 0 && ` · ${total} quoted`}
      </p>

      {groups.map(group => (
        <div className="menu-group" key={group.label}>
          <h2>{group.label}<span>{group.contacts.length}</span></h2>
          <div className="item-list">
            {group.contacts.map(item => (
              <ItemRow key={item.id} item={item} onOpen={onOpen} facts="none" alignForChecks={false}
                showStatus={false} showWhen={false} selected={item.id === selectedId}
                note={offerOf(item)} trailing={formatRupees(item.amount)} />
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}
