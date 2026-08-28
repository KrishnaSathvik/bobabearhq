import { expect, test, type Page } from '@playwright/test'
import { chooseKind, chooseStatus, contentPane, editRecord, editor, goTo, openFreshWorkspace, openGroup, openStoreView, row, seedLaunchTasks , saveThenEdit } from './helpers'

// The whole point of the workspace, in one pass: find a machine, compare it with
// another, get a quote, buy it, record what was paid, tick the task off, and
// find the lot again months later from one search box.
test('the cup sealer journey, from a pasted link to a searchable purchase', async ({ page }) => {
  await openFreshWorkspace(page)

  const field = (label: string) => editor.root(page).locator('label', { hasText: new RegExp(`^${label}`) }).locator('input').first()
  // Equipment lives in the equipment widget on Store Setup, not in the plain
  // list underneath it — the page shows each record once.
  const equipmentRow = (title: string) => page.locator('.comparison-row', { hasText: title })
  const openEquipment = (title: string) => equipmentRow(title).getByRole('button', { name: new RegExp(title) })
  // Linking happens on a saved record, so this opens it, links and saves.
  const linkFromRecord = async (title: string, relationship: string, optionLabel: string) => {
    await row(page, title).locator('.item-open').click()
    await editRecord(page)
    await openGroup(page, 'Related records')
    const related = editor.root(page).locator('.related-area')
    await related.locator('label', { hasText: 'Relationship' }).locator('select').selectOption(relationship)
    await related.locator('label', { hasText: 'Record' }).locator('select').selectOption({ label: optionLabel })
    await related.getByRole('button', { name: 'Link another record' }).click()
    await editor.save(page).click()
    await expect(editor.root(page)).toBeHidden()
    // Reading a record fills the pane the view was filling, so step back out of
    // it the way a person does once the link is made.
    const back = page.getByRole('button', { name: /^Back to / })
    if (await back.isVisible().catch(() => false)) await back.click()
  }

  // 1. You find a cup sealer online and paste the link into Home.
  await page.locator('.add-button').click()
    await editor.body(page).fill('https://theteaplanet.com/products/automatic-cup-sealer')
  await editor.save(page).click()

  // Capture is one press: no second screen, no questions.
  await expect(editor.root(page)).toHaveCount(0)
  await expect(page.locator('.inbox .item-row', { hasText: 'Automatic cup sealer' })).toBeVisible()

  // 2. You file it as equipment under Store Setup and fill in what you know.
  await page.locator('.inbox .item-row', { hasText: 'Automatic cup sealer' }).locator('.item-open').click()
  await editRecord(page)
  await openGroup(page, 'Filing')
  await editor.select(page, 'Type').selectOption('Product')
  await editor.select(page, 'Belongs to').selectOption('Store Setup')
  await editor.select(page, 'Area').selectOption('Equipment')
  await chooseStatus(page, 'Comparing')
  await field('Product price').fill('28000')
  await field('Shipping').fill('2000')
  await field('Category').fill('Cup sealer')
  await field('Supplier').fill('Tea Planet')
  await field('Warranty / service').fill('1 year')
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()

  await openStoreView(page, 'Equipment')
  await expect(equipmentRow('Automatic cup sealer')).toBeVisible()
  await expect(contentPane(page).locator('.item-list .item-row', { hasText: 'Automatic cup sealer' })).toHaveCount(0)

  // 3. She adds a competing option from another vendor.
  await goTo(page, 'Equipment')
  await page.locator('.add-button').click()
  await chooseKind(page, 'Equipment')
  await editor.title(page).fill('IndiaMART cup sealer')
  await chooseStatus(page, 'Comparing')
  await field('Estimated price').fill('24500')
  await field('Supplier').fill('IndiaMART vendor')
  // Shipping, the category and the warranty are what you find out while
  // comparing, so the machine gets them once it is on the list.
  await saveThenEdit(page, 'IndiaMART cup sealer')
  await field('Shipping').fill('4000')
  await field('Category').fill('Cup sealer')
  await field('Warranty / service').fill('6 months')
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()

  // 4. You put them side by side. The cheaper sticker price is not the cheaper
  //    machine once shipping is counted, and nothing is decided for you.
  await openStoreView(page, 'Equipment')
  const equipment = page.locator('.equipment-comparison')
  await expect(equipment.getByRole('tab', { name: /^Comparing/ })).toContainText('2')
  await page.getByRole('checkbox', { name: 'Select Automatic cup sealer for comparison' }).check()
  await page.getByRole('checkbox', { name: 'Select IndiaMART cup sealer for comparison' }).check()
  await equipment.getByRole('button', { name: 'Compare' }).click()
  const compareRow = (name: string) => page.locator('.compare-table tr')
    .filter({ has: page.locator('th', { hasText: new RegExp(`^${name}$`) }) })
  await expect(compareRow('Total')).toContainText('₹30,000')
  await expect(compareRow('Total')).toContainText('₹28,500')
  await expect(compareRow('Warranty')).toContainText('1 year')
  await expect(page.locator('.compare-table')).not.toContainText('Recommended')

  // 5. She asks Tea Planet for a price, so the next move is theirs.
  await openEquipment('Automatic cup sealer').click()
  await editRecord(page)
  await chooseStatus(page, 'Ordered')
  await editor.save(page).click()
  await expect(page.locator('.detail-meta')).toContainText('Ordered')

  // 6. The supplier sends a quotation. It is money considered, not money spent.
  await goTo(page, 'Money')
  await page.locator('.add-button').click()
  await chooseKind(page, 'Quote')
  await editor.title(page).fill('Tea Planet cup sealer quote')
  await field('Quoted amount').fill('30000')
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()
  await linkFromRecord('Tea Planet cup sealer quote', 'Quote for', 'Automatic cup sealer — Equipment · Store Setup')

  const tile = (label: string) => page.locator('.money-totals > span')
    .filter({ has: page.locator('span', { hasText: new RegExp(`^${label}$`) }) }).locator('strong')
  await expect(tile('quoted')).toHaveText('₹30,000')
  await expect(tile('paid')).toHaveText('₹0')

  // 7. You buy it: the machine is done with and the payment is recorded.
  await page.locator('.add-button').click()
  await chooseKind(page, 'Expense')
  await editor.title(page).fill('Cup sealer purchase')
  await field('Expense amount').fill('30000')
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()
  await linkFromRecord('Cup sealer purchase', 'Expense for', 'Automatic cup sealer — Equipment · Store Setup')

  await expect(tile('paid')).toHaveText('₹30,000')
  await expect(tile('committed')).toHaveText('₹0')
  // A quote never becomes spending just because the purchase happened.
  await expect(tile('quoted')).toHaveText('₹30,000')

  await openStoreView(page, 'Equipment')
  await openEquipment('Automatic cup sealer').click()
  await editRecord(page)
  await chooseStatus(page, 'Received')
  await editor.save(page).click()
  await expect(page.locator('.detail-meta')).toContainText('Received')

  // The machine knows about both money records, read from its own page.
  const related = page.locator('.detail-related')
  await expect(related).toContainText('Tea Planet cup sealer quote')
  await expect(related).toContainText('Quote · Quote · Money')
  await expect(related).toContainText('Cup sealer purchase')
  await expect(related).toContainText('Expense · Expense · Money')

  // 8. The matching launch task gets ticked off, and it stays ticked.
  await seedLaunchTasks(page)
  await openStoreView(page, 'Launch checklist')
  const task = page.locator('.checklist-row', { hasText: 'Test cup, sealing film and cup-sealer compatibility' })
  await task.getByRole('button', { name: /^Mark/ }).click()
  await expect(task).toHaveClass(/checked/)
  await page.reload()
  await openStoreView(page, 'Launch checklist')
  await expect(page.locator('.checklist-row', { hasText: 'Test cup, sealing film and cup-sealer compatibility' })).toHaveClass(/checked/)

  // 9. Months later, the pins bring the whole story back. The quote and the
  // payment are in Money; the machine is in Equipment. Every record is where
  // the view that owns it says it is.
  await goTo(page, 'Money')
  const banked = contentPane(page).locator('.item-row')
  await expect(banked.filter({ hasText: 'Tea Planet cup sealer quote' })).toContainText('Quote')
  await expect(banked.filter({ hasText: 'Cup sealer purchase' })).toContainText('Expense')

  // Opening one reads the record; it never drops you into a form.
  await banked.filter({ hasText: 'Tea Planet cup sealer quote' }).locator('.item-open').click()
  await expect(page.locator('.detail-heading h1')).toHaveText('Tea Planet cup sealer quote')
  await expect(editor.root(page)).toHaveCount(0)
})

// The same journey on the phone, because that is where half of it happens.
test('the same capture and file works on a phone', async ({ page }: { page: Page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openFreshWorkspace(page)

  await page.locator('.add-button').click()
  await editor.body(page).fill('Need to compare two cup sealing machines before ordering.')
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()
  await expect(page.locator('.inbox .item-row', { hasText: 'Compare two cup sealing machines' })).toBeVisible()

  // It lands in the Inbox, and filing it is a second, deliberate step.
  await page.locator('.inbox .item-row', { hasText: 'Compare two cup sealing machines' }).locator('.item-open').click()
  await editRecord(page)
  await openGroup(page, 'Filing')
  await editor.select(page, 'Belongs to').selectOption('Store Setup')
  await editor.save(page).click()

  // Filing gives it a home without hiding it: it is still on the one list.
  await goTo(page, 'Inbox')
  await expect(row(page, 'Compare two cup sealing machines')).toBeVisible()
})
