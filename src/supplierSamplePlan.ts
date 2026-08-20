import type { WorkspaceItem } from './types'

export type SupplierSamplePlanItem = Omit<WorkspaceItem, 'id' | 'createdAt' | 'updatedAt'> & { importKey: string }

export const supplierSamplePlan: SupplierSamplePlanItem[] = [
  {
    importKey: 'sample-plan-tea-planet', title: 'Tea Planet — first sample request',
    body: 'Request representative samples for milk-tea powders, lassi flavors, popping boba, and tapioca. Add individual records later when exact SKUs and prices arrive.',
    kind: 'Sample', section: 'Suppliers', area: 'Tea Planet', status: 'Sample needed', source: 'Boba Bear supplier plan',
    url: 'https://theteaplanet.com/', details: { supplier: 'The Tea Planet', category: 'Powders, lassi flavors, popping boba, tapioca', labelCheck: 'Not checked' },
  },
  {
    importKey: 'sample-plan-qqs', title: 'QQS — first powder sample request',
    body: 'Request Mango / Alphonso, Strawberry, Butterscotch, Papaya, and Honeydew powder samples. Confirm the actual seller and product labels before ordering.',
    kind: 'Sample', section: 'Suppliers', area: 'QQS Bubble Tea', status: 'Sample needed', source: 'Boba Bear supplier plan',
    url: 'https://www.indiamart.com/qqsbubbletea/', details: { supplier: 'QQS Bubble Tea', category: 'Milk-tea powders', labelCheck: 'Not checked' },
  },
  {
    importKey: 'sample-plan-zawaa', title: 'Zawaa — matcha and jelly samples',
    body: 'Request Matcha powder plus Strawberry, Pineapple, and Lychee jelly samples. Record delivered price, shelf life, and tasting results.',
    kind: 'Sample', section: 'Suppliers', area: 'Zawaa Foods', status: 'Sample needed', source: 'Boba Bear supplier plan',
    url: 'https://zawaafoods.com/', details: { supplier: 'Zawaa Foods', category: 'Matcha powder and jellies', labelCheck: 'Not checked' },
  },
  {
    importKey: 'sample-plan-local', title: 'Local Khammam — ingredient trials',
    body: 'Compare local milk, curd/yogurt, tea, sugar, ice, and water sources. Create separate records when shops and delivered prices are known.',
    kind: 'Sample', section: 'Suppliers', area: 'Local Khammam', status: 'Researching', source: 'Boba Bear supplier plan',
    details: { supplier: 'Local Khammam suppliers', category: 'Fresh and everyday ingredients', labelCheck: 'Not applicable / review invoices' },
  },
]
