alter table public.items drop constraint if exists items_kind_check;
alter table public.items
  add constraint items_kind_check check (kind in ('Note', 'Link', 'File', 'Expense', 'Product', 'Sample', 'Location', 'Checklist'));
