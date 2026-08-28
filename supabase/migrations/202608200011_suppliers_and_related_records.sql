-- Suppliers become real records, and records can point at each other.
-- Safe to run more than once, and it does not touch existing data.

-- 1. A supplier is its own kind of record, not a note that happens to be about
--    a supplier.
alter table public.items drop constraint if exists items_kind_check;
alter table public.items
  add constraint items_kind_check check (kind in (
    'Note', 'Link', 'File', 'Expense', 'Quote', 'Product', 'Sample',
    'Location', 'Checklist', 'Supplier'
  ));

-- 2. Related records.
--    A quote is a quote *for* a piece of equipment *from* a supplier, so one
--    record needs to reach more than one other record. That rules out a single
--    related_item_id column and calls for a join table.
create table if not exists public.item_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  from_item_id uuid not null references public.items(id) on delete cascade,
  to_item_id uuid not null references public.items(id) on delete cascade,
  relationship text not null check (relationship in (
    'Quote for', 'Expense for', 'Supplied by', 'Sample from',
    'Related to', 'Replaces', 'Reference for'
  )),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint item_links_distinct check (from_item_id <> to_item_id),
  constraint item_links_unique unique (from_item_id, to_item_id, relationship)
);

create index if not exists item_links_workspace_id_idx on public.item_links (workspace_id);
create index if not exists item_links_from_item_id_idx on public.item_links (from_item_id);
create index if not exists item_links_to_item_id_idx on public.item_links (to_item_id);

alter table public.item_links enable row level security;

drop policy if exists "members can view item links" on public.item_links;
create policy "members can view item links" on public.item_links for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "members can create item links" on public.item_links;
create policy "members can create item links" on public.item_links for insert
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "members can delete item links" on public.item_links;
create policy "members can delete item links" on public.item_links for delete
  using (public.is_workspace_member(workspace_id));

-- 3. Links have to reach the other session like everything else, and a delete
--    event has to carry workspace_id for the client's filter to match.
alter table public.item_links replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'item_links'
  ) then
    alter publication supabase_realtime add table public.item_links;
  end if;
end $$;
