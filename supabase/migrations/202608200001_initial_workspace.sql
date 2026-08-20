create extension if not exists pgcrypto;

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Boba Bear HQ',
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  body text not null default '',
  kind text not null check (kind in ('Note', 'Link', 'File', 'Expense')),
  section text not null check (section in ('Notes', 'Menu', 'Suppliers', 'Store Setup', 'Marketing', 'Money', 'Library')),
  area text,
  url text,
  amount numeric(12,2),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  name text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.workspace_members where workspace_id = target_workspace and user_id = auth.uid()) $$;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.items enable row level security;
alter table public.attachments enable row level security;

create policy "members can view workspace" on public.workspaces for select using (public.is_workspace_member(id) or owner_id = auth.uid());
create policy "owners can create workspace" on public.workspaces for insert with check (owner_id = auth.uid());
create policy "members can view memberships" on public.workspace_members for select using (public.is_workspace_member(workspace_id) or user_id = auth.uid());
create policy "owners can add membership" on public.workspace_members for insert with check (
  user_id = auth.uid() or exists(select 1 from public.workspaces where id = workspace_id and owner_id = auth.uid())
);
create policy "members can view items" on public.items for select using (public.is_workspace_member(workspace_id));
create policy "members can create items" on public.items for insert with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());
create policy "members can update items" on public.items for update using (public.is_workspace_member(workspace_id));
create policy "members can delete items" on public.items for delete using (public.is_workspace_member(workspace_id));
create policy "members can view attachments" on public.attachments for select using (public.is_workspace_member(workspace_id));
create policy "members can create attachments" on public.attachments for insert with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());
create policy "members can delete attachments" on public.attachments for delete using (public.is_workspace_member(workspace_id));

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

create trigger items_touch_updated_at before update on public.items for each row execute function public.touch_updated_at();

alter publication supabase_realtime add table public.items;
