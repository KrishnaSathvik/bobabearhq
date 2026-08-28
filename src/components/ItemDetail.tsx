import { useMemo, useState, type ReactNode } from 'react'
import { ArrowLeft, Check, CupSoda, ExternalLink, FileText, FlaskConical, ListChecks, MapPin, Megaphone, MoreHorizontal, Package, Plus, Wallet, X } from 'lucide-react'
import { AttachmentPhoto, AttachmentThumb, isImageAttachment } from './AttachmentThumb'
import { NoteBody } from './NoteBody'
import { RecordChecklist } from './RecordChecklist'
import { groupDetails } from '../detailShapes'
import { formatDate, formatIfDate, timeAgo } from '../lib/dates'
import { kindLabel, relationshipLabel, sectionLabel } from '../lib/labels'
import { formatRupees, parseAmount } from '../lib/money'
import { plainText } from '../lib/richText'
import { isDone, readTasks, type RecordTask } from '../lib/tasks'
import { itemRelationships, statusesFor, type ItemRelationship, type WorkspaceAttachment, type WorkspaceItem } from '../types'

type ItemDetailProps = {
  item: WorkspaceItem
  items: WorkspaceItem[]
  showBack: boolean
  // Where Back goes, when it goes anywhere other than the list behind it.
  backLabel: string
  onBack: () => void
  onMore: () => void
  onEdit: () => void
  // The workspace header, on the screens that do not already have one above
  // this. A record fills the window on a phone, and a page that opens on a bare
  // back arrow does not look like part of the app.
  header?: ReactNode
  onOpenRelated: (id: string) => void
  onOpenAttachment: (attachment: WorkspaceAttachment) => void
  resolveUrl: (storagePath: string) => Promise<string>
  onTasksChange: (tasks: RecordTask[]) => Promise<void>
  // Ticking a box written inside the note saves the writing, not a field.
  onBodyChange: (body: string) => Promise<void>
  onLink: (link: { itemId: string; relationship: ItemRelationship }) => Promise<void>
  onUnlink: (linkId: string) => Promise<void>
}

const detailLabels: Record<string, string> = {
  category: 'Category', supplier: 'Supplier', model: 'Model / size', moq: 'MOQ',
  leadTime: 'Lead time', delivery: 'Delivery', warranty: 'Warranty / service',
  shipping: 'Shipping (₹)', voltage: 'Voltage / power',
  quantity: 'Sample quantity', productCost: 'Product cost (₹)', reliability: 'Supplier reliability',
  decision: 'Decision', tasteDate: 'Taste date', preparation: 'Preparation used',
  sweetness: 'Sweetness', flavor: 'Flavor', texture: 'Texture', aftertaste: 'Aftertaste',
  costPerServing: 'Cost per serving (₹)', amountPaid: 'Paid so far (₹)', fitOut: 'Fit-out needs',
  requestedDate: 'Order date', receivedDate: 'Arrival date', labelCheck: 'Label / FSSAI check',
  tasteScore: 'Taste rating', searchArea: 'Area', address: 'Property / address',
  contactName: 'Contact name', phone: 'Phone', monthlyRent: 'Monthly rent (₹)', deposit: 'Deposit (₹)',
  sizeSqFt: 'Size (sq ft)', frontage: 'Frontage / visibility', visitDate: 'Visit date', footfall: 'Student footfall',
  parking: 'Parking / access', utilities: 'Water / power / drainage', deliveryAccess: 'Delivery pickup access',
  pros: 'Pros', concerns: 'Concerns',
  completed: 'Completed',
  floor: 'Floor', water: 'Water', drainage: 'Drainage', electrical: 'Electrical',
  fbAllowed: 'F&B allowed', website: 'Website', paidBy: 'Paid by', why: 'Why',
  location: 'Location', whatsapp: 'WhatsApp', email: 'Email', categories: 'Product categories',
  shippingTerms: 'Shipping terms', paymentTerms: 'Payment terms', labelNotes: 'FSSAI / label notes',
  flavorCount: 'Planning flavors', planningPriceSmall: 'Planning price — small (₹)',
  planningPriceRegular: 'Planning price — regular (₹)', launchPhase: 'Launch phase',
  flavors: 'Flavours', sizes: 'Sizes', ingredients: 'Ingredients', tasteResult: 'Taste result',
  tasteNotes: 'Tasting notes', packSize: 'Pack size', platform: 'Platform',
  reach: 'Audience / reach', deliverables: 'Deliverables',
  spent: 'Actually spent (₹)',
  vendor: 'Vendor / paid to', date: 'Date', validUntil: 'Valid until', taxDelivery: 'Tax / delivery',
  paymentStatus: 'Payment', paymentMethod: 'Payment method',
  referenceNumber: 'Receipt / invoice number',
}

