import { useMemo, useRef, useState } from 'react'
import { DollarSign, File as FileIcon, FileText, Image, Link2, Menu as MenuIcon, Paperclip, Plus, Search, X } from 'lucide-react'
import { sectionAreas, starterItems } from './data'
import { useWorkspaceItems } from './hooks/useWorkspaceItems'
import type { ItemKind, Section, WorkspaceItem } from './types'

const sections: Array<'Home' | Section> = ['Home', 'Notes', 'Menu', 'Suppliers', 'Store Setup', 'Marketing', 'Money', 'Library']

function createId() {
  return crypto.randomUUID()
}

export default function App() {
  const [active, setActive] = useState<'Home' | Section>('Home')
  const { items, loading, error, saveItem: persistItem, deleteItem: persistDelete, getAttachmentUrl } = useWorkspaceItems()
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [editing, setEditing] = useState<WorkspaceItem | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)

  const visibleItems = useMemo(() => {
    const base = items.filter(item => item.section === active)
    const needle = query.trim().toLowerCase()
    if (!needle) return base
    return base.filter(item => [item.title, item.body, item.section, item.area, item.url].some(value => value?.toLowerCase().includes(needle)))
  }, [active, items, query])

  async function saveItem(item: WorkspaceItem, file?: File) {
    await persistItem(item, file)
    setComposerOpen(false)
    setEditing(null)
  }

  function openNew(section?: Section, kind: ItemKind = 'Note', body = '', file?: File) {
    const capturedUrl = kind === 'Link' ? body : undefined
    setEditing({
      id: createId(), title: '', body: capturedUrl ? '' : body, url: capturedUrl, kind,
      section: section ?? 'Notes', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    })
    setPendingFile(file ?? null)
    setComposerOpen(true)
  }

  const [pendingFile, setPendingFile] = useState<File | null>(null)

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="mobile-menu" aria-label="Open navigation" onClick={() => setMobileOpen(v => !v)}><MenuIcon size={21} /></button>
        <button className="brand" onClick={() => setActive('Home')}>Boba Bear HQ</button>
        <nav className={mobileOpen ? 'nav nav-open' : 'nav'} aria-label="Main navigation">
          {sections.map(section => (
            <button key={section} className={active === section ? 'nav-item active' : 'nav-item'} onClick={() => { setActive(section); setMobileOpen(false); setQuery('') }}>{section}</button>
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
        {!loading && (active === 'Home' ? <Home onCreate={openNew} /> : (
          <SectionPage section={active} items={visibleItems} query={query} setQuery={setQuery} onNew={() => openNew(active)} onEdit={item => { setEditing(item); setComposerOpen(true) }} />
        ))}
      </main>

      {composerOpen && editing && <Editor item={editing} pendingFile={pendingFile} onFileChange={setPendingFile}
        onOpenAttachment={async path => { window.open(await getAttachmentUrl(path), '_blank', 'noopener,noreferrer') }}
        onClose={() => { setComposerOpen(false); setEditing(null); setPendingFile(null) }} onSave={saveItem}
        onDelete={async () => { await persistDelete(editing.id); setComposerOpen(false); setEditing(null); setPendingFile(null) }} />}
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

function SectionPage({ section, items, query, setQuery, onNew, onEdit }: { section: Section; items: WorkspaceItem[]; query: string; setQuery: (value: string) => void; onNew: () => void; onEdit: (item: WorkspaceItem) => void }) {
  return (
    <section className="section-page">
      <div className="section-heading">
        <div><p className="eyebrow">Workspace</p><h1>{section}</h1></div>
        <button className="minimal-add" onClick={onNew}><Plus size={17} /> Add</button>
      </div>
      <div className="section-search"><Search size={18} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder={`Search ${section.toLowerCase()}…`} /></div>
      <div className="item-list">
        {items.length === 0 ? <div className="empty-state"><p>Nothing here yet.</p><button onClick={onNew}>Add the first item</button></div> : items.map(item => (
          <button className="item-row" key={item.id} onClick={() => onEdit(item)}>
            <span className="item-icon">{item.kind === 'Link' ? <Link2 size={18} /> : item.kind === 'File' ? <FileIcon size={18} /> : item.kind === 'Expense' ? <DollarSign size={18} /> : <FileText size={18} />}</span>
            <span className="item-copy"><strong>{item.title}</strong><small>{item.body}</small></span>
            <span className="item-meta">{item.area ?? item.section}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

function Editor({ item, pendingFile, onFileChange, onOpenAttachment, onClose, onSave, onDelete }: {
  item: WorkspaceItem; pendingFile: File | null; onFileChange: (file: File | null) => void;
  onOpenAttachment: (path: string) => Promise<void>; onClose: () => void;
  onSave: (item: WorkspaceItem, file?: File) => Promise<void>; onDelete: () => Promise<void>
}) {
  const [draft, setDraft] = useState(item)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const isExisting = starterItems.some(x => x.id === item.id) || Boolean(item.title)
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form className="editor" onMouseDown={e => e.stopPropagation()} onSubmit={async e => { e.preventDefault(); if (!draft.title.trim()) return; setSaving(true); setSaveError(''); try { await onSave({ ...draft, updatedAt: new Date().toISOString() }, pendingFile ?? undefined) } catch (reason) { setSaveError(reason instanceof Error ? reason.message : 'Could not save this item.'); setSaving(false) } }}>
        <div className="editor-top"><span>{isExisting ? 'Edit item' : 'Add to workspace'}</span><button type="button" onClick={onClose}><X size={20} /></button></div>
        <input className="title-input" autoFocus value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="Title" />
        <textarea className="body-input" value={draft.body} onChange={e => setDraft({ ...draft, body: e.target.value })} placeholder="Write anything…" />
        <div className="editor-fields">
          <label>Type<select value={draft.kind} onChange={e => setDraft({ ...draft, kind: e.target.value as ItemKind })}><option>Note</option><option>Link</option><option>File</option><option>Expense</option></select></label>
          <label>Belongs to<select value={draft.section} onChange={e => setDraft({ ...draft, section: e.target.value as Section, area: '' })}>{sections.filter(s => s !== 'Home').map(s => <option key={s}>{s}</option>)}</select></label>
          <label>Area<select value={draft.area ?? ''} onChange={e => setDraft({ ...draft, area: e.target.value })}><option value="">Choose later</option>{sectionAreas[draft.section]?.map(area => <option key={area}>{area}</option>)}</select></label>
        </div>
        {(draft.kind === 'Link' || draft.kind === 'File') && <input className="url-input" value={draft.url ?? ''} onChange={e => setDraft({ ...draft, url: e.target.value })} placeholder="Paste link or file reference" />}
        {draft.kind === 'Expense' && <label className="amount-field">Amount (₹)<input type="number" min="0" step="0.01" value={draft.amount ?? ''} onChange={e => setDraft({ ...draft, amount: e.target.value })} placeholder="0.00" /></label>}
        {draft.kind === 'File' && <div className="attachment-area">
          <label className="attachment-picker"><Paperclip size={16} />{pendingFile ? 'Change file' : 'Choose file'}<input type="file" hidden onChange={e => onFileChange(e.target.files?.[0] ?? null)} /></label>
          {pendingFile && <span>{pendingFile.name}</span>}
          {draft.attachments?.map(attachment => <button type="button" key={attachment.id} onClick={() => onOpenAttachment(attachment.storagePath)}>{attachment.name}</button>)}
        </div>}
        {saveError && <p className="auth-error" role="alert">{saveError}</p>}
        <div className="editor-bottom">{isExisting ? (confirmDelete
          ? <span className="delete-confirm"><button type="button" onClick={() => setConfirmDelete(false)}>Cancel</button><button type="button" className="delete-button" onClick={onDelete}>Delete permanently</button></span>
          : <button type="button" className="delete-button" onClick={() => setConfirmDelete(true)}>Delete</button>) : <span />}
          <button className="save-button" disabled={!draft.title.trim() || saving}>{saving ? 'Saving…' : 'Save'}</button></div>
      </form>
    </div>
  )
}
