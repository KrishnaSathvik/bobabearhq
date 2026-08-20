import { expect, test } from '@playwright/test'
import { editor, nav, openFreshWorkspace } from './helpers'

test.beforeEach(async ({ page }) => {
  await openFreshWorkspace(page)
})

async function addMoneyRecord(page: import('@playwright/test').Page, opts: {
  button: 'Add quote' | 'Add expense'
  title: string
  amount: string
  paymentStatus?: 'Paid' | 'Part paid' | 'Not paid'
}) {
  await page.getByRole('button', { name: opts.button, exact: true }).click()
  await editor.title(page).fill(opts.title)
  await page.getByRole('spinbutton').first().fill(opts.amount)
  if (opts.paymentStatus) await editor.select(page, 'Payment status').selectOption(opts.paymentStatus)
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()
}

function tile(page: import('@playwright/test').Page, label: string) {
  return page.locator('.money-totals > div')
    .filter({ has: page.locator('span', { hasText: new RegExp(`^${label}$`) }) })
    .locator('strong')
}

test('money separates paid, outstanding and quotes', async ({ page }) => {
  await nav(page, 'Money').click()
  await expect(tile(page, 'Paid')).toHaveText('₹0.00')

  await addMoneyRecord(page, { button: 'Add expense', title: 'Paid item', amount: '3250.50', paymentStatus: 'Paid' })
  await addMoneyRecord(page, { button: 'Add expense', title: 'Unpaid item', amount: '1000', paymentStatus: 'Not paid' })
  await addMoneyRecord(page, { button: 'Add expense', title: 'Part paid item', amount: '500.25', paymentStatus: 'Part paid' })
  await addMoneyRecord(page, { button: 'Add quote', title: 'Open quote', amount: '12500' })

  // A quote is not spending, and money still owed is not money already spent.
  await expect(tile(page, 'Paid')).toHaveText('₹3,250.50')
  await expect(tile(page, 'Outstanding')).toHaveText('₹1,500.25')
  await expect(tile(page, 'Quotes')).toHaveText('₹12,500.00')
})

test('deleting a money record recalculates the totals', async ({ page }) => {
  await nav(page, 'Money').click()
  await addMoneyRecord(page, { button: 'Add expense', title: 'Removable', amount: '999.99', paymentStatus: 'Paid' })
  await expect(tile(page, 'Paid')).toHaveText('₹999.99')

  await page.locator('.item-row', { hasText: 'Removable' }).click()
  await page.getByRole('button', { name: 'Edit' }).click()
  await editor.root(page).getByRole('button', { name: 'Delete', exact: true }).click()
  await editor.root(page).getByRole('button', { name: 'Delete permanently' }).click()

  await expect(tile(page, 'Paid')).toHaveText('₹0.00')
})

test('an amount left blank never renders as NaN', async ({ page }) => {
  await nav(page, 'Money').click()
  await page.getByRole('button', { name: 'Add expense', exact: true }).click()
  await editor.title(page).fill('No amount given')
  await editor.save(page).click()

  await expect(tile(page, 'Paid')).toHaveText('₹0.00')
  await page.locator('.item-row', { hasText: 'No amount given' }).click()
  await expect(page.getByText('Not added yet')).toBeVisible()
  await expect(page.locator('body')).not.toContainText('NaN')
})

test('the header search looks outside the open section', async ({ page }) => {
  await nav(page, 'Notes').click()
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await editor.title(page).fill('Kraft carrier decision')
  await editor.save(page).click()

  // Stand in a different section, then search for something that lives in Notes.
  await nav(page, 'Money').click()
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await page.getByRole('textbox', { name: 'Search everything…' }).fill('kraft carrier')

  const result = page.locator('.item-row', { hasText: 'Kraft carrier decision' })
  await expect(result).toBeVisible()
  await expect(result).toContainText('Notes')

  // Opening a result reads the record; it must not jump into edit mode.
  await result.click()
  await expect(page.getByRole('heading', { name: 'Kraft carrier decision', level: 1 })).toBeVisible()
  await expect(editor.root(page)).toBeHidden()
})

test('a search with no matches says so instead of claiming the section is empty', async ({ page }) => {
  await nav(page, 'Notes').click()
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await editor.title(page).fill('Something real')
  await editor.save(page).click()

  await page.getByRole('textbox', { name: 'Search notes…' }).fill('zzz-no-such-thing')
  await expect(page.locator('.empty-state')).toContainText('Nothing in Notes matches')
  await expect(page.locator('.empty-state')).not.toContainText('Nothing here yet')
})

test('the open search bar does not block the navigation', async ({ page }) => {
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await page.getByRole('textbox', { name: 'Search everything…' }).fill('anything')
  // This click used to be swallowed by the search overlay.
  await nav(page, 'Menu').click()
  await expect(page.getByRole('heading', { name: 'Menu', level: 1 })).toBeVisible()
})
