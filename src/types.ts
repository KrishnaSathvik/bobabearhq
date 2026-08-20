export type Section = 'Notes' | 'Menu' | 'Suppliers' | 'Store Setup' | 'Marketing' | 'Money' | 'Library'

export type ItemKind = 'Note' | 'Link' | 'File' | 'Expense' | 'Quote' | 'Product' | 'Sample' | 'Location' | 'Checklist'
export type ItemStatus = 'Reference' | 'Researching' | 'Sample needed' | 'Requested' | 'Ordered' | 'Received' | 'Testing' | 'Visited' | 'Shortlisted' | 'Selected' | 'Not selected'

export type WorkspaceAttachment = {
  id: string
  name: string
  storagePath: string
  mimeType?: string
  sizeBytes?: number
}

export type WorkspaceItem = {
  id: string
  title: string
  body: string
  kind: ItemKind
  section: Section
  area?: string
  url?: string
  amount?: string
  status?: ItemStatus
  source?: string
  importKey?: string
  details?: Record<string, string>
  attachments?: WorkspaceAttachment[]
  createdAt: string
  updatedAt: string
}
