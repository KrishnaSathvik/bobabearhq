import { useMemo } from 'react'
import type { WorkspaceItem } from '../types'

type SupplierSampleOverviewProps = {
  samples: WorkspaceItem[]
}

export function SupplierSampleOverview({ samples }: SupplierSampleOverviewProps) {
  // Where the parcels are. A sample's status is its journey — needed, asked
  // for, arrived — and never a verdict on the product: what you thought of it
  // lives in the tasting fields, which is why "tasted" is read from those and
  // not from a status anybody has to remember to set.
  const counts = useMemo(() => ({
    needed: samples.filter(item => item.status === 'Needed').length,
    ordered: samples.filter(item => item.status === 'Ordered').length,
    received: samples.filter(item => item.status === 'Received').length,
    tasted: samples.filter(item => Boolean(item.details?.tasteDate) || Boolean(item.details?.tasteScore)).length,
  }), [samples])

  // No button here either: the floating + adds a sample from this screen.
  if (samples.length === 0) return <p className="quiet-offer">No samples yet.</p>

  return (
    <p className="sample-overview" aria-label="Supplier sample tracker">
      <span className="sample-stat"><strong>{counts.needed}</strong> needed</span>
      <span className="sample-stat"><strong>{counts.ordered}</strong> ordered</span>
      <span className="sample-stat"><strong>{counts.received}</strong> received</span>
      <span className="sample-stat"><strong>{counts.tasted}</strong> tasted</span>
    </p>
  )
}
