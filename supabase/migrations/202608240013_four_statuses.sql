-- The app collapsed nineteen statuses down to four — New, Doing, Waiting, Done —
-- but the check constraint was never widened to accept them, so against a real
-- Supabase project every save carrying a status is rejected. Old rows keep their
-- old words (they are translated on read, never rewritten on disk), so the
-- constraint has to allow both vocabularies.
--
-- Safe to run more than once, and it does not touch existing data.

alter table public.items drop constraint if exists items_status_check;
alter table public.items
  add constraint items_status_check check (status in (
    -- What the app writes today.
    'New', 'Doing', 'Waiting', 'Done',
    -- What workspaces written before the collapse still hold.
    'Reference', 'Researching', 'Visit planned', 'Sample needed', 'Requested',
    'Ordered', 'Received', 'Testing', 'Visited', 'Comparing', 'Shortlisted',
    'Selected', 'Purchased', 'Finalized', 'Completed', 'Deferred',
    'Not decided', 'Not selected', 'Rejected'
  ));
