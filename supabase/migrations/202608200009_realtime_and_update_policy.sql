-- Repair batch 1. Safe to run more than once, and it does not touch existing data.

-- 1. Publish both tables to Realtime.
--    202608200001 published only public.items, so attachment inserts and deletes
--    could never reach another session even though the client subscribes to them.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'items'
  ) then
    alter publication supabase_realtime add table public.items;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'attachments'
  ) then
    alter publication supabase_realtime add table public.attachments;
  end if;
end $$;

-- 2. Let delete events carry the old row.
--    The client subscribes with filter workspace_id=eq.<id>. Under the default
--    replica identity a DELETE only carries the primary key, so workspace_id is
--    absent and the event never matches the filter — deletes silently do not sync.
alter table public.items replica identity full;
alter table public.attachments replica identity full;

-- 3. Close the update policy.
--    The original policy had USING but no WITH CHECK, so a member could move a
--    row into a workspace they do not belong to.
drop policy if exists "members can update items" on public.items;
create policy "members can update items" on public.items for update
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
