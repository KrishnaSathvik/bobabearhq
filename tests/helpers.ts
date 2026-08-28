import { expect, type Page } from '@playwright/test'
import { referenceCatalog } from '../src/referenceCatalog'

// The starter reference pack, written straight into the workspace.
//
// This used to be done by pressing "Add references" in the Library. That button
// is gone — the Library indexes what hangs off records rather than creating
// anything — and a suite should not depend on a piece of UI whose only job was
// to put rows in a table. The pack itself is the fixture.
// A small launch plan, owned by the suite.
//
// This used to come from pressing "Add checklist", which dropped thirty-seven
// invented tasks into the workspace. The app ships no plan any more — a launch
// plan you did not write is one you cannot trust — so the tests bring their own,
// and it is deliberately small enough to read. Titles only: a launch task is a
// line of text, and the phases it used to be filed under are gone.
export const launchTasks = [
  'Review the working brand name',
  'Recheck competitors in Khammam',
  'Decide opening staffing',
  'Visit and compare three properties',
  'Review the lease and deposit terms',
  'Test cup, sealing film and cup-sealer compatibility',
]

export async function seedLaunchTasks(page: Page) {
  await page.evaluate(tasks => {
    const now = new Date().toISOString()
    const existing = JSON.parse(localStorage.getItem('boba-bear-items') ?? '[]')
    // Stamped as an import, with createdAt and updatedAt identical: that pair
    // is exactly how the app recognises "arrived as structure, nobody has
    // touched it", which is what keeps a seeded plan out of Recent.
    const added = tasks.map((title, index) => ({
      id: crypto.randomUUID(), importKey: `test-launch-${index}`,
      title, body: '', kind: 'Checklist',
      section: 'Store Setup', area: 'Launch Checklist', status: 'New',
      details: { sortOrder: String(index) }, createdAt: now, updatedAt: now,
    }))
    localStorage.setItem('boba-bear-items', JSON.stringify([...added, ...existing]))
  }, launchTasks)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Inbox', level: 1 })).toBeVisible()
}

export async function seedReferencePack(page: Page) {
  await page.evaluate(pack => {
    const now = new Date().toISOString()
    const existing = JSON.parse(localStorage.getItem('boba-bear-items') ?? '[]') as Array<{ importKey?: string }>
    const already = new Set(existing.map(item => item.importKey).filter(Boolean))
    const added = pack
      .filter(item => !already.has(item.importKey))
      .map(item => ({ ...item, id: crypto.randomUUID(), createdAt: now, updatedAt: now }))
    localStorage.setItem('boba-bear-items', JSON.stringify([...added, ...existing]))
  }, referenceCatalog)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Inbox', level: 1 })).toBeVisible()
}

// The suite runs against a build with no Supabase credentials, so the workspace
// lives in localStorage. Clearing it gives every test the same starting point.
export async function openFreshWorkspace(page: Page) {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Inbox', level: 1 })).toBeVisible()
}

// Navigation is one screen deep. There is the Inbox, and there are the views
// pinned on it — no tabs, no drawer, no section pages to file things into.
export type View = 'Inbox' | 'Launch Checklist' | 'Menu' | 'Suppliers' | 'Locations'
  | 'Equipment' | 'Money' | 'Marketing' | 'Library' | 'Needs you'

export async function goTo(page: Page, view: View) {
  // The brand mark is Home from anywhere, which is how every pinned view is
  // two taps from every other one. On a phone the note or the editor takes the
  // whole screen, so Home means stepping out of it first.
  const brand = page.locator('.brand')
  if (!await brand.isVisible()) await page.getByRole('button', { name: /^Back/ }).first().click()
  await brand.click()
  await expect(page.getByRole('heading', { name: 'Inbox', level: 1 })).toBeVisible()
  if (view === 'Inbox') return
  await page.locator('.pin-row').filter({ has: page.locator('strong', { hasText: new RegExp(`^${view}$`) }) }).click()
  // The heading carries its count — "Launch Checklist6" — so this matches the
  // name it starts with rather than the whole of it.
  await expect(page.getByRole('heading', { name: new RegExp(`^${view}`), level: 1 })).toBeVisible()
}

