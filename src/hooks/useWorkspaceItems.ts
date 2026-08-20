import { useCallback, useEffect, useState } from 'react'
import { starterItems } from '../data'
import { referenceCatalog } from '../referenceCatalog'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { WorkspaceAttachment, WorkspaceItem } from '../types'

type ItemRow = {
  id: string
  title: string
  body: string
  kind: WorkspaceItem['kind']
  section: WorkspaceItem['section']
  area: string | null
  url: string | null
  amount: number | null
  status: WorkspaceItem['status'] | null
  source: string | null
  import_key: string | null
  details: Record<string, string> | null
  created_at: string
  updated_at: string
}

type AttachmentRow = {
  id: string
  item_id: string
  name: string
  storage_path: string
  mime_type: string | null
  size_bytes: number | null
}

function fromRow(row: ItemRow): WorkspaceItem {
  return { id: row.id, title: row.title, body: row.body, kind: row.kind, section: row.section,
    area: row.area ?? undefined, url: row.url ?? undefined,
    amount: row.amount == null ? undefined : String(row.amount), status: row.status ?? undefined,
    source: row.source ?? undefined, importKey: row.import_key ?? undefined,
    details: row.details ?? undefined,
    createdAt: row.created_at, updatedAt: row.updated_at }
}

function loadLocalItems() {
  const stored = localStorage.getItem('boba-bear-items')
  return stored ? (JSON.parse(stored) as WorkspaceItem[]) : starterItems
}

