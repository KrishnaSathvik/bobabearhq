import { MapPin, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { WorkspaceItem } from '../types'

type Props = {
  locations: WorkspaceItem[]
  onAdd: () => void
  onAddStarterPlan: () => Promise<void>
}

export function LocationScoutingOverview({ locations, onAdd, onAddStarterPlan }: Props) {
  const [addingPlan, setAddingPlan] = useState(false)
  const [error, setError] = useState('')
  const counts = useMemo(() => ({
    saved: locations.filter(item => item.status === 'Researching').length,
    visited: locations.filter(item => item.status === 'Visited').length,
    shortlisted: locations.filter(item => item.status === 'Shortlisted').length,
  }), [locations])

  if (locations.length === 0) return (
    <section className="sample-empty">
      <div className="sample-empty-icon"><MapPin size={20} /></div>
      <div><strong>Start the location search</strong><p>Add the seven Khammam search areas, then create or update a record whenever you find or visit a property.</p>{error && <small>{error}</small>}</div>
      <button disabled={addingPlan} onClick={async () => { setAddingPlan(true); setError(''); try { await onAddStarterPlan() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not add the location plan.') } finally { setAddingPlan(false) } }}>{addingPlan ? 'Adding…' : 'Add search areas'}</button>
    </section>
  )

  return (
    <section className="sample-overview" aria-label="Location scouting tracker">
      <div className="sample-overview-title"><MapPin size={18} /><strong>Location scouting</strong></div>
      <div className="sample-stat"><span>Saved</span><strong>{counts.saved}</strong></div>
      <div className="sample-stat"><span>Visited</span><strong>{counts.visited}</strong></div>
      <div className="sample-stat"><span>Shortlist</span><strong>{counts.shortlisted}</strong></div>
      <button onClick={onAdd}><Plus size={15} /> Add property</button>
    </section>
  )
}
