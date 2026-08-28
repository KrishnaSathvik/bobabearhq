# Boba Bear HQ

A calm private workspace for planning and operating Boba Bear Khammam.

## How it works

It is one shared notebook. **Open → Write → Save → Find later**, and nothing
about it should feel like a dashboard.

Capture comes first and structure comes later. The floating **+** never asks
what you are adding *before letting you write*: on the Inbox it opens a plain
note with the caret already in the writing, and the type sits folded away beside
it — one tap turns the same composer into an expense, a property or a supplier,
and files it where that shape lives. Inside a pinned view the + already knows,
so it adds that view's kind and says so on the button. A note you never
classified asks what it is when you next open it — tap a shape and it gains that
shape's fields and moves into the right view.

A record carries its own short list of next steps ("visit Saturday evening",
"confirm the MOQ"), ticked where the record is read. The **Launch Checklist** is
the cross-business plan; the steps on a record are the two or three moves that
belong to that one thing. Either way, finished is `status` — one field, one
box, wherever you tick it.

There is no navigation to speak of: a header, a search field, one
`Everything ▾` filter and the **+**. Everything that used to be a tab is a
**pinned view** on the Inbox — Launch Checklist, Menu, Suppliers, Locations,
Equipment, Money, Marketing and Library — each with the one number that says
whether it needs you. A ninth pin, **Needs you**, appears only when something is
waiting on somebody else or has been marked Doing and untouched for a week.

Below the pins, **Recent** is every record in the workspace, newest movement
first, narrowed by the one filter. Filing a record gives it a view to belong to;
it never hides it from that list.

On a phone this is one pane and a note opens full-screen. From 1024px up it is a
Notes-style two-pane view: the list on the left, the note beside it.

Every record carries one of four statuses: **New**, **Doing**, **Waiting**,
**Done**. Older workspaces still hold the nineteen statuses this replaced; those
are translated when they are read, and the stored rows are never rewritten.

## Design

`DESIGN_SYSTEM.md` is the fourth spec, alongside `FEATURES.md`, `UI_UX.md` and
`ARCHITECTURE.md`. It fixes the colour, type, spacing, radius, shadow, icon and
motion tokens, and every one of them is a CSS custom property at the top of
`src/styles.css`. Nothing in the app hard-codes a colour, a radius or a step of
the spacing scale.

## Run locally

```bash
npm install
npm run dev
```

Without Supabase environment variables, the frontend stores changes in the browser for local design testing.

## Shared workspace setup

1. Create a Supabase project.
2. Run the SQL files in `supabase/migrations/` in filename order. The later
   migrations (`…0009`–`…0012`) are safe to run against an existing project and on
   an already-repaired one: they publish `items`, `attachments` and `item_links` to
   Realtime, close the update policy, index the columns every query filters on,
   widen the status vocabulary, and add supplier records plus the `item_links`
   table behind related records, and add the drink, product-link and influencer
   record types along with the `Deferred` and `Completed` statuses, and
   (`…0013`) widen the status check to accept the four statuses the app actually
   writes — without it every save carrying a status is rejected. Applied
   migrations are never edited; repairs move forward. **`…0011` and `…0012` have to
   be applied before the reference pack is imported**, because that pack creates
   `Supplier` and `Drink` records.
3. Copy `.env.example` to `.env.local` and add the project URL and public anonymous key.
4. Create the shared authentication user `bobabearkhammam@gmail.com` in Supabase Auth.

When the environment variables are present, the private login boundary, shared synchronization, file uploads, and reference-pack import are enabled.

## Checks

```bash
npm run lint     # oxlint
npx tsc -b       # app and test sources
npm run build    # production build
npm run test     # Playwright suite against a local, storage-only build
```

`npm run test:shared` runs the flows that only exist with Supabase behind them — the
login boundary, two-session sync, and file upload. They need a real project:

```bash
BOBA_E2E_URL=http://localhost:4173 BOBA_E2E_PASSWORD=… npm run test:shared
```

Point `BOBA_E2E_URL` at a build made with real Supabase credentials, and prefer a
scratch project: those tests create and delete records.

## Import the planning references

After the migrations are applied, sign in, open the **Library** pin on the Inbox, and choose **Add references**. The import is safe to run again: each reference has a stable import key, so it will not create duplicates. Imported planning information arrives as **New** or **Doing**—never as a decision.

Because the import skips keys that already exist, a workspace that imported the
pack *before* migration `…0011` keeps those older rows as they were (the candidate
suppliers stay `Link` records). Change one to **Supplier** in the editor when you
want the supplier fields, or delete the old row and import again.

## How records connect

A record can point at other records — a quote is a *Quote for* a machine and
*Supplied by* a supplier. Links are made where the record is read, under
**Connected**, and are visible from both ends: the machine shows the quote, the
quote shows the machine. Removing a link is done from the record that made it.
