import { EquipmentComparison } from './EquipmentComparison'
import { ItemRow, statusIsTelling } from './ItemRow'
import { LaunchChecklist } from './LaunchChecklist'
import { LibraryFiles, libraryCount } from './LibraryFiles'
import { LocationScoutingOverview } from './LocationScoutingOverview'
import { MenuOverview } from './MenuOverview'
import { MarketingList } from './MarketingList'
import { MoneyActivity, MoneyOverview } from './MoneyOverview'
import { SupplierList } from './SupplierList'
import { SupplierSampleOverview } from './SupplierSampleOverview'
import { formatRupees, paidPortion } from '../lib/money'
import { isDone } from '../lib/tasks'
import { initialStatus, isFinished, isWaitingOnSomeoneElse, statusesFor, type ItemKind, type Section, type WorkspaceAttachment, type WorkspaceItem } from '../types'

// The six sections and Store Setup's three jobs used to be tabs. They are
// saved views now, listed under PINNED on the one home screen — a new record
// type does not deserve a new tab, and eight tabs is a dashboard.

export type SavedViewId = 'checklist' | 'menu' | 'suppliers' | 'locations' | 'equipment' | 'money' | 'marketing' | 'library' | 'needs-you'

type SavedView = {
  id: SavedViewId
  label: string
  // Where the floating + puts a record started from inside this view, and what
  // that record is. Pressing Add while looking at the properties should offer a
  // property, not whatever the section happens to lead with.
  section: Section
  addKind: ItemKind
  // What the floating + is called while this view is open. A button that says
  // "Add note" and makes a location is lying to anyone who cannot see the
  // screen it is standing on.
  addAction: string
}

export const savedViews: SavedView[] = [
  { id: 'checklist', label: 'Launch Checklist', section: 'Store Setup', addKind: 'Checklist', addAction: 'Add task' },
  { id: 'menu', label: 'Menu', section: 'Menu', addKind: 'Drink', addAction: 'Add drink' },
  { id: 'suppliers', label: 'Suppliers', section: 'Suppliers', addKind: 'Supplier', addAction: 'Add supplier' },
  { id: 'locations', label: 'Locations', section: 'Store Setup', addKind: 'Location', addAction: 'Add location' },
  { id: 'equipment', label: 'Equipment', section: 'Store Setup', addKind: 'Product', addAction: 'Add equipment' },
  { id: 'money', label: 'Money', section: 'Money', addKind: 'Expense', addAction: 'Add expense' },
  { id: 'marketing', label: 'Marketing', section: 'Marketing', addKind: 'Influencer', addAction: 'Add marketing' },
  // Nothing is created *as* a library item. A document is a note with a file on
  // it, and the Library indexes attachments and saved links wherever they hang.
  { id: 'library', label: 'Library', section: 'Library', addKind: 'Note', addAction: 'Add note' },
]

const STALE_AFTER_DAYS = 7

// What "needs you" means: somebody else has the next move, or you said you were
// doing something a week ago and have not touched it since.
//
// Both halves read a status, so both are silent about a kind that has no
// vocabulary of its own. Marketing retired its words — a record still carrying
// one from before would otherwise be dragged in here forever as "untouched",
// wearing a tick box that writes nothing when pressed.
export function needsYou(item: WorkspaceItem, cutoff: number): boolean {
  if (statusesFor(item.kind).length === 0) return false
  return isWaitingOnSomeoneElse(item.kind, item.status)
    || Boolean(item.status && !isFinished(item.kind, item.status) && item.status !== initialStatus(item.kind)
      && Date.parse(item.updatedAt) < cutoff)
}

// These views are a widget, and the widget says for itself when it is empty.
const widgetOwnsEmptyState = new Set<SavedViewId>(['checklist', 'locations', 'equipment', 'library'])

// What each view is *for*, and how to tell whether it is showing any of it.
//
// A specialised widget that renders nothing used to hand the whole screen back
// to the generic row list, so Marketing holding two marketing notes looked
// exactly like the Inbox — same rows, same everything, only the heading
// different. The widget going quiet is not the view losing its identity: the
// view says what it is for in its own words, offers its own way to add one, and
// then lists whatever else lives here underneath.
const primaryOf: Partial<Record<SavedViewId, { is: (item: WorkspaceItem) => boolean; none: string; hint: string }>> = {
  menu: { is: item => item.kind === 'Drink', none: 'No drinks on the menu yet.', hint: 'Add the drinks you are planning to sell, with what you mean to charge.' },
  suppliers: { is: item => item.kind === 'Supplier', none: 'No suppliers yet.', hint: 'Start with the companies you are considering buying from.' },
  money: { is: item => item.kind === 'Quote' || item.kind === 'Expense', none: 'No quotes or expenses yet.', hint: 'Add each quote and each payment as it happens, so the totals are real.' },
  marketing: { is: item => item.kind === 'Influencer', none: 'No outreach contacts yet.', hint: 'Add anyone who could help you reach people — creators, pages, colleges, print shops.' },
}

