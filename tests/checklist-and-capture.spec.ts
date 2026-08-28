import { expect, test } from '@playwright/test'
import { chooseKind, chooseStatus, contentPane, editor, goTo, openFreshWorkspace, openStoreView, seedLaunchTasks , saveThenEdit } from './helpers'

test.beforeEach(async ({ page }) => {
  await openFreshWorkspace(page)
})

async function addChecklist(page: import('@playwright/test').Page) {
  await seedLaunchTasks(page)
  await openStoreView(page, 'Launch checklist')
  await expect(page.locator('.launch-checklist')).toBeVisible()
}

test('checklist boxes toggle and survive a reload', async ({ page }) => {
  await addChecklist(page)
  const progress = page.locator('.launch-checklist > header')
  await expect(progress).toContainText('0 of')

  // The box inside the checklist, not the one beside the same task in the
  // Inbox list on the other side of the window.
  await page.locator('.launch-checklist .check-toggle').first().click()
  await expect(progress).toContainText('1 of')

  await page.reload()
  await openStoreView(page, 'Launch checklist')
  await expect(page.locator('.launch-checklist > header')).toContainText('1 of')
})

// A launch task used to be reachable by searching for it, which is how one
// filed somewhere else was found again. There is no search any more, and the
// Launch Checklist edits the line of text rather than opening a page about it,
// so a task's record has no route in — the test that walked that route is gone
// with the route. See the note in DESIGN_SYSTEM.md.
test('store setup does not list checklist tasks twice', async ({ page }) => {
  await addChecklist(page)
  const inWidget = await page.locator('.launch-checklist .check-title').allTextContents()
  const inList = await contentPane(page).locator('.item-list .item-row strong').allTextContents()
  expect(inWidget.length).toBeGreaterThan(0)
  expect(inList.filter(title => inWidget.includes(title))).toEqual([])
})

test('equipment options are selected explicitly and compared side by side', async ({ page }) => {
  // Equipment, added from the Equipment view. This used to start on the Launch
  // Checklist and reach for its +, which that view no longer has.
  await goTo(page, 'Equipment')

  for (const option of [
    { title: 'Sealer A', amount: '18500', shipping: '2000', supplier: 'Vendor Alpha' },
    { title: 'Sealer B', amount: '14250.75', shipping: '', supplier: 'Vendor Beta' },
  ]) {
    await goTo(page, 'Equipment')
    await page.locator('.add-button').click()
    await chooseKind(page, 'Equipment')
    await editor.title(page).fill(option.title)
    await editor.root(page).locator('label', { hasText: /^Estimated price/ }).locator('input').fill(option.amount)
    await editor.root(page).locator('label', { hasText: 'Supplier' }).locator('input').fill(option.supplier)
    await chooseStatus(page, 'Comparing')
    // What it costs to get here, and what sort of machine it is, are answered
    // while comparing rather than while writing the option down.
    await saveThenEdit(page, option.title)
    if (option.shipping) await editor.root(page).locator('label', { hasText: /^Shipping/ }).locator('input').fill(option.shipping)
    await editor.root(page).locator('label', { hasText: 'Category' }).locator('input').fill('Cup sealer')
    await editor.save(page).click()
    await expect(editor.root(page)).toBeHidden()
  }

  // The status tabs are how the list narrows down as options are decided.
  await openStoreView(page, 'Equipment')
  await expect(page.getByRole('tab', { name: /^Comparing/ })).toContainText('2')
  await expect(page.getByRole('tab', { name: /^Received/ })).toContainText('0')

  // Nothing is compared until two records are picked on purpose.
  const compare = page.locator('.equipment-comparison').getByRole('button', { name: 'Compare' })
  await expect(compare).toBeDisabled()
  await page.getByRole('checkbox', { name: 'Select Sealer A for comparison' }).check()
  await expect(compare).toBeDisabled()
  await page.getByRole('checkbox', { name: 'Select Sealer B for comparison' }).check()
  await expect(compare).toBeEnabled()
  await compare.click()

  const table = page.locator('.compare-table')
  await expect(table).toBeVisible()
  const field = (name: string) => table.locator('tr').filter({ has: page.locator('th', { hasText: new RegExp(`^${name}$`) }) })
  await expect(field('Supplier')).toContainText('Vendor Alpha')
  await expect(field('Supplier')).toContainText('Vendor Beta')
  // Price plus shipping, because the cheaper sticker price is not always the
  // cheaper option.
  await expect(field('Total')).toContainText('₹20,500')
  await expect(field('Total')).toContainText('₹14,250.75')
  await expect(field('Shipping')).toContainText('₹2,000')
  // Comparing must not silently pick a winner.
  await expect(table).not.toContainText('Recommended')
  await expect(table).not.toContainText('Recommended')
})