export function useWorkspaceItems() {
  const [items, setItems] = useState<WorkspaceItem[]>(loadLocalItems)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [error, setError] = useState('')

  const loadRemoteItems = useCallback(async (id: string) => {
    if (!supabase) return
    const [{ data, error: queryError }, { data: attachmentData, error: attachmentError }] = await Promise.all([
      supabase.from('items').select('*').eq('workspace_id', id).order('updated_at', { ascending: false }),
      supabase.from('attachments').select('*').eq('workspace_id', id).order('created_at', { ascending: true }),
    ])
    if (queryError) throw queryError
    if (attachmentError) throw attachmentError
    const attachments = (attachmentData as AttachmentRow[]).reduce<Record<string, WorkspaceAttachment[]>>((grouped, row) => {
      const attachment = { id: row.id, name: row.name, storagePath: row.storage_path,
        mimeType: row.mime_type ?? undefined, sizeBytes: row.size_bytes ?? undefined }
      grouped[row.item_id] = [...(grouped[row.item_id] ?? []), attachment]
      return grouped
    }, {})
    setItems((data as ItemRow[]).map(row => ({ ...fromRow(row), attachments: attachments[row.id] ?? [] })))
  }, [])

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    let active = true
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function connect() {
      try {
        const { data: authData } = await supabase!.auth.getUser()
        const user = authData.user
        if (!user) return
        const { data: membership, error: membershipError } = await supabase!
          .from('workspace_members').select('workspace_id').eq('user_id', user.id).limit(1).maybeSingle()
        if (membershipError) throw membershipError
        let id = membership?.workspace_id as string | undefined
        if (!id) {
          const { data: workspace, error: workspaceError } = await supabase!
            .from('workspaces').insert({ name: 'Boba Bear HQ', owner_id: user.id }).select('id').single()
          if (workspaceError) throw workspaceError
          id = workspace.id
          const { error: memberError } = await supabase!.from('workspace_members').insert({ workspace_id: id, user_id: user.id, role: 'owner' })
          if (memberError) throw memberError
        }
        if (!active || !id) return
        setWorkspaceId(id)
        await loadRemoteItems(id)
        channel = supabase!.channel(`workspace-${id}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'items', filter: `workspace_id=eq.${id}` }, () => loadRemoteItems(id!))
          .subscribe()
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Could not open the shared workspace.')
      } finally {
        if (active) setLoading(false)
      }
    }
    connect()
    return () => { active = false; if (channel) supabase!.removeChannel(channel) }
  }, [loadRemoteItems])

  useEffect(() => { if (!isSupabaseConfigured) localStorage.setItem('boba-bear-items', JSON.stringify(items)) }, [items])

  async function saveItem(item: WorkspaceItem, file?: File) {
    if (!supabase || !workspaceId) {
      setItems(current => current.some(existing => existing.id === item.id)
        ? current.map(existing => existing.id === item.id ? item : existing) : [item, ...current])
      return
    }
    const { data: authData } = await supabase.auth.getUser()
    if (!authData.user) throw new Error('Please sign in again.')
    const record = { id: item.id, workspace_id: workspaceId, title: item.title, body: item.body,
      kind: item.kind, section: item.section, area: item.area ?? null, url: item.url ?? null,
      amount: item.amount ? Number(item.amount) : null, created_by: authData.user.id,
      status: item.status ?? null, source: item.source ?? null, import_key: item.importKey ?? null,
      details: item.details ?? {},
      created_at: item.createdAt, updated_at: new Date().toISOString() }
    const { error: saveError } = await supabase.from('items').upsert(record)
    if (saveError) throw saveError
    if (file) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-')
      const storagePath = `${workspaceId}/${item.id}/${crypto.randomUUID()}-${safeName}`
      const { error: uploadError } = await supabase.storage.from('workspace-files').upload(storagePath, file)
      if (uploadError) throw uploadError
      const { error: attachmentError } = await supabase.from('attachments').insert({
        workspace_id: workspaceId, item_id: item.id, name: file.name, storage_path: storagePath,
        mime_type: file.type || null, size_bytes: file.size, created_by: authData.user.id,
      })
      if (attachmentError) {
        await supabase.storage.from('workspace-files').remove([storagePath])
        throw attachmentError
      }
    }
    await loadRemoteItems(workspaceId)
  }

  async function deleteItem(id: string) {
    if (!supabase || !workspaceId) { setItems(current => current.filter(item => item.id !== id)); return }
    const paths = items.find(item => item.id === id)?.attachments?.map(attachment => attachment.storagePath) ?? []
    if (paths.length) {
      const { error: storageError } = await supabase.storage.from('workspace-files').remove(paths)
      if (storageError) throw storageError
    }
    const { error: deleteError } = await supabase.from('items').delete().eq('id', id).eq('workspace_id', workspaceId)
    if (deleteError) throw deleteError
    await loadRemoteItems(workspaceId)
  }

  async function getAttachmentUrl(storagePath: string) {
    if (!supabase) throw new Error('File storage is not connected.')
    const { data, error: signedUrlError } = await supabase.storage.from('workspace-files').createSignedUrl(storagePath, 60)
    if (signedUrlError) throw signedUrlError
    return data.signedUrl
  }

  async function importReferencePack() {
    const now = new Date().toISOString()
    if (!supabase || !workspaceId) {
      setItems(current => {
        const existingKeys = new Set(current.map(item => item.importKey).filter(Boolean))
        const additions = referenceCatalog.filter(item => !existingKeys.has(item.importKey)).map(item => ({
          ...item, id: crypto.randomUUID(), createdAt: now, updatedAt: now,
        }))
        return [...additions, ...current]
      })
      return
    }
    const { data: authData } = await supabase.auth.getUser()
    if (!authData.user) throw new Error('Please sign in again.')
    const records = referenceCatalog.map(item => ({
      id: crypto.randomUUID(), workspace_id: workspaceId, title: item.title, body: item.body,
      kind: item.kind, section: item.section, area: item.area ?? null, url: item.url ?? null,
      amount: item.amount ? Number(item.amount) : null, status: item.status ?? null,
      source: item.source ?? null, import_key: item.importKey, created_by: authData.user!.id,
      details: item.details ?? {},
      created_at: now, updated_at: now,
    }))
    const { error: importError } = await supabase.from('items').upsert(records, { onConflict: 'workspace_id,import_key', ignoreDuplicates: true })
    if (importError) throw importError
    await loadRemoteItems(workspaceId)
  }

  return { items, loading, error, saveItem, deleteItem, getAttachmentUrl, importReferencePack }
}
