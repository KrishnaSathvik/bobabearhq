import { useState } from 'react'
import { Check, ChevronDown, ChevronUp, Plus, X } from 'lucide-react'
import { newTask, readTasks, type RecordTask } from '../lib/tasks'
import type { WorkspaceItem } from '../types'

// The two or three moves that belong to one record: visit the property on a
// Saturday, confirm the MOQ, test our own cup in the sealer. Ticking a box
// saves immediately — there is no edit mode to enter and no Save to remember,
// which is the whole reason a box beats a sentence.
// `quietWhenEmpty` is for a record that is mostly writing. A note is one
// sentence; putting an empty NEXT STEPS heading and an input under it turns
// that sentence into a form to be completed. Empty, it is a single small
// invitation; the moment there is one step, it is the full list.
export function RecordChecklist({ item, onChange, quietWhenEmpty = false }: {
  item: WorkspaceItem
  onChange: (tasks: RecordTask[]) => Promise<void>
  quietWhenEmpty?: boolean
}) {
  const tasks = readTasks(item)
  const [opened, setOpened] = useState(false)
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const done = tasks.filter(task => task.done).length

  async function commit(next: RecordTask[]) {
    setBusy(true)
    setError('')
    try {
      await onChange(next)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save that step.')
    } finally {
      setBusy(false)
    }
  }

  function move(index: number, by: number) {
    const next = [...tasks]
    const target = index + by
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    void commit(next)
  }

  async function add() {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    await commit([...tasks, newTask(text)])
  }

  async function saveEdit() {
    const text = editingText.trim()
    const id = editingId
    setEditingId(null)
    if (!id) return
    // Emptying a step is how you delete one while renaming it.
    await commit(text ? tasks.map(task => task.id === id ? { ...task, text } : task) : tasks.filter(task => task.id !== id))
  }

  if (quietWhenEmpty && tasks.length === 0 && !opened) return (
    <button className="record-checklist-offer" onClick={() => setOpened(true)}>
      <Plus size={14} strokeWidth={2} /> Add next steps
    </button>
  )

  return (
    <section className="record-checklist" aria-label="Next steps">
      <h2>Next steps{tasks.length > 0 && <span>{done} of {tasks.length}</span>}</h2>
      {tasks.map((task, index) => (
        <div className={task.done ? 'record-task done' : 'record-task'} key={task.id}>
          <button className="check-toggle" disabled={busy}
            aria-label={task.done ? `Mark ${task.text} not done` : `Mark ${task.text} done`}
            onClick={() => commit(tasks.map(entry => entry.id === task.id ? { ...entry, done: !entry.done } : entry))}>
            {task.done && <Check size={13} strokeWidth={2.5} />}
          </button>
          {editingId === task.id
            ? <input className="record-task-edit" autoFocus value={editingText} aria-label={`Edit ${task.text}`}
              onChange={event => setEditingText(event.target.value)}
              onBlur={saveEdit}
              onKeyDown={event => {
                if (event.key === 'Enter') { event.preventDefault(); void saveEdit() }
                if (event.key === 'Escape') setEditingId(null)
              }} />
            : <button className="record-task-text" onClick={() => { setEditingId(task.id); setEditingText(task.text) }}>{task.text}</button>}
          <span className="record-task-actions">
            <button aria-label={`Move ${task.text} up`} disabled={busy || index === 0} onClick={() => move(index, -1)}><ChevronUp size={14} /></button>
            <button aria-label={`Move ${task.text} down`} disabled={busy || index === tasks.length - 1} onClick={() => move(index, 1)}><ChevronDown size={14} /></button>
            <button aria-label={`Delete ${task.text}`} disabled={busy} onClick={() => commit(tasks.filter(entry => entry.id !== task.id))}><X size={14} /></button>
          </span>
        </div>
      ))}
      <div className="record-task-add">
        <Plus size={15} strokeWidth={2} />
        <input value={draft} placeholder="Add a step…" aria-label="Add a step"
          onChange={event => setDraft(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void add() } }} />
      </div>
      {error && <p className="checklist-error" role="alert">{error}</p>}
    </section>
  )
}
