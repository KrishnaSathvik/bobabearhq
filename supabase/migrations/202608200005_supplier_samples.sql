alter table public.items drop constraint if exists items_kind_check;
alter table public.items
  add constraint items_kind_check check (kind in ('Note', 'Link', 'File', 'Expense', 'Product', 'Sample'));

alter table public.items drop constraint if exists items_status_check;
alter table public.items
  add constraint items_status_check check (status in ('Reference', 'Researching', 'Sample needed', 'Requested', 'Ordered', 'Received', 'Testing', 'Selected', 'Not selected'));
