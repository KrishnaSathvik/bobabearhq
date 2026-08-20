import { useMemo, useRef, useState } from 'react'
import { DollarSign, File as FileIcon, FileText, FlaskConical, Image, Link2, ListChecks, MapPin, Menu as MenuIcon, Package, Paperclip, Plus, Search, X } from 'lucide-react'
import { ItemDetail } from './components/ItemDetail'
import { LaunchChecklist } from './components/LaunchChecklist'
import { LocationScoutingOverview } from './components/LocationScoutingOverview'
import { MoneyOverview } from './components/MoneyOverview'
import { SupplierSampleOverview } from './components/SupplierSampleOverview'
import { sectionAreas, starterItems } from './data'
import { useWorkspaceItems } from './hooks/useWorkspaceItems'
import type { ItemKind, ItemStatus, Section, WorkspaceItem } from './types'

const sections: Array<'Home' | Section> = ['Home', 'Notes', 'Menu', 'Suppliers', 'Store Setup', 'Marketing', 'Money', 'Library']

function createId() {
  return crypto.randomUUID()
}

export default function App() {
  const [active, setActive] = useState<'Home' | Section>('Home')
  const { items, loading, error, saveItem: persistItem, deleteItem: persistDelete, getAttachmentUrl, deleteAttachment, importReferencePack, importSupplierSamples, importLocationPlan, importLaunchChecklist } = useWorkspaceItems()
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [editing, setEditing] = useState<WorkspaceItem | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)

  const visibleItems = useMemo(() => {
    const base = items.filter(item => item.section === active)
    const needle = query.trim().toLowerCase()
    if (!needle) return base
    return base.filter(item => [...[item.title, item.body, item.section, item.area, item.url, item.status, item.source], ...Object.values(item.details ?? {})].some(value => value?.toLowerCase().includes(needle)))
  }, [active, items, query])
  const selectedItem = selectedId ? items.find(item => item.id === selectedId) ?? null : null

  async function saveItem(item: WorkspaceItem, files?: File[]) {
    await persistItem(item, files)
    setComposerOpen(false)
    setEditing(null)
  }

  function openNew(section?: Section, kind: ItemKind = 'Note', body = '', file?: File) {
    const capturedUrl = kind === 'Link' ? body : undefined
    setEditing({
      id: createId(), title: '', body: capturedUrl ? '' : body, url: capturedUrl, kind,
      section: section ?? 'Notes', area: kind === 'Product' ? 'Equipment' : kind === 'Location' ? 'Locations' : kind === 'Checklist' ? 'Launch Checklist' : kind === 'Quote' ? 'Quote' : kind === 'Expense' ? 'Expense' : undefined,
      status: kind === 'Sample' ? 'Sample needed' : kind === 'Location' || kind === 'Checklist' || kind === 'Quote' ? 'Researching' : undefined,
      details: kind === 'Checklist' ? { phase: 'Planning', completed: 'false' } : kind === 'Quote' ? { category: 'Equipment', date: new Date().toISOString().slice(0, 10), vendor: '' } : kind === 'Expense' ? { category: 'Equipment', date: new Date().toISOString().slice(0, 10), expenseType: 'Purchase', paymentStatus: 'Paid', vendor: '' } : undefined,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    })
    setPendingFiles(file ? [file] : [])
    setComposerOpen(true)
  }

  const [pendingFiles, setPendingFiles] = useState<File[]>([])

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="mobile-menu" aria-label="Open navigation" onClick={() => setMobileOpen(v => !v)}><MenuIcon size={21} /></button>
        <button className="brand" onClick={() => { setActive('Home'); setSelectedId(null) }}>Boba Bear HQ</button>
        <nav className={mobileOpen ? 'nav nav-open' : 'nav'} aria-label="Main navigation">
          {sections.map(section => (
            <button key={section} className={active === section ? 'nav-item active' : 'nav-item'} onClick={() => { setActive(section); setSelectedId(null); setMobileOpen(false); setQuery('') }}>{section}</button>
          ))}
        </nav>
        <div className="top-actions">
          <button className="icon-button" aria-label="Search" onClick={() => setSearchOpen(v => !v)}><Search size={25} strokeWidth={1.7} /></button>
          <button className="avatar" aria-label="Shared account">B</button>
        </div>
      </header>

      {searchOpen && (
        <div className="global-search">
          <Search size={18} />
          <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search everything…" />
          <button aria-label="Close search" onClick={() => { setSearchOpen(false); setQuery('') }}><X size={18} /></button>
        </div>
      )}

      <main>
        {error && <div className="workspace-error" role="alert">{error}</div>}
        {loading && <div className="workspace-loading">Opening your workspace…</div>}
        {!loading && (selectedItem ? <ItemDetail item={selectedItem} onBack={() => setSelectedId(null)}
          onEdit={() => { setEditing(selectedItem); setComposerOpen(true) }}
          onOpenAttachment={async path => { window.open(await getAttachmentUrl(path), '_blank', 'noopener,noreferrer') }} />
          : active === 'Home' ? <Home onCreate={openNew} /> : (
            <SectionPage section={active} items={visibleItems} allItems={items.filter(item => item.section === active)} query={query} setQuery={setQuery}
              onNew={() => openNew(active)} onNewProduct={() => openNew('Store Setup', 'Product')}
              onNewSample={() => openNew('Suppliers', 'Sample')}
              onNewLocation={() => openNew('Store Setup', 'Location')}
              onNewChecklist={() => openNew('Store Setup', 'Checklist')}
              onNewQuote={() => openNew('Money', 'Quote')}
              onNewExpense={() => openNew('Money', 'Expense')}
              onOpen={item => setSelectedId(item.id)} onImport={importReferencePack}
              onImportSamples={importSupplierSamples}
              onImportLocations={importLocationPlan}
              onImportChecklist={importLaunchChecklist}
              onToggleChecklist={async (item, completed) => persistItem({ ...item, details: { ...item.details, completed: String(completed) }, updatedAt: new Date().toISOString() })}
              hasReferencePack={items.some(item => Boolean(item.importKey))} />
          ))}
      </main>

      {composerOpen && editing && <Editor item={editing} pendingFiles={pendingFiles} onFilesChange={setPendingFiles}
        onOpenAttachment={async path => { window.open(await getAttachmentUrl(path), '_blank', 'noopener,noreferrer') }}
        onDeleteAttachment={attachment => deleteAttachment(editing.id, attachment)}
        onClose={() => { setComposerOpen(false); setEditing(null); setPendingFiles([]) }} onSave={saveItem}
        onDelete={async () => { await persistDelete(editing.id); setSelectedId(null); setComposerOpen(false); setEditing(null); setPendingFiles([]) }} />}
    </div>
  )
}

