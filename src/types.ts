export type Section = 'Notes' | 'Menu' | 'Suppliers' | 'Store Setup' | 'Marketing' | 'Money' | 'Library'

export type ItemKind = 'Note' | 'Link' | 'File' | 'Expense' | 'Quote' | 'Product' | 'Sample' | 'Location' | 'Checklist' | 'Supplier' | 'Drink' | 'Influencer' | 'SupplierProduct' | 'Decision'

// A status is the one word a record wears in a list, and it should be a word
// from that record's own world. Four generic ones — New, Doing, Waiting, Done —
// were the same four on a property, a supplier and a drink, which is a large
// part of why every screen read like the same screen. "Doing" on a shop you
// have not visited says nothing at all.
//
// So each kind that has a journey gets the words for its own journey, and they
// are kept short: five or six, each one a state somebody would actually say out
// loud. Kinds that are writing — a note, a link, a saved document — get none.
// A thought is not at a stage. If it needs finishing, it becomes a task.

export type StatusPlan = {
  values: readonly string[]
  hints: Readonly<Record<string, string>>
  // What a record of this kind starts as, and the word a list treats as
  // "nothing has happened yet" — worth showing only when the others differ.
  initial: string
  // Terminal. Finished, chosen, or ruled out — all of them mean "not on my
  // plate any more", which is the only question a list needs answered.
  done: readonly string[]
  // The next move belongs to somebody else. This is what "Needs you" reads to
  // tell a waiting supplier apart from one nobody has written to yet.
  waiting: readonly string[]
}

const plan = (values: readonly string[], hints: Record<string, string>, done: readonly string[], waiting: readonly string[] = []): StatusPlan =>
  ({ values, hints, initial: values[0], done, waiting })

// Payment is an expense's only status. It lives here rather than in money.ts so
// there is one table of every word a record can wear.
export const paymentStatuses = ['Planned', 'Committed', 'Part paid', 'Paid', 'Refunded'] as const
export type PaymentStatus = (typeof paymentStatuses)[number]

export const statusPlans: Partial<Record<ItemKind, StatusPlan>> = {
  // The one kind the generic four were always right for: a task is a task.
  Checklist: plan(['New', 'Doing', 'Waiting', 'Done'], {
    New: 'Not looked at yet', Doing: 'You are on it',
    Waiting: 'Waiting on someone else', Done: 'Finished or decided',
  }, ['Done'], ['Waiting']),

  Location: plan(['To visit', 'Considering', 'Shortlisted', 'Rejected', 'Selected'], {
    'To visit': 'Nobody has been yet', Considering: 'Seen it, thinking',
    Shortlisted: 'In the final few', Rejected: 'Ruled out', Selected: 'This is the one',
  }, ['Rejected', 'Selected']),

  Supplier: plan(['Researching', 'Contacted', 'Sampling', 'Approved', 'Rejected'], {
    Researching: 'Found them, not written yet', Contacted: 'Waiting on their reply',
    Sampling: 'Samples asked for or on the way', Approved: 'We would buy from them',
    Rejected: 'Not worth pursuing',
  }, ['Approved', 'Rejected'], ['Contacted', 'Sampling']),

  Product: plan(['Needed', 'Comparing', 'Ordered', 'Received', 'Rejected'], {
    Needed: 'We know we need one', Comparing: 'Weighing up options',
    Ordered: 'Bought, waiting for it', Received: 'It is here', Rejected: 'Not this one',
  }, ['Received', 'Rejected'], ['Ordered']),

  // Marketing carries no status. Where an outreach conversation stands is
  // something you write down — "left a voice note, no reply" says more than any
  // of six words could — and asking for the word as well as the sentence was
  // asking the same question twice. The section holds print shops, colleges and
  // promotions as well as people, and none of them moved through the same six
  // stages anyway.
  //
  // Records saved before this keep whatever word they were given; it is simply
  // no longer read, the same way every other retired vocabulary is left on disk.

  Drink: plan(['Researching', 'Testing', 'Approved', 'Dropped'], {
    Researching: 'On the maybe list', Testing: 'Being tasted and costed',
    Approved: 'On the opening menu', Dropped: 'Not for launch',
  }, ['Approved', 'Dropped']),

  // The sample's own journey, not a verdict on the product. Whether the taste
  // was any good belongs in the tasting notes; this says where the parcel is.
  // 'Ordered' is the wait, because that one is on the supplier.
  Sample: plan(['Needed', 'Ordered', 'Received', 'Tested'], {
    Needed: 'We want one of these', Ordered: 'Asked for, on its way',
    Received: 'It arrived', Tested: 'Tasted and written up',
  }, ['Tested'], ['Ordered']),

  // Whether this actual ingredient has made it into Boba Bear's sourcing.
  SupplierProduct: plan(['Considering', 'Sampling', 'Approved', 'Rejected'], {
    Considering: 'On their list, not chased yet', Sampling: 'Sample asked for or on the way',
    Approved: 'We would buy this', Rejected: 'Not this one',
  }, ['Approved', 'Rejected'], ['Sampling']),

  // The quote itself, and nothing about money leaving the account — that is
  // the expense's job. 'Received' is deliberately not finished: a quote landing
  // is when the decision starts, not when it ends.
  Quote: plan(['Requested', 'Received', 'Accepted', 'Declined', 'Expired'], {
    Requested: 'Asked for, waiting on them', Received: 'It came back, now decide',
    Accepted: 'We are going with this', Declined: 'We said no', Expired: 'Too old to rely on',
  }, ['Accepted', 'Declined', 'Expired'], ['Requested']),

  // An expense's status is its payment and always has been. Saying it twice —
  // once as a payment and once as a workflow — was one question too many.
  Expense: plan(paymentStatuses, {
    Planned: 'Expected, not agreed yet', Committed: 'Agreed and owed',
    'Part paid': 'Some of it has been handed over', Paid: 'Settled in full',
    Refunded: 'Paid and given back',
  }, ['Paid', 'Refunded'], ['Committed', 'Part paid']),
}

