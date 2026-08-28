import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { starterItems } from '../data'
import { createId } from '../lib/ids'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { normalizePaymentStatus } from '../lib/money'
import { detailsAfterRetype } from '../itemShapes'
import { finishedStatus, normalizeStatus, type ItemRelationship, type WorkspaceAttachment, type WorkspaceItem, type WorkspaceLink } from '../types'


type ItemRow = {
  id: string
  title: string
  body: string
  kind: WorkspaceItem['kind']
  section: WorkspaceItem['section']
  area: string | null
  url: string | null
  amount: number | null
  status: string | null
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
  created_at: string
}

type LinkRow = {
  id: string
  from_item_id: string
  to_item_id: string
  relationship: ItemRelationship
}

type LinkRecord = { id: string; fromItemId: string; toItemId: string; relationship: ItemRelationship }

export type OutgoingLink = { itemId: string; relationship: ItemRelationship }

// 'connecting' is the first attempt, 'reconnecting' is a channel that dropped
// and is coming back, and 'offline' is only reached after retrying has stopped
// helping. Telling someone to refresh while a retry is still in flight is how a
// working app looks broken.
export type SyncState = 'connecting' | 'live' | 'reconnecting' | 'offline'

const MAX_RECONNECT_ATTEMPTS = 3

// Two fields used to be written in two places at once, and a workspace saved
// while that was true can disagree with itself. Both are settled here, on the
// way in, so the rest of the app only ever sees one answer:
//
//   * completion lives in `status` — a task carrying the old details.completed
//     flag is Done, and the flag is dropped rather than kept as a second copy;
//   * a payment saying 'Not paid' is saying 'Planned'.
//
// Rows on disk are left alone. They are translated on read and rewritten only
// when a person next saves that record, the same way the old statuses are.
function normalizeItem(item: WorkspaceItem): WorkspaceItem {
  const status = normalizeStatus(item.status, item.kind)
  const details = item.details
  const wasCompleted = details?.completed === 'true'
  if (!details) return status === item.status ? item : { ...item, status }
  const carried = Object.fromEntries(Object.entries(details).filter(([key]) => key !== 'completed'))
  // Writing has no fields. A note that was briefly a place and still holds a
  // monthly rent prints it under a trailing DETAILS heading, which is how
  // "Monthly rent ₹22,000" ended up on a thought about tapioca.
  const rest = detailsAfterRetype(item.kind, carried) ?? {}
  const payment = normalizePaymentStatus(rest.paymentStatus)
  const nextDetails = payment && payment !== rest.paymentStatus ? { ...rest, paymentStatus: payment } : rest
  // Compared against what was stored, not against the halfway value: this used
  // to ask whether the payment had been rewritten and answer "no", and so hand
  // back the record with everything else it had just cleaned still on it.
  const settled = Object.keys(nextDetails).length === Object.keys(details).length
    && Object.entries(nextDetails).every(([key, value]) => details[key] === value)
  if (settled && !wasCompleted && status === item.status) return item
  return {
    ...item,
    status: wasCompleted ? finishedStatus(item.kind) ?? status : status,
    details: Object.keys(nextDetails).length ? nextDetails : undefined,
  }
}

function fromRow(row: ItemRow): WorkspaceItem {
  return normalizeItem({ id: row.id, title: row.title, body: row.body, kind: row.kind, section: row.section,
    area: row.area ?? undefined, url: row.url ?? undefined,
    amount: row.amount == null ? undefined : String(row.amount), status: normalizeStatus(row.status, row.kind),
    source: row.source ?? undefined, importKey: row.import_key ?? undefined,
    details: row.details ?? undefined,
    createdAt: row.created_at, updatedAt: row.updated_at })
}

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024
const LINKS_KEY = 'boba-bear-links'

// A workspace saved before the statuses collapsed still holds the old words,
// so they are translated on the way in here too, not rewritten on disk.
function loadLocalItems(): WorkspaceItem[] {
  const stored = localStorage.getItem('boba-bear-items')
  const items = stored ? (JSON.parse(stored) as WorkspaceItem[]) : starterItems
  return items.map(normalizeItem)
}

function loadLocalLinks(): LinkRecord[] {
  try {
    const stored = localStorage.getItem(LINKS_KEY)
    return stored ? (JSON.parse(stored) as LinkRecord[]) : []
  } catch {
    return []
  }
}

