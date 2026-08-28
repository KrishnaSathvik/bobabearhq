import { expect, test } from '@playwright/test'
import { chooseKind, contentPane, editor, goTo, inboxPane, openFreshWorkspace, viewRow , seedReferencePack , seedLaunchTasks } from './helpers'

test.beforeEach(async ({ page }) => {
  await openFreshWorkspace(page)
})

// The pins are the navigation. Hiding them until the first record existed took
// the Launch Checklist and the Library off the screen — and with them the two
// buttons that fill a brand-new workspace, which is the one moment they matter.
test('a brand-new workspace can still be navigated and seeded', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('boba-bear-items', '[]'))
  await page.reload()

  await expect(page.locator('.pin-row')).toHaveCount(8)
  await expect(inboxPane(page).locator('.empty-state')).toContainText('Your Boba Bear notebook is ready')

  // And the seed action behind a pin is reachable, which is the point.
  await seedLaunchTasks(page)
  await goTo(page, 'Launch Checklist')
  await expect(page.locator('.checklist-row').first()).toBeVisible()
  await goTo(page, 'Inbox')
  await expect(page.locator('.pin-row', { hasText: 'Launch Checklist' })).toContainText('0 of 6 complete')
})

// One click means one thing. Leaving the open record in place meant the pin lit
// up, the back button relabelled, and the pane you were looking at did not move.
test('opening a view from a pin changes the workspace, even with a record open', async ({ page }) => {
  await page.locator('.inbox .item-row').first().locator('.item-open').click()
  await expect(contentPane(page).locator('.detail-page')).toBeVisible()

  await page.locator('.pin-row').filter({ has: page.locator('strong', { hasText: /^Suppliers$/ }) }).click()

  await expect(contentPane(page).getByRole('heading', { name: 'Suppliers', level: 1 })).toBeVisible()
  await expect(contentPane(page).locator('.detail-page')).toHaveCount(0)
})

// Completion is one field. When the Inbox box and the checklist box wrote two,
// a task read as finished on one screen and unfinished on the other.
// A launch task is worked on where it lives. It used to also be activity in
// the Inbox, so ticking six things off on a Saturday pushed everything you had
// actually written off the bottom of Recent.
test('a task is ticked on the checklist, and stays out of Recent', async ({ page }) => {
  await seedLaunchTasks(page)
  await goTo(page, 'Launch Checklist')
  const task = page.locator('.checklist-row').first()
  const title = await task.locator('.check-title').innerText()

  await task.locator('.check-toggle').click()
  await expect(task).toHaveClass(/checked/)
  await expect(page.locator('.launch-checklist > header')).toContainText('1 of 6')

  // Not in Recent, before or after ticking.
  await goTo(page, 'Inbox')
  await expect(inboxPane(page).locator('.item-row', { hasText: title })).toHaveCount(0)
  // The pin carries the count instead, which is where you would look for it.
  await expect(page.locator('.pin-row', { hasText: 'Launch Checklist' })).toContainText('1 of 6 complete')

  // Unticking it on the list puts the count back.
  await goTo(page, 'Launch Checklist')
  await page.locator('.checklist-row', { hasText: title }).locator('.check-toggle').click()
  await expect(page.locator('.checklist-row', { hasText: title })).not.toHaveClass(/checked/)
  await expect(page.locator('.launch-checklist > header')).toContainText('0 of 6')
})

test('the add says what it will actually add', async ({ page }) => {
  // The Launch Checklist is absent on purpose: it writes tasks on the list
  // itself, so it carries no heading + to label.
  const expected: Array<[Parameters<typeof goTo>[1], string]> = [
    ['Inbox', 'Add note'],
    ['Menu', 'Add drink'],
    ['Suppliers', 'Add supplier'],
    ['Locations', 'Add location'],
    ['Equipment', 'Add equipment'],
    ['Money', 'Add expense'],
    ['Marketing', 'Add marketing'],
    ['Library', 'Add note'],
  ]
  for (const [view, label] of expected) {
    await goTo(page, view)
    await expect(page.locator('.add-button'), `${view} mislabels its add`).toHaveAttribute('aria-label', label)
  }

  // And the one that writes its own says so in the field you type into.
  await goTo(page, 'Launch Checklist')
  await expect(page.locator('.add-button')).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'Add a launch task' })).toBeVisible()
})