// New / Doing / Waiting / Done now exists in exactly one place: a task. That is
// the one kind those four words were ever right for. Everything else that has a
// journey says it in its own words, and everything that is writing says nothing.
//
// Writing carries no status, so this answers with nothing for a note.
export function statusPlanFor(kind: ItemKind): StatusPlan | undefined {
  return statusPlans[kind]
}

export type ItemStatus = string

export function statusesFor(kind: ItemKind): readonly string[] {
  return statusPlanFor(kind)?.values ?? []
}

export function statusHintsFor(kind: ItemKind): Readonly<Record<string, string>> {
  return statusPlanFor(kind)?.hints ?? {}
}

// Terminal for this kind. A rejected property and a selected one are both off
// the list of things to think about.
export function isFinished(kind: ItemKind, status?: string): boolean {
  return Boolean(status && statusPlanFor(kind)?.done.includes(status))
}

export function isWaitingOnSomeoneElse(kind: ItemKind, status?: string): boolean {
  return Boolean(status && statusPlanFor(kind)?.waiting.includes(status))
}

// Every word any workspace has ever stored, mapped to the shape it played in
// the old generic four. Rows are never rewritten on disk — they are translated
// on the way in, so a workspace written last month and one written today read
// the same without a migration that could go wrong.
const legacyRoles: Record<string, 'initial' | 'active' | 'waiting' | 'done'> = {
  New: 'initial', Reference: 'initial', 'Not decided': 'initial', Needed: 'initial',
  Doing: 'active', Researching: 'active', 'Visit planned': 'active', 'Sample needed': 'active',
  Received: 'active', Testing: 'active', Visited: 'active', Comparing: 'active', Shortlisted: 'active',
  Waiting: 'waiting', Requested: 'waiting', Ordered: 'waiting', Deferred: 'waiting',
  Done: 'done', Selected: 'done', Purchased: 'done', Finalized: 'done', Completed: 'done',
  'Not selected': 'done', Rejected: 'done',
}

function roleValue(spec: StatusPlan, role: 'initial' | 'active' | 'waiting' | 'done'): string {
  if (role === 'initial') return spec.initial
  if (role === 'done') return spec.done[0] ?? spec.values[spec.values.length - 1]
  if (role === 'waiting') return spec.waiting[0] ?? spec.values[1] ?? spec.initial
  return spec.values.find(value => value !== spec.initial && !spec.done.includes(value)) ?? spec.initial
}

// A stored word is kept when this kind still uses it — which is most of them,
// because the new vocabularies were chosen from what the shop already said.
// Anything else is translated by the part it played, so a location saved as
// 'Doing' comes back as 'Considering' rather than as nothing at all.
export function normalizeStatus(value: string | null | undefined, kind: ItemKind): ItemStatus | undefined {
  if (!value) return undefined
  const spec = statusPlanFor(kind)
  if (!spec) return undefined
  if (spec.values.includes(value)) return value
  const match = spec.values.find(entry => entry.toLowerCase() === value.toLowerCase())
  if (match) return match
  const role = legacyRoles[value]
  return role ? roleValue(spec, role) : undefined
}

// What a brand-new record of this kind wears.
export function initialStatus(kind: ItemKind): ItemStatus | undefined {
  return statusPlanFor(kind)?.initial
}

// The word this kind uses for "finished with", for the one control that ticks
// something off without opening it.
export function finishedStatus(kind: ItemKind): ItemStatus | undefined {
  const spec = statusPlanFor(kind)
  return spec?.done[0]
}

// One quote can be a quote for a machine *and* come from a supplier, so a
// record needs more than one relation.
export type ItemRelationship = 'Quote for' | 'Expense for' | 'Supplied by' | 'Sample from' | 'Related to' | 'Replaces' | 'Reference for'

export const itemRelationships: ItemRelationship[] = ['Quote for', 'Expense for', 'Supplied by', 'Sample from', 'Related to', 'Replaces', 'Reference for']

export type WorkspaceLink = {
  id: string
  // The record at the other end of the link, never this one.
  itemId: string
  relationship: ItemRelationship
  // 'from' means this record points at the other one, so it is the side the
  // editor can change. 'to' links are shown but edited from the other record.
  direction: 'from' | 'to'
}

export type WorkspaceAttachment = {
  id: string
  name: string
  storagePath: string
  mimeType?: string
  sizeBytes?: number
  createdAt?: string
}

export type WorkspaceItem = {
  id: string
  title: string
  body: string
  kind: ItemKind
  section: Section
  area?: string
  url?: string
  amount?: string
  status?: ItemStatus
  source?: string
  importKey?: string
  details?: Record<string, string>
  attachments?: WorkspaceAttachment[]
  links?: WorkspaceLink[]
  createdAt: string
  updatedAt: string
}
