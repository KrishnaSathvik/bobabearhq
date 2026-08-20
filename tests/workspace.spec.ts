import { expect, test } from '@playwright/test'
import { createRecord, editor, nav, openFreshWorkspace, row } from './helpers'

test.beforeEach(async ({ page }) => {
  await openFreshWorkspace(page)
})

test('home stays a quick-capture surface, not a dashboard', async ({ page }) => {
  await expect(page.getByRole('textbox', { name: 'Quick capture' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
  // Home must not turn into an analytics view.
  await expect(page.locator('.item-list')).toHaveCount(0)
  await expect(page.locator('.money-totals')).toHaveCount(0)
})

test('capture from home, choose a section, and find it there', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Quick capture' }).fill('confirm sealing film pricing')
  await page.getByRole('button', { name: 'Save', exact: true }).click()

  await expect(editor.root(page)).toBeVisible()
  await expect(editor.body(page)).toHaveValue('confirm sealing film pricing')
  await editor.title(page).fill('Sealing film pricing')
  await editor.select(page, 'Belongs to').selectOption('Suppliers')
  await editor.save(page).click()

  await nav(page, 'Suppliers').click()
  await expect(row(page, 'Sealing film pricing')).toBeVisible()
})

test('a saved record survives a reload', async ({ page }) => {
  await createRecord(page, 'Notes', 'Persisted note', 'should still be here')
  await page.reload()
  await nav(page, 'Notes').click()
  await expect(row(page, 'Persisted note')).toBeVisible()
})

test('opening a record shows a readable page and does not start editing', async ({ page }) => {
  await createRecord(page, 'Notes', 'Readable record', 'the body text')
  await row(page, 'Readable record').click()

  await expect(page.getByRole('heading', { name: 'Readable record', level: 1 })).toBeVisible()
  await expect(page.getByText('the body text')).toBeVisible()
  // The editor must only appear once Edit is chosen.
  await expect(editor.root(page)).toBeHidden()
  await page.getByRole('button', { name: 'Edit' }).click()
  await expect(editor.root(page)).toBeVisible()
})

test('edit and delete a record, with delete needing confirmation', async ({ page }) => {
  await createRecord(page, 'Notes', 'Before edit')
  await row(page, 'Before edit').click()
  await page.getByRole('button', { name: 'Edit' }).click()
  await editor.title(page).fill('After edit')
  await editor.save(page).click()
  await expect(page.getByRole('heading', { name: 'After edit', level: 1 })).toBeVisible()

  await page.getByRole('button', { name: 'Edit' }).click()
  await editor.root(page).getByRole('button', { name: 'Delete', exact: true }).click()
  // One click must not delete anything.
  await expect(editor.root(page).getByRole('button', { name: 'Delete permanently' })).toBeVisible()
  await editor.root(page).getByRole('button', { name: 'Delete permanently' }).click()

  await nav(page, 'Notes').click()
  await expect(row(page, 'After edit')).toHaveCount(0)
})

test('closing an edited record asks before discarding', async ({ page }) => {
  await nav(page, 'Notes').click()
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await editor.title(page).fill('half-typed work')

  page.once('dialog', dialog => dialog.dismiss())
  await editor.root(page).getByRole('button', { name: 'Close editor' }).click()
  await expect(editor.root(page)).toBeVisible()
  await expect(editor.title(page)).toHaveValue('half-typed work')

  page.once('dialog', dialog => dialog.accept())
  await editor.root(page).getByRole('button', { name: 'Close editor' }).click()
  await expect(editor.root(page)).toBeHidden()
})
