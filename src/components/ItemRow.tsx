import { useState, type ReactNode } from 'react'
import { Check, CupSoda, File as FileIcon, FileText, FlaskConical, Link2, ListChecks, MapPin, Megaphone, Package, Signpost, Truck, Wallet, Wrench } from 'lucide-react'
import { formatIfDate, timeAgo } from '../lib/dates'
import { formatRupees } from '../lib/money'
import { kindLabel } from '../lib/labels'
import { preview } from '../lib/richText'
import { initialStatus, isFinished, statusesFor, type ItemKind, type WorkspaceItem } from '../types'

// Icons, not emoji. 1.75 stroke at 18px is the list weight; the design system
// keeps emoji for what a person actually typed into a note.
const ICON = { size: 18, strokeWidth: 1.75 } as const

export function iconForKind(kind: ItemKind) {
  if (kind === 'Link') return <Link2 {...ICON} />
  if (kind === 'File') return <FileIcon {...ICON} />
  if (kind === 'Expense' || kind === 'Quote') return <Wallet {...ICON} />
  if (kind === 'Product') return <Wrench {...ICON} />
  if (kind === 'Sample') return <FlaskConical {...ICON} />
  if (kind === 'Supplier') return <Truck {...ICON} />
  if (kind === 'SupplierProduct') return <Package {...ICON} />
  if (kind === 'Drink') return <CupSoda {...ICON} />
  if (kind === 'Influencer') return <Megaphone {...ICON} />
  if (kind === 'Location') return <MapPin {...ICON} />
  if (kind === 'Checklist') return <ListChecks {...ICON} />
  if (kind === 'Decision') return <Signpost {...ICON} />
  return <FileText {...ICON} />
}

// A supplier, a quote and a drink are not the same thing, so their rows should
// not read the same. Each kind shows the two or three facts you would actually
// scan for, and falls back to what was written when there are none.
function rowFacts(item: WorkspaceItem): string {
  const details = item.details ?? {}
  const money = (value?: string) => formatRupees(value) ?? ''
  const parts = (() => {
    switch (item.kind) {
      case 'Supplier': return [details.location, details.categories]
      case 'SupplierProduct': return [details.supplier, details.packSize, money(item.amount)]
      case 'Sample': return [details.supplier, details.quantity, money(item.amount)]
      case 'Drink': return [flavourCount(item), [money(details.planningPriceSmall), money(details.planningPriceRegular)].filter(Boolean).join(' / ')]
      case 'Product': return [details.category, details.supplier, money(item.amount)]
      case 'Location': return [details.searchArea || details.address, money(details.monthlyRent)]
      case 'Quote': return [details.vendor, money(item.amount), details.date]
      case 'Expense': return [details.vendor, money(item.amount), details.paymentStatus]
      case 'Influencer': return [details.platform, money(item.amount)]
      case 'Checklist': return []
      default: return []
    }
  })().map(part => formatIfDate((part ?? '').trim())).filter(Boolean)
  // A saved link with nothing written under it left the row half empty and made
  // the list jump between one-line and two-line rows. Where it points is the
  // one fact a link always has.
  return parts.length ? parts.join(' · ') : preview(item.body) || hostOf(item.url)
}

