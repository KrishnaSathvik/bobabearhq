-- The record types the workspace was always about, given their own shape:
-- a drink on the menu, a product a supplier sells, and an influencer.
-- Safe to run more than once, and it does not touch existing data.

alter table public.items drop constraint if exists items_kind_check;
alter table public.items
  add constraint items_kind_check check (kind in (
    'Note', 'Link', 'File', 'Expense', 'Quote', 'Product', 'Sample',
    'Location', 'Checklist', 'Supplier', 'Drink', 'Influencer', 'SupplierProduct'
  ));

-- 'Deferred' is how Phase 2 drinks stay in the workspace without pretending to
-- be part of the opening menu, and 'Completed' lets a finished launch task read
-- as finished everywhere a status is shown.
alter table public.items drop constraint if exists items_status_check;
alter table public.items
  add constraint items_status_check check (status in (
    'Reference', 'Researching', 'Visit planned', 'Sample needed', 'Requested',
    'Ordered', 'Received', 'Testing', 'Visited', 'Comparing', 'Shortlisted',
    'Selected', 'Purchased', 'Finalized', 'Completed', 'Deferred',
    'Not decided', 'Not selected', 'Rejected'
  ));
