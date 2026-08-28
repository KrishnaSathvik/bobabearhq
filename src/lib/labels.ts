import type { ItemKind, ItemRelationship, Section } from '../types'

// The database vocabulary is not the shop's vocabulary. Nobody thinks of a cup
// sealer as a "Product" row — it is equipment. Every label a person reads comes
// from here; the stored kind never changes.
//
// Two of these are renames the app earned rather than inherited:
//
//   * a `Checklist` record is a Task. Records now carry checklists of their
//     own, so "Checklist item" had come to mean two different things — a
//     standalone piece of work, and a box inside something else. Task is the
//     first of those and Next steps is the second.
//   * an `Influencer` is Marketing. The section already holds print shops,
//     colleges, opening promotions and paid ads, and none of those is an
//     influencer. The stored kind stays `Influencer` so nothing has to move.
const kindLabels: Record<ItemKind, string> = {
  Note: 'Note',
  Link: 'Web link',
  File: 'Document',
  Drink: 'Drink',
  Product: 'Equipment',
  Sample: 'Supplier sample',
  Supplier: 'Supplier',
  SupplierProduct: 'Product link',
  Influencer: 'Marketing',
  Location: 'Location',
  Checklist: 'Task',
  Quote: 'Quote',
  Expense: 'Expense',
  Decision: 'Decision',
}

// What a saved record can be reclassified into. Decision and File are not
// offered — nothing new is one — but a record already saved as either keeps its
// own kind in the list, so opening it cannot silently turn it into something
// else. See `kindOptions`.
export const editableKinds: ItemKind[] = ['Note', 'Link', 'Drink', 'Supplier', 'SupplierProduct', 'Sample', 'Product', 'Location', 'Influencer', 'Quote', 'Expense', 'Checklist']

export function kindOptions(current: ItemKind): ItemKind[] {
  return editableKinds.includes(current) ? editableKinds : [current, ...editableKinds]
}

export function kindLabel(kind: ItemKind) {
  return kindLabels[kind] ?? kind
}

// Read from the other record, a link reads backwards: the quote is "Quote for"
// the machine, so the machine shows it as "Quote".
const inverseLabels: Record<ItemRelationship, string> = {
  'Quote for': 'Quote',
  'Expense for': 'Expense',
  'Supplied by': 'Supplies',
  'Sample from': 'Sample',
  'Related to': 'Related to',
  Replaces: 'Replaced by',
  'Reference for': 'Reference',
}

export function relationshipLabel(relationship: ItemRelationship, direction: 'from' | 'to') {
  return direction === 'from' ? relationship : inverseLabels[relationship]
}

// Capture no longer belongs to a screen — the bar is on all of them — so the
// screen that used to be Home is just the pile of what has not been filed yet.
// The stored section is still 'Notes', so no record has to move.
export function sectionLabel(section: Section) {
  return section === 'Notes' ? 'Inbox' : section
}

// Where a record lives, named for the pin you would click to find it again.
// 'Store Setup' is a section in the database and nowhere on the screen: a task
// is in the Launch Checklist, a shop is in Locations and a cup sealer is in
// Equipment. Anything that tells a person where something is says it this way.
const viewForKind: Partial<Record<ItemKind, string>> = {
  Checklist: 'Launch Checklist',
  Location: 'Locations',
  Product: 'Equipment',
}

export function viewName(item: { kind: ItemKind; section: Section }) {
  return viewForKind[item.kind] ?? sectionLabel(item.section)
}

// One plain sentence per record type. Nobody should have to guess the
// difference between a supplier, a product link and a sample.
const kindHints: Partial<Record<ItemKind, string>> = {
  Note: 'Just a thought, in your own words',
  Link: 'A page worth coming back to',
  File: 'A document to keep',
  Drink: 'Something you plan to sell',
  Supplier: 'A company you might buy from',
  SupplierProduct: 'Something a supplier sells',
  Sample: 'Something to taste and judge',
  Product: 'A machine or fixture to buy',
  Location: 'A property you are considering',
  Influencer: 'A creator, page or promotion that reaches people',
  Quote: 'A price someone gave you',
  Expense: 'Money you actually spent',
  Checklist: 'A piece of work to finish before opening',
  Decision: 'A choice you made, and why',
}

export function kindHint(kind: ItemKind) {
  return kindHints[kind] ?? ''
}

// "a supplier", "an expense", and "equipment" and "marketing" — which take no
// article at all.
const kindPhrases: Partial<Record<ItemKind, string>> = {
  Product: 'equipment',
  Expense: 'an expense',
  Influencer: 'marketing',
}

export function kindPhrase(kind: ItemKind) {
  return kindPhrases[kind] ?? `a ${kindLabel(kind).toLowerCase()}`
}
