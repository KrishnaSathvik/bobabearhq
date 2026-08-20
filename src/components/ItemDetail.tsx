import { ArrowLeft, Check, DollarSign, ExternalLink, FileText, FlaskConical, ListChecks, MapPin, Package, Paperclip, Pencil } from 'lucide-react'
import { formatRupees } from '../lib/money'
import type { WorkspaceItem } from '../types'

type ItemDetailProps = {
  item: WorkspaceItem
  onBack: () => void
  onEdit: () => void
  onOpenAttachment: (path: string) => Promise<void>
}

const detailLabels: Record<string, string> = {
  category: 'Category', supplier: 'Supplier', model: 'Model / size', moq: 'MOQ',
  leadTime: 'Lead time', delivery: 'Delivery', warranty: 'Warranty / service',
  requestedDate: 'Requested date', receivedDate: 'Received date', labelCheck: 'Label / FSSAI check',
  tasteScore: 'Taste score', searchArea: 'Search area', address: 'Property / address',
  contactName: 'Contact name', phone: 'Phone', monthlyRent: 'Monthly rent (₹)', deposit: 'Deposit (₹)',
  sizeSqFt: 'Size (sq ft)', frontage: 'Frontage', visitDate: 'Visit date', footfall: 'Student footfall',
  parking: 'Parking / access', utilities: 'Water / power / drainage', deliveryAccess: 'Delivery pickup access',
  pros: 'Pros', concerns: 'Concerns',
  phase: 'Phase', completed: 'Completed',
  vendor: 'Vendor / paid to', date: 'Date', validUntil: 'Valid until', taxDelivery: 'Tax / delivery',
  expenseType: 'Record type', paymentStatus: 'Payment status', paymentMethod: 'Payment method',
  referenceNumber: 'Receipt / invoice number',
}

export function ItemDetail({ item, onBack, onEdit, onOpenAttachment }: ItemDetailProps) {
  const isWebLink = Boolean(item.url && /^https?:\/\//i.test(item.url))
  const details = Object.entries(item.details ?? {}).filter(([key, value]) => key !== 'sortOrder' && value.trim()).map(([key, value]) => [key, key === 'completed' ? (value === 'true' ? 'Yes' : 'No') : value] as const)

  return (
    <article className="detail-page">
      <div className="detail-toolbar">
        <button className="detail-back" onClick={onBack}><ArrowLeft size={18} /> Back to {item.section}</button>
        <button className="detail-edit" onClick={onEdit}><Pencil size={15} /> Edit</button>
      </div>

      <div className="detail-document">
        <div className="detail-heading">
          <div className="detail-kicker">{item.area ?? item.section}</div>
          <h1>{item.title}</h1>
          <div className="detail-badges">
            {item.status && <span>{item.status}</span>}
            <span>{item.kind}</span>
          </div>
        </div>

        {item.body && <div className="detail-body">{item.body}</div>}

        {item.kind === 'Product' && <section className="product-summary" aria-label="Product comparison details">
          <div className="product-summary-icon"><Package size={20} /></div>
          <div><small>Current price / quote</small><strong>{formatRupees(item.amount) ?? 'Not added yet'}</strong></div>
        </section>}

        {item.kind === 'Sample' && <section className="product-summary" aria-label="Supplier sample details">
          <div className="product-summary-icon"><FlaskConical size={20} /></div>
          <div><small>Sample + delivery cost</small><strong>{formatRupees(item.amount) ?? 'Not added yet'}</strong></div>
        </section>}

        {item.kind === 'Location' && <section className="product-summary" aria-label="Location scouting details">
          <div className="product-summary-icon"><MapPin size={20} /></div>
          <div><small>Current monthly rent quote</small><strong>{formatRupees(item.details?.monthlyRent) ?? 'Not added yet'}</strong></div>
        </section>}

        {item.kind === 'Checklist' && <section className="product-summary" aria-label="Checklist status">
          <div className="product-summary-icon">{item.details?.completed === 'true' ? <Check size={20} /> : <ListChecks size={20} />}</div>
          <div><small>Task status</small><strong>{item.details?.completed === 'true' ? 'Completed' : 'Not completed'}</strong></div>
        </section>}

        {(item.kind === 'Expense' || item.kind === 'Quote') && <section className="product-summary" aria-label="Money record amount">
          <div className="product-summary-icon"><DollarSign size={20} /></div>
          <div><small>{item.kind === 'Quote' ? 'Quoted amount' : 'Expense amount'}</small><strong>{formatRupees(item.amount) ?? 'Not added yet'}</strong></div>
        </section>}

        {details.length > 0 && <dl className="detail-grid">
          {details.map(([key, value]) => <div key={key}><dt>{detailLabels[key] ?? key}</dt><dd>{value}</dd></div>)}
        </dl>}

        {isWebLink && <a className="primary-link" href={item.url} target="_blank" rel="noreferrer">{item.kind === 'Location' ? 'Open map or listing' : item.kind === 'Sample' ? 'Open supplier product page' : item.kind === 'Expense' || item.kind === 'Quote' ? 'Open reference link' : 'Open product page'} <ExternalLink size={16} /></a>}

        {item.kind === 'File' && !isWebLink && item.url && <section className="file-reference"><FileText size={19} /><div><small>Referenced file</small><strong>{item.url}</strong></div></section>}

        {item.attachments && item.attachments.length > 0 && <section className="detail-attachments">
          <h2>Files</h2>
          {item.attachments.map(attachment => <button key={attachment.id} onClick={() => onOpenAttachment(attachment.storagePath)}><Paperclip size={16} /><span>{attachment.name}</span></button>)}
        </section>}

        <footer className="detail-footer">
          {item.source && <div><span>Source</span><strong>{item.source}</strong></div>}
          <div><span>Last updated</span><strong>{new Date(item.updatedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong></div>
        </footer>
      </div>
    </article>
  )
}
