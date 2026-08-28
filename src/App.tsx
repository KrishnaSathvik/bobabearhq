import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Plus, X } from 'lucide-react'
import { workspaceEmail } from './AuthGate'
import { BottomSheet, SheetOption } from './components/BottomSheet'
import { Editor } from './components/Editor'
import { ItemDetail } from './components/ItemDetail'
import { ItemRow, statusIsTelling } from './components/ItemRow'
import { SavedViewBody, needsYou as itemNeedsYou, savedViewCount, savedViewSummary, savedViews, type SavedViewId } from './components/SavedView'
import { useWorkspaceItems, type OutgoingLink, type SyncState } from './hooks/useWorkspaceItems'
import { defaultsForKind, sectionKinds } from './itemShapes'
import { createId } from './lib/ids'
import { suggestTitle, suggestTitleFromFiles, suggestTitleFromUrl } from './lib/suggestTitle'
import { writeTasks, type RecordTask } from './lib/tasks'
import { supabase } from './lib/supabase'
import { finishedStatus, initialStatus, type ItemKind, type Section, type WorkspaceAttachment, type WorkspaceItem } from './types'

// The whole app is one notebook. There is no bottom navigation, no drawer and
// no module tabs: a header and a floating +. Anything
// that used to be a tab is a pinned view in the Inbox, which is what the spec
// means by "pins are the lightweight replacement for a dashboard".

type Screen = 'inbox' | SavedViewId

const STALE_AFTER_DAYS = 7

// A box beside a supplier asks a question suppliers do not answer, and a box
// beside a note asks one a thought does not either — a note is something you
// wrote, not something you finish. Only a task carries one. Anything else that
// needs finishing becomes a task, which is the whole reason tasks exist.
const completable = (item: WorkspaceItem) => item.kind === 'Checklist'

// A record that arrived with a starter pack and has not been touched since.
// The importer stamps createdAt and updatedAt identically, so the two being
// equal is exactly "nobody has done anything to this yet".
const isUntouchedImport = (item: WorkspaceItem) => Boolean(item.importKey) && item.createdAt === item.updatedAt

const syncMessages: Partial<Record<SyncState, string>> = {
  connecting: 'Workspace is reconnecting…',
  reconnecting: 'Live updates are paused. Reconnecting…',
  offline: 'Live updates are unavailable. Refresh before editing.',
}

// Two panes above 1024, one below. This is read in JavaScript rather than left
// to CSS because the two layouts do not show the same thing: on a phone the
// note replaces the list, on a laptop it sits beside it.
function useTwoPane() {
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches)
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)')
    const onChange = (event: MediaQueryListEvent) => setWide(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return wide
}

