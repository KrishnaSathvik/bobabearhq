import type { WorkspaceItem } from './types'

export const starterItems: WorkspaceItem[] = [
  {
    id: 'tea-planet',
    title: 'Tea Planet sample questions',
    body: 'Ask about sample pricing, MOQ, delivery time to Khammam, and label information.',
    kind: 'Note',
    section: 'Suppliers',
    area: 'Tea Planet',
    url: 'https://theteaplanet.com/',
    createdAt: '2026-08-20T09:00:00.000Z',
    updatedAt: '2026-08-20T09:00:00.000Z',
  },
  {
    id: 'kraft-carrier',
    title: 'Kraft paper cup carrier',
    body: 'Built-in handle direction for takeaway and delivery orders. Compare one-cup and two-cup versions.',
    kind: 'Link',
    section: 'Store Setup',
    area: 'Packaging',
    url: 'https://store.yenchuan.co/products/packaging/carriers/craft-paper-cup-carrier-2-cups/',
    createdAt: '2026-08-19T10:00:00.000Z',
    updatedAt: '2026-08-19T10:00:00.000Z',
  },
  {
    id: 'mango-milk-tea',
    title: 'Mango / Alphonso Milk Tea',
    body: 'Planning price: ₹149 small / ₹199 regular. Taste and supplier still need validation.',
    kind: 'Note',
    section: 'Menu',
    area: 'Milk Tea',
    createdAt: '2026-08-18T10:00:00.000Z',
    updatedAt: '2026-08-18T10:00:00.000Z',
  },
]

export const sectionAreas: Record<string, string[]> = {
  Notes: ['General', 'Unsorted'],
  Menu: ['Milk Tea', 'Fruit Tea', 'Boba Lassi', 'Toppings', 'Preparation'],
  Suppliers: ['Tea Planet', 'QQS Bubble Tea', 'Zawaa Foods', 'Local Khammam', 'Other'],
  'Store Setup': ['Locations', 'Equipment', 'Packaging', 'Décor', 'Legal', 'Store Workflow'],
  Marketing: ['Influencers', 'Instagram', 'Promotions', 'Ideas'],
  Money: ['Estimate', 'Quote', 'Purchase', 'Expense'],
  Library: ['Document', 'Spreadsheet', 'Photo', 'Screenshot', 'Reference Link'],
}
