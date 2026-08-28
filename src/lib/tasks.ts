import { createId } from './ids'
import { isFinished, type WorkspaceItem } from '../types'

// A record's own short list of next steps: a property has "visit Saturday
// evening, check drainage, negotiate deposit" and a supplier has "ask for
// samples, confirm MOQ". Tiny on purpose — text, a box and an order, and
// nothing else. The Launch Checklist is where a plan lives; this is where the
// two or three moves belonging to one record live.
export type RecordTask = { id: string; text: string; done: boolean }

const TASKS_KEY = 'checklist'

// Stored as JSON under one details key, so it travels with the record through
// the same save, the same realtime channel and the same offline copy as every
// other field. A malformed value reads as an empty list rather than throwing
// the record away.
export function readTasks(item: Pick<WorkspaceItem, 'details'> | undefined): RecordTask[] {
  const raw = item?.details?.[TASKS_KEY]
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap(entry => {
      if (!entry || typeof entry !== 'object') return []
      const task = entry as Partial<RecordTask>
      const text = typeof task.text === 'string' ? task.text : ''
      if (!text.trim()) return []
      return [{ id: typeof task.id === 'string' && task.id ? task.id : createId(), text, done: task.done === true }]
    })
  } catch {
    return []
  }
}

// An empty list removes the key rather than storing "[]", so a record that
// never grew a checklist carries no trace of one.
export function writeTasks(details: Record<string, string> | undefined, tasks: RecordTask[]): Record<string, string> | undefined {
  const next = { ...details }
  if (tasks.length) next[TASKS_KEY] = JSON.stringify(tasks)
  else delete next[TASKS_KEY]
  return Object.keys(next).length ? next : undefined
}

export function newTask(text: string): RecordTask {
  return { id: createId(), text, done: false }
}

// The one question everything asks about a launch task. Completion lives in
// `status` and nowhere else: a box in the Inbox, a box in the checklist widget
// and the Done chip in the editor are three ways of writing the same field.
// Each kind spells "finished" its own way, so the word is looked up rather
// than compared against a literal.
export function isDone(item: Pick<WorkspaceItem, 'status' | 'kind'>) {
  return isFinished(item.kind, item.status)
}

export { TASKS_KEY }
