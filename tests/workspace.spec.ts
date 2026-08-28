import { expect, test } from '@playwright/test'
import { chooseKind, chooseStatus, contentPane, createRecord, editRecord, editor, goTo, inboxPane, inboxRow, openFreshWorkspace, openGroup, openRow, row, startAdd, viewRow , seedLaunchTasks } from './helpers'

test.beforeEach(async ({ page }) => {
  await openFreshWorkspace(page)
})

test('home is a notebook, not a dashboard', async ({ page }) => {
  // One visible action, and it is the +. No bottom navigation, no drawer, no
  // module tabs, no toolbar of things to press.
  await expect(page.locator('.add-button')).toBeVisible()
  await expect(page.locator('.tabbar')).toHaveCount(0)
  // And no analytics: totals and widgets live inside the view they belong to.
  await expect(page.locator('.money-totals')).toHaveCount(0)
  await expect(page.locator('.launch-checklist')).toHaveCount(0)
  // The list underneath is the notebook itself, not a metric.
  await expect(page.locator('.item-list')).toHaveCount(1)
})

test('a thought is saved without being classified, and filed later', async ({ page }) => {
  // The + never asks what kind of thing this is before letting you write. The
  // type is offered beside the writing, folded away, and answering it is
  // optional: a sentence and Save is the whole of it, and the note takes its
  // title from what was written.
  await page.locator('.add-button').click()
  await expect(editor.body(page)).toBeFocused()
  await expect(page.locator('.kind-current')).toContainText('Adding a note')
  await expect(page.locator('.kind-options')).toHaveCount(0)
  await editor.body(page).fill('Kraft carrier sizes to confirm with the packaging vendor.')
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()

  // Filing happens later, on the record itself.
  await page.locator('.inbox .item-row', { hasText: 'Kraft carrier sizes' }).locator('.item-open').click()
  await editRecord(page)
  await openGroup(page, 'Filing')
  await editor.select(page, 'Belongs to').selectOption('Store Setup')
  await editor.select(page, 'Area').selectOption('Packaging')
  await editor.save(page).click()

  // Filing sets where a record belongs; it does not hide it. Every record is
  // still on the one list there is, and still findable by searching for it.
  await goTo(page, 'Inbox')
  await expect(row(page, 'Kraft carrier sizes')).toBeVisible()
  await goTo(page, 'Inbox')
  await expect(row(page, 'Kraft carrier sizes')).toBeVisible()
})

test('a saved record survives a reload', async ({ page }) => {
  await createRecord(page, 'Inbox', 'Persisted note', 'should still be here')
  await page.reload()
  await goTo(page, 'Inbox')
  await expect(row(page, 'Persisted note')).toBeVisible()
})

test('opening a record shows a readable page and does not start editing', async ({ page }) => {
  await createRecord(page, 'Inbox', 'Readable record', 'the body text')
  await row(page, 'Readable record').locator('.item-open').click()

  await expect(page.getByRole('heading', { name: 'Readable record', level: 1 })).toBeVisible()
  await expect(page.locator('.detail-body')).toHaveText('the body text')
  // The editor must only appear once Edit is chosen.
  await expect(editor.root(page)).toBeHidden()
  await editRecord(page)
  await expect(editor.root(page)).toBeVisible()
})

test('edit and delete a record, with delete needing confirmation', async ({ page }) => {
  await createRecord(page, 'Inbox', 'Before edit')
  await row(page, 'Before edit').locator('.item-open').click()
  await editRecord(page)
  await editor.title(page).fill('After edit')
  await editor.save(page).click()
  await expect(page.getByRole('heading', { name: 'After edit', level: 1 })).toBeVisible()

  await editRecord(page)
  await editor.root(page).getByRole('button', { name: 'Delete', exact: true }).click()
  // One click must not delete anything.
  await expect(editor.root(page).getByRole('button', { name: 'Delete permanently' })).toBeVisible()
  await editor.root(page).getByRole('button', { name: 'Delete permanently' }).click()

  await goTo(page, 'Inbox')
  await expect(row(page, 'After edit')).toHaveCount(0)
})

