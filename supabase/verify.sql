-- Boba Bear HQ · schema verification
--
-- Run against the project in .env.local (psmuoyirikvvbgejtdtd). Reads system
-- catalogs only: it changes nothing and is safe to run before and after any
-- migration.
--
-- Pasting SQL through a chat window or a markdown renderer can mangle single
-- quotes, which is why no string below contains a SQL keyword. If you get a
-- parse error naming a word that appears in one of these messages, the quotes
-- were lost in transit -- run the file directly instead:
--
--   psql "$DATABASE_URL" -f supabase/verify.sql
--
-- ---------------------------------------------------------------------------
-- The one-line version. Everything else is detail; this is the migration that
-- was outstanding. Look for Decision in the output.

select pg_get_constraintdef(oid) as items_kind_check
from pg_constraint
where conrelid = to_regclass('public.items') and conname = 'items_kind_check';

-- ---------------------------------------------------------------------------
-- The full check. Every row should read ok = true; anything false names what
-- is missing.

with kind_def as (
  select pg_get_constraintdef(oid) as def from pg_constraint
  where conrelid = to_regclass('public.items') and conname = 'items_kind_check'
),
status_def as (
  select pg_get_constraintdef(oid) as def from pg_constraint
  where conrelid = to_regclass('public.items') and conname = 'items_status_check'
),
app_kinds(k) as (values ('Note'),('Link'),('File'),('Expense'),('Quote'),('Product'),('Sample'),
                        ('Location'),('Checklist'),('Supplier'),('Drink'),('Influencer'),
                        ('SupplierProduct'),('Decision')),
app_statuses(s) as (values ('New'),('Doing'),('Waiting'),('Done')),
missing_kinds as (
  select k from app_kinds where coalesce((select def from kind_def), '') not like '%''' || k || '''%'
),
missing_statuses as (
  select s from app_statuses where coalesce((select def from status_def), '') not like '%''' || s || '''%'
),
app_columns(c) as (values ('details'),('status'),('source'),('import_key'),('amount'),('area'),('url')),
missing_columns as (
  select c from app_columns where not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'items' and column_name = c)
),
app_tables(t) as (values ('workspaces'),('workspace_members'),('items'),('attachments'),('item_links')),
missing_tables as (
  select t from app_tables where to_regclass('public.' || quote_ident(t)) is null
),
realtime_tables(t) as (values ('items'),('attachments'),('item_links')),
missing_realtime as (
  select t from realtime_tables where not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t)
),
partial_replica as (
  select t from realtime_tables where coalesce(
    (select relreplident from pg_class where oid = to_regclass('public.' || quote_ident(t))), 'x') <> 'f'
),
rls_off as (
  select t from app_tables where coalesce(
    (select relrowsecurity from pg_class where oid = to_regclass('public.' || quote_ident(t))), false) is not true
)
select * from (
  values
    (1, 'Decision kind accepted  (migration 202608250014)',
        coalesce((select def like '%''Decision''%' from kind_def), false),
        coalesce((select def from kind_def), 'items_kind_check is missing entirely')),
    (2, 'every kind the app writes is accepted',
        not exists (select 1 from missing_kinds),
        coalesce((select 'missing: ' || string_agg(k, ', ') from missing_kinds), 'all 14 present')),
    (3, 'four statuses accepted  (migration 202608240013)',
        not exists (select 1 from missing_statuses),
        coalesce((select 'missing: ' || string_agg(s, ', ') from missing_statuses), 'New, Doing, Waiting, Done')),
    (4, 'items columns the app needs',
        not exists (select 1 from missing_columns),
        coalesce((select 'missing: ' || string_agg(c, ', ') from missing_columns), 'all present')),
    (5, 'items.details is jsonb  (next steps + payment status live here)',
        exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'items'
                  and column_name = 'details' and data_type = 'jsonb'),
        coalesce((select data_type from information_schema.columns
                  where table_schema = 'public' and table_name = 'items' and column_name = 'details'),
                 'no details column')),
    (6, 'all five tables present',
        not exists (select 1 from missing_tables),
        coalesce((select 'missing: ' || string_agg(t, ', ') from missing_tables), 'all present')),
    (7, 'realtime publishes items, attachments, item_links',
        not exists (select 1 from missing_realtime),
        coalesce((select 'not published: ' || string_agg(t, ', ') from missing_realtime), 'all three published')),
    (8, 'deletes carry workspace_id  (replica identity)',
        not exists (select 1 from partial_replica),
        coalesce((select 'not set: ' || string_agg(t, ', ') from partial_replica), 'all three set')),
    (9, 'row level security everywhere',
        not exists (select 1 from rls_off),
        coalesce((select 'RLS off: ' || string_agg(t, ', ') from rls_off), 'enabled everywhere')),
    (10, 'items update policy closed with WITH CHECK',
        exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'items'
                and policyname = 'members can update items' and with_check is not null),
        'blocks cross-workspace writes'),
    (11, 'workspace-files bucket, private, 25 MB',
        exists (select 1 from storage.buckets
                where id = 'workspace-files' and public = false and file_size_limit = 26214400),
        coalesce((select 'public=' || public::text || ', limit=' || coalesce(file_size_limit::text, 'none')
                  from storage.buckets where id = 'workspace-files'), 'bucket missing'))
) as t(step, check_name, ok, detail)
order by step;

-- ---------------------------------------------------------------------------
-- Optional: what the read-time normaliser is still translating.
-- Both are harmless — the app fixes them in memory and rewrites a row only when
-- somebody next saves it — but the counts should fall to zero over time.

select 'rows still carrying the old details.completed flag' as legacy,
       count(*) as rows
from public.items where jsonb_exists(details, 'completed')
union all
select 'expenses still saying "Not paid" instead of "Planned"',
       count(*)
from public.items where details->>'paymentStatus' = 'Not paid'
union all
select 'rows on a status word from before the four',
       count(*)
from public.items
where status is not null and status not in ('New', 'Doing', 'Waiting', 'Done');
