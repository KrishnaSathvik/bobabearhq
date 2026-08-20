export type Section = 'Notes' | 'Menu' | 'Suppliers' | 'Store Setup' | 'Marketing' | 'Money' | 'Library'

export type ItemKind = 'Note' | 'Link' | 'File' | 'Expense'

export type WorkspaceItem = {
  id: string
  title: string
  body: string
  kind: ItemKind
  section: Section
  area?: string
  url?: string
  amount?: string
  createdAt: string
  updatedAt: string
}