test('closing an edited record asks before discarding', async ({ page }) => {
  await goTo(page, 'Inbox')
  await page.locator('.add-button').click()
  await editor.title(page).fill('half-typed work')

  await editor.root(page).getByRole('button', { name: /^Back to / }).click()
  const discard = page.getByRole('dialog', { name: 'Discard changes?' })
  await expect(discard).toContainText('Your unsaved changes will be lost.')

  // Keep editing leaves everything exactly as it was.
  await discard.getByRole('button', { name: 'Keep editing' }).click()
  await expect(discard).toBeHidden()
  await expect(editor.title(page)).toHaveValue('half-typed work')

  // Cancel asks the same question as the X.
  await editor.root(page).getByRole('button', { name: /^Back to / }).click()
  await expect(page.getByRole('dialog', { name: 'Discard changes?' })).toBeVisible()
  await page.getByRole('dialog', { name: 'Discard changes?' }).getByRole('button', { name: 'Discard' }).click()
  await expect(editor.root(page)).toBeHidden()
  await expect(row(page, 'half-typed work')).toHaveCount(0)
})

test('closing an untouched record does not ask anything', async ({ page }) => {
  await goTo(page, 'Inbox')
  await page.locator('.add-button').click()
  await editor.root(page).getByRole('button', { name: /^Back to / }).click()
  await expect(editor.root(page)).toBeHidden()
  await expect(page.getByRole('dialog', { name: 'Discard changes?' })).toHaveCount(0)
})

test('the workspace wears its own logo, and the icons actually ship', async ({ page }) => {
  const mark = page.locator('.brand-mark')
  await expect(mark).toBeVisible()
  // A broken image still "exists", so check the browser really decoded it.
  const loaded = await mark.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)
  expect(loaded).toBe(true)
  // The mark is decoration next to the name, not a second copy of it.
  await expect(mark).toHaveAttribute('alt', '')
  await expect(page.getByRole('button', { name: 'Boba Bear' })).toBeVisible()

  for (const path of ['/favicon.ico', '/favicon-32x32.png', '/apple-touch-icon.png', '/logo-mark.png', '/logo-lockup.png']) {
    const response = await page.request.get(path)
    expect(response.status(), `${path} is not being served`).toBe(200)
  }

  const manifest = await (await page.request.get('/site.webmanifest')).json()
  expect(manifest.name).toBe('Boba Bear HQ')
  expect(manifest.short_name).toBe('Boba Bear')
  expect(manifest.icons.length).toBeGreaterThanOrEqual(2)
})

test('the inbox is one list of everything, newest movement first', async ({ page }) => {
  // There is no navigation to speak of: a header, a filter and the +. The six
  // sections are pinned views on this one screen.
  await expect(page.getByRole('navigation')).toHaveCount(0)

  await page.locator('.add-button').click()
  await editor.body(page).fill('Ask the landlord about the water connection.')
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()

  // It is listed on the screen it was written on, at the top, because it is the
  // thing that moved most recently.
  await expect(page.locator('.inbox .item-list .item-row').first())
    .toContainText('Ask the landlord about the water connection')

  // Filing a note gives it a pinned view to belong to, and it stays on the one
  // list as well — filing is not filing away.
  await createRecord(page, 'Inbox', 'Belongs in marketing')
  await openRow(page, 'Belongs in marketing')
  await editRecord(page)
  await openGroup(page, 'Filing')
  await editor.select(page, 'Belongs to').selectOption('Marketing')
  await editor.save(page).click()

  await goTo(page, 'Marketing')
  await expect(viewRow(page, 'Belongs in marketing')).toBeVisible()
  await goTo(page, 'Inbox')
  await expect(inboxRow(page, 'Belongs in marketing')).toBeVisible()
})

// The Inbox used to carry an `Everything ▾` menu listing Notes, Tasks, Money,
// Locations, Suppliers, Menu, Equipment, Marketing and Documents — which is the
// Views list, printed a second time three inches below itself. Two navigations
// for one set of things is what made a small app feel like a large one.
test('the inbox has one navigation, not two', async ({ page }) => {
  await createRecord(page, 'Inbox', 'A plain thought')
  await startAdd(page, 'Money', 'Expense')
  await editor.title(page).fill('Signboard advance')
  await editor.save(page).click()

  await goTo(page, 'Inbox')
  await expect(page.locator('.filter-button')).toHaveCount(0)
  // Recent is a history of everything that moved, unfiltered.
  await expect(row(page, 'A plain thought')).toBeVisible()
  await expect(row(page, 'Signboard advance')).toBeVisible()
  // And the one navigation is the views, which are always there.
  await expect(page.locator('.pin-row')).not.toHaveCount(0)
})