// The + opens straight into the writing. The type is beside it, not in front of
// it — but it is there, so the Inbox can start anything.
test('the inbox composer can become an expense without leaving the inbox', async ({ page }) => {
  await page.locator('.add-button').click()
  await expect(editor.body(page)).toBeFocused()

  await chooseKind(page, 'Expense')
  await expect(editor.root(page).locator('.eyebrow')).toHaveText('New expense · Money')
  await editor.title(page).fill('Packaging samples')
  await page.getByRole('spinbutton').first().fill('4500')
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()

  // Started from the Inbox, filed in Money, and counted there.
  await goTo(page, 'Money')
  await expect(viewRow(page, 'Packaging samples')).toBeVisible()
  await expect(page.locator('.money-totals')).toContainText('₹4,500')
})

// An expense's status is its payment. Two status controls on one receipt is one
// question too many, and the row should not print the same answer twice.
test('an expense is asked about payment once, and only once', async ({ page }) => {
  await goTo(page, 'Money')
  await page.locator('.add-button').click()
  await expect(editor.root(page).locator('.status-field')).toHaveCount(0)
  await editor.title(page).fill('Cup sealer deposit')
  await page.getByRole('spinbutton').first().fill('18000')
  await editor.select(page, 'Payment').selectOption('Committed')
  await editor.save(page).click()

  const record = viewRow(page, 'Cup sealer deposit')
  await expect(record).toContainText('Committed')
  await expect(record.locator('.item-meta')).toHaveCount(0)
  // Committed money is owed, so it counts as outstanding rather than spent.
  await expect(page.locator('.money-totals')).toContainText('₹18,000')
})

// The two or three moves that belong to one record, ticked where the record is
// read. No dates, no owners — the Launch Checklist is where a plan lives.
test('a record carries its own short list of next steps', async ({ page }) => {
  await goTo(page, 'Locations')
  await page.locator('.add-button').click()
  await editor.title(page).fill('Shop near Ibaco')
  await editor.save(page).click()

  // The Locations view lists properties in its own comparison rows.
  const property = () => contentPane(page).locator('.comparison-row', { hasText: 'Shop near Ibaco' }).locator('.comparison-open')
  await property().click()
  const steps = page.locator('.record-checklist')
  const add = steps.getByRole('textbox', { name: 'Add a step' })
  for (const step of ['Visit Saturday evening', 'Check drainage', 'Negotiate deposit']) {
    await add.fill(step)
    await add.press('Enter')
    await expect(steps.locator('.record-task', { hasText: step })).toBeVisible()
  }
  await expect(steps.locator('h2')).toContainText('0 of 3')

  // Ticking one saves it there and then — there is no edit mode to leave.
  await steps.locator('.record-task', { hasText: 'Check drainage' }).locator('.check-toggle').click()
  await expect(steps.locator('h2')).toContainText('1 of 3')
  await page.reload()
  await goTo(page, 'Locations')
  await property().click()
  await expect(page.locator('.record-checklist h2')).toContainText('1 of 3')
  await expect(page.locator('.record-task', { hasText: 'Check drainage' })).toHaveClass(/done/)

  // A step can be reordered and deleted.
  await page.locator('.record-task', { hasText: 'Negotiate deposit' }).getByRole('button', { name: /^Move .* up$/ }).click()
  await expect(page.locator('.record-task').nth(1)).toContainText('Negotiate deposit')
  await page.locator('.record-task', { hasText: 'Visit Saturday evening' }).getByRole('button', { name: /^Delete/ }).click()
  await expect(page.locator('.record-task')).toHaveCount(2)
})

