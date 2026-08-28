# Mobile-First Capture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn Boba Bear HQ from a seven-tab record tracker into a phone-first workbook where capture is one action and structure is added afterwards.

**Architecture:** One capture bar is the front door on every screen. Everything saved lands untyped in an Inbox. A record gains a kind and three fields only when you promote it. The seven sections stop being containers and become saved views over one pool, reached from a Find screen. Navigation collapses to three bottom tabs.

**Tech Stack:** React 19, TypeScript, Vite, Supabase (online only), Playwright, oxlint.

**Design:** `docs/plans/2026-08-23-mobile-first-capture-design.md`

---

## Task 1: Camera capture

**Files:** Modify `src/App.tsx` (image input)

Add `capture="environment"` to the photo input so a phone opens the camera
rather than the photo picker. One attribute, shipped on its own.

Verify: `npm run lint && npx tsc -b`. Commit.

## Task 2: Capture bar

**Files:**
- Create: `src/components/CaptureBar.tsx`
- Modify: `src/App.tsx`, `src/styles.css`
- Test: `tests/capture.spec.ts`

A bar fixed to the bottom of the viewport on every screen except the editor and
the record detail. One textarea that grows as you type, a camera button, an
attach button, and Save. Saving posts through the existing `quickSave` path and
clears the bar without navigating anywhere.

The textarea is the voice input: no speech recognition, just a plainly tappable
box the native keyboard mic can dictate into. It carries
`aria-label="Quick capture"`, so a phone reader announces it.

Respect `env(safe-area-inset-bottom)`. Give `main` bottom padding equal to the
bar height so the last row in any list clears it.

**Test first:** capture from a section screen, assert the item appears in Inbox.

Verify: `npm run lint && npx tsc -b && npm run test`. Commit.

## Task 3: Inbox replaces Home

**Files:** Modify `src/App.tsx`, `src/lib/labels.ts`, `src/styles.css`, `tests/helpers.ts`

`Home` becomes `Inbox`. It is a list, not a compose screen: the big textarea is
gone, because the capture bar took that job. `sectionLabel('Notes')` returns
`'Inbox'`. Records still store `section: 'Notes'`, so nothing migrates.

Update `openFreshWorkspace` and `createRecord` in `tests/helpers.ts` for the new
heading and the capture bar.

Verify: `npm run lint && npx tsc -b && npm run test`. Commit.

## Task 4: Schema diet — statuses

**Files:** Modify `src/types.ts`, `src/lib/labels.ts`, `src/App.tsx`, `src/components/*`, `supabase/migrations/`

Nineteen statuses become four: `New`, `Doing`, `Waiting`, `Done`. Add
`legacyStatusMap` translating every old value onto one of the four so stored
rows keep meaning without a destructive migration. `statusesForKind` collapses
to a single list for every kind.

Replace the status `<select>` in the editor with four tappable chips.

Verify: `npm run lint && npx tsc -b && npm run test`. Commit.

## Task 5: Schema diet — kinds and fields

**Files:** Modify `src/types.ts`, `src/lib/labels.ts`, `src/App.tsx`

Thirteen kinds become five: `Note`, `Supplier`, `Money`, `Place`, `Task`.
`legacyKindMap` folds the old kinds in (`Quote`/`Expense` → `Money`,
`Product`/`Location` → `Place`, `Drink`/`SupplierProduct`/`Sample` → `Supplier`
where they describe a supplier's goods, `Checklist` → `Task`,
`Link`/`File` → `Note`).

Every kind's form is three fields plus free text. Everything else moves behind a
single "More details" disclosure and stays optional.

The seven relationship types collapse to one generic `Related to`.

Verify: `npm run lint && npx tsc -b && npm run test`. Commit.

## Task 6: Promote from inbox

**Files:** Modify `src/App.tsx`, `src/styles.css`; Test: `tests/promote.spec.ts`

An untyped inbox record shows one row of chips — Supplier, Money, Place, Task —
and choosing one gives it that kind and reveals its three fields in place. No
navigation, no separate form.

**Test first:** capture a sentence, promote it to Supplier, fill the phone
number, assert it appears under the Suppliers view.

Verify: `npm run lint && npx tsc -b && npm run test`. Commit.

## Task 7: Three bottom tabs

**Files:** Modify `src/App.tsx`, `src/styles.css`; rewrite `tests/helpers.ts` and the section specs

Top tab bar and hamburger both go. Three thumb targets fixed to the bottom:
**Inbox**, **Find**, **Now**. The old sections become saved views listed inside
Find, underneath the search box.

This is the task that breaks the suite. `tests/responsive.spec.ts`,
`tests/editor-layout.spec.ts` and every spec calling `nav()` navigate by
clicking a section in the top bar. Rewrite `nav()` to go through Find, and fix
the specs that assert on the top bar.

Verify: `npm run lint && npx tsc -b && npm run test`. Commit.

## Task 8: Now screen

**Files:** Create `src/components/Now.tsx`; Modify `src/App.tsx`; Test: `tests/now.spec.ts`

Everything in `Waiting`, then everything in `Doing` untouched for seven days.
Nothing else. If both lists are empty the screen says so plainly rather than
showing zeroes.

Verify: `npm run lint && npx tsc -b && npm run test`. Commit.

## Task 9: Mobile-first test promise

**Files:** Modify `tests/responsive.spec.ts`

Today it asserts nothing clips, which is a not-broken standard. Add: the capture
bar is reachable at every width, Save is never below the fold, and every tap
target on the bottom bar is at least 44px.

Verify: `npm run lint && npx tsc -b && npm run test`. Commit.
