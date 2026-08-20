import { FlaskConical, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { WorkspaceItem } from '../types'

type SupplierSampleOverviewProps = {
  samples: WorkspaceItem[]
  onAdd: () => void
  onAddStarterPlan: () => Promise<void>
}

export function SupplierSampleOverview({ samples, onAdd, onAddStarterPlan }: SupplierSampleOverviewProps) {
  const [addingPlan, setAddingPlan] = useState(false)
  const [error, setError] = useState('')
  const counts = useMemo(() => ({
    open: samples.filter(item => ['Researching', 'Sample needed', 'Requested', 'Ordered', 'Received'].includes(item.status ?? '')).length,
    testing: samples.filter(item => item.status === 'Testing').length,
    selected: samples.filter(item => item.status === 'Selected').length,
  }), [samples])

  if (samples.length === 0) return (
    <section className="sample-empty">
      <div className="sample-empty-icon"><FlaskConical size={20} /></div>
      <div><strong>Start tracking supplier samples</strong><p>Create the Tea Planet, QQS, Zawaa, and local Khammam starter records, then update them as quotes and samples arrive.</p>{error && <small>{error}</small>}</div>
      <button disabled={addingPlan} onClick={async () => { setAddingPlan(true); setError(''); try { await onAddStarterPlan() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not add the sample plan.') } finally { setAddingPlan(false) } }}>{addingPlan ? 'Adding…' : 'Add starter plan'}</button>
    </section>
  )

  return (
    <section className="sample-overview" aria-label="Supplier sample tracker">
      <div className="sample-overview-title"><FlaskConical size={18} /><strong>Sample tracker</strong></div>
      <div className="sample-stat"><span>Open</span><strong>{counts.open}</strong></div>
      <div className="sample-stat"><span>Testing</span><strong>{counts.testing}</strong></div>
      <div className="sample-stat"><span>Selected</span><strong>{counts.selected}</strong></div>
      <button onClick={onAdd}><Plus size={15} /> Add sample</button>
    </section>
  )
}
