import { Check, ListChecks, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { WorkspaceItem } from '../types'

type Props = {
  tasks: WorkspaceItem[]
  onAdd: () => void
  onAddStarterPlan: () => Promise<void>
  onOpen: (item: WorkspaceItem) => void
  onToggle: (item: WorkspaceItem, completed: boolean) => Promise<void>
}

const phaseOrder = ['Planning', 'Location & legal', 'Suppliers & menu testing', 'Equipment & store setup', 'People & operations', 'Prelaunch & opening', 'Other']

export function LaunchChecklist({ tasks, onAdd, onAddStarterPlan, onOpen, onToggle }: Props) {
  const [addingPlan, setAddingPlan] = useState(false)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const completed = tasks.filter(item => item.details?.completed === 'true').length
  const grouped = useMemo(() => tasks.reduce<Record<string, WorkspaceItem[]>>((result, task) => {
    const phase = task.details?.phase || 'Other'
    result[phase] = [...(result[phase] ?? []), task]
    return result
  }, {}), [tasks])

  if (tasks.length === 0) return (
    <section className="sample-empty">
      <div className="sample-empty-icon"><ListChecks size={20} /></div>
      <div><strong>Add the launch checklist</strong><p>Start with practical prelaunch steps. Every task remains editable, and all tasks begin unchecked.</p>{error && <small>{error}</small>}</div>
      <button disabled={addingPlan} onClick={async () => { setAddingPlan(true); setError(''); try { await onAddStarterPlan() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not add the checklist.') } finally { setAddingPlan(false) } }}>{addingPlan ? 'Adding…' : 'Add checklist'}</button>
    </section>
  )

  return (
    <section className="launch-checklist" aria-label="Launch checklist">
      <header>
        <div><span><ListChecks size={18} /> Launch checklist</span><strong>{completed} of {tasks.length}</strong></div>
        <button onClick={onAdd}><Plus size={15} /> Add task</button>
      </header>
      <div className="checklist-progress"><span style={{ width: `${tasks.length ? (completed / tasks.length) * 100 : 0}%` }} /></div>
      {Object.entries(grouped).sort(([a], [b]) => phaseOrder.indexOf(a) - phaseOrder.indexOf(b)).map(([phase, phaseTasks]) => (
        <div className="checklist-phase" key={phase}>
          <h2>{phase}</h2>
          {[...phaseTasks].sort((a, b) => Number(a.details?.sortOrder ?? 9999) - Number(b.details?.sortOrder ?? 9999)).map(task => {
            const checked = task.details?.completed === 'true'
            return <div className={checked ? 'checklist-row checked' : 'checklist-row'} key={task.id}>
              <button className="check-toggle" aria-label={checked ? `Mark ${task.title} incomplete` : `Mark ${task.title} complete`} disabled={updatingId === task.id} onClick={async () => { setUpdatingId(task.id); setError(''); try { await onToggle(task, !checked) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update the task.') } finally { setUpdatingId(null) } }}>{checked && <Check size={14} />}</button>
              <button className="check-title" onClick={() => onOpen(task)}>{task.title}</button>
            </div>
          })}
        </div>
      ))}
      {error && <p className="checklist-error">{error}</p>}
    </section>
  )
}
