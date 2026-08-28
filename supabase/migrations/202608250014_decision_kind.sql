-- A decision is a thing you want to find again: what was chosen, and why. It
-- was being written as a note and then lost among the notes, so it gets a kind
-- of its own. It carries no fields — it is writing, like a note — so nothing
-- else about the table changes.
--
-- Until this runs, saving a Decision against a real Supabase project is
-- rejected by the kind constraint.
--
-- Safe to run more than once, and it does not touch existing data.

alter table public.items drop constraint if exists items_kind_check;
alter table public.items
  add constraint items_kind_check check (kind in (
    'Note', 'Link', 'File', 'Expense', 'Quote', 'Product', 'Sample',
    'Location', 'Checklist', 'Supplier', 'Drink', 'Influencer', 'SupplierProduct',
    'Decision'
  ));