export default function App() {
  const {
    items, loading, error, syncState, cleanupWarning, dismissCleanupWarning,
    saveItem: persistItem, deleteItem: persistDelete, getAttachmentUrl,
  } = useWorkspaceItems()

  const twoPane = useTwoPane()
  const [screen, setScreen] = useState<Screen>('inbox')
  const [accountOpen, setAccountOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState<WorkspaceItem | null>(null)
  const [editingIsNew, setEditingIsNew] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [moreOpen, setMoreOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const selectedItem = selectedId ? items.find(item => item.id === selectedId) ?? null : null

  // Recent is what has moved, newest first — not everything that exists.
  //
  // Seeding the launch checklist and the reference pack writes eighty-odd rows
  // at once, all stamped with the same timestamp, and they would take the whole
  // of this list and bury the three things you actually wrote. They are not
  // recent activity; they are structure that arrived, and they already have a
  // pin of their own to live in. So a seeded record stays out of Recent until a
  // person touches it — the moment you tick it, edit it or file it, its
  // updatedAt moves and it turns up here as the activity it now is.
  // A launch task belongs to the Launch Checklist and is worked on there. It
  // does not also need to be activity in the Inbox: ticking six things off on a
  // Saturday would push everything you actually wrote off the bottom of Recent.
  const recent = useMemo(() => items
    .filter(item => item.kind !== 'Checklist' && !isUntouchedImport(item))
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)), [items])

  // Everything seeded and nothing worked on yet: the list is empty for a
  // reason worth saying, rather than looking like a workspace that lost its
  // contents.
  const onlySeeded = items.length > 0 && recent.length === 0

  // The one thing the pinned views cannot say on their own: what is sitting
  // waiting on somebody else, and what you said you were doing a week ago and
  // have not touched since. It appears only when there is something in it.
  const needsYou = useMemo(() => {
    const cutoff = Date.now() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000
    return items.filter(item => itemNeedsYou(item, cutoff))
  }, [items])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setAccountOpen(false)
      setMoreOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!accountOpen) return
    function onPointerDown(event: MouseEvent) {
      if (!(event.target as HTMLElement | null)?.closest('.account')) setAccountOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [accountOpen])

  // A file dropped anywhere on the page starts a note holding it. This is the
  // one piece of the old capture bar worth keeping on a laptop.
  useEffect(() => {
    function onDragOver(event: DragEvent) {
      if (event.dataTransfer?.types.includes('Files')) event.preventDefault()
    }
    function onDrop(event: DragEvent) {
      const dropped = Array.from(event.dataTransfer?.files ?? [])
      if (!dropped.length) return
      event.preventDefault()
      openNew('Notes', 'File', '', dropped)
    }
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
    }
  })

  async function openAttachment(attachment: Pick<WorkspaceAttachment, 'storagePath'>) {
    try {
      window.open(await getAttachmentUrl(attachment.storagePath), '_blank', 'noopener,noreferrer')
    } catch (reason) {
      window.alert(reason instanceof Error ? reason.message : 'Could not open this file.')
    }
  }

  async function signOut() {
    setAccountOpen(false)
    setSelectedId(null)
    setEditing(null)
    setPendingFiles([])
    setScreen('inbox')
    if (supabase) await supabase.auth.signOut()
  }

  async function saveItem(item: WorkspaceItem, files?: File[], removedAttachmentIds?: string[], links?: OutgoingLink[]) {
    // A pasted link is a link, not a note that happens to contain one. This is
    // the one thing Quick Add works out for you, because a URL on its own is
    // never the thing you meant to write down.
    const pasted = item.body.trim()
    const record = editingIsNew && item.kind === 'Note' && /^https?:\/\/\S+$/i.test(pasted)
      ? { ...item, kind: 'Link' as const, url: pasted, body: '', title: suggestTitleFromUrl(pasted) || item.title }
      : item
    await persistItem(record, files, removedAttachmentIds, links)
    setEditing(null)
    setPendingFiles([])
    // Saving a brand-new record opens it beside the list, because the thing you
    // just wrote is the thing you are most likely to want to look at. On a phone
    // that would replace the list you saved it into, so there Save just finishes
    // — and inside a view it would hide the view you were adding to, where the
    // new task or expense has just appeared and is the thing worth seeing.
    if (editingIsNew && twoPane && !onSavedView) setSelectedId(record.id)
  }

  function openNew(section: Section = 'Notes', kind?: ItemKind, body = '', files?: File[], area?: string) {
    const startingKind = kind ?? sectionKinds[section][0]
    const captured = body.trim()
    const capturedUrl = startingKind === 'Link' ? captured : undefined
    const suggested = capturedUrl ? suggestTitleFromUrl(capturedUrl)
      : captured ? suggestTitle(captured, startingKind)
        : files?.length ? suggestTitleFromFiles(files) : ''
    setEditing({
      id: createId(), title: suggested, body: capturedUrl ? '' : body, url: capturedUrl, kind: startingKind,
      section, ...defaultsForKind(startingKind, area),
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    })
    setEditingIsNew(true)
    setPendingFiles(files ?? [])
  }

  // The floating + never asks what you are adding. Standing in a view it adds
  // that view's thing; anywhere else it adds a plain note, and the note can be
  // given a shape later from the chips on its own screen. Being made to
  // classify a thought before it can be saved is the thing this app is not.
  function startAdd() {
    const view = savedViews.find(entry => entry.id === screen)
    if (view) return openNew(view.section, view.addKind)
    openNew('Notes')
  }

  function openEditor(item: WorkspaceItem) {
    setMoreOpen(false)
    setEditing(item)
    setEditingIsNew(false)
    setPendingFiles([])
  }

  async function deleteSelected() {
    if (!selectedItem) return
    await persistDelete(selectedItem.id)
    setConfirmDelete(false)
    setMoreOpen(false)
    setSelectedId(null)
  }

  // Completion is `status`, and this is the only thing that writes it. The box
  // in the Inbox, the box in the launch checklist and the Done chip in the
  // editor are three ways of pressing the same switch — when they were three
  // implementations they disagreed, and a task read as finished on one screen
  // and unfinished on another.
  async function toggleDone(item: WorkspaceItem, done: boolean) {
    // Each kind has its own word for finished — 'Selected' on a property,
    // 'Received' on a machine — and its own word for back on the pile.
    await persistItem({
      ...item,
      status: done ? finishedStatus(item.kind) : initialStatus(item.kind),
      updatedAt: new Date().toISOString(),
    })
  }

  // A record's own next steps. Saved the moment a box is ticked, so it travels
  // the same realtime channel as every other edit.
  async function saveTasks(item: WorkspaceItem, tasks: RecordTask[]) {
    await persistItem({ ...item, details: writeTasks(item.details, tasks), updatedAt: new Date().toISOString() })
  }

  // A launch task written straight onto the checklist. It is a real record like
  // any other — it opens, it carries next steps, it can be edited — but writing
  // one costs a line of text rather than a trip through the editor.
  async function addLaunchTask(title: string) {
    const now = new Date().toISOString()
    await persistItem({
      id: createId(), title, body: '', kind: 'Checklist', section: 'Store Setup',
      ...defaultsForKind('Checklist'),
      createdAt: now, updatedAt: now,
    })
  }

  // Renaming a task on the list. Emptying it deletes it, which is how you undo
  // one you did not mean to write without hunting for a delete.
  async function renameLaunchTask(task: WorkspaceItem, title: string) {
    if (!title) { await persistDelete(task.id); return }
    await persistItem({ ...task, title, updatedAt: new Date().toISOString() })
  }

  // Ticking a box that was written inside a note. The writing is the record, so
  // this is an ordinary save of the writing — no separate list to keep in step.
  async function saveBody(item: WorkspaceItem, body: string) {
    await persistItem({ ...item, body, updatedAt: new Date().toISOString() })
  }

  function outgoingOf(item: WorkspaceItem): OutgoingLink[] {
    return (item.links ?? []).filter(link => link.direction === 'from')
      .map(link => ({ itemId: link.itemId, relationship: link.relationship }))
  }

  async function connect(item: WorkspaceItem, link: OutgoingLink) {
    await persistItem(item, undefined, undefined, [...outgoingOf(item), link])
  }

  async function disconnect(item: WorkspaceItem, linkId: string) {
    const dropped = (item.links ?? []).find(link => link.id === linkId)
    if (!dropped || dropped.direction !== 'from') return
    await persistItem(item, undefined, undefined,
      outgoingOf(item).filter(link => !(link.itemId === dropped.itemId && link.relationship === dropped.relationship)))
  }

  // One click means one thing: click Suppliers, and the workspace shows
  // Suppliers. Leaving the open record in place meant the pin lit up, the back
  // button relabelled, and the pane you were looking at did not move.
  function openView(view: SavedViewId) {
    setSelectedId(null)
    setScreen(view)
  }

  function goHome() {
    setScreen('inbox')
    setSelectedId(null)
  }

  const syncMessage = loading ? '' : syncMessages[syncState] ?? ''
  // "Needs you" is a view without a pin of its own in the list, so looking it
  // up in savedViews alone left it rendering the Inbox instead of itself.
  const onSavedView = screen !== 'inbox'
  const savedView = savedViews.find(entry => entry.id === screen) ?? null
  // Standing in Locations the + adds a location, so that is what it is called.
  const addLabel = savedView ? savedView.addAction : 'Add note'
  // On a phone one region holds whatever is open, so it is named for what it is
  // currently showing. Announcing a view of the suppliers as "Inbox" tells a
  // screen reader the opposite of what everyone else can see.
  const paneLabel = onSavedView ? savedView?.label ?? 'Needs you' : 'Inbox'

  const savedViewScreen = onSavedView ? (
    <SavedViewScreen viewId={screen as SavedViewId} items={items} onBack={goHome} selectedId={selectedId}
      onOpen={item => setSelectedId(item.id)}
      onOpenAttachment={openAttachment} resolveUrl={getAttachmentUrl}
      onToggleDone={toggleDone} onAddTask={addLaunchTask} onRenameTask={renameLaunchTask}
      // The Launch Checklist writes its own tasks, on the list, in the row at
      // the foot of it. A + on the heading beside that would be two plus signs
      // on one screen doing the same job — and the one that opened a whole
      // editor to type a single line is the ceremony that row exists to remove.
      onAdd={!loading && !editing && screen !== 'checklist' ? startAdd : undefined} addLabel={addLabel} />
  ) : null

  const workspaceHeader = (
      <header className="topbar">
        <button className="brand" onClick={goHome}>
          <img className="brand-mark" src="/logo-mark.png" alt="" width={32} height={32} />
          <span>Boba Bear</span>
        </button>
        <div className="top-actions">
          <div className="account">
            <button className="avatar" aria-label="Account" aria-haspopup="menu" aria-expanded={accountOpen} onClick={() => setAccountOpen(value => !value)}>B</button>
            {accountOpen && (
              <div className="account-menu" role="menu">
                <p className="account-email">{workspaceEmail}</p>
                <p className="account-note">Shared Boba Bear workspace</p>
                <button role="menuitem" className="account-signout" onClick={signOut}>Sign out</button>
              </div>
            )}
          </div>
        </div>
      </header>
  )

  const listPane = (
    <>
      <header className="topbar">
        <button className="brand" onClick={goHome}>
          <img className="brand-mark" src="/logo-mark.png" alt="" width={32} height={32} />
          <span>Boba Bear</span>
        </button>
        <div className="top-actions">
          <div className="account">
            <button className="avatar" aria-label="Account" aria-haspopup="menu" aria-expanded={accountOpen} onClick={() => setAccountOpen(value => !value)}>B</button>
            {accountOpen && (
              <div className="account-menu" role="menu">
                <p className="account-email">{workspaceEmail}</p>
                <p className="account-note">Shared Boba Bear workspace</p>
                <button role="menuitem" className="account-signout" onClick={signOut}>Sign out</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="pane-body">
        {error && <div className="workspace-error" role="alert">{error}</div>}
        {cleanupWarning && <div className="workspace-warning" role="status">{cleanupWarning}<button aria-label="Dismiss file cleanup warning" onClick={dismissCleanupWarning}><X size={15} /></button></div>}
        {syncMessage && <div className="workspace-offline" role="status">{syncMessage}</div>}
        {loading
          ? <div className="workspace-loading">Opening your workspace…</div>
          // Results are a list of records with three lines each, and this rail
          // is 348px wide. They belong in the workspace, the way an open view
          // does — the rail keeps the field you are typing into and the pins.
          // On a laptop a view is content, not navigation, so it opens in the
          // wide pane and this side stays the Inbox with its pin marked. On a
          // phone there is one pane, so the view takes it.
          : onSavedView && !twoPane
              ? savedViewScreen
              : <InboxScreen items={items} recent={recent} needsYou={needsYou}
                activeView={onSavedView ? screen as SavedViewId : null}
                onOpenView={openView} onlySeeded={onlySeeded}
                onOpen={item => setSelectedId(item.id)} onToggleDone={toggleDone} selectedId={selectedId}
                // On a laptop the rail and an open view are both on screen, and
                // the + belongs to whichever one you are working in — otherwise
                // there are two of them, and the rail's is labelled for a view
                // it is not showing. The open view wins.
                onAdd={!loading && !editing && !onSavedView ? startAdd : undefined} addLabel={addLabel} />}
      </div>
    </>
  )

  const notePane = editing
    ? <Editor item={editing} isNew={editingIsNew} workspaceItems={items} pendingFiles={pendingFiles} onFilesChange={setPendingFiles}
      header={twoPane ? null : workspaceHeader}
      backLabel={savedView ? savedView.label : 'Inbox'}
      onOpenAttachment={openAttachment} resolveUrl={getAttachmentUrl}
      onClose={() => { setEditing(null); setPendingFiles([]) }} onSave={saveItem}
      onDelete={async () => { await persistDelete(editing.id); setSelectedId(null); setEditing(null); setPendingFiles([]) }} />
    : selectedItem
      ? <ItemDetail item={selectedItem} items={items} onBack={() => setSelectedId(null)}
        showBack={!twoPane || onSavedView} backLabel={savedView ? savedView.label : onSavedView ? 'Needs you' : ''}
        onMore={() => setMoreOpen(true)}
        header={twoPane ? null : workspaceHeader}
        onLink={link => connect(selectedItem, link)}
        onUnlink={linkId => disconnect(selectedItem, linkId)}
        onEdit={() => openEditor(selectedItem)}
        onOpenRelated={id => setSelectedId(id)}
        onOpenAttachment={openAttachment}
        resolveUrl={getAttachmentUrl}
        onTasksChange={tasks => saveTasks(selectedItem, tasks)}
        onBodyChange={body => saveBody(selectedItem, body)} />
      : twoPane ? savedViewScreen : null

  // A phone shows one thing at a time: the note if there is one, otherwise the
  // list. A laptop shows the Inbox beside whatever is open.
  const showingNote = Boolean(notePane || (!twoPane && onSavedView))

  // The window has two regions and they mean different things: the Inbox, which
  // is always there and is how you get anywhere, and the pane holding whatever
  // is currently open. On a phone only one of them is on screen at a time, and
  // that one is the main region. Naming them is what lets a screen reader — and
  // a test — tell navigation apart from the thing being worked on.
  return (
    <div className={twoPane ? 'app-shell two-pane' : 'app-shell'}>
      {twoPane
        ? <>
          <aside className="list-pane" data-pane="inbox" aria-label="Inbox">{listPane}</aside>
          <main className="note-pane" data-pane="content" aria-label="Workspace">{notePane ?? <EmptyNotePane onAdd={startAdd} />}</main>
        </>
        : showingNote && notePane
          ? <main className="note-pane" data-pane="content" aria-label="Workspace">{notePane}</main>
          : <main data-pane="inbox" aria-label={paneLabel}>{listPane}</main>}


      {moreOpen && selectedItem && (
        <BottomSheet title={selectedItem.title} onClose={() => { setMoreOpen(false); setConfirmDelete(false) }}>
          <SheetOption onClick={() => openEditor(selectedItem)}>Edit</SheetOption>
          {confirmDelete
            ? <>
              <p className="sheet-warning">This cannot be undone.</p>
              <SheetOption danger onClick={deleteSelected}>Delete permanently</SheetOption>
              <SheetOption onClick={() => setConfirmDelete(false)}>Keep it</SheetOption>
            </>
            : <SheetOption danger onClick={() => setConfirmDelete(true)}>Delete</SheetOption>}
        </BottomSheet>
      )}
    </div>
  )
}

// The home screen: what is pinned, then what has moved recently. No cards, no
// tiles, no charts — the writing is the interface.
function InboxScreen({ items, recent, needsYou, activeView, onlySeeded, onOpenView, onOpen, onToggleDone, selectedId, onAdd, addLabel }: {
  items: WorkspaceItem[]
  recent: WorkspaceItem[]
  needsYou: WorkspaceItem[]
  activeView: SavedViewId | null
  onlySeeded: boolean
  onOpenView: (id: SavedViewId) => void
  onOpen: (item: WorkspaceItem) => void
  onToggleDone: (item: WorkspaceItem, done: boolean) => Promise<void>
  selectedId: string | null
  // The one way to add, on the line that names the screen — the slot the
  // `Everything ▾` filter used to sit in. Absent while you are writing.
  onAdd?: () => void
  addLabel: string
}) {
  // The `Everything ▾` menu listed Notes, Tasks, Money, Locations, Suppliers,
  // Menu, Equipment, Marketing, Documents — which is the list of Views, printed
  // a second time three inches below itself. Two navigations for one set of
  // things is how a small app starts feeling like a large one.
  return (
    <section className="screen inbox">
      <div className="screen-heading">
        <h1>Inbox</h1>
        {onAdd && <button className="add-button" aria-label={addLabel} onClick={onAdd}><Plus size={20} strokeWidth={2} /></button>}
      </div>

      {/* On a workspace with nothing in it, this is the first thing to read.
          Below the pins it was clipped by the fold with the + painted over it. */}
      {items.length === 0 && <div className="empty-state welcome">
        <img src="/logo-mark.png" alt="" width={44} height={44} />
        <p>Your Boba Bear notebook is ready.</p>
        <small>Add a supplier, property, receipt, document, task, or anything you want to remember — or open a view below and start from a ready-made list.</small>
      </div>}

      {/* These are the whole navigation system, so they are here before there
          is anything to navigate to. Hiding them until the first record existed
          took the Launch Checklist and the Library off the screen — and with
          them the two buttons that seed a brand-new workspace, which is exactly
          when somebody needs them.
          "Pinned" was left over from an earlier concept and was a lie three
          times over: nobody pinned these, they cannot be unpinned, and they are
          not a chosen subset of anything. They are the eight areas the business
          has. Unpinning Money would only raise the question of where Money went. */}
      <>
        <p className="eyebrow">Views</p>
        <div className="pin-list">
          {needsYou.length > 0 && (
            <button className={activeView === 'needs-you' ? 'pin-row active' : 'pin-row'} onClick={() => onOpenView('needs-you')}>
              <strong>Needs you</strong>
              <small>{needsYou.length} waiting or untouched</small>
            </button>
          )}
          {savedViews.map(view => (
            <button className={activeView === view.id ? 'pin-row active' : 'pin-row'} key={view.id} onClick={() => onOpenView(view.id)}>
              <strong>{view.label}</strong>
              <small>{savedViewSummary(view.id, items)}</small>
            </button>
          ))}
        </div>
      </>

      {items.length > 0 && <p className="eyebrow">Recent</p>}
      {recent.length === 0
        ? items.length === 0 ? null : <div className="empty-state">
          <p>{onlySeeded ? 'Nothing worked on yet.' : 'Nothing here yet.'}</p>
          {onlySeeded && <small>What you have imported is waiting in the views above. Anything you touch shows up here.</small>}
        </div>
        : <div className="item-list">
          {recent.map(item => (
            <ItemRow key={item.id} item={item} onOpen={onOpen}
              onToggleDone={completable(item) ? onToggleDone : undefined}
              showStatus={statusIsTelling(recent)} selected={item.id === selectedId} />
          ))}
        </div>}
    </section>
  )
}

function SavedViewScreen(props: Parameters<typeof SavedViewBody>[0] & {
  onBack: () => void
  onAdd?: () => void
  addLabel: string
}) {
  const view = savedViews.find(entry => entry.id === props.viewId)
  const label = view?.label ?? 'Needs you'
  const count = savedViewCount(props.viewId, props.items)
  return (
    <section className="screen saved-view">
      <button className="detail-back" onClick={props.onBack}><ArrowLeft size={18} strokeWidth={1.75} /> Inbox</button>
      <div className="screen-heading">
        <h1>{label}{count > 0 && <span className="screen-count">{count}</span>}</h1>
        {props.onAdd && <button className="add-button" aria-label={props.addLabel} onClick={props.onAdd}><Plus size={20} strokeWidth={2} /></button>}
      </div>
      <SavedViewBody {...props} />
    </section>
  )
}

// The right-hand pane before anything is chosen. One sentence and the same
// action the floating button performs, rather than a wall of onboarding.
function EmptyNotePane({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="empty-note">
      <img src="/logo-mark.png" alt="" width={48} height={48} />
      <p>Nothing open.</p>
      <button className="ghost-button" onClick={onAdd}><Plus size={18} strokeWidth={1.75} /> Start a note</button>
    </div>
  )
}