export const editor = {
  root: (page: Page) => page.locator('form.editor'),
  title: (page: Page) => page.locator('form.editor .title-input'),
  body: (page: Page) => page.getByRole('textbox', { name: 'Write anything…' }),
  save: (page: Page) => page.locator('form.editor').getByRole('button', { name: 'Save' }),
  select: (page: Page, label: string) => page.locator('form.editor label', { hasText: label }).locator('select').first(),
}

// One button starts everything: the floating +. In a pinned view it adds that
// view's kind of record; on the Inbox it adds a plain note.
export async function startAdd(page: Page, view: View, kind?: string) {
  await goTo(page, view)
  await page.locator('.add-button').click()
  await expect(editor.root(page)).toBeVisible()
  if (kind) await chooseKind(page, kind)
}

export async function createRecord(page: Page, view: View, title: string, body = '') {
  await startAdd(page, view)
  await editor.title(page).fill(title)
  if (body) await editor.body(page).fill(body)
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()
}

// The two regions the window is made of. On a laptop both are on screen: the
// Inbox that is always there, and the pane holding whatever is open. On a phone
// only one is, and these still name it. Scope to a region rather than hoping a
// class landed in the pane you meant — navigation and content legitimately
// contain the same record, so an unscoped selector matches both.
export const inboxPane = (page: Page) => page.locator('[data-pane="inbox"]')
export const contentPane = (page: Page) => page.locator('[data-pane="content"]')

// A record can be listed in both regions at once — once in the Inbox, once in
// the open view. They are the same record, so a test that says "the record"
// gets one of them; a test that means a particular region says which.
export function row(page: Page, title: string) {
  return page.locator('.item-row', { hasText: title }).first()
}

export function inboxRow(page: Page, title: string) {
  return inboxPane(page).locator('.item-row', { hasText: title })
}

export function viewRow(page: Page, title: string) {
  return contentPane(page).locator('.item-row', { hasText: title })
}

// A row is two targets: the box that finishes it and the rest, which opens it.
export function openRow(page: Page, title: string) {
  return row(page, title).locator('.item-open').click()
}

// There is no Edit button on a record any more. The writing is editable where
// it sits, and everything else a record can have done to it is behind the •••.
export async function editRecord(page: Page) {
  await openMore(page)
  await page.locator('.sheet-option', { hasText: 'Edit' }).click()
  await expect(page.locator('form.editor')).toBeVisible()
}

// Quick Add: the floating + and nothing else. A note can be saved without ever
// saying what kind of thing it is.
export async function quickCapture(page: Page, text: string) {
  // The + adds this view's kind of record, so a plain note starts from the one
  // screen that holds plain notes.
  await goTo(page, 'Inbox')
  await page.locator('.add-button').click()
  await editor.body(page).fill(text)
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()
}

// Secondary field groups in the editor start folded. Tests open them the same
// way a person does, instead of reaching past the UI.
// The road a person now walks to reach a field the Add screen does not offer.
//
// Adding captures the minimum — a supplier is a name, a place and what they
// might sell us — and everything the record still has to learn is asked on the
// record itself. So a test that wants MOQ, or a property's parking, saves what
// it has and opens the thing it just made.
export async function saveThenEdit(page: Page, title: string) {
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()
  const open = page.locator('.item-open, .comparison-open, .supplier-catalogue-row')
    .filter({ hasText: title }).first()
  if (await open.isVisible()) await open.click()
  await editRecord(page)
}

// Folded field groups belong to a record that exists. Adding one asks only for
// what you already know, so a test that wants the depth saves first and opens
// the record — which is the whole shape of the app now.
export async function openGroup(page: Page, name: string) {
  const head = page.locator('form.editor .editor-group-head', { hasText: name })
  // Filing and Related records sit inside the details area on a plain note.
  if (!await head.isVisible()) await openDetails(page)
  await expect(head, `no "${name}" group here — is this an Add screen rather than a saved record?`).toBeVisible({ timeout: 3000 })
  if (await head.getAttribute('aria-expanded') === 'false') await head.click()
  await expect(head).toHaveAttribute('aria-expanded', 'true')
}

