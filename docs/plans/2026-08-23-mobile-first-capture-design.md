# Mobile-first capture — design

**Date:** 2026-08-23
**Status:** approved, not yet planned

## The problem

The app works, but it feels like a SaaS tracker rather than a workbook for a
business. Four frictions, all of them real:

- getting a thought in
- knowing what to do next
- filling records out
- finding what was saved

Those are not four screen bugs. They are one model problem, and it shows up in
the vocabulary before it shows up in the pixels. `types.ts` defines 13 record
kinds, 19 statuses and 7 relationship types. "Tea Planet wants ₹8k advance" is
not a thing you can save: first you decide whether it is a Supplier, a
SupplierProduct or a Quote, which of 19 statuses it sits in, and which of seven
sections owns it. That is data entry standing in front of a thought.

Two more things follow from it. The seven tabs are an org chart, not a moment in
anyone's day — you have to know the filing cabinet before you can act. And Home
is the one humane surface in the app, but it is a dead end: quick capture drops
into `Notes` and nothing ever pulls those notes forward into structure. The easy
door leads to a junk drawer; everything useful is behind the hard door.

The visual design is not the problem. It is calm and it stays.

## The decision

**Capture first, structure later, phone first.**

One input is the front door for everything. What you save lands untyped. The
structure is added onto the record afterwards, when you actually have the
answer, rather than demanded at the moment of the thought.

Sections stop being containers and become saved views over one pool. Nothing is
*in* a tab any more, so search and views are the only ways in — and both work,
which is what removes "which tab did I put it in".

The phone is the design target. The laptop is the same app with more on the
screen, not the design the phone is squeezed out of.

**Online only.** Saves need signal. Offline capture was considered and
deliberately dropped: a service worker, a sync queue and conflict handling
against Supabase realtime is a large piece of work for a case that has not hurt
yet. It can be added later.

## The phone app

Three thumb targets along the bottom, replacing seven tabs behind a hamburger:

- **Inbox** — the default screen. Everything captured, newest first, unfiled.
- **Find** — search across everything, with the old sections listed underneath
  as plain shortcuts into saved views.
- **Now** — the short list of things actually waiting on you. Built last.

Capture is a bar pinned above the keyboard, present on every screen, never a
page you navigate to. Type, save, and you are back where you were.

Three things make capture work on a phone, and two are nearly free:

1. **The textarea is the voice input.** No speech recognition to build — the
   native keyboard mic already dictates into any textarea. The box just has to
   be big and obvious. Standing in a shop, you talk at it.
2. **Camera, not file picker.** The image input passes `accept="image/*"` with
   no `capture` attribute, so it opens a picker. `capture="environment"` opens
   the camera instead. A photograph of a price list, a shopfront or a label is
   the record. One attribute.
3. **Links already work.** `suggestTitleFromUrl` stays as it is.

## The record model

An inbox item is a sentence and maybe a photo. Tapping it offers one row of
chips — Supplier, Expense, Place, Drink, Task — and choosing one gives the
record **three** fields. Supplier asks name, phone, and what they sell. That is
the entire form on a phone.

The rest of today's fields survive, behind a "More details" disclosure, optional
forever. MOQ, shipping terms, payment terms, lead time, FSSAI notes: these are
laptop-time fields. Today a Supplier record fronts twelve of them across three
drawers.

**Statuses collapse from 19 to four:** New, Doing, Waiting, Done. The status
`<select>` is the most SaaS-feeling control in the app — on a phone it opens a
native wheel with nineteen entries. Four statuses become one tap on the row.

Kinds collapse from 13 to roughly five. Relationship types collapse to one
generic link.

## The laptop

The same code, wider. The inbox becomes list-and-record side by side, and the
views regain the comparison surfaces that already exist — `EquipmentComparison`
and `MoneyOverview` are good work and are pointless at 390px.

This is the inversion that matters: the phone shows less, the laptop *adds*
analysis. Today the laptop is the design and the phone is the remainder.

## Build order

Each step ships on its own.

1. **Capture bar, camera capture, Inbox as home.** No migration, no test
   rewrites, and it changes the daily feel by itself. Worth doing even if
   nothing else follows.
2. **Schema diet.** Statuses to four, kinds to about five, forms to three
   fields plus a disclosure. Mostly `types.ts`, `lib/labels.ts` and the
   `FieldGroup` blocks in the editor.
3. **Promote-from-inbox.**
4. **Navigation to three bottom tabs**, sections become saved views.
5. **Now screen.**

## Testing

Steps 1 to 3 leave the existing Playwright suite broadly intact. Step 4 does
not: `responsive.spec.ts`, `editor-layout.spec.ts` and the section specs all
navigate by section heading through the tab bar, and they will need rewriting
against the new navigation. That rewrite is part of step 4, not a follow-up.

`responsive.spec.ts` also needs a stronger promise. Today it asserts that
nothing clips, which is a not-broken standard. Mobile-first means asserting that
capture is reachable with one thumb and that Save is never below the fold.

## Out of scope

- Offline capture and sync.
- Any change to the visual language: type, colour, spacing and the logo stay.
- Migrating existing records to new kinds. Old kinds map onto the reduced set;
  nothing is deleted.