export function viewItems(id: SavedViewId, items: WorkspaceItem[]): WorkspaceItem[] {
  switch (id) {
    case 'checklist': return items.filter(item => item.kind === 'Checklist')
    case 'menu': return items.filter(item => item.section === 'Menu')
    case 'suppliers': return items.filter(item => item.section === 'Suppliers')
    case 'locations': return items.filter(item => item.kind === 'Location')
    case 'equipment': return items.filter(item => item.kind === 'Product')
    case 'money': return items.filter(item => item.section === 'Money')
    case 'marketing': return items.filter(item => item.section === 'Marketing')
    case 'library': return items.filter(item => item.section === 'Library')
    case 'needs-you': {
      const cutoff = Date.now() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000
      return items.filter(item => needsYou(item, cutoff))
    }
  }
}

// What the heading counts. Every view counts the records filed into it, except
// the Library, which is a way of finding material rather than a folder of
// records — so it counts the documents and references it actually puts on
// screen. The alternative is a heading that says 8 above a body showing 5.
export function savedViewCount(id: SavedViewId, items: WorkspaceItem[]): number {
  return id === 'library' ? libraryCount(items) : viewItems(id, items).length
}

// The second line of a pin. One fact, in the view's own words — "8 tasks
// remaining" tells you something a count of rows never does.
export function savedViewSummary(id: SavedViewId, items: WorkspaceItem[]): string {
  const own = viewItems(id, items)
  // The Library is the one view that is not a drawer of its own records. It is
  // a way of finding material, and the material hangs off records all over the
  // workspace — a photo on a property, a link inside a note. So it is asked
  // first, before the shortcut below decides the view is empty: that shortcut
  // reads the Library *section*, which can be empty while the Library screen is
  // full, and the pin then said "Nothing yet" over a screen listing nine files.
  if (id === 'library') {
    const references = libraryCount(items)
    return references ? `${references} ${references === 1 ? 'reference' : 'references'}` : 'Nothing yet'
  }
  if (own.length === 0) return 'Nothing yet'
  switch (id) {
    case 'checklist': {
      // How far through the launch we are, not how much is left to dread.
      return `${own.filter(isDone).length} of ${own.length} complete`
    }
    case 'menu': {
      const drinks = own.filter(item => item.kind === 'Drink').length
      return drinks ? `${drinks} launch ${drinks === 1 ? 'drink' : 'drinks'}` : `${own.length} ${own.length === 1 ? 'note' : 'notes'}`
    }
    case 'suppliers': {
      const suppliers = own.filter(item => item.kind === 'Supplier').length
      return suppliers ? `${suppliers} ${suppliers === 1 ? 'supplier' : 'suppliers'}`
        : `${own.length} ${own.length === 1 ? 'record' : 'records'}`
    }
    case 'locations': return `${own.length} ${own.length === 1 ? 'property' : 'properties'}`
    case 'equipment': return `${own.length} ${own.length === 1 ? 'item' : 'items'}`
    case 'money': {
      const spent = own.filter(item => item.kind === 'Expense').reduce((sum, item) => sum + paidPortion(item), 0)
      return `${formatRupees(spent) ?? '₹0'} spent`
    }
    case 'marketing': {
      const contacts = own.filter(item => item.kind === 'Influencer').length
      return contacts ? `${contacts} ${contacts === 1 ? 'contact' : 'contacts'}`
        : `${own.length} ${own.length === 1 ? 'note' : 'notes'}`
    }
    case 'needs-you': return `${own.length} waiting or untouched`
  }
}

export type SavedViewBodyProps = {
  viewId: SavedViewId
  items: WorkspaceItem[]
  selectedId: string | null
  onOpen: (item: WorkspaceItem) => void
  onOpenAttachment: (attachment: WorkspaceAttachment) => void
  resolveUrl: (storagePath: string) => Promise<string>
  // One toggle, everywhere. The box beside a task in the Inbox, the box in the
  // checklist widget and the Done chip in the editor all write the same field,
  // because two ways of ticking one thing is two answers to one question.
  onToggleDone: (item: WorkspaceItem, done: boolean) => Promise<void>
  onAddTask: (title: string) => Promise<void>
  onRenameTask: (task: WorkspaceItem, title: string) => Promise<void>
}

