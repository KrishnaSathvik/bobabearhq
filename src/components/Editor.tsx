import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, ChevronRight, ListChecks, Paperclip, Plus } from 'lucide-react'
import type { OutgoingLink } from '../hooks/useWorkspaceItems'
import { AttachmentThumb, PendingPhoto, isImageAttachment, isImageFile } from './AttachmentThumb'
import { continueList, fromMarkdown, setLineKind, type LineEdit, type LineKind } from '../lib/richText'

// A saved photo in the editor, at the same size as one you have just picked.
function SavedPhotoPreview({ attachment, resolveUrl }: {
  attachment: WorkspaceAttachment
  resolveUrl: (storagePath: string) => Promise<string>
}) {
  return <span className="attachment-preview-wrap"><AttachmentThumb attachment={attachment} resolveUrl={resolveUrl} /></span>
}
import { kindHint, kindLabel, kindOptions, kindPhrase, sectionLabel } from '../lib/labels'
import { ensureTitle } from '../lib/suggestTitle'
import { itemRelationships, statusHintsFor, statusesFor, type ItemKind, type Section, type WorkspaceAttachment, type WorkspaceItem } from '../types'
import { sectionAreas } from '../data'
import { allSections, composerKinds, retype, structuredKinds } from '../itemShapes'
import { formatRupees, outstandingPortion, paymentStatusHints, paymentStatuses, statusForPayment } from '../lib/money'

function RelatedRecords({ draft, workspaceItems, outgoing, onChange }: {
  draft: WorkspaceItem; workspaceItems: WorkspaceItem[]; outgoing: OutgoingLink[]; onChange: (links: OutgoingLink[]) => void
}) {
  const [relationship, setRelationship] = useState<(typeof itemRelationships)[number]>('Related to')
  const [targetId, setTargetId] = useState('')
  const byId = useMemo(() => new Map(workspaceItems.map(item => [item.id, item])), [workspaceItems])
  const incoming = (draft.links ?? []).filter(link => link.direction === 'to')
  const candidates = workspaceItems
    .filter(item => item.id !== draft.id && !outgoing.some(link => link.itemId === item.id))
    .sort((a, b) => a.section.localeCompare(b.section) || a.title.localeCompare(b.title))

  return (
    <div className="related-area">
      <p className="related-hint">Connect a quote to what it is for, or a sample to its supplier.</p>
      {outgoing.map(link => {
        const target = byId.get(link.itemId)
        return (
          <div className="related-record" key={`${link.itemId}-${link.relationship}`}>
            <span>{target?.title ?? 'Removed record'}<small>{link.relationship} · {target ? `${kindLabel(target.kind)} · ${sectionLabel(target.section)}` : 'no longer in the workspace'}</small></span>
            <button type="button" onClick={() => onChange(outgoing.filter(current => current !== link))}>Remove</button>
          </div>
        )
      })}
      {incoming.map(link => {
        const other = byId.get(link.itemId)
        return (
          <div className="related-record incoming" key={link.id}>
            <span>{other?.title ?? 'Removed record'}<small>Linked from {other ? kindLabel(other.kind) : 'another record'} · edit it there</small></span>
          </div>
        )
      })}
      <div className="related-add">
        <label>Relationship<select value={relationship} onChange={e => setRelationship(e.target.value as typeof relationship)}>{itemRelationships.map(name => <option key={name}>{name}</option>)}</select></label>
        <label>Record<select value={targetId} onChange={e => setTargetId(e.target.value)}>
          <option value="">Choose a record</option>
          {candidates.map(item => <option key={item.id} value={item.id}>{item.title} — {kindLabel(item.kind)} · {sectionLabel(item.section)}</option>)}
        </select></label>
        <button type="button" className="related-link-button" disabled={!targetId}
          onClick={() => { onChange([...outgoing, { itemId: targetId, relationship }]); setTargetId('') }}>
          <Plus size={15} /> Link another record
        </button>
      </div>
    </div>
  )
}

// Long records (a sample has twenty fields) used to be one unbroken scroll with
// Save at the bottom of it. The title row and the action row are pinned now, and
// the fields are grouped: the ones you fill in first are open, the rest fold
// away with a count so nothing is hidden without a trace.
function FieldGroup({ title, filled, defaultOpen = false, children }: {
  title: string; filled?: number; defaultOpen?: boolean; children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className={open ? 'editor-group open' : 'editor-group'}>
      <button type="button" className="editor-group-head" aria-expanded={open} onClick={() => setOpen(value => !value)}>
        <ChevronRight size={15} className="editor-group-chevron" />
        <span>{title}</span>
        {filled ? <em>{filled} filled</em> : null}
      </button>
      {open && <div className="editor-group-body">{children}</div>}
    </section>
  )
}

// Records that are mostly fields keep a shorter writing area; a note is nearly
// all writing, so its box opens at the size of a page.

// A note may never be named — its first words will do. A property, a supplier
// or a machine is a thing in the world, and a thing in the world has a name, so
// the field asks for that name instead of offering to skip it.
const titlePlaceholders: Partial<Record<ItemKind, string>> = {
  Location: 'Property / shop name',
  Supplier: 'Supplier name',
  Product: 'Equipment item',
  Drink: 'Drink name',
  Influencer: 'Who or what channel',
  Expense: 'What was it for?',
  Quote: 'What is being quoted for?',
  Sample: 'What was sampled?',
  SupplierProduct: 'Product name',
  Checklist: 'What needs doing?',
}

function titlePlaceholder(kind: ItemKind) {
  return titlePlaceholders[kind] ?? 'Name'
}

// What the money on each kind is called. One table, so the Add screen and the
// record cannot end up asking for "Product price" and "Estimated price".
const amountLabels: Partial<Record<ItemKind, string>> = {
  Product: 'Product price (₹)',
  Sample: 'Sample + delivery cost (₹)',
  SupplierProduct: 'Price (₹)',
  Influencer: 'Quoted cost (₹)',
  Quote: 'Quoted amount (₹)',
  Expense: 'Expense amount (₹)',
}

const moneyCategories = ['Equipment', 'Ingredients', 'Packaging', 'Location', 'Marketing', 'Legal', 'Utilities', 'Other']

// What the menu is read by, on the wall and in the Menu view.
// Plural, because it is a group heading on the Menu before it is a field on a
// drink — and because the reference pack and the Menu's own ordering already
// say "Toppings". Two spellings would be two groups holding one thing.
const drinkCategories = ['Milk tea', 'Fruit tea', 'Boba lassi', 'Toppings']

// What Marketing is read down. The section is not only influencers — it holds
// print shops, colleges and partnerships — so these are the channels, not the
// platforms, and the view groups by exactly this.
const marketingChannels = ['Instagram', 'Print', 'Campus', 'Local page', 'Partnership']

const urlPlaceholders: Partial<Record<ItemKind, string>> = {
  Location: 'Google Maps or listing link',
  Supplier: 'Website',
  Influencer: 'Instagram or profile link',
  Quote: 'Optional product, invoice, or payment link',
  Expense: 'Optional product, invoice, or payment link',
}

