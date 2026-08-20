import { useCallback, useEffect, useState } from 'react'
import { starterItems } from '../data'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { WorkspaceItem } from '../types'

type ItemRow = {
  id: string
  title: string
  body: string
  kind: WorkspaceItem['kind']
  section: WorkspaceItem['section']
  area: string | null
  url: string | null
  amount: number | null
  created_at: string
  updated_at: string
}

function fromRow(row: ItemRow): WorkspaceItem {
  return { id: row.id, title: row.title, body: row.body, kind: row.kind, section: row.section,
    area: row.area ?? undefined, url: row.url ?? undefined,
    amount: row.amount == null ? undefined : String(row.amount), createdAt: row.created_at, updatedAt: row.updated_at }
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
    const { data, error: queryError } = await supabase.from('items').select('*').eq('workspace_id', id).order('updated_at', { ascending: false })
    if (queryError) throw queryError
    setItems((data as ItemRow[]).map(fromRow))
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

  async function saveItem(item: WorkspaceItem) {
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
      created_at: item.createdAt, updated_at: new Date().toISOString() }
    const { error: saveError } = await supabase.from('items').upsert(record)
    if (saveError) throw saveError
    await loadRemoteItems(workspaceId)
  }

  async function deleteItem(id: string) {
    if (!supabase || !workspaceId) { setItems(current => current.filter(item => item.id !== id)); return }
    const { error: deleteError } = await supabase.from('items').delete().eq('id', id).eq('workspace_id', workspaceId)
    if (deleteError) throw deleteError
    await loadRemoteItems(workspaceId)
  }

  return { items, loading, error, saveItem, deleteItem }
}
