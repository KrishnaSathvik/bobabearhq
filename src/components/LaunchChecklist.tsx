import { Check, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { isDone } from '../lib/tasks'
import type { WorkspaceItem } from '../types'

type Props = {
  tasks: WorkspaceItem[]
  onToggle: (item: WorkspaceItem, done: boolean) => Promise<void>
  // Renaming in place. Emptying a task is how you delete one while renaming it,
  // which is the same bargain the next-steps list on a record makes.
  onRename: (task: WorkspaceItem, title: string) => Promise<void>
  // Writing a task here rather than opening the editor for it. A launch task is
  // a line of text; making you open a full record page to type one is why the
  // list only ever got filled from a starter pack.
  onAdd: (title: string) => Promise<void>
}

// One list, in the order you wrote it.
//
// Tasks used to be grouped under twelve phase headings — Business setup,
// Compliance, Opening readiness — and every new one had to pick a phase before
// it could exist. That is filing standing in front of writing, and it was
// filing into a taxonomy nobody had chosen: the phases came with the starter
// plan, and the starter plan is gone. Old tasks keep whatever phase they were
// saved with; nothing reads it any more.
export function LaunchChecklist({ tasks, onToggle, onRename, onAdd }: Props) {
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')

  async function saveEdit(task: WorkspaceItem) {
    const title = editingText.trim()
    setEditingId(null)
    if (title === task.title) return
    setError('')
    try {
      await onRename(task, title)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save that task.')
    }
  }
  const completed = tasks.filter(isDone).length
  const percent = tasks.length ? Math.round((completed / tasks.length) * 100) : 0

  // Whatever order the workspace put them in, oldest first, so a list you have
  // been adding to reads top to bottom the way you wrote it.
  const ordered = useMemo(() => [...tasks].sort((a, b) => {
    const order = Number(a.details?.sortOrder ?? 9999) - Number(b.details?.sortOrder ?? 9999)
    return order || Date.parse(a.createdAt) - Date.parse(b.createdAt)
  }), [tasks])

  async function add() {
    const title = draft.trim()
    if (!title || adding) return
    setAdding(true)
    setError('')
    try {
      await onAdd(title)
      setDraft('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not add that task.')
    } finally {
      setAdding(false)
    }
  }

  // A leading + so the row reads as somewhere to write before you have written
  // anything, and Enter as the only way to commit.
  const addRow = (
    <div className="checklist-add">
      <Plus size={15} strokeWidth={2} />
      <input value={draft} placeholder="Add a task…" aria-label="Add a launch task" disabled={adding}
        onChange={event => setDraft(event.target.value)}
        onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void add() } }} />
    </div>
  )

  if (tasks.length === 0) return (
    <section className="launch-checklist" aria-label="Launch checklist">
      <p className="quiet-offer">No launch tasks yet. Write the first one.</p>
      {addRow}
      {error && <p className="checklist-error">{error}</p>}
    </section>
  )

  return (
    <section className="launch-checklist" aria-label="Launch checklist">
      <header>
        <span>{completed} of {tasks.length} complete</span>
        {/* The bar already draws the fraction; the number beside it is for the
            glance that does not stop to measure a bar. */}
        <span className="checklist-percent">{percent}%</span>
      </header>
      <div className="checklist-progress"><span style={{ width: `${percent}%` }} /></div>
      <div className="checklist-list">
        {ordered.map(task => {
          const checked = isDone(task)
          return <div className={checked ? 'checklist-row checked' : 'checklist-row'} key={task.id}>
            <button className="check-toggle" aria-label={checked ? `Mark ${task.title} incomplete` : `Mark ${task.title} complete`} disabled={updatingId === task.id} onClick={async () => { setUpdatingId(task.id); setError(''); try { await onToggle(task, !checked) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update the task.') } finally { setUpdatingId(null) } }}>{checked && <Check size={14} />}</button>
            {/* Tapping the words edits the words. It used to open a whole
                record page — a page about one line of text, which is more
                ceremony than the thing it is describing. */}
            {editingId === task.id
              ? <input className="check-title-edit" autoFocus value={editingText} aria-label={`Edit ${task.title}`}
                onChange={event => setEditingText(event.target.value)}
                onBlur={() => saveEdit(task)}
                onKeyDown={event => {
                  if (event.key === 'Enter') { event.preventDefault(); void saveEdit(task) }
                  if (event.key === 'Escape') setEditingId(null)
                }} />
              : <button className="check-title" onClick={() => { setEditingId(task.id); setEditingText(task.title) }}>{task.title}</button>}
          </div>
        })}
      </div>
      {addRow}
      {error && <p className="checklist-error">{error}</p>}
    </section>
  )
}