// A stored file whose row is already gone is invisible in the app but still
// occupies the bucket. Remembering the path is what makes a later retry
// possible instead of losing it the moment the tab closes.
const ORPHAN_KEY = 'boba-bear-orphan-files'

function readOrphanPaths(): string[] {
  try {
    const stored = localStorage.getItem(ORPHAN_KEY)
    return stored ? (JSON.parse(stored) as string[]) : []
  } catch {
    return []
  }
}

function writeOrphanPaths(paths: string[]) {
  if (paths.length) localStorage.setItem(ORPHAN_KEY, JSON.stringify([...new Set(paths)]))
  else localStorage.removeItem(ORPHAN_KEY)
}

export function useWorkspaceItems() {
  const [rawItems, setRawItems] = useState<WorkspaceItem[]>(loadLocalItems)
  const [links, setLinks] = useState<LinkRecord[]>(loadLocalLinks)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  // The listener below outlives any one render, so it reads the workspace from
  // a ref rather than closing over a value that was null when it was attached.
  const workspaceIdRef = useRef<string | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [error, setError] = useState('')
  const [syncState, setSyncState] = useState<SyncState>(isSupabaseConfigured ? 'connecting' : 'live')
  const [cleanupWarning, setCleanupWarning] = useState('')
  const [reconnectToken, setReconnectToken] = useState(0)
  const syncStateRef = useRef<SyncState>(isSupabaseConfigured ? 'connecting' : 'live')
  const attemptsRef = useRef(0)

  // Both ends of a link are shown on both records: a quote knows it is a quote
  // for a machine, and the machine shows the quote.
  const items = useMemo(() => rawItems.map(item => {
    const attached: WorkspaceLink[] = links
      .filter(link => link.fromItemId === item.id || link.toItemId === item.id)
      .map(link => link.fromItemId === item.id
        ? { id: link.id, itemId: link.toItemId, relationship: link.relationship, direction: 'from' as const }
        : { id: link.id, itemId: link.fromItemId, relationship: link.relationship, direction: 'to' as const })
    return attached.length ? { ...item, links: attached } : item
  }), [rawItems, links])

  const loadRemoteItems = useCallback(async (id: string) => {
    if (!supabase) return
    const [{ data, error: queryError }, { data: attachmentData, error: attachmentError }, { data: linkData, error: linkError }] = await Promise.all([
      supabase.from('items').select('*').eq('workspace_id', id).order('updated_at', { ascending: false }),
      supabase.from('attachments').select('*').eq('workspace_id', id).order('created_at', { ascending: true }),
      supabase.from('item_links').select('id, from_item_id, to_item_id, relationship').eq('workspace_id', id),
    ])
    if (queryError) throw queryError
    if (attachmentError) throw attachmentError
    if (linkError) throw linkError
    const attachments = (attachmentData as AttachmentRow[]).reduce<Record<string, WorkspaceAttachment[]>>((grouped, row) => {
      const attachment = { id: row.id, name: row.name, storagePath: row.storage_path,
        mimeType: row.mime_type ?? undefined, sizeBytes: row.size_bytes ?? undefined,
        createdAt: row.created_at }
      grouped[row.item_id] = [...(grouped[row.item_id] ?? []), attachment]
      return grouped
    }, {})
    setRawItems((data as ItemRow[]).map(row => ({ ...fromRow(row), attachments: attachments[row.id] ?? [] })))
    setLinks((linkData as LinkRow[]).map(row => ({ id: row.id, fromItemId: row.from_item_id, toItemId: row.to_item_id, relationship: row.relationship })))
  }, [])

  // Files left behind by a failed delete are retried on the next connection, so
  // a temporary storage outage does not turn into permanent rubbish.
  const flushOrphanPaths = useCallback(async () => {
    const paths = readOrphanPaths()
    if (!paths.length || !supabase) return
    const { error: removeError } = await supabase.storage.from('workspace-files').remove(paths)
    if (removeError) return
    writeOrphanPaths([])
    setCleanupWarning('')
  }, [])

  const updateSyncState = useCallback((next: SyncState) => {
    syncStateRef.current = next
    setSyncState(next)
  }, [])

  useEffect(() => {
    // This effect is the one legitimate case the rule describes: it synchronises
    // React with an external system (Supabase auth, the workspace row, and the
    // realtime channel). The state it sets cannot be derived during render.
    // oxlint-disable-next-line react/set-state-in-effect
    if (!supabase) { setLoading(false); return }
    let active = true
    let channel: ReturnType<typeof supabase.channel> | null = null
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    function scheduleRetry() {
      if (!active || retryTimer) return
      if (attemptsRef.current >= MAX_RECONNECT_ATTEMPTS) { updateSyncState('offline'); return }
      const delay = 4000 * 2 ** attemptsRef.current
      attemptsRef.current += 1
      retryTimer = setTimeout(() => { retryTimer = null; if (active) setReconnectToken(token => token + 1) }, delay)
    }

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
        workspaceIdRef.current = id
        setError('')
        await loadRemoteItems(id)
        await flushOrphanPaths()
        const reload = () => { void loadRemoteItems(id!).catch(() => undefined) }
        channel = supabase!.channel(`workspace-${id}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'items', filter: `workspace_id=eq.${id}` }, reload)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'attachments', filter: `workspace_id=eq.${id}` }, reload)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'item_links', filter: `workspace_id=eq.${id}` }, reload)
          .subscribe(status => {
            if (!active) return
            // Without this the workspace silently stops receiving other sessions'
            // changes and still looks perfectly healthy.
            if (status === 'SUBSCRIBED') { attemptsRef.current = 0; updateSyncState('live'); return }
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
              if (syncStateRef.current !== 'offline') updateSyncState('reconnecting')
              reload()
              scheduleRetry()
            }
          })
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Could not open the shared workspace.')
        scheduleRetry()
      } finally {
        if (active) setLoading(false)
      }
    }
    connect()
    return () => {
      active = false
      if (retryTimer) clearTimeout(retryTimer)
      if (channel) supabase!.removeChannel(channel)
    }
  }, [loadRemoteItems, flushOrphanPaths, updateSyncState, reconnectToken])

  // Coming back from a tunnel, a dead wifi hop or a slept laptop leaves the
  // channel closed. Both of these are free retries that cost nothing when the
  // channel is already healthy.
  //
  // Installed to a home screen this matters more, not less: a standalone app is
  // frozen outright when you switch away from it, so it can come back minutes
  // later with a socket that never noticed it died. A channel reporting itself
  // as live is not evidence that nothing happened while nobody was watching, so
  // coming back to the front always re-reads the workspace — the reconnect
  // below only fixes the socket, and this fixes what is on screen.
  useEffect(() => {
    if (!supabase) return
    function reconnect() {
      if (syncStateRef.current === 'live') return
      attemptsRef.current = 0
      updateSyncState('reconnecting')
      setReconnectToken(token => token + 1)
    }
    function onVisible() {
      if (document.visibilityState !== 'visible') return
      reconnect()
      if (workspaceIdRef.current) void loadRemoteItems(workspaceIdRef.current).catch(() => undefined)
    }
    window.addEventListener('online', reconnect)
    window.addEventListener('online', onVisible)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('online', reconnect)
      window.removeEventListener('online', onVisible)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [updateSyncState, loadRemoteItems])

  useEffect(() => {
    if (isSupabaseConfigured) return
    localStorage.setItem('boba-bear-items', JSON.stringify(rawItems))
    localStorage.setItem(LINKS_KEY, JSON.stringify(links))
  }, [rawItems, links])

  async function removeStorageObjects(paths: string[]) {
    if (!paths.length || !supabase) return
    const { error: removeError } = await supabase.storage.from('workspace-files').remove(paths)
    if (!removeError) return
    // The record is already gone, so throwing here would report a failed delete
    // that actually succeeded. Say what was left behind instead of hiding it.
    writeOrphanPaths([...readOrphanPaths(), ...paths])
    setCleanupWarning(`${paths.length} stored ${paths.length === 1 ? 'file was' : 'files were'} not deleted from storage (${removeError.message}). The record is gone and the cleanup will be retried automatically.`)
  }

  async function removeAttachments(targets: WorkspaceAttachment[]) {
    if (!targets.length || !supabase || !workspaceId) return
    const { error: deleteError } = await supabase.from('attachments').delete()
      .in('id', targets.map(target => target.id)).eq('workspace_id', workspaceId)
    if (deleteError) throw deleteError
    await removeStorageObjects(targets.map(target => target.storagePath))
  }

  async function saveItem(item: WorkspaceItem, files: File[] = [], removedAttachmentIds: string[] = [], outgoing?: OutgoingLink[]) {
    // Reject oversized files before anything is written, so a rejected upload
    // never leaves the record itself half-saved.
    const oversized = files.find(file => file.size > MAX_ATTACHMENT_BYTES)
    if (oversized) throw new Error(`${oversized.name} is larger than the 25 MB file limit.`)

    if (!supabase || !workspaceId) {
      const kept = (item.attachments ?? []).filter(attachment => !removedAttachmentIds.includes(attachment.id))
      const added = files.map(file => ({ id: createId(), name: file.name, storagePath: '',
        mimeType: file.type || undefined, sizeBytes: file.size, createdAt: new Date().toISOString() }))
      const next = { ...item, attachments: [...kept, ...added], links: undefined }
      setRawItems(current => current.some(existing => existing.id === item.id)
        ? current.map(existing => existing.id === item.id ? next : existing) : [next, ...current])
      if (outgoing) {
        setLinks(current => [
          ...current.filter(link => link.fromItemId !== item.id),
          ...outgoing.map(link => ({ id: createId(), fromItemId: item.id, toItemId: link.itemId, relationship: link.relationship })),
        ])
      }
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

    // Attachment removal is staged in the editor, so it only happens now, once
    // the record itself has been saved.
    if (removedAttachmentIds.length) {
      const stored = rawItems.find(existing => existing.id === item.id)?.attachments ?? item.attachments ?? []
      await removeAttachments(stored.filter(attachment => removedAttachmentIds.includes(attachment.id)))
    }

    if (outgoing) {
      const existing = links.filter(link => link.fromItemId === item.id)
      const wanted = outgoing.map(link => `${link.itemId}|${link.relationship}`)
      const gone = existing.filter(link => !wanted.includes(`${link.toItemId}|${link.relationship}`))
      const added = outgoing.filter(link => !existing.some(current => current.toItemId === link.itemId && current.relationship === link.relationship))
      if (gone.length) {
        const { error: unlinkError } = await supabase.from('item_links').delete()
          .in('id', gone.map(link => link.id)).eq('workspace_id', workspaceId)
        if (unlinkError) throw unlinkError
      }
      if (added.length) {
        const { error: linkError } = await supabase.from('item_links').insert(added.map(link => ({
          workspace_id: workspaceId, from_item_id: item.id, to_item_id: link.itemId,
          relationship: link.relationship, created_by: authData.user!.id,
        })))
        if (linkError) throw linkError
      }
    }

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
    }

    if (files.length || removedAttachmentIds.length) {
      // The item was written before its files existed, so the change other
      // sessions already saw did not include them. Touch the row again now that
      // the attachments are in place to broadcast a complete version.
      await supabase.from('items').update({ updated_at: new Date().toISOString() })
        .eq('id', item.id).eq('workspace_id', workspaceId)
    }
    await loadRemoteItems(workspaceId)
  }

  async function deleteItem(id: string) {
    if (!supabase || !workspaceId) {
      setRawItems(current => current.filter(item => item.id !== id))
      setLinks(current => current.filter(link => link.fromItemId !== id && link.toItemId !== id))
      return
    }
    const paths = rawItems.find(item => item.id === id)?.attachments?.map(attachment => attachment.storagePath).filter(Boolean) ?? []
    // Delete the record first (attachment and link rows cascade). If the storage
    // cleanup then fails we are left with unreferenced files, which is
    // recoverable — the reverse order would leave records pointing at files that
    // no longer exist.
    const { error: deleteError } = await supabase.from('items').delete().eq('id', id).eq('workspace_id', workspaceId)
    if (deleteError) throw deleteError
    await removeStorageObjects(paths)
    await loadRemoteItems(workspaceId)
    // Nothing may claim the record is gone until the reload proves it is.
    const { count, error: confirmError } = await supabase.from('items')
      .select('id', { count: 'exact', head: true }).eq('id', id).eq('workspace_id', workspaceId)
    if (!confirmError && count) throw new Error('The record could not be deleted. Please try again.')
  }

  async function getAttachmentUrl(storagePath: string) {
    if (!supabase || !storagePath) throw new Error('File storage is not connected, so this file cannot be opened.')
    const { data, error: signedUrlError } = await supabase.storage.from('workspace-files').createSignedUrl(storagePath, 3600)
    if (signedUrlError) throw signedUrlError
    return data.signedUrl
  }


  // Nothing seeds any more. Every record in the workspace is one somebody
  // wrote, which is the point: a plan you did not write is a plan you cannot
  // trust, and `importKey` stays only so records seeded before this still read.
  return { items, loading, error, syncState, cleanupWarning, dismissCleanupWarning: () => setCleanupWarning(''),
    saveItem, deleteItem, getAttachmentUrl }
}