function Home({ onCreate }: { onCreate: (section?: Section, kind?: ItemKind, body?: string, file?: File) => void }) {
  const [text, setText] = useState('')
  const [kind, setKind] = useState<ItemKind>('Note')
  const fileRef = useRef<HTMLInputElement>(null)

  function save() {
    if (!text.trim()) return
    const value = text.trim()
    const detectedKind = /^https?:\/\//i.test(value) ? 'Link' : kind
    onCreate(undefined, detectedKind, value)
    setText('')
  }

  return (
    <section className="home">
      <h1>Home</h1>
      <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Start writing, paste a product link, or drop a file here…" aria-label="Quick capture" />
      <div className="capture-actions">
        <button className={kind === 'File' ? 'capture-tool selected' : 'capture-tool'} onClick={() => fileRef.current?.click()} aria-label="Attach file"><Paperclip /></button>
        <button className={kind === 'Link' ? 'capture-tool selected' : 'capture-tool'} onClick={() => setKind('Link')} aria-label="Save link"><Link2 /></button>
        <button className="capture-tool" onClick={() => setKind('File')} aria-label="Add image"><Image /></button>
        <button className="save-button" disabled={!text.trim()} onClick={save}>Save</button>
        <input ref={fileRef} type="file" hidden accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.html"
          onChange={e => { const file = e.target.files?.[0]; if (file) { onCreate('Library', 'File', '', file); e.target.value = '' } }} />
      </div>
      <p>Choose where it belongs after saving.</p>
    </section>
  )
}

