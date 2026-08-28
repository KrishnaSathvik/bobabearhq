-- Repair batch 2. Safe to run more than once, and it does not touch existing data.

-- 1. Index the columns every query filters on.
--    Every read is "where workspace_id = ...", and attachments are grouped by
--    item_id on load and deleted by item_id through the cascade. Without these
--    each one is a sequential scan of the whole table.
create index if not exists items_workspace_id_idx on public.items (workspace_id);
create index if not exists attachments_workspace_id_idx on public.attachments (workspace_id);
create index if not exists attachments_item_id_idx on public.attachments (item_id);

-- 2. Widen the status vocabulary.
--    Comparing, Purchased, Rejected, Not decided, Visit planned and Finalized are
--    part of the equipment, sample and location lifecycles, and the old check
--    constraint rejected every one of them.
alter table public.items drop constraint if exists items_status_check;
alter table public.items
  add constraint items_status_check check (status in (
    'Reference', 'Researching', 'Visit planned', 'Sample needed', 'Requested',
    'Ordered', 'Received', 'Testing', 'Visited', 'Comparing', 'Shortlisted',
    'Selected', 'Purchased', 'Finalized', 'Not decided', 'Not selected', 'Rejected'
  ));
