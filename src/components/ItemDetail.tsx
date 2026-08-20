import { ArrowLeft, ExternalLink, FileText, Package, Paperclip, Pencil } from 'lucide-react'
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
}

export function ItemDetail({ item, onBack, onEdit, onOpenAttachment }: ItemDetailProps) {
  const isWebLink = Boolean(item.url && /^https?:\/\//i.test(item.url))
  const details = Object.entries(item.details ?? {}).filter(([, value]) => value.trim())

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
          <div><small>Current price / quote</small><strong>{item.amount ? `₹${Number(item.amount).toLocaleString('en-IN')}` : 'Not added yet'}</strong></div>
        </section>}

        {details.length > 0 && <dl className="detail-grid">
          {details.map(([key, value]) => <div key={key}><dt>{detailLabels[key] ?? key}</dt><dd>{value}</dd></div>)}
        </dl>}

        {isWebLink && <a className="primary-link" href={item.url} target="_blank" rel="noreferrer">Open product page <ExternalLink size={16} /></a>}

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
