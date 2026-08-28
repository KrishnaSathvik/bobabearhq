import { expect, test } from '@playwright/test'
import { editor, goTo, openFreshWorkspace, openRow, quickCapture, row , turnInto } from './helpers'

test.beforeEach(async ({ page }) => {
  await openFreshWorkspace(page)
})

// This is the whole bet of the redesign: you say the thing first and decide
// what it is afterwards. If this flow works, nothing has to be filed before it
// can be saved.
//
// It used to be offered as a row of chips under every note. A thought you had
// just typed is not the moment to be asked what it might really be, so the
// question is gone from the page and the answer lives where every other change
// to a record's shape lives — in the editor, under Filing.
test('a captured sentence becomes a supplier without being retyped', async ({ page }) => {
  await page.locator('.add-button').click()
  await editor.body(page).fill('Sri Balaji traders on Wyra Road might do sugar and milk')
  await editor.save(page).click()

  const captured = row(page, 'Sri Balaji traders')
  await expect(captured).toBeVisible()
  await captured.locator('.item-open').click()

  // Nothing on the page asks a thought to justify itself.
  await expect(page.locator('.promote')).toHaveCount(0)
  await turnInto(page, 'Supplier')

  // The writing survives the change, and the supplier fields are now there.
  await expect(editor.root(page)).toBeVisible()
  await expect(editor.body(page)).toHaveValue('Sri Balaji traders on Wyra Road might do sugar and milk')
  await page.locator('form.editor .editor-group-head', { hasText: 'Supplier contact' }).scrollIntoViewIfNeeded()
  await editor.root(page).locator('label', { hasText: /^Phone/ }).locator('input').fill('9000012345')
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()

  // It moved itself into the Suppliers view; nobody chose a section.
  await goTo(page, 'Suppliers')
  await expect(row(page, 'Sri Balaji traders')).toBeVisible()

  // It is a supplier now, and the one list says so without being asked.
  await goTo(page, 'Inbox')
  await expect(row(page, 'Sri Balaji traders')).toContainText('Supplier')
})

test('a record that already has a shape is not asked what it is', async ({ page }) => {
  await goTo(page, 'Suppliers')
  await page.locator('.add-button').click()
  await editor.title(page).fill('Already a supplier')
  await editor.save(page).click()

  await row(page, 'Already a supplier').locator('.item-open').click()
  await expect(page.locator('.promote')).toHaveCount(0)
  // And a supplier still carries its connections, because a supplier is a
  // record other records point at. Only writing hides the empty offer.
  await expect(page.locator('.detail-related')).toBeVisible()
})

test('money spent lands in Money, and a task lands in the launch checklist', async ({ page }) => {
  await quickCapture(page, 'Paid the signboard advance')
  await openRow(page, 'Paid the signboard advance')
  await turnInto(page, 'Expense')
  await editor.save(page).click()
  await goTo(page, 'Money')
  await expect(row(page, 'Paid the signboard advance')).toBeVisible()

  await goTo(page, 'Inbox')
  await quickCapture(page, 'Get the shop board painted')
  await openRow(page, 'Get the shop board painted')
  await turnInto(page, 'Task')
  await editor.save(page).click()
  await expect(page.locator('.checklist-row', { hasText: 'Get the shop board painted' })).toHaveCount(0)
  await goTo(page, 'Launch Checklist')
  await expect(page.locator('.checklist-row', { hasText: 'Get the shop board painted' })).toBeVisible()
  // And the pin counts it without being opened.
  await goTo(page, 'Inbox')
  await expect(page.locator('.pin-row', { hasText: 'Launch Checklist' })).toContainText('0 of 1 complete')
})
