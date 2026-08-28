import type { ItemKind } from './types'

// A record page is not a dump of every field that happens to be filled in. The
// spec writes each one as a handful of small headed blocks — PROPERTY, CONTACT,
// COMMERCIAL — because that is how a person reads a property or a supplier:
// the money together, the phone numbers together, the verdict together.
//
// One flat two-column grid could say the same facts, and that is exactly the
// problem the redesign is fixing: it made a location and a drink look like the
// same record with different words in it.

export type DetailGroup = {
  title: string
  keys: string[]
  // The questions this kind of record exists to answer. They print whether or
  // not anyone has answered them, as an em dash.
  //
  // A block that disappears when empty tells you the information does not
  // matter. A block of dashes tells you it matters and nobody has found out
  // yet — which is the difference between a supplier you have vetted and a
  // supplier you have only written the name of. Everything outside this list
  // still behaves as before and shows up only once it is filled in, so the
  // record never becomes a form of twenty-five blanks.
  persistent?: string[]
}

// Ordered. A key named twice would print twice, so each appears once, and
// anything not listed here falls through to the trailing group rather than
// being silently dropped — a field nobody thought about is still the user's.
const groupsByKind: Partial<Record<ItemKind, DetailGroup[]>> = {
  Location: [
    {
      title: 'Property',
      keys: ['monthlyRent', 'deposit', 'sizeSqFt', 'address', 'searchArea', 'frontage', 'floor', 'parking', 'water', 'drainage', 'electrical', 'utilities', 'fbAllowed', 'deliveryAccess', 'fitOut', 'footfall', 'visitDate'],
      persistent: ['monthlyRent', 'deposit', 'sizeSqFt', 'address'],
    },
    // What you decided about the place, which is the column you read across two
    // of them. Blank here means nobody has been yet.
    { title: 'Assessment', keys: ['pros', 'concerns'], persistent: ['pros', 'concerns'] },
    { title: 'Contact', keys: ['contactName', 'phone', 'whatsapp', 'email'], persistent: ['contactName', 'phone'] },
  ],
  Supplier: [
    // The four questions every supplier conversation is actually about, in the
    // order you ask them.
    {
      title: 'Commercial',
      keys: ['moq', 'shippingTerms', 'leadTime', 'paymentTerms', 'reliability', 'labelNotes'],
      persistent: ['moq', 'shippingTerms', 'leadTime', 'paymentTerms'],
    },
    {
      title: 'Contact',
      keys: ['contactName', 'phone', 'whatsapp', 'email', 'website', 'location'],
      persistent: ['contactName', 'phone'],
    },
  ],
  SupplierProduct: [
    { title: 'Product', keys: ['packSize', 'moq', 'leadTime'] },
  ],
  Drink: [
    { title: 'Selling', keys: ['category', 'sizes'], persistent: ['category', 'sizes'] },
    {
      title: 'Recipe',
      keys: ['ingredients', 'flavors', 'flavorCount', 'preparation', 'sweetness'],
      persistent: ['ingredients', 'preparation'],
    },
    { title: 'Supplier', keys: ['supplier'], persistent: ['supplier'] },
    // A drink nobody has tasted is the single most important thing this record
    // can tell you, and it can only tell you by leaving the row standing empty.
    {
      title: 'Test results',
      keys: ['tasteScore', 'flavor', 'texture', 'aftertaste', 'tasteResult', 'tasteNotes', 'tasteDate'],
      persistent: ['tasteResult', 'tasteScore'],
    },
    { title: 'Cost', keys: ['costPerServing'], persistent: ['costPerServing'] },
  ],
  // PURCHASE is the block above these — the summary that prints the price and
  // the total with shipping in large type. Repeating those two numbers in a
  // group of their own would be the third printing of the same rupees.
  Product: [
    { title: 'Requirements', keys: ['category', 'model', 'voltage', 'warranty'], persistent: ['category', 'model'] },
    { title: 'Supplier', keys: ['supplier', 'moq', 'leadTime', 'delivery'], persistent: ['supplier', 'leadTime'] },
    { title: 'Quote', keys: ['shipping'], persistent: ['shipping'] },
  ],
  Influencer: [
    // 'contactStatus' is gone: where an outreach conversation stands is the
    // record's status now, printed once in the heading. Two fields answering
    // "have we heard back?" is the duplication this pass exists to remove.
    { title: 'Channel', keys: ['platform', 'reach'], persistent: ['platform', 'reach'] },
    { title: 'Commercial', keys: ['deliverables'], persistent: ['deliverables'] },
    { title: 'Contact', keys: ['phone', 'whatsapp', 'email'], persistent: ['phone', 'email'] },
  ],
  Sample: [
    { title: 'Sample', keys: ['supplier', 'quantity', 'productCost', 'requestedDate', 'receivedDate'] },
    { title: 'Tasting', keys: ['tasteDate', 'preparation', 'sweetness', 'flavor', 'texture', 'aftertaste', 'tasteScore', 'decision'] },
    { title: 'Checks', keys: ['labelCheck', 'reliability'] },
  ],
  Decision: [
    { title: 'Why', keys: ['why', 'rationale'] },
  ],
  Expense: [
    { title: 'Payment', keys: ['vendor', 'category', 'date', 'paymentStatus', 'amountPaid', 'paymentMethod', 'paidBy', 'referenceNumber'] },
  ],
  Quote: [
    { title: 'Quote', keys: ['vendor', 'category', 'date', 'validUntil', 'taxDelivery', 'paymentTerms'] },
  ],
}

// Fields the record's lead block already prints in large type. Dropping them
// from the groups is not enough on its own: an unlisted key falls through to
// the trailing group, so a field removed from SELLING would simply reappear
// under DETAILS. These are removed outright.
//
// A location is the deliberate exception — the spec repeats its rent and size
// under PROPERTY, because that is the block you read across two properties.
const shownInLead: Partial<Record<ItemKind, string[]>> = {
  Drink: ['planningPriceSmall', 'planningPriceRegular', 'launchPhase'],
  // Printed as WHAT WE MAY BUY, which is the question it answers. It used to
  // fall through to the trailing group and read "Product categories" under
  // DETAILS — the same fact the supplier list leads with, filed as an offcut.
  Supplier: ['categories'],
  Influencer: ['spent'],
  SupplierProduct: ['supplier'],
}

export type DetailSection = { title: string; rows: Array<readonly [string, string]> }

// The trailing group. Named for what it is rather than "Other", because a field
// landing here is a field the shape does not know about yet — not a leftover.
const FALLBACK = 'Details'

export function groupDetails(kind: ItemKind, all: Array<readonly [string, string]>): DetailSection[] {
  const lead = new Set(shownInLead[kind] ?? [])
  const entries = lead.size ? all.filter(([key]) => !lead.has(key)) : all

  const shape = groupsByKind[kind]
  if (!shape) return entries.length ? [{ title: FALLBACK, rows: entries }] : []

  const remaining = new Map(entries)
  const sections = shape.map(group => {
    const rows = group.keys.flatMap(key => {
      const value = remaining.get(key)
      if (value === undefined) return group.persistent?.includes(key) ? [[key, ''] as const] : []
      remaining.delete(key)
      return [[key, value] as const]
    })
    return { title: group.title, rows }
  }).filter(section => section.rows.length > 0)

  // Order is the order the record stored them in, which is the order the form
  // asked for them.
  const leftover = entries.filter(([key]) => remaining.has(key))
  return leftover.length ? [...sections, { title: FALLBACK, rows: leftover }] : sections
}
