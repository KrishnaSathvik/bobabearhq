alter table public.items
  add column if not exists details jsonb not null default '{}'::jsonb;

alter table public.items drop constraint if exists items_kind_check;
alter table public.items
  add constraint items_kind_check check (kind in ('Note', 'Link', 'File', 'Expense', 'Product'));
