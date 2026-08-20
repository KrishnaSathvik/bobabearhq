alter table public.items
  add column if not exists status text check (status in ('Reference', 'Researching', 'Sample needed', 'Testing', 'Selected', 'Not selected')),
  add column if not exists source text,
  add column if not exists import_key text;

create unique index if not exists items_workspace_import_key_unique
  on public.items (workspace_id, import_key);