// A note carries no status, so there is no box beside it: a thought is
// something you wrote, not something you finish. Anything that does need
// finishing is a task, and this is what ticking one looks like.
test('a task can be ticked off; a note has no box to tick', async ({ page }) => {
  // A note carries no status, so there is no box beside it: a thought is
  // something you wrote, not something you finish.
  await page.locator('.add-button').click()
  await editor.body(page).fill('Their Hyderabad depot is closer than New Delhi')
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()
  await expect(row(page, 'Hyderabad depot').getByRole('button', { name: /^Mark/ })).toHaveCount(0)

  // Anything that does need finishing is a task, and it lives on the checklist.
  await goTo(page, 'Launch Checklist')
  const add = page.locator('.checklist-add')
  await add.getByRole('textbox', { name: 'Add a launch task' }).fill('Ask Tea Planet whether they deliver to Khammam')
  await add.getByRole('textbox', { name: 'Add a launch task' }).press('Enter')
  const asked = page.locator('.checklist-row', { hasText: 'Ask Tea Planet' })
  await expect(asked).toBeVisible()

  await asked.getByRole('button', { name: /^Mark/ }).click()

  // It stays where it is, struck through and with a filled box, rather than
  // vanishing — a finished task is still a record of what was done.
  await expect(asked).toHaveClass(/checked/)
  await expect(asked.locator('.check-title')).toHaveCSS('text-decoration-line', 'line-through')
  await expect(page.locator('.launch-checklist > header')).toContainText('1 of 1 complete')
})

test('"Needs you" is a place to finish things, not only a list of them', async ({ page }) => {
  await page.locator('.add-button').click()
  // A note carries no status and so can never be waiting on anyone. Chasing a
  // quote is a piece of work, which is a task.
  await chooseKind(page, 'Task')
  await editor.title(page).fill('Chase the signage quote')
  await chooseStatus(page, 'Waiting')
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()

  // "Needs you" is a pin, and it only appears when something actually does.
  await goTo(page, 'Needs you')
  const chasing = page.locator('.item-row', { hasText: 'Chase the signage quote' }).first()
  await expect(chasing).toBeVisible()

  // Ticking it off from here is enough; nothing needs opening.
  await chasing.getByRole('button', { name: /^Mark/ }).click()
  await expect(contentPane(page).locator('.item-row')).toHaveCount(0)
  // Emptied, the pin itself goes away rather than sitting there saying zero.
  await goTo(page, 'Inbox')
  await expect(page.locator('.pin-row', { hasText: 'Needs you' })).toHaveCount(0)
})

// Seeding the built-in packs writes eighty-odd rows at once. They are structure
// that arrived, not things that happened, and they already have pins to live in
// — so they must not take over the one list on the home screen.
test('launch tasks never appear in Recent', async ({ page }) => {
  await seedLaunchTasks(page)
  await goTo(page, 'Launch Checklist')
  const titles = await page.locator('.check-title').allInnerTexts()
  expect(titles.length).toBeGreaterThan(0)

  // The tasks are in their own view, in full — and nowhere in the Inbox. A
  // launch task belongs to the checklist and is worked on there; ticking six
  // off on a Saturday should not push what you wrote off the bottom of Recent.
  await goTo(page, 'Inbox')
  for (const title of titles) {
    await expect(inboxPane(page).locator('.item-row', { hasText: title }), `${title} leaked into Recent`).toHaveCount(0)
  }
  // The pin carries the progress instead, which is where you would look.
  await expect(page.locator('.pin-row', { hasText: 'Launch Checklist' })).toContainText('0 of 6 complete')
})

test('a workspace that is only seeded says so instead of looking empty', async ({ page }) => {
  // Clear the three starter notes so the pack is all there is.
  await page.evaluate(() => localStorage.setItem('boba-bear-items', '[]'))
  await page.reload()

  await seedLaunchTasks(page)
  await goTo(page, 'Launch Checklist')
  await expect(page.locator('.checklist-row').first()).toBeVisible()

  await goTo(page, 'Inbox')
  await expect(inboxPane(page).locator('.empty-state')).toContainText('Nothing worked on yet')
  await expect(inboxPane(page).locator('.empty-state')).toContainText('waiting in the views above')
})
