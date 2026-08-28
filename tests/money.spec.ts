import { expect, test } from '@playwright/test'
import { chooseKind, editRecord, editor, goTo, openFreshWorkspace } from './helpers'

test.beforeEach(async ({ page }) => {
  await openFreshWorkspace(page)
})

async function addMoneyRecord(page: import('@playwright/test').Page, opts: {
  button: 'Add quote' | 'Add expense'
  title: string
  amount: string
  paymentStatus?: 'Planned' | 'Committed' | 'Part paid' | 'Paid' | 'Refunded'
}) {
  await page.locator('.add-button').click()
  await chooseKind(page, opts.button === 'Add quote' ? 'Quote' : 'Expense')
  await editor.title(page).fill(opts.title)
  await page.getByRole('spinbutton').first().fill(opts.amount)
  if (opts.paymentStatus) await editor.select(page, 'Payment').selectOption(opts.paymentStatus)
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()
}

function tile(page: import('@playwright/test').Page, label: string) {
  return page.locator('.money-totals > span')
    .filter({ has: page.locator('span', { hasText: new RegExp(`^${label}$`) }) })
    .locator('strong')
}

test('money separates paid, committed, planned and quotes', async ({ page }) => {
  await goTo(page, 'Money')
  await expect(tile(page, 'paid')).toHaveText('₹0')

  await addMoneyRecord(page, { button: 'Add expense', title: 'Paid item', amount: '3250.50', paymentStatus: 'Paid' })
  await addMoneyRecord(page, { button: 'Add expense', title: 'Unpaid item', amount: '1000', paymentStatus: 'Planned' })
  await addMoneyRecord(page, { button: 'Add expense', title: 'Part paid item', amount: '500.25', paymentStatus: 'Part paid' })
  await addMoneyRecord(page, { button: 'Add quote', title: 'Open quote', amount: '12500' })

  // A quote is not spending, and money still owed is not money already spent.
  // An agreed bill and an expected one are also different feelings about the
  // same rupee, so they are counted apart.
  await expect(tile(page, 'paid')).toHaveText('₹3,250.50')
  await expect(tile(page, 'planned')).toHaveText('₹1,000')
  await expect(tile(page, 'committed')).toHaveText('₹500.25')
  await expect(tile(page, 'quoted')).toHaveText('₹12,500')
})

test('deleting a money record recalculates the totals', async ({ page }) => {
  await goTo(page, 'Money')
  await addMoneyRecord(page, { button: 'Add expense', title: 'Removable', amount: '999.99', paymentStatus: 'Paid' })
  await expect(tile(page, 'paid')).toHaveText('₹999.99')

  await page.locator('.item-row', { hasText: 'Removable' }).first().locator('.item-open').click()
  await editRecord(page)
  await editor.root(page).getByRole('button', { name: 'Delete', exact: true }).click()
  await editor.root(page).getByRole('button', { name: 'Delete permanently' }).click()

  await expect(tile(page, 'paid')).toHaveText('₹0')
})

test('an amount left blank never renders as NaN', async ({ page }) => {
  await goTo(page, 'Money')
  await page.locator('.add-button').click()
  await chooseKind(page, 'Expense')
  await editor.title(page).fill('No amount given')
  await editor.save(page).click()

  await expect(tile(page, 'paid')).toHaveText('₹0')
  await page.locator('.item-row', { hasText: 'No amount given' }).first().locator('.item-open').click()
  await expect(page.getByText('Not added yet')).toBeVisible()
  await expect(page.locator('body')).not.toContainText('NaN')
})