function hostOf(url?: string) {
  if (!url) return ''
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function flavourCount(item: WorkspaceItem) {
  const listed = (item.details?.flavors ?? '').split(/[;,]/).map(part => part.trim()).filter(Boolean).length
  const count = listed || Number(item.details?.flavorCount)
  return Number.isFinite(count) && count > 0 ? `${count} ${item.details?.category === 'Toppings' ? 'toppings' : 'flavours'}` : ''
}

// A screen that tells you what is unfinished has to be a place you can finish
// something, or it is only a list of complaints. The box is the launch
// checklist's box, because ticking a thing off is the same gesture everywhere.
//
// Three lines, in the order the design system fixed them: what it is, the two
// facts you would scan for, and when it last moved. No container — a separator
// under the row is enough, and a list of boxes reads as a dashboard.
// How much of the second line a screen wants:
//
//   'full'  what it is and the two facts you would scan for — the Inbox row.
//   'kind'  what it is, and nothing else — an action queue, where the useful
//           fact is which part of the shop the thing belongs to.
//   'none'  the name alone. Under a heading that already says MILK TEA, every
//           drink repeating "Drink" is a column of the same word, and three
//           lines per drink turns a menu into six screens of scrolling.
//
// Anything but 'full' also drops the timestamp: a catalog is not activity.
export type RowFacts = 'full' | 'kind' | 'none'

export function ItemRow({ item, onOpen, onToggleDone, showStatus = true, showWhen = true, selected = false, facts: detail = 'full', alignForChecks = true, trailing, note }: {
  item: WorkspaceItem
  onOpen: (item: WorkspaceItem) => void
  onToggleDone?: (item: WorkspaceItem, done: boolean) => Promise<void>
  showStatus?: boolean
  showWhen?: boolean
  selected?: boolean
  facts?: RowFacts
  // Whether to hold the checkbox slot open on a row that has no checkbox. True
  // in a mixed list, where it keeps the left edge straight; false in a list
  // where nothing is tickable, where it is only an indent nobody asked for.
  alignForChecks?: boolean
  // One fact worth a column of its own, between the name and the status. The
  // menu uses it for price: what a drink costs is one of the few things worth
  // seeing without opening it, and it belongs in a column you can read down
  // rather than buried in a sentence beside two other facts.
  trailing?: ReactNode
  // A second line the row's own view supplies, where the generic facts do not
  // answer the question that view exists to answer. Marketing uses it for what
  // a contact reaches and what they would make: a row saying only a name and a
  // rupee figure tells you nothing about whether the rupees are worth it.
  note?: ReactNode
}) {
  const [saving, setSaving] = useState(false)
  // An expense's status is its payment, and a paid receipt is not a finished
  // piece of work. Greying it out is the workflow word said in colour instead
  // of in text — which is the one thing a money record must never show.
  const done = isFinished(item.kind, item.status) && item.kind !== 'Expense'
  // A line through the title means "this piece of work is finished". A note, a
  // decision, a document and a link can all be Done without their contents
  // being cancelled, so only a task is struck out. The rest still go muted and
  // keep a filled box, which is what says you have dealt with them.
  const struck = done && item.kind === 'Checklist'
  // "Supplier · Testing", the way the design system writes the second line.
  // A note is never labelled "Note" — it is obviously itself.
  const unstructured = item.kind === 'Note' || item.kind === 'Link' || item.kind === 'File'
  const label = unstructured ? '' : kindLabel(item.kind)
  const facts = detail === 'none' ? ''
    : detail === 'kind' ? label
      : [label, rowFacts(item)].filter(Boolean).join(' · ')
  const when = showWhen && detail === 'full' ? timeAgo(item.updatedAt) : null
  // An expense already says "Paid" in its own facts. The workflow word is read
  // off that payment, so printing both puts the same answer on the row twice.
  // A kind with no vocabulary of its own has no status to print, whatever word
  // an older save happens to be carrying. Marketing is the one that retired its
  // words; the rows must retire them too, or the workspace still shows a state
  // nothing can set any more.
  const showsStatus = showStatus && Boolean(item.status) && item.kind !== 'Expense'
    && statusesFor(item.kind).length > 0
  return (
    <div className={['item-row', detail === 'full' ? '' : 'compact', trailing ? 'has-trailing' : '', done ? 'done' : '', struck ? 'struck' : '', selected ? 'selected' : ''].filter(Boolean).join(' ')}>
      {/* The slot is always the same width, so a row with nothing to tick off
          still lines up with the row above it. */}
      {onToggleDone ? (
        <button className="check-toggle" disabled={saving}
          aria-label={done ? `Mark ${item.title} not done` : `Mark ${item.title} done`}
          onClick={async () => { setSaving(true); try { await onToggleDone(item, !done) } finally { setSaving(false) } }}>
          {done && <Check size={13} strokeWidth={2.5} />}
        </button>
      ) : alignForChecks ? <span className="check-slot" aria-hidden="true" /> : null}
      <button className="item-open" onClick={() => onOpen(item)} aria-current={selected ? 'true' : undefined}>
        <span className="item-copy">
          <strong>{item.title}</strong>
          {facts && <small>{facts}</small>}
          {note && <small>{note}</small>}
          {when && <small className="item-when">Updated {when}</small>}
        </span>
        {trailing && <span className="item-trailing">{trailing}</span>}
        {showsStatus && <span className="item-meta">{item.status}</span>}
      </button>
    </div>
  )
}

// A column where every row says the same thing is decoration — a list of five
// suppliers all marked Researching tells you nothing. Anything past a kind's
// opening word does tell you something, even on its own, so those always show.
export function statusIsTelling(items: WorkspaceItem[]) {
  const stated = items.filter(item => item.status)
  if (stated.length === 0) return false
  if (new Set(stated.map(item => item.status)).size > 1) return true
  return stated[0].status !== initialStatus(stated[0].kind)
}