// A launch task is a task. Giving it subtasks is the task manager this is not.
test('a launch task is edited on the list, not on a page about itself', async ({ page }) => {
  await seedLaunchTasks(page)
  await goTo(page, 'Launch Checklist')

  // Tapping the words edits the words. It used to open a whole record page —
  // a page about one line of text, which is more ceremony than the line.
  await page.locator('.checklist-row').first().locator('.check-title').click()
  await expect(page.locator('.detail-page')).toHaveCount(0)
  await expect(page.locator('.check-title-edit')).toBeFocused()
  await page.locator('.check-title-edit').fill('Review the brand name and trademark')
  await page.locator('.check-title-edit').press('Enter')
  await expect(page.locator('.checklist-row').first()).toContainText('Review the brand name and trademark')

  // Emptying it is how you delete one you did not mean to write.
  const before = await page.locator('.checklist-row').count()
  await page.locator('.checklist-row').first().locator('.check-title').click()
  await page.locator('.check-title-edit').fill('')
  await page.locator('.check-title-edit').press('Enter')
  await expect(page.locator('.checklist-row')).toHaveCount(before - 1)

  // The rest of the list is untouched, and no row grows a list of its own.
  await expect(page.locator('.checklist-row', { hasText: 'Decide opening staffing' })).toBeVisible()
  await expect(page.locator('.record-checklist')).toHaveCount(0)
})

// A flat list of twenty-two drinks throws away the one piece of structure the
// menu already has.
test('the menu is listed by category', async ({ page }) => {
  await seedReferencePack(page)

  await goTo(page, 'Menu')
  const headings = page.locator('.menu-group h2')
  // Milk tea leads, toppings follow the drinks, and each heading counts itself.
  await expect(headings.first()).toContainText('Milk tea')
  await expect(page.locator('.menu-group', { hasText: 'Toppings' }).locator('.item-row')).toHaveCount(3)
  // Every drink is listed once, under exactly one heading.
  const grouped = await page.locator('.menu-group .item-row strong').allTextContents()
  expect(new Set(grouped).size).toBe(grouped.length)
  await expect(viewRow(page, 'Flavored Milk Tea')).toBeVisible()
})

test('a launch task is written onto the checklist, not through the editor', async ({ page }) => {
  await goTo(page, 'Launch Checklist')

  // An empty checklist is a place to write one, not a sentence about not
  // having one. This is why the list only ever got filled from a starter pack:
  // adding a task meant opening a whole record page to type one line.
  const add = page.locator('.checklist-add')
  await expect(add).toBeVisible()
  await expect(page.locator('.quiet-offer')).toContainText('Write the first one')

  // No button in the row, before or during typing. One used to appear the
  // moment you started — a control you could not learn existed before you
  // needed it, doing what Return already does, and shouting while it did it.
  await expect(add.getByRole('button')).toHaveCount(0)
  await add.getByRole('textbox', { name: 'Add a launch task' }).fill('Half a thought')
  await expect(add.getByRole('button')).toHaveCount(0)
  await add.getByRole('textbox', { name: 'Add a launch task' }).clear()

  const write = async (title: string) => {
    await add.getByRole('textbox', { name: 'Add a launch task' }).fill(title)
    await add.getByRole('textbox', { name: 'Add a launch task' }).press('Enter')
    await expect(page.locator('.checklist-row', { hasText: title })).toBeVisible()
    // The field clears itself, because tasks arrive in threes.
    await expect(add.getByRole('textbox', { name: 'Add a launch task' })).toHaveValue('')
    await expect(page.locator('form.editor')).toHaveCount(0)
  }

  await write('Confirm the FSSAI filing path')
  await write('Check GST treatment with a CA')
  await write('Visit three properties near Ibaco')

  // One list, in the order you wrote it. Tasks used to be filed under one of
  // twelve phase headings, chosen before the task could exist — filing standing
  // in front of writing, into a taxonomy that came with the starter plan.
  await expect(page.locator('.checklist-phase')).toHaveCount(0)
  await expect(page.locator('.launch-checklist select')).toHaveCount(0)
  await expect(page.locator('.checklist-row')).toHaveCount(3)
  await expect(page.locator('.launch-checklist > header')).toContainText('0 of 3 complete')

  // A written task is a record like any other: it ticks, and it survives.
  await page.locator('.checklist-row', { hasText: 'Check GST treatment with a CA' }).locator('.check-toggle').click()
  await expect(page.locator('.launch-checklist > header')).toContainText('1 of 3 complete')
  await page.reload()
  await goTo(page, 'Launch Checklist')
  await expect(page.locator('.launch-checklist > header')).toContainText('1 of 3 complete')
  await expect(page.locator('.checklist-row', { hasText: 'Visit three properties near Ibaco' })).toBeVisible()
})