function urlPlaceholder(kind: ItemKind) {
  return urlPlaceholders[kind] ?? 'Product page link'
}

function countFilled(details: Record<string, string> | undefined, keys: string[]) {
  if (!details) return 0
  return keys.filter(key => (details[key] ?? '').toString().trim() && details[key] !== 'false').length
}

export function Editor({ item, isNew, workspaceItems, pendingFiles, onFilesChange, backLabel, header, onOpenAttachment, resolveUrl, onClose, onSave, onDelete }: {
  item: WorkspaceItem; isNew: boolean; workspaceItems: WorkspaceItem[]; pendingFiles: File[]; onFilesChange: (files: File[]) => void;
  backLabel: string;
  // The workspace header, on the screens that do not already have one above
  // this. Writing takes the whole window on a phone, and a page that opens on
  // "Cancel  Save" and nothing else does not look like part of the app.
  header?: ReactNode;
  onOpenAttachment: (attachment: WorkspaceAttachment) => void;
  resolveUrl: (storagePath: string) => Promise<string>; onClose: () => void;
  onSave: (item: WorkspaceItem, files?: File[], removedAttachmentIds?: string[], links?: OutgoingLink[]) => Promise<void>; onDelete: () => Promise<void>
}) {
  const [draft, setDraft] = useState(item)
  // The section this composer was opened in. Choosing a kind refiles the draft
  // into that kind's home section — which is what puts an expense started from
  // the Inbox into Money — but the menu was being derived from the draft, so
  // the first choice narrowed every choice after it: pick Expense from the
  // Inbox and the nine types collapsed to Money's three. The choices belong to
  // where you opened the composer, not to where the draft has wandered.
  const [origin] = useState(item.section)
  // Whether the button that opened this screen had already decided what was
  // being added. Pressing + inside Suppliers had; the Inbox + had not.
  //
  // This is read from the kind the composer *opened* on, not from the kind the
  // draft has since become — otherwise turning an Inbox thought into an expense
  // would take the question away with it, and the Inbox composer, whose whole
  // point is changing your mind mid-thought, would become one-way.
  const [openedUndecided] = useState(() => !structuredKinds.includes(item.kind))
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [switching, setSwitching] = useState(false)
  // Removing a file is staged like every other edit: it only happens on Save,
  // and closing the editor leaves the file exactly where it was.
  const [removedIds, setRemovedIds] = useState<string[]>([])
  // The writing box, so the toolbar can act on the line the caret is actually
  // on rather than on the end of the text.
  const bodyRef = useRef<HTMLTextAreaElement | null>(null)
  // Where the caret should be once React has painted the rewritten writing. A
  // toolbar press that dumped the caret at the end of the note would make a
  // checklist unusable after the first box. A ref rather than state: this is
  // one instruction to the DOM after the render that is already happening, not
  // a reason to render again.
  const pendingCaret = useRef<number | null>(null)
  const [styleOpen, setStyleOpen] = useState(false)
  // A plain note is writing, so it opens as writing. Status, filing and links
  // are real and reachable, but they are not the first thing a thought meets.
  const [detailsOpen, setDetailsOpen] = useState(false)
  const initialLinks = useMemo(() => (item.links ?? []).filter(link => link.direction === 'from')
    .map(link => ({ itemId: link.itemId, relationship: link.relationship })), [item])
  const [outgoing, setOutgoing] = useState<OutgoingLink[]>(initialLinks)
  // A stray click on the backdrop used to discard everything typed so far.
  const isDirty = JSON.stringify(draft) !== JSON.stringify(item) || pendingFiles.length > 0 || removedIds.length > 0
    || JSON.stringify(outgoing) !== JSON.stringify(initialLinks)
  function closeWithGuard() {
    if (isDirty) { setConfirmDiscard(true); return }
    onClose()
  }
  // Something has to be in it: a thought, a title, a link, an amount or a file.
  const isEmpty = !draft.title.trim() && !draft.body.trim() && !draft.url?.trim() && !draft.amount?.trim()
    && pendingFiles.length === 0 && !(draft.attachments ?? []).length
  const detail = (key: string) => draft.details?.[key] ?? ''
  // Total minus what has been handed over. Shown while capturing a part-paid
  // purchase so the two numbers you typed are checked back to you.
  const outstanding = formatRupees(outstandingPortion({ amount: draft.amount, details: draft.details }))
  const setDetail = (key: string, value: string) => setDraft({ ...draft, details: { ...draft.details, [key]: value } })
  // The writing area grows with the writing. The ceiling is high enough that a
  // long thought keeps flowing down the page instead of scrolling inside a box,
  // and it has to sit above the opening height or the box could never grow.
  function autoGrow(field: HTMLTextAreaElement | null) {
    if (!field) return
    field.style.height = 'auto'
    field.style.height = `${Math.min(field.scrollHeight, Math.round(window.innerHeight * 0.72))}px`
  }

  // Every toolbar press and every Enter inside a list rewrites the whole string
  // and then puts the caret back. Doing it in an effect rather than straight
  // after setDraft is what makes it land after React has painted, so the caret
  // is set on the text that is actually in the box.
  useEffect(() => {
    const caret = pendingCaret.current
    if (caret === null) return
    pendingCaret.current = null
    const field = bodyRef.current
    if (!field) return
    field.focus()
    field.setSelectionRange(caret, caret)
    autoGrow(field)
  }, [draft.body])

  function applyEdit(edit: LineEdit | null) {
    if (!edit) return
    pendingCaret.current = edit.caret
    setDraft(current => ({ ...current, body: edit.body }))
  }

  // ☑︎, and the three the Aa menu offers. All four are the same move: take the
  // line the caret is on and give it — or take from it — a marker.
  function applyLineKind(kind: LineKind) {
    const field = bodyRef.current
    if (!field) return
    applyEdit(setLineKind(draft.body, field.selectionStart, kind))
  }

  // Adding is capture: the button you pressed already decided the section and
  // the kind, so the form never asks you to confirm either. Filing, links and
  // the type live on the saved record, where changing them is a deliberate act
  // rather than a toll gate in front of a thought.
  const isStructured = structuredKinds.includes(draft.kind)

  // The rule this editor is built around:
  //
  //   Adding is the minimum needed to create the record.
  //   Opening the saved record is where the depth lives.
  //
  // A supplier used to arrive as MOQ, shipping terms, lead time, payment terms,
  // reliability and FSSAI notes — six questions nobody can answer about a
  // company they have just found the name of. So the Add screen asks only what
  // you already know standing in front of the thing, and everything the record
  // still has to learn is asked on the record, once it exists and there is
  // somewhere for the answer to go.
  const capturing = isNew && isStructured
  // Money is the one Add screen that leads with a number rather than a name.
  const capturingMoney = capturing && (draft.kind === 'Expense' || draft.kind === 'Quote')
  const statusValues = statusesFor(draft.kind)
  // A structured record's fields are the reason you opened it, so they are on
  // the page. A note's are optional, and stay behind + Details until asked for.
  const showsDetailArea = isStructured || detailsOpen
  // What + Details would actually reveal. Filing and links belong to a record
  // that exists; a status belongs to a kind that has one.
  const hasDetails = !isNew || statusesFor(draft.kind).length > 0
  const showsFiling = !isNew
  // Anything saved can be connected to anything else. A photographed price list
  // belongs to the supplier who sent it and a thought belongs to the decision it
  // is about, and those are notes and files — the records that could not be
  // joined to anything at all until now.
  const showsLinks = !isNew
  // "New marketing · Marketing" says the same word twice. When the shape and
  // the place it lives share a name, once is enough.
  const kindName = kindLabel(draft.kind).toLowerCase()
  const place = sectionLabel(draft.section)
  const headline = isNew
    ? draft.kind === 'Note' ? `Add to ${place}`
      : kindName === place.toLowerCase() ? `New ${kindName}`
        : `New ${kindName} · ${place}`
    : `Edit ${kindName}`

  // The menu category, as chips. A native <datalist> draws a different, worse
  // control in every browser and gives no sign there is anything to choose
  // from, so the four the menu is built from are simply on the page — in the
  // same pill the statuses already use. A drink imported under a word of its
  // own keeps that word: it joins the row rather than being reassigned.
  function choiceChips(legend: string, key: string, choices: string[]) {
    const chosen = detail(key).trim()
    const same = (name: string) => chosen.toLowerCase() === name.toLowerCase()
    // A record imported under a word of its own keeps that word: it joins the
    // row rather than being silently reassigned to one of ours.
    const all = chosen && !choices.some(same) ? [...choices, chosen] : choices
    return (
      <fieldset className="status-field">
        <legend>{legend}</legend>
        <div className="status-chips">
          {all.map(name => (
            <button type="button" key={name} aria-pressed={same(name)}
              className={same(name) ? 'status-chip active' : 'status-chip'}
              onClick={() => setDetail(key, same(name) ? '' : name)}>{name}</button>
          ))}
        </div>
      </fieldset>
    )
  }
  const categoryChips = choiceChips('Category', 'category', drinkCategories)
  const channelChips = choiceChips('Channel', 'platform', marketingChannels)

  // Chips, not a dropdown. On a phone a select opens a wheel, which is a lot of
  // ceremony for a word that changes as often as this one. The words are this
  // kind's own — a property is "To visit", not "New" — and a note has none at
  // all, because a thought is not at a stage in anything.
  const statusChips = statusValues.length > 0 ? (
    <fieldset className="status-field">
      <legend>Status</legend>
      <div className="status-chips">
        {statusValues.map(status => (
          <button type="button" key={status} aria-pressed={draft.status === status} title={statusHintsFor(draft.kind)[status]}
            className={draft.status === status ? 'status-chip active' : 'status-chip'}
            onClick={() => setDraft({ ...draft, status: draft.status === status ? undefined : status })}>{status}</button>
        ))}
      </div>
    </fieldset>
  ) : null

  // A note is writing, so the writing is the page and the caret starts in it.
  // A property is a property: you opened it to put an address and a rent into
  // it, and a full-height empty box sitting above those fields made every
  // structured record look like a note wearing a form underneath. So on a
  // record this same block moves below the fields, under its own NOTES heading,
  // which is where it reads in the saved record too.
  const writingArea = (
    <>
            <textarea className={isStructured ? 'body-input' : 'body-input body-input-tall'} value={draft.body} autoFocus={!isStructured}
              ref={field => { bodyRef.current = field; autoGrow(field) }}
              onChange={e => { setDraft({ ...draft, body: e.target.value }); autoGrow(e.target) }}
              // A guide pasted out of a chat window or a doc arrives as Markdown
              // and used to land as punctuation — "## Store Timing", "**Staff
              // arrives:**", "* Wash hands". It is translated into the markers
              // this app has, and text that is not Markdown is left exactly alone.
              onPaste={e => {
                const pasted = e.clipboardData.getData('text/plain')
                const clean = pasted && fromMarkdown(pasted)
                if (!clean || clean === pasted) return
                e.preventDefault()
                const field = e.currentTarget
                // The browser's own insert keeps the browser's own undo stack,
                // which is what you want most immediately after pasting a long
                // document. The manual path is the fallback where it is refused.
                if (document.execCommand('insertText', false, clean)) return
                const { selectionStart: from, selectionEnd: to } = field
                applyEdit({ body: draft.body.slice(0, from) + clean + draft.body.slice(to), caret: from + clean.length })
              }}
              // Enter on a list line starts the next one; Enter on an empty list
              // line ends the list. Everywhere else this hands the key straight
              // back to the box, so ordinary writing is untouched.
              onKeyDown={e => {
                if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
                const field = e.currentTarget
                if (field.selectionStart !== field.selectionEnd) return
                const edit = continueList(draft.body, field.selectionStart)
                if (edit) e.preventDefault()
                applyEdit(edit)
              }}
              placeholder="Write anything…" />

            {/* Aa ☑︎ 📎 — the same three on every record you can write in, sitting
                under the writing rather than in a menu. A note that cannot grow a
                checkbox while you are writing it is not a notebook. */}
            <div className="write-tools" role="group" aria-label="Writing tools">
              <div className="write-style">
                <button type="button" className="write-tool" aria-label="Text style" aria-expanded={styleOpen}
                  aria-haspopup="menu" onClick={() => setStyleOpen(open => !open)}>Aa</button>
                {styleOpen && (
                  <div className="write-style-menu" role="menu" aria-label="Text style">
                    {([['Body', 'text'], ['Heading', 'heading'], ['Sub-heading', 'subheading'], ['Bulleted list', 'bullet'], ['Numbered list', 'numbered']] as const).map(([label, kind]) => (
                      <button type="button" role="menuitem" key={kind}
                        onClick={() => { setStyleOpen(false); applyLineKind(kind) }}>{label}</button>
                    ))}
                  </div>
                )}
              </div>
              <button type="button" className="write-tool" aria-label="Checklist" onClick={() => applyLineKind('todo')}>
                <ListChecks size={17} strokeWidth={1.9} />
              </button>
              {/* One line, not a headed block with a size limit printed under it.
                  The limit is worth saying when a file is refused, not before. */}
              <label className="write-tool attachment-picker">
                <Paperclip size={16} strokeWidth={1.9} />Attach files
                <input type="file" hidden multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.html"
                  onChange={e => { const files = Array.from(e.target.files ?? []); onFilesChange([...pendingFiles, ...files]); e.target.value = '' }} />
              </label>
              {/* Structured records already have their fields on the page, so the
                  question "is there more to this?" is only a question for a note.
                  And only where there is an answer: a brand-new note has no
                  status, no filing and nothing to link to yet, so this button
                  used to open onto an empty space. */}
              {!isStructured && hasDetails && (
                <button type="button" className="write-tool write-tool-details" aria-expanded={detailsOpen}
                  onClick={() => setDetailsOpen(open => !open)}><Plus size={15} strokeWidth={2} /> Details</button>
              )}
            </div>
    </>
  )

  return (
    <>
      <form className={header ? 'editor editor-page has-header' : 'editor editor-page'} onSubmit={async e => { e.preventDefault(); if (isEmpty) return; setSaving(true); setSaveError(''); try { await onSave({ ...draft, title: ensureTitle(draft.title, draft.body, draft.kind), status: draft.kind === 'Expense' ? statusForPayment(draft.details?.paymentStatus) : draft.status, updatedAt: new Date().toISOString() }, pendingFiles, removedIds, outgoing) } catch (reason) { setSaveError(reason instanceof Error ? reason.message : 'Could not save this item.'); setSaving(false) } }}>
        {header}

        {/* The actions ride along under the header, so Save and the way back
            are reachable from anywhere in a long record. */}
        <div className="editor-toolbar">
          {/* Two controls, the way out and the way to keep it. Cancel used to
              sit between them running the same handler as the arrow beside it —
              one screen, two buttons, one behaviour. The arrow says where it
              goes, so it is the one that stayed. */}
          <button type="button" className="detail-back" onClick={closeWithGuard} aria-label={`Back to ${backLabel}`}><ArrowLeft size={18} /> {backLabel}</button>
          <div className="editor-toolbar-actions">
            {!isNew && (confirmDelete
              ? <span className="delete-confirm"><button type="button" onClick={() => setConfirmDelete(false)}>Keep</button><button type="button" className="delete-button" onClick={onDelete}>Delete permanently</button></span>
              : <button type="button" className="delete-button" onClick={() => setConfirmDelete(true)}>Delete</button>)}
            <button className="save-button" disabled={isEmpty || saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>

        <div className="editor-document">
          <p className="eyebrow">{headline}</p>
          {/* A row of chips is still a row of decisions. This says what is being
              added in one line, and explains the alternatives only if you ask. */}
          {/* Only while composing. Changing your mind mid-thought is the point
              of the Inbox composer, and it is also how a note gets filed into
              Menu or Suppliers. On a record that already exists this line is
              gone: reclassifying a supplier is rare, and it lives in Filing. */}
          {isNew && openedUndecided && composerKinds(origin).length > 1 && (
            <div className="kind-switch">
              {switching
                ? <div className="kind-options" role="group" aria-label={`What are you adding to ${sectionLabel(origin)}?`}>
                  {composerKinds(origin).map(kind => (
                    <button type="button" key={kind} aria-pressed={draft.kind === kind}
                      className={draft.kind === kind ? 'kind-option active' : 'kind-option'}
                      // Choosing a shape from the Inbox also files the record
                      // where that shape lives, so an expense started as a
                      // thought still turns up in Money. A note started from
                      // the Menu is about the menu, and stays there. Filing is
                      // measured from the origin too, so changing your mind
                      // twice lands where changing it once would have.
                      onClick={() => { setDraft(current => retype(current, kind, origin)); setSwitching(false) }}>
                      <span className="kind-option-name">{kindLabel(kind)}</span>
                      <span className="kind-option-hint">{kindHint(kind)}</span>
                    </button>
                  ))}
                </div>
                : <p className="kind-current">Adding {kindPhrase(draft.kind)}<button type="button" onClick={() => setSwitching(true)}>Turn into…</button></p>}
            </div>
          )}
          {/* On a supplier or an expense the name is the point, so the title
              leads and the caret starts there. On a plain note the writing is
              the point and the title is derived from it — so there the writing
              leads, and the caret starts in the writing. The field that looks
              primary and the field that has the caret must be the same field,
              or you type into a page that appears not to be listening. */}
          {capturing && (draft.kind === 'Expense' || draft.kind === 'Quote') && (
            <label className="amount-field capture-amount">{amountLabels[draft.kind]}
              <input type="number" min="0" step="0.01" autoFocus value={draft.amount ?? ''} onChange={e => setDraft({ ...draft, amount: e.target.value })} placeholder="0.00" />
            </label>
          )}
          <input className={isStructured ? 'title-input' : 'title-input title-secondary'} value={draft.title} autoFocus={isStructured && !capturingMoney}
            onChange={e => setDraft({ ...draft, title: e.target.value })}
            placeholder={isStructured ? titlePlaceholder(draft.kind) : 'Title (optional)'} />
          {!isStructured && writingArea}

          {/* A link record is its link, so that one field stays with the writing. */}
          {(draft.kind === 'Link' || draft.kind === 'File') && <input className="url-input" value={draft.url ?? ''} onChange={e => setDraft({ ...draft, url: e.target.value })} placeholder={draft.kind === 'File' ? 'Optional file reference' : 'Paste link'} />}
          {isStructured && !capturing && <>
            {draft.kind !== 'Drink' && draft.kind !== 'Checklist' && <input className="url-input" value={draft.url ?? ''} onChange={e => setDraft({ ...draft, url: e.target.value })} placeholder={urlPlaceholder(draft.kind)} />}
            {amountLabels[draft.kind] && <label className="amount-field">{amountLabels[draft.kind]}<input type="number" min="0" step="0.01" value={draft.amount ?? ''} onChange={e => setDraft({ ...draft, amount: e.target.value })} placeholder="0.00" /></label>}
          </>}

          {/* ── Adding ──────────────────────────────────────────────────────
              Four to six fields, flat, no folded groups: this is what you know
              about the thing when you first write it down. Everything else each
              kind can hold is asked on the saved record. */}
          {capturing && draft.kind === 'Drink' && <>
            {categoryChips}
            <div className="product-fields">
              <label>Planning price — small (₹)<input type="number" min="0" step="0.01" value={detail('planningPriceSmall')} onChange={e => setDetail('planningPriceSmall', e.target.value)} placeholder="0.00" /></label>
              <label>Planning price — regular (₹)<input type="number" min="0" step="0.01" value={detail('planningPriceRegular')} onChange={e => setDetail('planningPriceRegular', e.target.value)} placeholder="0.00" /></label>
              <label>Supplier<input value={detail('supplier')} onChange={e => setDetail('supplier', e.target.value)} placeholder="Which supplier" /></label>
            </div>
            {statusChips}
          </>}

          {capturing && draft.kind === 'Supplier' && <>
            <div className="product-fields">
              <label>Location<input value={detail('location')} onChange={e => setDetail('location', e.target.value)} placeholder="Where they are" /></label>
            </div>
            <label className="source-field">What might we buy?<input value={detail('categories')} onChange={e => setDetail('categories', e.target.value)} placeholder="What they sell" /></label>
            <label className="source-field">Website<input value={draft.url ?? ''} onChange={e => setDraft({ ...draft, url: e.target.value })} placeholder="Their website" /></label>
            {statusChips}
          </>}

          {capturing && draft.kind === 'Location' && <>
            <div className="product-fields">
              <label>Area<input value={detail('searchArea')} onChange={e => setDetail('searchArea', e.target.value)} placeholder="Which part of town" /></label>
              <label>Monthly rent (₹)<input type="number" min="0" value={detail('monthlyRent')} onChange={e => setDetail('monthlyRent', e.target.value)} placeholder="Current quote" /></label>
              <label>Deposit (₹)<input type="number" min="0" value={detail('deposit')} onChange={e => setDetail('deposit', e.target.value)} placeholder="Advance asked for" /></label>
              <label>Size (sq ft)<input value={detail('sizeSqFt')} onChange={e => setDetail('sizeSqFt', e.target.value)} placeholder="Approximate size" /></label>
            </div>
            <label className="source-field">Maps or listing<input value={draft.url ?? ''} onChange={e => setDraft({ ...draft, url: e.target.value })} placeholder="Optional link" /></label>
            {statusChips}
          </>}

          {capturing && draft.kind === 'Product' && <>
            <div className="product-fields">
              <label>Estimated price (₹)<input type="number" min="0" step="0.01" value={draft.amount ?? ''} onChange={e => setDraft({ ...draft, amount: e.target.value })} placeholder="0.00" /></label>
              <label>Supplier<input value={detail('supplier')} onChange={e => setDetail('supplier', e.target.value)} placeholder="Supplier name" /></label>
            </div>
            <label className="source-field">Product link<input value={draft.url ?? ''} onChange={e => setDraft({ ...draft, url: e.target.value })} placeholder="Optional link" /></label>
            {statusChips}
          </>}

          {/* Money leads with the rupees, because that is the fact you opened
              the screen holding. */}
          {capturingMoney && <>
            <div className="product-fields">
              <label>Vendor / paid to<input value={detail('vendor')} onChange={e => setDetail('vendor', e.target.value)} placeholder="Who was paid" /></label>
              <label>Category<select value={draft.details?.category ?? 'Equipment'} onChange={e => setDetail('category', e.target.value)}>{moneyCategories.map(name => <option key={name}>{name}</option>)}</select></label>
              <label>Date<input type="date" value={detail('date')} onChange={e => setDetail('date', e.target.value)} /></label>
              {draft.kind === 'Expense' && <label>Payment<select value={draft.details?.paymentStatus ?? 'Paid'} onChange={e => setDetail('paymentStatus', e.target.value)}>{paymentStatuses.map(status => <option key={status} title={paymentStatusHints[status]}>{status}</option>)}</select></label>}
              {draft.kind === 'Expense' && draft.details?.paymentStatus === 'Part paid' && <label>Paid so far (₹)<input type="number" min="0" step="0.01" value={detail('amountPaid')} onChange={e => setDetail('amountPaid', e.target.value)} placeholder="0.00" /></label>}
            </div>
            {/* The third number is arithmetic, so the form does it rather than
                asking you to. */}
            {draft.kind === 'Expense' && draft.details?.paymentStatus === 'Part paid' && outstanding !== null && (
              <p className="capture-outstanding">Outstanding <strong>{outstanding}</strong></p>
            )}
            {draft.kind === 'Quote' && statusChips}
          </>}

          {/* Marketing is a conversation before it is a line item, so the
              writing comes first and the two numbers follow it. */}
          {capturing && draft.kind === 'Influencer' && <>
            {channelChips}
            <p className="editor-writing-heading">Notes</p>
            {writingArea}
            <label className="source-field">Instagram or profile link<input value={draft.url ?? ''} onChange={e => setDraft({ ...draft, url: e.target.value })} placeholder="Optional link" /></label>
            <label className="amount-field">Quoted cost (₹)<input type="number" min="0" step="0.01" value={draft.amount ?? ''} onChange={e => setDraft({ ...draft, amount: e.target.value })} placeholder="0.00" /></label>
          </>}

          {capturing && (draft.kind === 'Sample' || draft.kind === 'SupplierProduct') && <>
            <div className="product-fields">
              <label>Supplier<input value={detail('supplier')} onChange={e => setDetail('supplier', e.target.value)} placeholder="Which supplier" /></label>
              <label>{amountLabels[draft.kind]}<input type="number" min="0" step="0.01" value={draft.amount ?? ''} onChange={e => setDraft({ ...draft, amount: e.target.value })} placeholder="0.00" /></label>
            </div>
            <label className="source-field">Product link<input value={draft.url ?? ''} onChange={e => setDraft({ ...draft, url: e.target.value })} placeholder="Optional link" /></label>
            {statusChips}
          </>}

          {capturing && draft.kind === 'Checklist' && statusChips}

          {/* An expense's status is its payment, asked once below, so it is
              not asked twice here. While capturing, each Add block places the
              chips itself, among the four or five fields it asks for. */}
          {draft.kind !== 'Expense' && !capturing && showsDetailArea && statusChips}

          {draft.kind === 'Supplier' && !capturing && <>
            <FieldGroup title="Supplier contact" defaultOpen filled={countFilled(draft.details, ['location', 'contactName', 'phone', 'whatsapp', 'email'])}>
              <div className="product-fields">
                <label>Location<input value={detail('location')} onChange={e => setDetail('location', e.target.value)} placeholder="Where they are" /></label>
                <label>Contact person<input value={detail('contactName')} onChange={e => setDetail('contactName', e.target.value)} placeholder="Who you speak to" /></label>
                <label>Phone<input value={detail('phone')} onChange={e => setDetail('phone', e.target.value)} placeholder="Contact number" /></label>
                <label>WhatsApp<input value={detail('whatsapp')} onChange={e => setDetail('whatsapp', e.target.value)} placeholder="WhatsApp number" /></label>
                <label>Email<input value={detail('email')} onChange={e => setDetail('email', e.target.value)} placeholder="Email address" /></label>
              </div>
            </FieldGroup>
            <FieldGroup title="Trade terms" filled={countFilled(draft.details, ['categories', 'moq', 'shippingTerms', 'leadTime', 'paymentTerms'])}>
              <div className="product-fields">
                <label>What might we buy?<input value={detail('categories')} onChange={e => setDetail('categories', e.target.value)} placeholder="What they sell" /></label>
                <label>MOQ<input value={detail('moq')} onChange={e => setDetail('moq', e.target.value)} placeholder="Minimum order" /></label>
                <label>Shipping terms<input value={detail('shippingTerms')} onChange={e => setDetail('shippingTerms', e.target.value)} placeholder="Who pays to ship it" /></label>
                <label>Delivery time<input value={detail('leadTime')} onChange={e => setDetail('leadTime', e.target.value)} placeholder="How long delivery takes" /></label>
                <label>Payment terms<input value={detail('paymentTerms')} onChange={e => setDetail('paymentTerms', e.target.value)} placeholder="When payment is due" /></label>
              </div>
            </FieldGroup>
            <FieldGroup title="Reliability and labels" filled={countFilled(draft.details, ['reliability', 'labelNotes'])}>
              <div className="product-fields">
                <label>Reliability notes<input value={detail('reliability')} onChange={e => setDetail('reliability', e.target.value)} placeholder="How they answer and deliver" /></label>
                <label>FSSAI / label notes<input value={detail('labelNotes')} onChange={e => setDetail('labelNotes', e.target.value)} placeholder="What their labels show" /></label>
              </div>
            </FieldGroup>
          </>}

          {draft.kind === 'Drink' && !capturing && <>
            <FieldGroup title="Drink details" defaultOpen filled={countFilled(draft.details, ['category', 'flavors', 'sizes', 'planningPriceSmall', 'planningPriceRegular', 'launchPhase'])}>
              {categoryChips}
              <div className="product-fields">
                <label>Sizes<input value={detail('sizes')} onChange={e => setDetail('sizes', e.target.value)} placeholder="The sizes it is sold in" /></label>
                {/* Opening menu or Phase 2 — a drink can wait without being
                    dropped, which is what 'Deferred' is for. */}
                <label>Launch phase<select value={detail('launchPhase') || 'Opening menu'} onChange={e => setDetail('launchPhase', e.target.value)}><option>Opening menu</option><option>Phase 2</option></select></label>
                <label>Planning price — small (₹)<input type="number" min="0" step="0.01" value={detail('planningPriceSmall')} onChange={e => setDetail('planningPriceSmall', e.target.value)} placeholder="0.00" /></label>
                <label>Planning price — regular (₹)<input type="number" min="0" step="0.01" value={detail('planningPriceRegular')} onChange={e => setDetail('planningPriceRegular', e.target.value)} placeholder="0.00" /></label>
                <label>Cost per serving (₹)<input type="number" min="0" step="0.01" value={detail('costPerServing')} onChange={e => setDetail('costPerServing', e.target.value)} placeholder="0.00" /></label>
              </div>
              <label className="source-field">Flavours<input value={detail('flavors')} onChange={e => setDetail('flavors', e.target.value)} placeholder="Flavours, separated by semicolons" /></label>
            </FieldGroup>
            <FieldGroup title="Recipe and tasting" filled={countFilled(draft.details, ['ingredients', 'preparation', 'tasteResult', 'tasteNotes'])}>
              <div className="product-fields">
                <label>Taste result<select value={detail('tasteResult')} onChange={e => setDetail('tasteResult', e.target.value)}><option value="">Not tasted</option><option>Tasted — good</option><option>Tasted — needs work</option><option>Not suitable</option></select></label>
              </div>
              <label className="source-field">Ingredients<input value={detail('ingredients')} onChange={e => setDetail('ingredients', e.target.value)} placeholder="What goes into it" /></label>
              <label className="source-field">Preparation<input value={detail('preparation')} onChange={e => setDetail('preparation', e.target.value)} placeholder="How it is made" /></label>
              <label className="source-field">Tasting notes<input value={detail('tasteNotes')} onChange={e => setDetail('tasteNotes', e.target.value)} placeholder="How it tasted" /></label>
            </FieldGroup>
          </>}

          {draft.kind === 'SupplierProduct' && !capturing && <FieldGroup title="Product details" defaultOpen filled={countFilled(draft.details, ['supplier', 'category', 'packSize', 'moq', 'shipping', 'leadTime'])}>
            <div className="product-fields">
              <label>Supplier<input value={detail('supplier')} onChange={e => setDetail('supplier', e.target.value)} placeholder="Which supplier" /></label>
              <label>Product category<input value={detail('category')} onChange={e => setDetail('category', e.target.value)} placeholder="What sort of product" /></label>
              <label>Pack size<input value={detail('packSize')} onChange={e => setDetail('packSize', e.target.value)} placeholder="Weight or volume per pack" /></label>
              <label>MOQ<input value={detail('moq')} onChange={e => setDetail('moq', e.target.value)} placeholder="Minimum order" /></label>
              <label>Shipping (₹)<input type="number" min="0" step="0.01" value={detail('shipping')} onChange={e => setDetail('shipping', e.target.value)} placeholder="0.00" /></label>
              <label>Lead time<input value={detail('leadTime')} onChange={e => setDetail('leadTime', e.target.value)} placeholder="How long delivery takes" /></label>
            </div>
          </FieldGroup>}

          {draft.kind === 'Influencer' && !capturing && <FieldGroup title="Outreach" defaultOpen filled={countFilled(draft.details, ['platform', 'reach', 'deliverables'])}>
            {channelChips}
            <div className="product-fields">
              <label>Audience / reach<input value={detail('reach')} onChange={e => setDetail('reach', e.target.value)} placeholder="How many people they reach" /></label>
              <label>Deliverables<input value={detail('deliverables')} onChange={e => setDetail('deliverables', e.target.value)} placeholder="What they would make" /></label>
            </div>
          </FieldGroup>}

          {draft.kind === 'Product' && !capturing && <FieldGroup title="Equipment details" defaultOpen filled={countFilled(draft.details, ['category', 'supplier', 'shipping', 'model', 'voltage', 'moq', 'leadTime', 'warranty'])}>
            <div className="product-fields">
              <label>Category<input value={detail('category')} onChange={e => setDetail('category', e.target.value)} placeholder="What sort of machine" /></label>
              <label>Supplier<input value={detail('supplier')} onChange={e => setDetail('supplier', e.target.value)} placeholder="Supplier name" /></label>
              <label>Shipping (₹)<input type="number" min="0" step="0.01" value={detail('shipping')} onChange={e => setDetail('shipping', e.target.value)} placeholder="0.00" /></label>
              <label>Model / size<input value={detail('model')} onChange={e => setDetail('model', e.target.value)} placeholder="Model or capacity" /></label>
              <label>Voltage / power<input value={detail('voltage')} onChange={e => setDetail('voltage', e.target.value)} placeholder="Voltage and wattage" /></label>
              <label>MOQ<input value={detail('moq')} onChange={e => setDetail('moq', e.target.value)} placeholder="Minimum order" /></label>
              <label>Lead time<input value={detail('leadTime')} onChange={e => setDetail('leadTime', e.target.value)} placeholder="Delivery estimate" /></label>
              <label>Warranty / service<input value={detail('warranty')} onChange={e => setDetail('warranty', e.target.value)} placeholder="Cover and who services it" /></label>
            </div>
          </FieldGroup>}

          {draft.kind === 'Sample' && !capturing && <>
            <FieldGroup title="Sample details" defaultOpen filled={countFilled(draft.details, ['supplier', 'category', 'quantity', 'productCost', 'shipping', 'requestedDate', 'receivedDate', 'moq', 'leadTime'])}>
              <div className="product-fields">
                <label>Supplier<input value={detail('supplier')} onChange={e => setDetail('supplier', e.target.value)} placeholder="Which supplier" /></label>
                <label>Product / category<input value={detail('category')} onChange={e => setDetail('category', e.target.value)} placeholder="What sort of product" /></label>
                <label>Sample quantity<input value={detail('quantity')} onChange={e => setDetail('quantity', e.target.value)} placeholder="How much was sent" /></label>
                <label>Product cost (₹)<input type="number" min="0" step="0.01" value={detail('productCost')} onChange={e => setDetail('productCost', e.target.value)} placeholder="0.00" /></label>
                <label>Shipping (₹)<input type="number" min="0" step="0.01" value={detail('shipping')} onChange={e => setDetail('shipping', e.target.value)} placeholder="0.00" /></label>
                <label>Order date<input type="date" value={detail('requestedDate')} onChange={e => setDetail('requestedDate', e.target.value)} /></label>
                <label>Arrival date<input type="date" value={detail('receivedDate')} onChange={e => setDetail('receivedDate', e.target.value)} /></label>
                <label>MOQ<input value={detail('moq')} onChange={e => setDetail('moq', e.target.value)} placeholder="Minimum order" /></label>
                <label>Lead time<input value={detail('leadTime')} onChange={e => setDetail('leadTime', e.target.value)} placeholder="Delivery time" /></label>
              </div>
            </FieldGroup>
            <FieldGroup title="Tasting notes" filled={countFilled(draft.details, ['tasteDate', 'tasteScore', 'preparation', 'sweetness', 'flavor', 'texture', 'aftertaste', 'costPerServing'])}>
              <div className="product-fields">
                <label>Taste date<input type="date" value={detail('tasteDate')} onChange={e => setDetail('tasteDate', e.target.value)} /></label>
                <label>Taste rating<input type="number" min="1" max="10" value={detail('tasteScore')} onChange={e => setDetail('tasteScore', e.target.value)} placeholder="1–10" /></label>
                <label>Preparation used<input value={detail('preparation')} onChange={e => setDetail('preparation', e.target.value)} placeholder="How it was made" /></label>
                <label>Sweetness<input value={detail('sweetness')} onChange={e => setDetail('sweetness', e.target.value)} placeholder="How sweet it was" /></label>
                <label>Flavor<input value={detail('flavor')} onChange={e => setDetail('flavor', e.target.value)} placeholder="How it tasted" /></label>
                <label>Texture<input value={detail('texture')} onChange={e => setDetail('texture', e.target.value)} placeholder="How it felt to chew" /></label>
                <label>Aftertaste<input value={detail('aftertaste')} onChange={e => setDetail('aftertaste', e.target.value)} placeholder="What it left behind" /></label>
                <label>Cost per serving (₹)<input type="number" min="0" step="0.01" value={detail('costPerServing')} onChange={e => setDetail('costPerServing', e.target.value)} placeholder="0.00" /></label>
              </div>
            </FieldGroup>
            <FieldGroup title="Checks and decision" filled={countFilled(draft.details, ['labelCheck', 'reliability', 'decision'])}>
              <div className="product-fields">
                <label>Label / FSSAI check<select value={detail('labelCheck')} onChange={e => setDetail('labelCheck', e.target.value)}><option value="">Not checked</option><option>Looks complete</option><option>Needs clarification</option><option>Not acceptable</option><option>Not applicable</option></select></label>
                <label>Supplier reliability<select value={detail('reliability')} onChange={e => setDetail('reliability', e.target.value)}><option value="">Not tested</option><option>Answers quickly</option><option>Slow but reliable</option><option>Inconsistent</option><option>Unreliable</option></select></label>
                {/* Whether the sample arrived and whether you want it are two
                    different questions, so they get two different fields. */}
                <label>Decision<select value={draft.details?.decision ?? 'Not decided'} onChange={e => setDetail('decision', e.target.value)}><option>Not decided</option><option>Comparing</option><option>Shortlisted</option><option>Rejected</option></select></label>
              </div>
            </FieldGroup>
          </>}

          {draft.kind === 'Location' && !capturing && <>
            <FieldGroup title="Property details" defaultOpen filled={countFilled(draft.details, ['searchArea', 'address', 'contactName', 'phone', 'monthlyRent', 'deposit', 'sizeSqFt', 'frontage'])}>
              <div className="product-fields">
                <label>Area<input value={detail('searchArea')} onChange={e => setDetail('searchArea', e.target.value)} placeholder="Which part of town" /></label>
                <label>Property / address<input value={detail('address')} onChange={e => setDetail('address', e.target.value)} placeholder="Address or landmark" /></label>
                <label>Contact name<input value={detail('contactName')} onChange={e => setDetail('contactName', e.target.value)} placeholder="Owner or broker" /></label>
                <label>Phone<input value={detail('phone')} onChange={e => setDetail('phone', e.target.value)} placeholder="Contact number" /></label>
                <label>Monthly rent (₹)<input type="number" min="0" value={detail('monthlyRent')} onChange={e => setDetail('monthlyRent', e.target.value)} placeholder="Current quote" /></label>
                <label>Deposit (₹)<input type="number" min="0" value={detail('deposit')} onChange={e => setDetail('deposit', e.target.value)} placeholder="Advance asked for" /></label>
                <label>Size (sq ft)<input value={detail('sizeSqFt')} onChange={e => setDetail('sizeSqFt', e.target.value)} placeholder="Approximate size" /></label>
                <label>Frontage / visibility<input value={detail('frontage')} onChange={e => setDetail('frontage', e.target.value)} placeholder="Width / visibility" /></label>
              </div>
            </FieldGroup>
            <FieldGroup title="Visit findings" filled={countFilled(draft.details, ['visitDate', 'footfall', 'parking', 'utilities', 'deliveryAccess', 'fitOut', 'pros', 'concerns'])}>
              <div className="product-fields">
                <label>Visit date<input type="date" value={detail('visitDate')} onChange={e => setDetail('visitDate', e.target.value)} /></label>
                <label>Student footfall<input value={detail('footfall')} onChange={e => setDetail('footfall', e.target.value)} placeholder="How busy it looks" /></label>
                <label>Parking / access<input value={detail('parking')} onChange={e => setDetail('parking', e.target.value)} placeholder="Where people would park" /></label>
                <label>Water / power / drainage<input value={detail('utilities')} onChange={e => setDetail('utilities', e.target.value)} placeholder="What is available?" /></label>
                <label>Delivery pickup access<input value={detail('deliveryAccess')} onChange={e => setDetail('deliveryAccess', e.target.value)} placeholder="How easy pickup would be" /></label>
                <label>Fit-out needs<input value={detail('fitOut')} onChange={e => setDetail('fitOut', e.target.value)} placeholder="What would need doing" /></label>
                <label>Pros<input value={detail('pros')} onChange={e => setDetail('pros', e.target.value)} placeholder="What looks good" /></label>
                <label>Concerns<input value={detail('concerns')} onChange={e => setDetail('concerns', e.target.value)} placeholder="Risks or questions" /></label>
              </div>
            </FieldGroup>
          </>}

          {/* A decision exists so that months later somebody can ask why we
              chose this. The choice itself is the writing above; this is the
              reasoning, kept apart from it so it stays findable. */}
          {draft.kind === 'Decision' && !capturing && <FieldGroup title="Why" defaultOpen filled={countFilled(draft.details, ['why'])}>
            <div className="product-fields">
              <label>Why<input value={detail('why')} onChange={e => setDetail('why', e.target.value)} placeholder="What made this the right call…" /></label>
            </div>
          </FieldGroup>}

          {(draft.kind === 'Quote' || draft.kind === 'Expense') && !capturing && <FieldGroup title={draft.kind === 'Quote' ? 'Quote details' : 'Payment details'} defaultOpen filled={countFilled(draft.details, ['vendor', 'date', 'validUntil', 'taxDelivery', 'paymentStatus', 'amountPaid', 'paymentMethod', 'referenceNumber'])}>
            <div className="product-fields">
              <label>Category<select value={draft.details?.category ?? 'Equipment'} onChange={e => setDetail('category', e.target.value)}><option>Equipment</option><option>Ingredients</option><option>Packaging</option><option>Location</option><option>Marketing</option><option>Legal</option><option>Utilities</option><option>Other</option></select></label>
              <label>Vendor / paid to<input value={detail('vendor')} onChange={e => setDetail('vendor', e.target.value)} placeholder="Who was paid" /></label>
              <label>Date<input type="date" value={detail('date')} onChange={e => setDetail('date', e.target.value)} /></label>
              {draft.kind === 'Quote' ? <>
                <label>Valid until<input type="date" value={detail('validUntil')} onChange={e => setDetail('validUntil', e.target.value)} /></label>
                <label>Tax / delivery<input value={detail('taxDelivery')} onChange={e => setDetail('taxDelivery', e.target.value)} placeholder="Whether tax and delivery are included" /></label>
              </> : <>
                <label>Payment<select value={draft.details?.paymentStatus ?? 'Paid'} onChange={e => setDetail('paymentStatus', e.target.value)}>{paymentStatuses.map(status => <option key={status} title={paymentStatusHints[status]}>{status}</option>)}</select></label>
                {draft.details?.paymentStatus === 'Part paid' && <label>Paid so far (₹)<input type="number" min="0" step="0.01" value={detail('amountPaid')} onChange={e => setDetail('amountPaid', e.target.value)} placeholder="0.00" /></label>}
                <label>Payment method<input value={detail('paymentMethod')} onChange={e => setDetail('paymentMethod', e.target.value)} placeholder="How it was paid" /></label>
                <label>Receipt / invoice number<input value={detail('referenceNumber')} onChange={e => setDetail('referenceNumber', e.target.value)} placeholder="Optional reference" /></label>
              </>}
            </div>
          </FieldGroup>}

          {isStructured && !(capturing && draft.kind === 'Influencer') && <>
            <p className="editor-writing-heading">Notes</p>
            {writingArea}
          </>}

          {/* Attaching is a toolbar press now. What is left here is the list of
              what is attached, which only exists once something is. */}
          {(pendingFiles.length > 0 || (draft.attachments ?? []).length > 0) && <div className="attachment-area">
            {/* The photo you just picked, shown as the photo. It is already in
                the browser, so there is nothing to upload before you can see
                it — and a row reading "IMG_4413.jpg · 2.1 MB" is no way to
                check you attached the right one. */}
            {pendingFiles.map((file, index) => <div className="attachment-record pending" key={`${file.name}-${file.size}-${index}`}>
              {isImageFile(file) && <PendingPhoto file={file} />}
              <span>{file.name}<small>{formatFileSize(file.size)} · ready to upload</small></span>
              <button type="button" onClick={() => onFilesChange(pendingFiles.filter((_, fileIndex) => fileIndex !== index))}>Remove</button>
            </div>)}
            {draft.attachments?.map(attachment => {
              const staged = removedIds.includes(attachment.id)
              return staged
                ? <div className="attachment-record removing" key={attachment.id}><span>{attachment.name}<small>Will be removed when you save</small></span><button type="button" onClick={() => setRemovedIds(current => current.filter(id => id !== attachment.id))}>Undo</button></div>
                : <div className="attachment-record" key={attachment.id}>
                  {isImageAttachment(attachment) && <SavedPhotoPreview attachment={attachment} resolveUrl={resolveUrl} />}
                  <button type="button" className="attachment-open" onClick={() => onOpenAttachment(attachment)}>{attachment.name}<small>{attachment.sizeBytes ? formatFileSize(attachment.sizeBytes) : 'Saved file'}</small></button>
                  <button type="button" className="attachment-remove" onClick={() => setRemovedIds(current => [...current, attachment.id])}>Remove</button>
                </div>
            })}
          </div>}

          {showsLinks && showsDetailArea && <FieldGroup title="Related records" defaultOpen={outgoing.length > 0 || (draft.links ?? []).length > 0} filled={outgoing.length + (draft.links ?? []).filter(link => link.direction === 'to').length}>
            <RelatedRecords draft={draft} workspaceItems={workspaceItems} outgoing={outgoing} onChange={setOutgoing} />
          </FieldGroup>}

          {/* Moving a record or changing what it is happens here, on the record,
              long after it was captured. */}
          {showsFiling && showsDetailArea && <FieldGroup title="Filing" filled={[draft.area, isStructured ? draft.status : '', isStructured ? draft.source : ''].filter(Boolean).length}>
            <div className="editor-fields">
              <label>Type<select value={draft.kind} onChange={e => setDraft(current => retype(current, e.target.value as ItemKind, origin))}>{kindOptions(draft.kind).map(kind => <option key={kind} value={kind}>{kindLabel(kind)}</option>)}</select></label>
              <label>Belongs to<select value={draft.section} onChange={e => setDraft({ ...draft, section: e.target.value as Section, area: '' })}>{allSections.map(section => <option key={section} value={section}>{sectionLabel(section)}</option>)}</select></label>
              <label>Area<select value={draft.area ?? ''} onChange={e => setDraft({ ...draft, area: e.target.value })}><option value="">Choose later</option>{sectionAreas[draft.section]?.map(area => <option key={area}>{area}</option>)}</select></label>
            </div>
            {isStructured && <label className="source-field">Source / reference<input value={draft.source ?? ''} onChange={e => setDraft({ ...draft, source: e.target.value })} placeholder="Optional document, conversation, or website" /></label>}
          </FieldGroup>}
          {isNew && !openedUndecided && composerKinds(origin).length > 1 && (
            <div className="kind-escape">
              {switching
                ? <div className="kind-options" role="group" aria-label={`What are you adding to ${sectionLabel(origin)}?`}>
                  {composerKinds(origin).map(kind => (
                    <button type="button" key={kind} aria-pressed={draft.kind === kind}
                      className={draft.kind === kind ? 'kind-option active' : 'kind-option'}
                      onClick={() => { setDraft(current => retype(current, kind, origin)); setSwitching(false) }}>
                      <span className="kind-option-name">{kindLabel(kind)}</span>
                      <span className="kind-option-hint">{kindHint(kind)}</span>
                    </button>
                  ))}
                </div>
                : <button type="button" onClick={() => setSwitching(true)}>Not {kindPhrase(draft.kind)}?</button>}
            </div>
          )}
          {saveError && <p className="auth-error" role="alert">{saveError}</p>}
        </div>
      </form>
      {confirmDiscard && (
        <div className="discard-scrim">
          <div className="discard-panel" role="dialog" aria-label="Discard changes?">
            <strong>Discard changes?</strong>
            <p>Your unsaved changes will be lost.</p>
            <div className="discard-actions">
              <button type="button" onClick={() => setConfirmDiscard(false)}>Keep editing</button>
              <button type="button" className="delete-button" onClick={onClose}>Discard</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