// What the link on a record is, in the record's own words. The editor already
// asks for "Website" on a supplier and "Instagram or profile link" on a
// marketing contact; the page that reads them back used to call all of it
// "Open product page", which is only true of equipment.
function linkLabel(item: Pick<WorkspaceItem, 'kind' | 'url'>): string {
  switch (item.kind) {
    case 'Location': return /(?:google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google)/i.test(item.url ?? '')
      ? 'Open in Maps' : 'Open listing'
    case 'Supplier': return 'Open website'
    case 'Influencer': return 'Open profile'
    case 'Product': case 'SupplierProduct': return 'Open product page'
    case 'Sample': return 'Open supplier product page'
    case 'File': return 'Open document'
    case 'Drink': return 'Open source'
    // Not "open the payment": the link on a receipt is the paperwork behind it.
    case 'Expense': case 'Quote': return 'Open receipt or invoice'
    default: return 'Open link'
  }
}

// Fields the labels already call rupees should read as rupees, not as a bare
// number the eye has to convert.
const moneyKeys = new Set(['planningPriceSmall', 'planningPriceRegular', 'costPerServing', 'shipping',
  'productCost', 'monthlyRent', 'deposit', 'amountPaid', 'spent'])

export function ItemDetail({ item, items, showBack, backLabel, onBack, onMore, header, onEdit, onOpenRelated, onOpenAttachment, resolveUrl, onTasksChange, onBodyChange, onLink, onUnlink }: ItemDetailProps) {
  const related = (item.links ?? [])
    .map(link => ({ link, other: items.find(candidate => candidate.id === link.itemId) }))
    .filter((entry): entry is { link: NonNullable<WorkspaceItem['links']>[number]; other: WorkspaceItem } => Boolean(entry.other))
  const isWebLink = Boolean(item.url && /^https?:\/\//i.test(item.url))
  const photos = (item.attachments ?? []).filter(isImageAttachment)
  const documents = (item.attachments ?? []).filter(attachment => !isImageAttachment(attachment))
  const details = Object.entries(item.details ?? {})
    .filter(([key, value]) => key !== 'sortOrder' && key !== 'checklist' && value.trim())
    .map(([key, value]) => [key,
      moneyKeys.has(key) ? formatRupees(value) ?? value : formatIfDate(value)] as const)

  // Link and File are Notes that happened to carry a URL or an attachment, so
  // all three are still shapeless as far as this row is concerned.
  const unstructured = item.kind === 'Note' || item.kind === 'Link' || item.kind === 'File'
  const isStructured = !unstructured && item.kind !== 'Decision'
  const sections = groupDetails(item.kind, details)
  // A decision is a thing you look back at, so it is stamped with the day it
  // was made rather than with how long ago it moved.
  const decidedOn = item.kind === 'Decision' ? formatDate(item.createdAt) : null
  // Products filed against this supplier, whether they were linked explicitly
  // or simply typed its name into their own supplier field.
  const supplies = item.kind === 'Supplier'
    ? items.filter(candidate => candidate.kind === 'SupplierProduct'
      && ((item.links ?? []).some(link => link.itemId === candidate.id)
        || candidate.details?.supplier?.trim().toLowerCase() === item.title.trim().toLowerCase()))
    : []
  // The reason a supplier is on the list is written down twice over: as their
  // own `categories` line, and — later, once anyone has filed one — as product
  // records. The list view already reads the first. Requiring the second before
  // the record would say what a supplier sells is what made opening Tea Planet
  // less informative than the row you tapped to get there.
  //
  // Products win where they exist, because they carry a price and a status the
  // categories line cannot; the categories fill in until they do.
  const namedSupplies = item.kind === 'Supplier' && supplies.length === 0
    ? (item.details?.categories ?? '').split(/[·,;\n]/)
      .map(name => name.trim())
      .filter(Boolean)
      // "popping boba, tapioca, milk-tea powders" is one sentence chopped up.
      // Printed as a list, each entry starts a line and reads as a name.
      .map(name => name[0].toUpperCase() + name.slice(1))
    : []
  // A captured note's title was taken from its own first words, so printing it
  // as a headline above the same sentence makes you read the thought twice.
  // When the title is nothing the body does not already say, the body is the
  // heading — which is how a note looks in a notebook.
  const titleEchoesBody = unstructured
    && plainText(item.body).trim().toLowerCase().startsWith(item.title.trim().toLowerCase().replace(/…$/, ''))

  return (
    <article className="detail-page">
      {/* Two controls. Everything else about this record is reached by
          tapping the thing itself, or from the sheet behind the •••. */}
      {header}

      <div className="detail-toolbar">
        {showBack
          ? <button className="detail-back" onClick={onBack} aria-label={backLabel ? `Back to ${backLabel}` : 'Back'}>
            <ArrowLeft size={20} strokeWidth={1.75} />{backLabel && <span>{backLabel}</span>}
          </button>
          : <span />}
        {/* Two controls. Reading a record is not the moment to add one, so the
            + that used to sit here is gone; everything else this record can
            have done to it is behind the •••. */}
        <button className="icon-button" onClick={onMore} aria-label="More actions" aria-haspopup="dialog"><MoreHorizontal size={20} strokeWidth={1.75} /></button>
      </div>

      <div className="detail-document">
        <div className="detail-heading">
          <div className="detail-kicker">{item.area ?? sectionLabel(item.section)}</div>
          {!titleEchoesBody && <h1>{item.title}</h1>}
          {/* "Note" on a note is a label for a thing that is obviously itself. */}
          {/* "Location · Considering · Updated 20 min ago" — what it is, where
              it stands and when it last moved, in one quiet line. The workspace
              does not record who made the change, so the line does not claim to. */}
          <p className="detail-meta">
            {[
              unstructured ? null : kindLabel(item.kind),
              // An expense's status is its payment, and the payment block below
              // already says it. "Paid · Done" is one answer printed twice. A
              // kind that retired its vocabulary — marketing — prints nothing,
              // whatever word an older save is still carrying.
              item.kind === 'Expense' || statusesFor(item.kind).length === 0 ? null : item.status,
              decidedOn ?? (timeAgo(item.updatedAt) && `Updated ${timeAgo(item.updatedAt)}`),
            ].filter(Boolean).join(' · ')}
          </p>
        </div>

        {/* No edit mode: tapping the writing opens it for writing, which is
            the whole of §16 of the UI spec. */}
        {/* On a note the writing is the record, so it leads. On a supplier or a
            property it is one block among several and reads after the facts,
            which is why it moves down the page for those. */}
        {!isStructured && (item.body
          ? <NoteBody body={item.body} lead={titleEchoesBody} onEdit={onEdit} onChange={onBodyChange} />
          : <button className="detail-body detail-body-empty" onClick={onEdit}>Add a note…</button>)}

        {item.kind === 'Product' && <section className="product-summary" aria-label="Product comparison details">
          <div className="product-summary-icon"><Package size={20} /></div>
          <div><small>Product price</small><strong>{formatRupees(item.amount) ?? 'Not added yet'}</strong></div>
          {parseAmount(item.details?.shipping) !== null && <div><small>Total with shipping</small><strong>{formatRupees((parseAmount(item.amount) ?? 0) + (parseAmount(item.details?.shipping) ?? 0))}</strong></div>}
        </section>}

        {item.kind === 'Drink' && <section className="product-summary" aria-label="Drink planning details">
          <div className="product-summary-icon"><CupSoda size={20} /></div>
          <div><small>Planning price</small><strong>{[formatRupees(item.details?.planningPriceSmall), formatRupees(item.details?.planningPriceRegular)].filter(Boolean).join(' / ') || 'Not set yet'}</strong></div>
          {/* A drink is on the opening menu unless it was deliberately pushed
              to Phase 2, so the summary says so without needing the field set. */}
          <div><small>Launch phase</small><strong>{item.details?.launchPhase ?? 'Opening menu'}</strong></div>
        </section>}

        {item.kind === 'Influencer' && <section className="product-summary" aria-label="Influencer outreach">
          <div className="product-summary-icon"><Megaphone size={20} /></div>
          <div><small>Quoted cost</small><strong>{formatRupees(item.amount) ?? 'Not quoted'}</strong></div>
          {/* Nothing sets this any more — what was really paid is an expense in
              Money, where it counts towards the totals. Records written before
              that still show what they were given rather than losing it, but a
              record that never had one no longer reads "₹0.00" for ever. */}
          {formatRupees(item.details?.spent) && <div><small>Actually spent</small><strong>{formatRupees(item.details?.spent)}</strong></div>}
        </section>}

        {item.kind === 'SupplierProduct' && <section className="product-summary" aria-label="Supplier product details">
          <div className="product-summary-icon"><Package size={20} /></div>
          <div><small>Price</small><strong>{formatRupees(item.amount) ?? 'Not quoted'}</strong></div>
          {item.details?.supplier && <div><small>Supplier</small><strong>{item.details.supplier}</strong></div>}
        </section>}

        {item.kind === 'Sample' && <section className="product-summary" aria-label="Supplier sample details">
          <div className="product-summary-icon"><FlaskConical size={20} /></div>
          <div><small>Sample + delivery cost</small><strong>{formatRupees(item.amount) ?? 'Not added yet'}</strong></div>
        </section>}

        {item.kind === 'Location' && <section className="product-summary" aria-label="Location scouting details">
          <div className="product-summary-icon"><MapPin size={20} /></div>
          <div><small>Monthly rent</small><strong>{formatRupees(item.details?.monthlyRent) ?? 'Not added yet'}</strong></div>
          {item.details?.sizeSqFt && <div><small>Size</small><strong>{/^[\d.,]+$/.test(item.details.sizeSqFt.trim()) ? `${item.details.sizeSqFt.trim()} sqft` : item.details.sizeSqFt}</strong></div>}
          {(item.details?.address || item.details?.searchArea) && <div><small>Where</small><strong>{item.details.address || item.details.searchArea}</strong></div>}
        </section>}

        {item.kind === 'Checklist' && <section className="product-summary" aria-label="Checklist status">
          <div className="product-summary-icon">{isDone(item) ? <Check size={20} /> : <ListChecks size={20} />}</div>
          <div><small>Task status</small><strong>{isDone(item) ? 'Completed' : 'Not completed'}</strong></div>
        </section>}

        {(item.kind === 'Expense' || item.kind === 'Quote') && <section className="product-summary" aria-label="Money record amount">
          <div className="product-summary-icon"><Wallet size={20} strokeWidth={1.75} /></div>
          <div><small>{item.kind === 'Quote' ? 'Quoted amount' : 'Expense amount'}</small><strong>{formatRupees(item.amount) ?? 'Not added yet'}</strong></div>
        </section>}

        {/* The reason a supplier is on the list at all. These are records in
            their own right, so each one opens rather than being dead text. */}
        {item.kind === 'Supplier' && (supplies.length > 0 || namedSupplies.length > 0) && <section className="detail-section supplier-catalogue">
          <h2>What we may buy</h2>
          {supplies.map(product => (
            <button key={product.id} className="supplier-catalogue-row" onClick={() => onOpenRelated(product.id)}>
              <span>{product.title}</span>
              {[formatRupees(product.amount), product.status].filter(Boolean).length > 0
                && <small>{[formatRupees(product.amount), product.status].filter(Boolean).join(' · ')}</small>}
            </button>
          ))}
          {/* A category is not a record, so it does not pretend to open one. */}
          {namedSupplies.map(name => <p className="supplier-catalogue-name" key={name}>{name}</p>)}
        </section>}

        {/* PROPERTY, CONTACT, COMMERCIAL — a record is read in blocks, not as
            one undifferentiated grid of every field that happens to be set. */}
        {sections.map(section => (
          <section className="detail-section" key={section.title}>
            <h2>{section.title}</h2>
            <dl className="detail-grid">
              {/* An em dash is the record saying "we still need to find this
                  out". A missing row would have said it did not matter. */}
              {section.rows.map(([key, value]) => (
                <div key={key} className={value ? undefined : 'detail-unanswered'}>
                  <dt>{detailLabels[key] ?? key}</dt><dd>{value || '—'}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}

        {isWebLink && <a className="primary-link" href={item.url} target="_blank" rel="noreferrer">{linkLabel(item)} <ExternalLink size={16} /></a>}

        {item.kind === 'File' && !isWebLink && item.url && <section className="file-reference"><FileText size={19} /><div><small>Referenced file</small><strong>{item.url}</strong></div></section>}

        {isStructured && <>
          <h2 className="detail-body-heading">Notes</h2>
          {item.body
            ? <NoteBody body={item.body} lead={false} onEdit={onEdit} onChange={onBodyChange} />
            : <button className="detail-body detail-body-empty" onClick={onEdit}>Add a note…</button>}
        </>}

        {/* A launch task does not get a list of its own — that is a subtask,
            and the Launch Checklist is where a plan belongs. Everything else
            has two or three moves attached to it, and this is where they live:
            on the record, ticked in place, saved as you go.
            This used to be hidden until the record was marked Done, which meant
            a supplier could only grow a checklist after you had declared
            yourself finished with it — exactly backwards. A record that is work
            carries its next steps from the moment it exists.
            A note is the exception, and not because it cannot have a checklist:
            it is where a checklist most obviously belongs. It belongs in the
            writing, though, typed with ☑︎ while the thought is still being had.
            Offering a second, record-level list beside it is the two-offers
            problem again — so on a note this appears only once there are steps
            on it, which happens when a note is given a shape. */}
        {item.kind !== 'Checklist' && !(unstructured && readTasks(item).length === 0)
          && <RecordChecklist item={item} onChange={onTasksChange} quietWhenEmpty={item.kind === 'Decision'} />}

        {/* Photographs and paperwork are not the same thing to look at. A
            storefront photo is read by looking at it; a PDF quote is read by
            opening it. They used to share one list of 40px squares, which
            served the second and wasted the first. */}
        {photos.length > 0 && <section className="detail-photos">
          <h2>{photos.length === 1 ? 'Photo' : 'Photos'}</h2>
          <div className="photo-grid">
            {photos.map(attachment => (
              <AttachmentPhoto key={attachment.id} attachment={attachment} resolveUrl={resolveUrl}
                onOpen={() => onOpenAttachment(attachment)} />
            ))}
          </div>
        </section>}

        {documents.length > 0 && <section className="detail-attachments">
          <h2>Files</h2>
          {documents.map(attachment => (
            <button key={attachment.id} onClick={() => onOpenAttachment(attachment)}>
              <AttachmentThumb attachment={attachment} resolveUrl={resolveUrl} />
              <span>{attachment.name}</span>
            </button>
          ))}
        </section>}

        {/* Reading a record is when you know what it belongs to, so this is
            where connections are made — not three folds deep in the editor.
            But a thought you typed into the Inbox is writing, and an empty
            CONNECTED heading with an offer under it turned three words into a
            page of chrome. On writing, the block appears once there is
            something in it; joining a note to a record is still done from the
            editor, where the rest of a note's structure lives. */}
        {(!unstructured || related.length > 0) && (
          <ConnectedRecords item={item} items={items} related={related}
            onOpenRelated={onOpenRelated} onLink={onLink} onUnlink={onUnlink} />
        )}

        {/* The heading already says when this last moved, so the footer is
            only for the one fact that has nowhere else to go. */}
        {item.source && <footer className="detail-footer">
          <div><span>Source</span><strong>{item.source}</strong></div>
        </footer>}
      </div>
    </article>
  )
}


function ConnectedRecords({ item, items, related, onOpenRelated, onLink, onUnlink }: {
  item: WorkspaceItem
  items: WorkspaceItem[]
  related: Array<{ link: NonNullable<WorkspaceItem['links']>[number]; other: WorkspaceItem }>
  onOpenRelated: (id: string) => void
  onLink: (link: { itemId: string; relationship: ItemRelationship }) => Promise<void>
  onUnlink: (linkId: string) => Promise<void>
}) {
  const [adding, setAdding] = useState(false)
  const [relationship, setRelationship] = useState<ItemRelationship>('Related to')
  const [targetId, setTargetId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const candidates = useMemo(() => items
    .filter(candidate => candidate.id !== item.id && !related.some(entry => entry.other.id === candidate.id))
    .sort((a, b) => a.section.localeCompare(b.section) || a.title.localeCompare(b.title)), [items, item.id, related])

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save that connection.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="detail-related">
      <h2>Connected</h2>
      {related.length === 0 && !adding && <p className="detail-related-empty">Nothing is connected to this yet.</p>}
      {related.map(({ link, other }) => (
        <div className="detail-related-row" key={link.id}>
          <button className="detail-related-open" onClick={() => onOpenRelated(other.id)}>
            <span>{other.title}</span>
            <small>{relationshipLabel(link.relationship, link.direction)} · {kindLabel(other.kind)} · {sectionLabel(other.section)}</small>
          </button>
          {/* A link belongs to the record that made it. From the other end it is
              shown but not undone, which is why only one side offers this. */}
          {link.direction === 'from' && (
            <button className="detail-related-remove" disabled={busy} aria-label={`Disconnect ${other.title}`}
              onClick={() => run(() => onUnlink(link.id))}><X size={15} /></button>
          )}
        </div>
      ))}
      {adding
        ? <div className="detail-connect">
          <label>Relationship<select value={relationship} onChange={e => setRelationship(e.target.value as ItemRelationship)}>
            {itemRelationships.map(name => <option key={name}>{name}</option>)}
          </select></label>
          <label>Record<select value={targetId} onChange={e => setTargetId(e.target.value)}>
            <option value="">Choose a record</option>
            {candidates.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.title} — {kindLabel(candidate.kind)} · {sectionLabel(candidate.section)}</option>)}
          </select></label>
          <div className="detail-connect-actions">
            <button className="link-button" onClick={() => { setAdding(false); setTargetId(''); setError('') }}>Cancel</button>
            <button className="compare-button" disabled={!targetId || busy}
              onClick={() => run(async () => {
                await onLink({ itemId: targetId, relationship })
                setTargetId('')
                setAdding(false)
              })}>{busy ? 'Connecting…' : 'Connect'}</button>
          </div>
        </div>
        : <button className="detail-connect-open" onClick={() => setAdding(true)}><Plus size={15} /> Connect a record</button>}
      {error && <p className="checklist-error" role="alert">{error}</p>}
    </section>
  )
}
