import { useCallback, useEffect, useMemo, useState } from 'react'
import { starterItems } from '../data'
import { createId } from '../lib/ids'
import { referenceCatalog } from '../referenceCatalog'
import { supplierSamplePlan } from '../supplierSamplePlan'
import { locationScoutingPlan } from '../locationScoutingPlan'
import { launchChecklistPlan } from '../launchChecklistPlan'
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

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024

function loadLocalItems() {
  const stored = localStorage.getItem('boba-bear-items')
  return stored ? (JSON.parse(stored) as WorkspaceItem[]) : starterItems
}

export function useWorkspaceItems() {
  const [items, setItems] = useState<WorkspaceItem[]>(loadLocalItems)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [error, setError] = useState('')
  const [liveSync, setLiveSync] = useState(!isSupabaseConfigured)

  // Each starter pack is detected by its own keys. Checking merely "has any
  // importKey" meant importing the checklist permanently hid the reference pack.
  const importedPacks = useMemo(() => {
    const keys = new Set(items.map(item => item.importKey).filter(Boolean))
    return {
      reference: referenceCatalog.some(entry => keys.has(entry.importKey)),
      samples: supplierSamplePlan.some(entry => keys.has(entry.importKey)),
      locations: locationScoutingPlan.some(entry => keys.has(entry.importKey)),
      checklist: launchChecklistPlan.some(entry => keys.has(entry.importKey)),
    }
  }, [items])

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
          .on('postgres_changes', { event: '*', schema: 'public', table: 'items', filter: `workspace_id=eq.${id}` }, () => { void loadRemoteItems(id!) })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'attachments', filter: `workspace_id=eq.${id}` }, () => { void loadRemoteItems(id!) })
          .subscribe(status => {
            if (!active) return
            // Without this the workspace silently stops receiving other sessions'
            // changes and still looks perfectly healthy.
            if (status === 'SUBSCRIBED') { setLiveSync(true); return }
            setLiveSync(false)
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
              void loadRemoteItems(id!).catch(() => undefined)
            }
          })
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

  async function saveItem(item: WorkspaceItem, files: File[] = []) {
    if (!supabase || !workspaceId) {
      setItems(current => current.some(existing => existing.id === item.id)
        ? current.map(existing => existing.id === item.id ? item : existing) : [item, ...current])
      return
    }
    // Reject oversized files before anything is written, so a rejected upload
    // never leaves the record itself half-saved.
    const oversized = files.find(file => file.size > MAX_ATTACHMENT_BYTES)
    if (oversized) throw new Error(`${oversized.name} is larger than the 25 MB file limit.`)

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
    if (files.length) {
      const uploadedPaths: string[] = []
      try {
        const attachmentRecords = []
        for (const file of files) {
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-')
          const storagePath = `${workspaceId}/${item.id}/${createId()}-${safeName}`
          const { error: uploadError } = await supabase.storage.from('workspace-files').upload(storagePath, file)
          if (uploadError) throw uploadError
          uploadedPaths.push(storagePath)
          attachmentRecords.push({
            workspace_id: workspaceId, item_id: item.id, name: file.name, storage_path: storagePath,
            mime_type: file.type || null, size_bytes: file.size, created_by: authData.user.id,
          })
        }
        const { error: attachmentError } = await supabase.from('attachments').insert(attachmentRecords)
        if (attachmentError) throw attachmentError
      } catch (reason) {
        if (uploadedPaths.length) await supabase.storage.from('workspace-files').remove(uploadedPaths)
        throw reason
      }
      // The item was written before its files existed, so the change other
      // sessions already saw did not include them. Touch the row again now that
      // the attachments are in place to broadcast a complete version.
      await supabase.from('items').update({ updated_at: new Date().toISOString() })
        .eq('id', item.id).eq('workspace_id', workspaceId)
    }
    await loadRemoteItems(workspaceId)
  }

  async function deleteItem(id: string) {
    if (!supabase || !workspaceId) { setItems(current => current.filter(item => item.id !== id)); return }
    const paths = items.find(item => item.id === id)?.attachments?.map(attachment => attachment.storagePath) ?? []
    // Delete the record first (attachment rows cascade). If the storage cleanup
    // then fails we are left with unreferenced files, which is recoverable —
    // the reverse order would leave records pointing at files that no longer exist.
    const { error: deleteError } = await supabase.from('items').delete().eq('id', id).eq('workspace_id', workspaceId)
    if (deleteError) throw deleteError
    if (paths.length) await supabase.storage.from('workspace-files').remove(paths)
    await loadRemoteItems(workspaceId)
  }

  async function getAttachmentUrl(storagePath: string) {
    if (!supabase) throw new Error('File storage is not connected.')
    const { data, error: signedUrlError } = await supabase.storage.from('workspace-files').createSignedUrl(storagePath, 60)
    if (signedUrlError) throw signedUrlError
    return data.signedUrl
  }

  async function deleteAttachment(itemId: string, attachment: WorkspaceAttachment) {
    if (!supabase || !workspaceId) {
      setItems(current => current.map(item => item.id === itemId
        ? { ...item, attachments: item.attachments?.filter(file => file.id !== attachment.id) }
        : item))
      return
    }
    // Metadata first, then the file, so a failure cannot leave a record
    // referencing a file that is already gone.
    const { error: attachmentError } = await supabase.from('attachments').delete().eq('id', attachment.id).eq('workspace_id', workspaceId)
    if (attachmentError) throw attachmentError
    await supabase.storage.from('workspace-files').remove([attachment.storagePath])
    // Attachment rows do not change the parent item, so touch it to broadcast.
    await supabase.from('items').update({ updated_at: new Date().toISOString() })
      .eq('id', itemId).eq('workspace_id', workspaceId)
    await loadRemoteItems(workspaceId)
  }

  async function importReferencePack() {
    const now = new Date().toISOString()
    if (!supabase || !workspaceId) {
      setItems(current => {
        const existingKeys = new Set(current.map(item => item.importKey).filter(Boolean))
        const additions = referenceCatalog.filter(item => !existingKeys.has(item.importKey)).map(item => ({
          ...item, id: createId(), createdAt: now, updatedAt: now,
        }))
        return [...additions, ...current]
      })
      return
    }
    const { data: authData } = await supabase.auth.getUser()
    if (!authData.user) throw new Error('Please sign in again.')
    const records = referenceCatalog.map(item => ({
      id: createId(), workspace_id: workspaceId, title: item.title, body: item.body,
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

  async function importSupplierSamples() {
    const now = new Date().toISOString()
    if (!supabase || !workspaceId) {
      setItems(current => {
        const existingKeys = new Set(current.map(item => item.importKey).filter(Boolean))
        const additions = supplierSamplePlan.filter(item => !existingKeys.has(item.importKey)).map(item => ({
          ...item, id: createId(), createdAt: now, updatedAt: now,
        }))
        return [...additions, ...current]
      })
      return
    }
    const { data: authData } = await supabase.auth.getUser()
    if (!authData.user) throw new Error('Please sign in again.')
    const records = supplierSamplePlan.map(item => ({
      id: createId(), workspace_id: workspaceId, title: item.title, body: item.body,
      kind: item.kind, section: item.section, area: item.area ?? null, url: item.url ?? null,
      amount: item.amount ? Number(item.amount) : null, status: item.status ?? null,
      source: item.source ?? null, import_key: item.importKey, details: item.details ?? {},
      created_by: authData.user!.id, created_at: now, updated_at: now,
    }))
    const { error: importError } = await supabase.from('items').upsert(records, { onConflict: 'workspace_id,import_key', ignoreDuplicates: true })
    if (importError) throw importError
    await loadRemoteItems(workspaceId)
  }

  async function importLocationPlan() {
    const now = new Date().toISOString()
    if (!supabase || !workspaceId) {
      setItems(current => {
        const existingKeys = new Set(current.map(item => item.importKey).filter(Boolean))
        const additions = locationScoutingPlan.filter(item => !existingKeys.has(item.importKey)).map(item => ({
          ...item, id: createId(), createdAt: now, updatedAt: now,
        }))
        return [...additions, ...current]
      })
      return
    }
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) throw authError ?? new Error('Please sign in again.')
    const records = locationScoutingPlan.map(item => ({
      id: createId(), workspace_id: workspaceId, title: item.title, body: item.body, kind: item.kind,
      section: item.section, area: item.area ?? null, url: item.url ?? null,
      amount: item.amount ? Number(item.amount) : null, status: item.status ?? null,
      source: item.source ?? null, import_key: item.importKey, details: item.details ?? {},
      created_by: authData.user!.id, created_at: now, updated_at: now,
    }))
    const { error: importError } = await supabase.from('items').upsert(records, { onConflict: 'workspace_id,import_key', ignoreDuplicates: true })
    if (importError) throw importError
    await loadRemoteItems(workspaceId)
  }

  async function importLaunchChecklist() {
    const now = new Date().toISOString()
    if (!supabase || !workspaceId) {
      setItems(current => {
        const existingKeys = new Set(current.map(item => item.importKey).filter(Boolean))
        const additions = launchChecklistPlan.filter(item => !existingKeys.has(item.importKey)).map(item => ({
          ...item, id: createId(), createdAt: now, updatedAt: now,
        }))
        return [...additions, ...current]
      })
      return
    }
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) throw authError ?? new Error('Please sign in again.')
    const records = launchChecklistPlan.map(item => ({
      id: createId(), workspace_id: workspaceId, title: item.title, body: item.body, kind: item.kind,
      section: item.section, area: item.area ?? null, url: null, amount: null, status: item.status ?? null,
      source: item.source ?? null, import_key: item.importKey, details: item.details ?? {},
      created_by: authData.user!.id, created_at: now, updated_at: now,
    }))
    const { error: importError } = await supabase.from('items').upsert(records, { onConflict: 'workspace_id,import_key', ignoreDuplicates: true })
    if (importError) throw importError
    await loadRemoteItems(workspaceId)
  }

  return { items, loading, error, liveSync, importedPacks, saveItem, deleteItem, getAttachmentUrl, deleteAttachment, importReferencePack, importSupplierSamples, importLocationPlan, importLaunchChecklist }
}