test('a typed thought is saved with a title of its own', async ({ page }) => {
  await page.locator('.add-button').click()
  await editor.body(page).fill('Need to compare two cup sealing machines.')
  await editor.save(page).click()

  const saved = page.locator('.inbox .item-row', { hasText: 'Compare two cup sealing machines' })
  await expect(saved).toBeVisible()
  await saved.click()
  await expect(page.locator('.detail-heading h1')).toHaveText('Compare two cup sealing machines')
  // The sentence itself is kept whole.
  await expect(page.locator('.detail-body')).toHaveText('Need to compare two cup sealing machines.')
})

test('a pasted link is saved as a link, titled from the product page', async ({ page }) => {
  await page.locator('.add-button').click()
  await editor.body(page).fill('https://store.example.com/products/automatic-cup-sealer')
  await editor.save(page).click()

  await page.locator('.inbox .item-row', { hasText: 'Automatic cup sealer' }).locator('.item-open').click()
  await expect(page.locator('.detail-heading h1')).toHaveText('Automatic cup sealer')
  await expect(page.getByRole('link', { name: /Open/ })).toHaveAttribute('href', 'https://store.example.com/products/automatic-cup-sealer')
})

test('several files dropped at once land in one note, keeping what was typed', async ({ page }) => {
  await page.locator('.add-button').click()
  await editor.body(page).fill('receipts from today')

  // A file dropped anywhere on the page lands on the note being written.
  await page.locator('.app-shell').evaluate(node => {
    const data = new DataTransfer()
    data.items.add(new File(['a'], 'first receipt.txt', { type: 'text/plain' }))
    data.items.add(new File(['b'], 'second-receipt.csv', { type: 'text/csv' }))
    node.dispatchEvent(new DragEvent('drop', { dataTransfer: data, bubbles: true, cancelable: true }))
  })

  // Dropped files wait with what was typed until Save.
  await expect(page.locator('.attachment-record.pending')).toHaveCount(2)
  await expect(editor.body(page)).toHaveValue('receipts from today')
  await editor.save(page).click()

  await page.locator('.inbox .item-row', { hasText: 'receipts from today' }).locator('.item-open').click()
  await expect(page.locator('.detail-attachments')).toContainText('first receipt.txt')
  await expect(page.locator('.detail-attachments')).toContainText('second-receipt.csv')
})

test('every rupee amount is shown with two decimals', async ({ page }) => {
  await goTo(page, 'Money')
  await page.locator('.add-button').click()
  await chooseKind(page, 'Expense')
  await editor.title(page).fill('Round number')
  await page.getByRole('spinbutton').first().fill('1200')
  await editor.save(page).click()

  await expect(page.locator('.money-totals > span')
    .filter({ has: page.locator('span', { hasText: /^paid$/ }) })
    .locator('strong')).toHaveText('₹1,200')
  await page.locator('.item-row', { hasText: 'Round number' }).first().locator('.item-open').click()
  await expect(page.locator('.product-summary strong')).toHaveText('₹1,200')
})
