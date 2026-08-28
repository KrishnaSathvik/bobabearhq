import { initialStatus, type ItemKind, type Section, type WorkspaceItem } from './types'

// What a record of each shape starts life as, and which shapes belong where.
// This used to live inside App; the editor needs the same answers, and two
// copies of it is how the composer and the saved views drift apart.

// A note is stored in the 'Notes' section, and that section is the Inbox.
export const allSections: Section[] = ['Notes', 'Menu', 'Suppliers', 'Store Setup', 'Marketing', 'Money', 'Library']

// What each section can hold, in the order it thinks about them. A section with
// one kind never asks; the rest ask with their own words, not a type dropdown.
// Decision and File are gone from here. A decision is a note that says what was
// decided and why — giving it an object type made you classify a sentence before
// you could write it. A document is a note with a file on it, and the Library
// indexes attachments wherever they hang, so creating a "Document" was creating
// a second way to do the thing Attach files already does.
//
// Both kinds stay in the type and still render, so records already saved as one
// are untouched. They simply cannot be created any more.
export const sectionKinds: Record<Section, ItemKind[]> = {
  Notes: ['Note'],
  Menu: ['Drink', 'Note'],
  Suppliers: ['Supplier', 'SupplierProduct', 'Sample', 'Note'],
  'Store Setup': ['Product', 'Location', 'Checklist', 'Note'],
  Marketing: ['Influencer', 'Note'],
  Money: ['Quote', 'Expense', 'Note'],
  Library: ['Note'],
}

export const sectionForKind: Partial<Record<ItemKind, Section>> = {
  Note: 'Notes', Decision: 'Notes', Link: 'Notes', File: 'Library',
  Supplier: 'Suppliers', SupplierProduct: 'Suppliers', Sample: 'Suppliers',
  Drink: 'Menu', Product: 'Store Setup', Location: 'Store Setup', Checklist: 'Store Setup',
  Influencer: 'Marketing', Quote: 'Money', Expense: 'Money',
}

// What the Inbox composer offers when you decide, mid-thought, that this is
// actually an expense. The + still opens straight into the writing — this is
// the escape hatch beside it, not a gate in front of it. One line per thing
// the shop actually keeps track of, in the order they come up.
// What a thought turns out to be. Seven shapes, each earning its place by
// carrying something a note cannot: a due state, a rupee total, a rent to
// compare, terms to chase, a spec to weigh, a reply to wait on, a recipe.
export const inboxKinds: ItemKind[] = ['Note', 'Checklist', 'Expense', 'Location', 'Supplier', 'Product', 'Influencer', 'Drink']

// Where a record goes when the composer's type is changed. A note started from
// the Menu is a note about the menu and stays there — the section only moves
// when it cannot hold the chosen shape, which is what happens when an expense
// is started from the Inbox.
export function sectionForComposedKind(kind: ItemKind, current: Section): Section {
  return sectionKinds[current].includes(kind) ? current : sectionForKind[kind] ?? current
}

// The list the composer shows for the section it was opened in. A view already
// knows what it adds, so it offers only its own shapes; the Inbox knows
// nothing, so it offers everything.
export function composerKinds(section: Section): ItemKind[] {
  return section === 'Notes' ? inboxKinds : sectionKinds[section]
}

// The kinds that are writing rather than fields, and carry no status at all. A
// note is not at a stage: it is a thing you wrote. If it turns out to be
// something you have to finish, it becomes a task, and a task has states.
export const writingKinds: ItemKind[] = ['Note', 'Link', 'File', 'Decision']

// The kinds that carry structured Details. Everything else is writing.
export const structuredKinds: ItemKind[] = ['Drink', 'Product', 'Sample', 'Supplier', 'SupplierProduct', 'Influencer', 'Location', 'Quote', 'Expense', 'Checklist']

// Details a record keeps no matter what it turns into: its own next steps, and
// the order it was placed in. Neither is a field of any particular shape.
const KEPT_THROUGH_RETYPE = ['checklist', 'sortOrder']

// Turning a record into something else has to shed what the new shape cannot
// say. A note promoted to a place, filled in with a rent and a frontage and
// then turned back into a note, used to keep all of it — invisible in the
// editor, because a note has no fields, and printed on the record under a
// trailing DETAILS heading: "Monthly rent ₹22,000" on a thought about tapioca.
//
// Only the move *to* writing sheds fields, because that is the one case where
// the answer is certain: writing has no fields at all. Structured to structured
// keeps everything, since a key this shape does not print today may be one it
// prints tomorrow, and quietly deleting somebody's typing is worse than showing
// it in the wrong block.
export function detailsAfterRetype(kind: ItemKind, details?: Record<string, string>): Record<string, string> | undefined {
  if (!details || !writingKinds.includes(kind)) return details
  const kept = Object.fromEntries(Object.entries(details).filter(([key]) => KEPT_THROUGH_RETYPE.includes(key)))
  return Object.keys(kept).length ? kept : undefined
}

// Everything that changes when a record becomes a different kind: where it is
// filed, what word it wears, and which of its fields survive.
export function retype(item: WorkspaceItem, kind: ItemKind, origin: Section): WorkspaceItem {
  const section = sectionForComposedKind(kind, origin)
  const defaults = defaultsForKind(kind)
  const details = detailsAfterRetype(kind, item.details)
  return {
    ...item,
    kind,
    section,
    // A place's "Locations" filing is not a note's filing. Where the new shape
    // has an opinion it wins; where it has none the record starts unfiled
    // rather than keeping a drawer that belonged to what it used to be.
    area: defaults.area,
    status: defaults.status,
    details: details ? { ...defaults.details, ...details } : defaults.details,
  }
}

export function defaultsForKind(kind: ItemKind, area?: string): Pick<WorkspaceItem, 'area' | 'status' | 'details'> {
  return {
    area: area ?? (kind === 'Product' ? 'Equipment' : kind === 'Location' ? 'Locations' : kind === 'Checklist' ? 'Launch Checklist' : kind === 'Quote' ? 'Quote' : kind === 'Expense' ? 'Expense' : kind === 'Influencer' ? 'Influencers' : undefined),
    // The first word of this kind's own vocabulary — 'To visit' on a property,
    // 'Researching' on a supplier — rather than a generic 'New' on everything.
    status: initialStatus(kind),
    // Only what the form cannot work out on its own. Storing the value a select
    // already falls back to made a brand-new record claim a field was filled in.
    // An expense's payment status is stored, not merely shown. The form used
    // to display 'Paid' as a select fallback and write nothing, so the record
    // said one thing on screen and another on disk — and the row, which reads
    // the stored value, could say nothing at all.
    details: (kind === 'Expense' ? { date: new Date().toISOString().slice(0, 10), paymentStatus: 'Paid' }
        : kind === 'Quote' ? { date: new Date().toISOString().slice(0, 10) }
          : undefined) as Record<string, string> | undefined,
  }
}
