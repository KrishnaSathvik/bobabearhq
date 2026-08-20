import { expect, test } from '@playwright/test'
import { editor, nav, openFreshWorkspace } from './helpers'

test.beforeEach(async ({ page }) => {
  await openFreshWorkspace(page)
})

async function addChecklist(page: import('@playwright/test').Page) {
  await nav(page, 'Store Setup').click()
  await page.getByRole('button', { name: 'Add checklist' }).click()
  await expect(page.locator('.launch-checklist')).toBeVisible()
}

test('checklist boxes toggle and survive a reload', async ({ page }) => {
  await addChecklist(page)
  const progress = page.locator('.launch-checklist > header strong')
  await expect(progress).toContainText('0 of')

  await page.locator('.check-toggle').first().click()
  await expect(progress).toContainText('1 of')

  await page.reload()
  await nav(page, 'Store Setup').click()
  await expect(page.locator('.launch-checklist > header strong')).toContainText('1 of')
})

test('a checklist task moved out of store setup is still reachable', async ({ page }) => {
  await addChecklist(page)
  await page.getByRole('button', { name: 'Add task' }).click()
  await editor.title(page).fill('Task that moved')
  await editor.select(page, 'Belongs to').selectOption('Notes')
  await editor.save(page).click()

  // It is no longer shown by the checklist widget, so the section list has to
  // show it or it becomes unreachable.
  await nav(page, 'Notes').click()
  await expect(page.locator('.item-row', { hasText: 'Task that moved' })).toBeVisible()
})

test('store setup does not list checklist tasks twice', async ({ page }) => {
  await addChecklist(page)
  const inWidget = await page.locator('.launch-checklist .check-title').allTextContents()
  const inList = await page.locator('.item-list .item-row strong').allTextContents()
  expect(inWidget.length).toBeGreaterThan(0)
  expect(inList.filter(title => inWidget.includes(title))).toEqual([])
})

test('equipment options in one category line up for comparison', async ({ page }) => {
  await nav(page, 'Store Setup').click()

  for (const option of [
    { title: 'Sealer A', amount: '18500', supplier: 'Vendor Alpha' },
    { title: 'Sealer B', amount: '14250.75', supplier: 'Vendor Beta' },
  ]) {
    await page.getByRole('button', { name: 'Add equipment' }).first().click()
    await editor.title(page).fill(option.title)
    await page.getByRole('spinbutton').first().fill(option.amount)
    await editor.root(page).locator('label', { hasText: 'Category' }).locator('input').fill('Cup sealer')
    await editor.root(page).locator('label', { hasText: 'Supplier' }).locator('input').fill(option.supplier)
    await editor.save(page).click()
    await expect(editor.root(page)).toBeHidden()
  }

  const group = page.locator('.comparison-group', { hasText: 'Cup sealer' })
  await expect(group).toContainText('2 options')
  await expect(group).toContainText('₹18,500.00')
  await expect(group).toContainText('₹14,250.75')
  // Comparing must not silently pick a winner.
  await expect(group).not.toContainText('Selected')
})

test('home accepts several dropped files at once and keeps what was typed', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Quick capture' }).fill('receipts from today')

  await page.locator('.home').evaluate(node => {
    const data = new DataTransfer()
    data.items.add(new File(['a'], 'first receipt.txt', { type: 'text/plain' }))
    data.items.add(new File(['b'], 'second-receipt.csv', { type: 'text/csv' }))
    node.dispatchEvent(new DragEvent('drop', { dataTransfer: data, bubbles: true, cancelable: true }))
  })

  await expect(editor.root(page)).toBeVisible()
  await expect(editor.body(page)).toHaveValue('receipts from today')
  await expect(page.locator('.attachment-record.pending')).toHaveCount(2)
  await expect(editor.select(page, 'Belongs to')).toHaveValue('Library')
})

test('every rupee amount is shown with two decimals', async ({ page }) => {
  await nav(page, 'Money').click()
  await page.getByRole('button', { name: 'Add expense', exact: true }).click()
  await editor.title(page).fill('Round number')
  await page.getByRole('spinbutton').first().fill('1200')
  await editor.save(page).click()

  await expect(page.locator('.money-totals > div')
    .filter({ has: page.locator('span', { hasText: /^Paid$/ }) })
    .locator('strong')).toHaveText('₹1,200.00')
  await page.locator('.item-row', { hasText: 'Round number' }).click()
  await expect(page.locator('.product-summary strong')).toHaveText('₹1,200.00')
})