// Choosing what you are adding.
//
// Pressing + inside a view already decided this, so a structured Add screen no
// longer opens on the question — it opens on the four or five fields a supplier
// actually needs. The way out, for the two shapes no view has a + of its own
// for, is at the foot of the form. From the Inbox the question is still at the
// top, because there the + genuinely does not know.
//
// Asking for the kind a screen is already on is a no-op, so a test may say
// which kind it means even where the button pressed had already said it.
export async function chooseKind(page: Page, label: string) {
  // What the screen says it is adding. A structured record says it in the
  // heading — "New supplier · Suppliers"; a plain note says it on the line
  // above the writing — "Adding a note", because its heading names the place
  // it is going rather than the shape.
  async function saysKind() {
    const said = [page.locator('.kind-current'), page.locator('.kind-escape > button')]
    for (const line of said) {
      if (await line.isVisible() && (await line.innerText()).toLowerCase().includes(label.toLowerCase())) return true
    }
    return (await page.locator('form.editor .eyebrow').innerText()).toLowerCase().includes(label.toLowerCase())
  }
  if (await saysKind()) return

  const top = page.locator('.kind-current')
  const foot = page.locator('.kind-escape > button')
  if (await top.isVisible()) await top.getByRole('button', { name: 'Turn into…' }).click()
  else if (await foot.isVisible()) await foot.click()

  const option = page.locator('.kind-options .kind-option').filter({ has: page.locator('.kind-option-name', { hasText: new RegExp(`^${label}$`) }) })
  await expect(option, `no "${label}" to add here`).toBeVisible({ timeout: 3000 })
  await option.click()
  await expect.poll(saysKind, { message: `the editor did not switch to ${label}`, timeout: 3000 }).toBe(true)
}

// Status is four chips rather than a dropdown, so a test picks one the way a
// thumb does. On a plain note the chips live behind + Details, because a
// thought arriving does not need to be told what stage it is at — so a test
// reaches them the way a person does, by asking for the details first.
export async function openDetails(page: Page) {
  const toggle = page.locator('form.editor .write-tool-details')
  if (!await toggle.isVisible()) return
  if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
}

// Turning a captured thought into something with a shape.
//
// This used to be a row of chips under every note — "Is this something in
// particular? A supplier / A drink / …" — which put a form of decisions under
// three words you had just typed. Changing what a record is now happens where
// the rest of a record's structure is changed: in the editor, under Filing.
export async function turnInto(page: Page, kind: string) {
  await editRecord(page)
  await openGroup(page, 'Filing')
  await editor.select(page, 'Type').selectOption(kind)
}

// A word picked from a short row of chips rather than typed: a drink's menu
// category, a marketing contact's channel. Same gesture as choosing a status,
// and like a status the chip toggles — asking for one means ending up with it.
export async function chooseChip(page: Page, legend: string, label: string) {
  const group = page.locator('form.editor fieldset.status-field')
    .filter({ has: page.locator('legend', { hasText: new RegExp(`^${legend}$`) }) })
  const chip = group.locator('.status-chip').filter({ hasText: new RegExp(`^${label}$`) })
  await expect(chip, `no "${label}" ${legend.toLowerCase()} on this record`).toBeVisible({ timeout: 3000 })
  if (await chip.getAttribute('aria-pressed') === 'true') return
  await chip.click()
}

// Statuses are each kind's own words now — 'To visit' on a property, 'Ordered'
// on a machine — so a test asks for one this record can actually wear.
export async function chooseStatus(page: Page, status: string) {
  const chip = page.locator('form.editor .status-chip').filter({ hasText: new RegExp(`^${status}$`) })
  if (!await chip.isVisible()) await openDetails(page)
  // Fail here, saying which word was missing, rather than timing out in 30s
  // against a chip that this kind has never had.
  await expect(chip, `no "${status}" status on this record`).toBeVisible({ timeout: 3000 })
  // A chip toggles, so pressing the one that is already on would clear it.
  // Asking for a status means ending up with it, however the record started.
  if (await chip.getAttribute('aria-pressed') === 'true') return
  await chip.click()
}

// Locations, Equipment and the Launch Checklist used to live inside a Store
// Setup page. They are pinned views of their own now.
export async function openStoreView(page: Page, name: 'Locations' | 'Equipment' | 'Launch checklist') {
  await goTo(page, name === 'Launch checklist' ? 'Launch Checklist' : name)
}

// Reading a record and then acting on it: the ••• opens a sheet of what can be
// done to it, which is where Edit and Delete live now.
export async function openMore(page: Page) {
  await page.getByRole('button', { name: 'More actions' }).click()
  await expect(page.locator('.sheet')).toBeVisible()
}
