import type { WorkspaceItem } from './types'

export type LaunchChecklistItem = Omit<WorkspaceItem, 'id' | 'createdAt' | 'updatedAt'> & { importKey: string }

const phases: Array<[string, string[]]> = [
  ['Planning', [
    'Review the working brand name and trademark search',
    'Recheck dedicated boba competitors in Khammam',
    'Decide the opening-board menu after sample tasting',
    'Confirm which drinks and toppings stay out of launch',
  ]],
  ['Location & legal', [
    'Visit and compare at least three actual properties',
    'Check water, drainage, power, signage, AC, waste and delivery access',
    'Review the lease, deposit, rent, escalation and exit terms',
    'Confirm the current FSSAI filing path',
    'Confirm Khammam trade permission and Telangana registrations',
    'Check GST treatment with a Telangana CA',
    'Confirm fire-safety requirements',
  ]],
  ['Suppliers & menu testing', [
    'Request current catalogs, samples, quotes, MOQ and lead times',
    'Check supplier labels, invoices and FSSAI information',
    'Taste-test every proposed launch flavor and topping',
    'Record standard recipes, dose, yield and landed cost',
    'Test tea brewing, tapioca holding time and discard limits',
    'Select primary and backup sources for critical ingredients',
  ]],
  ['Equipment & store setup', [
    'Finalize the counter and drink-making workflow',
    'Test cup, sealing film and cup-sealer compatibility',
    'Choose blender, refrigeration, RO, cooking and stainless equipment',
    'Plan sinks, handwashing, storage and drainage',
    'Choose POS, printer, UPI, internet, CCTV and backup power',
    'Test the Kraft takeaway and delivery packaging',
    'Complete equipment stress tests, pest control and deep cleaning',
  ]],
  ['People & operations', [
    'Decide opening staffing and peak-hour backup coverage',
    'Write recipe, opening, closing, cleaning and waste procedures',
    'Train drink preparation, sealing, hygiene and allergen communication',
    'Run mock rushes and verify consistent drinks and leak-free cups',
  ]],
  ['Prelaunch & opening', [
    'Create consistent Google, Instagram and WhatsApp business profiles',
    'Photograph the actual drinks, store and packaging',
    'Run a friends-and-family service test',
    'Complete delivery travel tests before enabling delivery platforms',
    'Run a short soft launch and record wait time, remakes, waste and feedback',
    'Review the first 30 days using actual sales, costs and customer feedback',
  ]],
]

function keyFor(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 64)
}

export const launchChecklistPlan: LaunchChecklistItem[] = phases.flatMap(([phase, tasks], phaseIndex) => tasks.map((task, taskIndex) => ({
  importKey: `checklist-${keyFor(task)}`,
  title: task,
  body: '',
  kind: 'Checklist',
  section: 'Store Setup',
  area: 'Launch Checklist',
  status: 'Researching',
  source: 'Launch Checklist v3.1, reviewed for the current prelaunch workspace',
  details: { phase, completed: 'false', sortOrder: String(phaseIndex * 100 + taskIndex) },
})))