function SectionPage({ section, items, allItems, query, setQuery, onNew, onNewProduct, onNewSample, onNewLocation, onNewChecklist, onNewQuote, onNewExpense, onOpen, onImport, onImportSamples, onImportLocations, onImportChecklist, onToggleChecklist, hasReferencePack }: { section: Section; items: WorkspaceItem[]; allItems: WorkspaceItem[]; query: string; setQuery: (value: string) => void; onNew: () => void; onNewProduct: () => void; onNewSample: () => void; onNewLocation: () => void; onNewChecklist: () => void; onNewQuote: () => void; onNewExpense: () => void; onOpen: (item: WorkspaceItem) => void; onImport: () => Promise<void>; onImportSamples: () => Promise<void>; onImportLocations: () => Promise<void>; onImportChecklist: () => Promise<void>; onToggleChecklist: (item: WorkspaceItem, completed: boolean) => Promise<void>; hasReferencePack: boolean }) {
  const [importing, setImporting] = useState(false)
  const [importMessage, setImportMessage] = useState('')
  return (
    <section className="section-page">
      <div className="section-heading">
        <div><p className="eyebrow">Workspace</p><h1>{section}</h1></div>
        <div className="section-actions">{section === 'Store Setup' && <><button className="minimal-add" onClick={onNewLocation}><MapPin size={16} /> Add location</button><button className="minimal-add" onClick={onNewProduct}><Package size={16} /> Add equipment</button></>}{section === 'Suppliers' && <button className="minimal-add" onClick={onNewSample}><FlaskConical size={16} /> Add sample</button>}<button className="minimal-add" onClick={onNew}><Plus size={17} /> Add</button></div>
      </div>
      <div className="section-search"><Search size={18} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder={`Search ${section.toLowerCase()}…`} /></div>
      {section === 'Library' && !hasReferencePack && <div className="reference-import">
        <div><strong>Bring in the Boba Bear reference pack</strong><p>Add the useful parts of your existing documents across every tab. Nothing will be marked as final.</p></div>
        <button disabled={importing} onClick={async () => { setImporting(true); setImportMessage(''); try { await onImport(); setImportMessage('Reference pack added.') } catch (reason) { setImportMessage(reason instanceof Error ? reason.message : 'Could not import the reference pack.') } finally { setImporting(false) } }}>{importing ? 'Adding…' : 'Add references'}</button>
      </div>}
      {importMessage && <p className="import-message">{importMessage}</p>}
      {section === 'Suppliers' && <SupplierSampleOverview samples={allItems.filter(item => item.kind === 'Sample')} onAdd={onNewSample} onAddStarterPlan={onImportSamples} />}
      {section === 'Store Setup' && <LocationScoutingOverview locations={allItems.filter(item => item.kind === 'Location')} onAdd={onNewLocation} onAddStarterPlan={onImportLocations} />}
      {section === 'Store Setup' && <LaunchChecklist tasks={items.filter(item => item.kind === 'Checklist')} onAdd={onNewChecklist} onAddStarterPlan={onImportChecklist} onOpen={onOpen} onToggle={onToggleChecklist} />}
      {section === 'Money' && <MoneyOverview records={allItems.filter(item => item.kind === 'Quote' || item.kind === 'Expense')} onAddQuote={onNewQuote} onAddExpense={onNewExpense} />}
      <div className="item-list">
        {items.filter(item => item.kind !== 'Checklist').length === 0 ? (section === 'Store Setup' ? null : <div className="empty-state"><p>Nothing here yet.</p><button onClick={onNew}>Add the first item</button></div>) : items.filter(item => item.kind !== 'Checklist').map(item => (
          <button className="item-row" key={item.id} onClick={() => onOpen(item)}>
            <span className="item-icon">{item.kind === 'Link' ? <Link2 size={18} /> : item.kind === 'File' ? <FileIcon size={18} /> : item.kind === 'Expense' || item.kind === 'Quote' ? <DollarSign size={18} /> : item.kind === 'Product' ? <Package size={18} /> : item.kind === 'Sample' ? <FlaskConical size={18} /> : item.kind === 'Location' ? <MapPin size={18} /> : item.kind === 'Checklist' ? <ListChecks size={18} /> : <FileText size={18} />}</span>
            <span className="item-copy"><strong>{item.title}</strong><small>{item.body}</small></span>
            <span className="item-meta">{item.status && <em>{item.status}</em>}{['Product', 'Sample', 'Expense', 'Quote'].includes(item.kind) && item.amount ? `₹${Number(item.amount).toLocaleString('en-IN')} · ` : ''}{item.area ?? item.section}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

function Editor({ item, pendingFiles, onFilesChange, onOpenAttachment, onDeleteAttachment, onClose, onSave, onDelete }: {
  item: WorkspaceItem; pendingFiles: File[]; onFilesChange: (files: File[]) => void;
  onOpenAttachment: (path: string) => Promise<void>; onDeleteAttachment: (attachment: NonNullable<WorkspaceItem['attachments']>[number]) => Promise<void>; onClose: () => void;
  onSave: (item: WorkspaceItem, files?: File[]) => Promise<void>; onDelete: () => Promise<void>
}) {
  const [draft, setDraft] = useState(item)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [attachmentError, setAttachmentError] = useState('')
  const isExisting = starterItems.some(x => x.id === item.id) || Boolean(item.title)
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form className="editor" onMouseDown={e => e.stopPropagation()} onSubmit={async e => { e.preventDefault(); if (!draft.title.trim()) return; setSaving(true); setSaveError(''); try { await onSave({ ...draft, updatedAt: new Date().toISOString() }, pendingFiles) } catch (reason) { setSaveError(reason instanceof Error ? reason.message : 'Could not save this item.'); setSaving(false) } }}>
        <div className="editor-top"><span>{isExisting ? 'Edit item' : 'Add to workspace'}</span><button type="button" onClick={onClose}><X size={20} /></button></div>
        <input className="title-input" autoFocus value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="Title" />
        <textarea className="body-input" value={draft.body} onChange={e => setDraft({ ...draft, body: e.target.value })} placeholder="Write anything…" />
        <div className="editor-fields">
          <label>Type<select value={draft.kind} onChange={e => setDraft({ ...draft, kind: e.target.value as ItemKind })}><option>Note</option><option>Link</option><option>File</option><option>Expense</option><option>Quote</option><option>Product</option><option>Sample</option><option>Location</option><option>Checklist</option></select></label>
          <label>Belongs to<select value={draft.section} onChange={e => setDraft({ ...draft, section: e.target.value as Section, area: '' })}>{sections.filter(s => s !== 'Home').map(s => <option key={s}>{s}</option>)}</select></label>
          <label>Area<select value={draft.area ?? ''} onChange={e => setDraft({ ...draft, area: e.target.value })}><option value="">Choose later</option>{sectionAreas[draft.section]?.map(area => <option key={area}>{area}</option>)}</select></label>
          <label>Status<select value={draft.status ?? ''} onChange={e => setDraft({ ...draft, status: (e.target.value || undefined) as ItemStatus | undefined })}><option value="">Not set</option><option>Reference</option><option>Researching</option><option>Sample needed</option><option>Requested</option><option>Ordered</option><option>Received</option><option>Testing</option><option>Visited</option><option>Shortlisted</option><option>Selected</option><option>Not selected</option></select></label>
        </div>
        {(draft.kind === 'Link' || draft.kind === 'File' || draft.kind === 'Product' || draft.kind === 'Sample' || draft.kind === 'Location' || draft.kind === 'Quote' || draft.kind === 'Expense') && <input className="url-input" value={draft.url ?? ''} onChange={e => setDraft({ ...draft, url: e.target.value })} placeholder={draft.kind === 'Location' ? 'Google Maps or listing link' : draft.kind === 'Quote' || draft.kind === 'Expense' ? 'Optional product, invoice, or payment link' : draft.kind === 'Product' || draft.kind === 'Sample' ? 'Product page link' : 'Paste link or file reference'} />}
        {(draft.kind === 'Expense' || draft.kind === 'Quote' || draft.kind === 'Product' || draft.kind === 'Sample') && <label className="amount-field">{draft.kind === 'Product' ? 'Price / quote (₹)' : draft.kind === 'Sample' ? 'Sample + delivery cost (₹)' : draft.kind === 'Quote' ? 'Quoted amount (₹)' : 'Expense amount (₹)'}<input type="number" min="0" step="0.01" value={draft.amount ?? ''} onChange={e => setDraft({ ...draft, amount: e.target.value })} placeholder="0.00" /></label>}
        {draft.kind === 'Product' && <div className="product-fields">
          <label>Category<input value={draft.details?.category ?? ''} onChange={e => setDraft({ ...draft, details: { ...draft.details, category: e.target.value } })} placeholder="Cup sealer, blender…" /></label>
          <label>Supplier<input value={draft.details?.supplier ?? ''} onChange={e => setDraft({ ...draft, details: { ...draft.details, supplier: e.target.value } })} placeholder="Supplier name" /></label>
          <label>Model / size<input value={draft.details?.model ?? ''} onChange={e => setDraft({ ...draft, details: { ...draft.details, model: e.target.value } })} placeholder="Model or capacity" /></label>
          <label>MOQ<input value={draft.details?.moq ?? ''} onChange={e => setDraft({ ...draft, details: { ...draft.details, moq: e.target.value } })} placeholder="Minimum order" /></label>
          <label>Lead time<input value={draft.details?.leadTime ?? ''} onChange={e => setDraft({ ...draft, details: { ...draft.details, leadTime: e.target.value } })} placeholder="Delivery estimate" /></label>
          <label>Warranty / service<input value={draft.details?.warranty ?? ''} onChange={e => setDraft({ ...draft, details: { ...draft.details, warranty: e.target.value } })} placeholder="Local service details" /></label>
        </div>}
        {draft.kind === 'Sample' && <div className="product-fields">
          <label>Supplier<input value={draft.details?.supplier ?? ''} onChange={e => setDraft({ ...draft, details: { ...draft.details, supplier: e.target.value } })} placeholder="Tea Planet, QQS…" /></label>
          <label>Product / category<input value={draft.details?.category ?? ''} onChange={e => setDraft({ ...draft, details: { ...draft.details, category: e.target.value } })} placeholder="Flavor, powder, jelly…" /></label>
          <label>Requested date<input type="date" value={draft.details?.requestedDate ?? ''} onChange={e => setDraft({ ...draft, details: { ...draft.details, requestedDate: e.target.value } })} /></label>
          <label>Received date<input type="date" value={draft.details?.receivedDate ?? ''} onChange={e => setDraft({ ...draft, details: { ...draft.details, receivedDate: e.target.value } })} /></label>
          <label>MOQ<input value={draft.details?.moq ?? ''} onChange={e => setDraft({ ...draft, details: { ...draft.details, moq: e.target.value } })} placeholder="Minimum order" /></label>
          <label>Lead time<input value={draft.details?.leadTime ?? ''} onChange={e => setDraft({ ...draft, details: { ...draft.details, leadTime: e.target.value } })} placeholder="Delivery time" /></label>
          <label>Label / FSSAI check<select value={draft.details?.labelCheck ?? ''} onChange={e => setDraft({ ...draft, details: { ...draft.details, labelCheck: e.target.value } })}><option value="">Not checked</option><option>Looks complete</option><option>Needs clarification</option><option>Not acceptable</option><option>Not applicable</option></select></label>
          <label>Taste score<input type="number" min="1" max="10" value={draft.details?.tasteScore ?? ''} onChange={e => setDraft({ ...draft, details: { ...draft.details, tasteScore: e.target.value } })} placeholder="1–10" /></label>
        </div>}
        {draft.kind === 'Location' && <div className="product-fields">
          <label>Search area<input value={draft.details?.searchArea ?? ''} onChange={e => setDraft({ ...draft, details: { ...draft.details, searchArea: e.target.value } })} placeholder="Kaviraj Nagar…" /></label>
          <label>Property / address<input value={draft.details?.address ?? ''} onChange={e => setDraft({ ...draft, details: { ...draft.details, address: e.target.value } })} placeholder="Address or landmark" /></label>
          <label>Contact name<input value={draft.details?.contactName ?? ''} onChange={e => setDraft({ ...draft, details: { ...draft.details, contactName: e.target.value } })} placeholder="Owner or broker" /></label>
          <label>Phone<input value={draft.details?.phone ?? ''} onChange={e => setDraft({ ...draft, details: { ...draft.details, phone: e.target.value } })} placeholder="Contact number" /></label>
          <label>Monthly rent (₹)<input type="number" min="0" value={draft.details?.monthlyRent ?? ''} onChange={e => setDraft({ ...draft, details: { ...draft.details, monthlyRent: e.target.value } })} placeholder="Current quote" /></label>
          <label>Deposit (₹)<input type="number" min="0" value={draft.details?.deposit ?? ''} onChange={e => setDraft({ ...draft, details: { ...draft.details, deposit: e.target.value } })} placeholder="Current quote" /></label>
          <label>Size (sq ft)<input value={draft.details?.sizeSqFt ?? ''} onChange={e => setDraft({ ...draft, details: { ...draft.details, sizeSqFt: e.target.value } })} placeholder="Approximate size" /></label>
          <label>Frontage<input value={draft.details?.frontage ?? ''} onChange={e => setDraft({ ...draft, details: { ...draft.details, frontage: e.target.value } })} placeholder="Width / visibility" /></label>
          <label>Visit date<input type="date" value={draft.details?.visitDate ?? ''} onChange={e => setDraft({ ...draft, details: { ...draft.details, visitDate: e.target.value } })} /></label>
          <label>Student footfall<input value={draft.details?.footfall ?? ''} onChange={e => setDraft({ ...draft, details: { ...draft.details, footfall: e.target.value } })} placeholder="Low, medium, high + notes" /></label>
          <label>Parking / access<input value={draft.details?.parking ?? ''} onChange={e => setDraft({ ...draft, details: { ...draft.details, parking: e.target.value } })} placeholder="Two-wheelers, road access…" /></label>
          <label>Water / power / drainage<input value={draft.details?.utilities ?? ''} onChange={e => setDraft({ ...draft, details: { ...draft.details, utilities: e.target.value } })} placeholder="What is available?" /></label>
          <label>Delivery pickup access<input value={draft.details?.deliveryAccess ?? ''} onChange={e => setDraft({ ...draft, details: { ...draft.details, deliveryAccess: e.target.value } })} placeholder="Easy, difficult, unknown…" /></label>
          <label>Pros<input value={draft.details?.pros ?? ''} onChange={e => setDraft({ ...draft, details: { ...draft.details, pros: e.target.value } })} placeholder="What looks good" /></label>
          <label>Concerns<input value={draft.details?.concerns ?? ''} onChange={e => setDraft({ ...draft, details: { ...draft.details, concerns: e.target.value } })} placeholder="Risks or questions" /></label>
        </div>}
        {draft.kind === 'Checklist' && <div className="product-fields">
          <label>Phase<select value={draft.details?.phase ?? 'Planning'} onChange={e => setDraft({ ...draft, details: { ...draft.details, phase: e.target.value } })}><option>Planning</option><option>Location &amp; legal</option><option>Suppliers &amp; menu testing</option><option>Equipment &amp; store setup</option><option>People &amp; operations</option><option>Prelaunch &amp; opening</option></select></label>
          <label className="completed-field"><input type="checkbox" checked={draft.details?.completed === 'true'} onChange={e => setDraft({ ...draft, details: { ...draft.details, completed: String(e.target.checked) } })} /> Completed</label>
        </div>}
        {(draft.kind === 'Quote' || draft.kind === 'Expense') && <div className="product-fields">
          <label>Category<select value={draft.details?.category ?? 'Equipment'} onChange={e => setDraft({ ...draft, details: { ...draft.details, category: e.target.value } })}><option>Equipment</option><option>Ingredients</option><option>Packaging</option><option>Location</option><option>Marketing</option><option>Legal</option><option>Utilities</option><option>Other</option></select></label>
          <label>Vendor / paid to<input value={draft.details?.vendor ?? ''} onChange={e => setDraft({ ...draft, details: { ...draft.details, vendor: e.target.value } })} placeholder="Supplier, shop, person…" /></label>
          <label>Date<input type="date" value={draft.details?.date ?? ''} onChange={e => setDraft({ ...draft, details: { ...draft.details, date: e.target.value } })} /></label>
          {draft.kind === 'Quote' ? <>
            <label>Valid until<input type="date" value={draft.details?.validUntil ?? ''} onChange={e => setDraft({ ...draft, details: { ...draft.details, validUntil: e.target.value } })} /></label>
            <label>Tax / delivery<input value={draft.details?.taxDelivery ?? ''} onChange={e => setDraft({ ...draft, details: { ...draft.details, taxDelivery: e.target.value } })} placeholder="Included, extra, unknown…" /></label>
          </> : <>
            <label>Record type<select value={draft.details?.expenseType ?? 'Purchase'} onChange={e => setDraft({ ...draft, details: { ...draft.details, expenseType: e.target.value } })}><option>Purchase</option><option>Expense</option></select></label>
            <label>Payment status<select value={draft.details?.paymentStatus ?? 'Paid'} onChange={e => setDraft({ ...draft, details: { ...draft.details, paymentStatus: e.target.value } })}><option>Paid</option><option>Part paid</option><option>Not paid</option></select></label>
            <label>Payment method<input value={draft.details?.paymentMethod ?? ''} onChange={e => setDraft({ ...draft, details: { ...draft.details, paymentMethod: e.target.value } })} placeholder="UPI, card, cash…" /></label>
            <label>Receipt / invoice number<input value={draft.details?.referenceNumber ?? ''} onChange={e => setDraft({ ...draft, details: { ...draft.details, referenceNumber: e.target.value } })} placeholder="Optional reference" /></label>
          </>}
        </div>}
        <label className="source-field">Source / reference<input value={draft.source ?? ''} onChange={e => setDraft({ ...draft, source: e.target.value })} placeholder="Optional document, conversation, or website" /></label>
        <div className="attachment-area">
          <div className="attachment-heading"><span>Files</span><small>PDF, Word, Excel, photos and screenshots · 25 MB each</small></div>
          <label className="attachment-picker"><Paperclip size={16} />Attach files<input type="file" hidden multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.html" onChange={e => { const files = Array.from(e.target.files ?? []); onFilesChange([...pendingFiles, ...files]); e.target.value = '' }} /></label>
          {pendingFiles.map((file, index) => <div className="attachment-record pending" key={`${file.name}-${file.size}-${index}`}><span>{file.name}<small>{formatFileSize(file.size)} · ready to upload</small></span><button type="button" onClick={() => onFilesChange(pendingFiles.filter((_, fileIndex) => fileIndex !== index))}>Remove</button></div>)}
          {draft.attachments?.map(attachment => <div className="attachment-record" key={attachment.id}><button type="button" className="attachment-open" onClick={() => onOpenAttachment(attachment.storagePath)}>{attachment.name}<small>{attachment.sizeBytes ? formatFileSize(attachment.sizeBytes) : 'Saved file'}</small></button><button type="button" className="attachment-remove" onClick={async () => { if (!window.confirm(`Remove ${attachment.name}?`)) return; setAttachmentError(''); try { await onDeleteAttachment(attachment); setDraft(current => ({ ...current, attachments: current.attachments?.filter(file => file.id !== attachment.id) })) } catch (reason) { setAttachmentError(reason instanceof Error ? reason.message : 'Could not remove this file.') } }}>Remove</button></div>)}
          {attachmentError && <p className="attachment-error">{attachmentError}</p>}
        </div>
        {saveError && <p className="auth-error" role="alert">{saveError}</p>}
        <div className="editor-bottom">{isExisting ? (confirmDelete
          ? <span className="delete-confirm"><button type="button" onClick={() => setConfirmDelete(false)}>Cancel</button><button type="button" className="delete-button" onClick={onDelete}>Delete permanently</button></span>
          : <button type="button" className="delete-button" onClick={() => setConfirmDelete(true)}>Delete</button>) : <span />}
          <button className="save-button" disabled={!draft.title.trim() || saving}>{saving ? 'Saving…' : 'Save'}</button></div>
      </form>
    </div>
  )
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
