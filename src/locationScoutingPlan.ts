import type { WorkspaceItem } from './types'

export type LocationPlanItem = Omit<WorkspaceItem, 'id' | 'createdAt' | 'updatedAt'> & { importKey: string }

const areas = [
  ['near-ibaco', 'Near Ibaco'],
  ['near-zudio', 'Near Zudio'],
  ['near-unlimited', 'Near Unlimited'],
  ['kaviraj-nagar', 'Kaviraj Nagar'],
  ['varadiah-nagar', 'Varadiah Nagar'],
  ['rotary-nagar', 'Rotary Nagar'],
  ['mamatha-hospital-road', 'Mamatha Hospital Road'],
] as const

export const locationScoutingPlan: LocationPlanItem[] = areas.map(([key, area]) => ({
  importKey: `location-${key}`,
  title: `${area} — location search`,
  body: 'Add each property found in this area, then record the visit details, current rent quote, utilities, access, footfall, photos, pros, and concerns.',
  kind: 'Location',
  section: 'Store Setup',
  area: 'Locations',
  status: 'Researching',
  source: 'Boba Bear location search notes',
  details: { searchArea: area },
}))