// Each view is its widget, if it has one, and then the plain list of everything
// the widget did not already show.
export function SavedViewBody({
  viewId, items, selectedId, onOpen, onOpenAttachment, resolveUrl,
  onToggleDone, onAddTask, onRenameTask,
}: SavedViewBodyProps) {
  const own = viewItems(viewId, items)
  const primary = primaryOf[viewId]

  // The view above already lists these, so the list below would repeat them.
  // What is left over is the writing filed into a section — a note about the
  // menu, a thought about a supplier — which still has to be reachable, and
  // which the purpose-built view has no column for.
  const alreadyShown = (item: WorkspaceItem) => {
    switch (viewId) {
      case 'checklist': case 'locations': case 'equipment': case 'menu': return true
      case 'suppliers': return item.kind === 'Supplier'
      case 'money': return item.kind === 'Expense' || item.kind === 'Quote'
      case 'marketing': return item.kind === 'Influencer'
      case 'library': return item.kind === 'File'
      default: return false
    }
  }
  const listed = own.filter(item => !alreadyShown(item))

  return (
    <>
      {/* Every other view opens with a sentence saying what it is showing, and
          that sentence is also what puts air between the heading and the first
          row. Needs you had no widget to draw one, so its first row started
          4px under the title while the eight beside it started 20px under. */}
      {viewId === 'needs-you' && own.length > 0 && (
        <p className="view-summary">{own.length} waiting or untouched</p>
      )}
      {viewId === 'checklist' && <LaunchChecklist tasks={own} onToggle={onToggleDone} onRename={onRenameTask} onAdd={onAddTask} />}
      {viewId === 'locations' && <LocationScoutingOverview locations={own} onOpen={onOpen} />}
      {viewId === 'equipment' && <EquipmentComparison products={own} onOpen={onOpen} />}
      {viewId === 'menu' && <MenuOverview items={own} selectedId={selectedId} onOpen={onOpen} />}
      {viewId === 'suppliers' && <SupplierList suppliers={own.filter(item => item.kind === 'Supplier')} items={items} selectedId={selectedId} onOpen={onOpen} />}
      {/* Only once there are samples to track. It used to also appear whenever
          there were no suppliers, which is how a Suppliers screen showing one
          record managed to say "No samples yet." and "No suppliers yet." at
          the same time, one under the other. */}
      {viewId === 'suppliers' && own.some(item => item.kind === 'Sample')
        && <SupplierSampleOverview samples={own.filter(item => item.kind === 'Sample')} />}
      {viewId === 'money' && <MoneyOverview records={own.filter(item => item.kind === 'Quote' || item.kind === 'Expense')} />}
      {viewId === 'money' && <MoneyActivity records={own.filter(item => item.kind === 'Quote' || item.kind === 'Expense')} selectedId={selectedId} onOpen={onOpen} />}
      {viewId === 'marketing' && <MarketingList records={own.filter(item => item.kind === 'Influencer')} selectedId={selectedId} onOpen={onOpen} />}
      {viewId === 'library' && <LibraryFiles items={items} onOpenFile={onOpenAttachment} onOpenParent={onOpen} resolveUrl={resolveUrl} />}

      {/* Only when the screen is genuinely empty. This used to ask whether the
          view held any of its *primary* kind, so Suppliers holding a supplier
          note said "No suppliers yet." directly above that note — and Menu
          holding a menu note said "No drinks on the menu yet." above it. A
          screen with something on it is not empty, whatever kind that
          something happens to be. */}
      {primary && own.length === 0 && <div className="view-summary view-summary-empty">
        <span>{primary.none}</span>
        <em>{primary.hint}</em>
      </div>}

      {listed.length > 0 && <>
        {/* Leftover writing sits under a heading rather than running straight
            on from the view above it, or the two read as one list. */}
        {viewId !== 'needs-you' && <p className="eyebrow">Notes</p>}
        <div className="item-list">
          {listed.map(item => (
            <ItemRow key={item.id} item={item} onOpen={onOpen} showStatus={statusIsTelling(listed)} selected={item.id === selectedId}
              // An action queue answers "what needs attention now", so each row
              // says which part of the shop it belongs to and nothing else.
              facts={viewId === 'needs-you' ? 'kind' : 'full'}
              alignForChecks={viewId === 'needs-you'}
              // A screen that tells you what is unfinished has to be a place you
              // can finish something, or it is only a list of complaints.
              onToggleDone={viewId === 'needs-you' ? onToggleDone : undefined} />
          ))}
        </div>
      </>}

      {own.length === 0 && !widgetOwnsEmptyState.has(viewId) && !primary && (
        <div className="empty-state"><p>Nothing here yet.</p></div>
      )}
    </>
  )
}
