import { expect, test, type Page } from '@playwright/test'
import { chooseKind, chooseStatus, editRecord, editor, goTo, openFreshWorkspace, openGroup, openStoreView, row, viewRow , seedReferencePack , seedLaunchTasks , saveThenEdit , chooseChip } from './helpers'

test.beforeEach(async ({ page }) => {
  await openFreshWorkspace(page)
})

const field = (page: Page, label: string) => editor.root(page).locator('label', { hasText: new RegExp(`^${label}`) }).locator('input').first()
const select = (page: Page, label: string) => editor.root(page).locator('label', { hasText: new RegExp(`^${label}`) }).locator('select').first()

test('a drink on the menu is a record, not a paragraph', async ({ page }) => {
  await goTo(page, 'Menu')
  await page.locator('.add-button').click()
  await expect(editor.root(page).locator('.eyebrow')).toHaveText('New drink · Menu')

  // Adding a drink asks what it is, what it costs to sell and where it stands.
  await editor.title(page).fill('Honeydew Milk Tea')
  await chooseChip(page, 'Category', 'Milk tea')
  await field(page, 'Planning price — small').fill('149')
  await field(page, 'Planning price — regular').fill('199')

  // The recipe, the sizes and what it costs to make are learned by making it,
  // so the record asks for them once it exists.
  await saveThenEdit(page, 'Honeydew Milk Tea')
  await field(page, 'Sizes').fill('Small 350ml, Regular 500ml')
  await field(page, 'Cost per serving').fill('38.5')
  await field(page, 'Flavours').fill('Honeydew; Winter melon')
  await openGroup(page, 'Recipe and tasting')
  await select(page, 'Taste result').selectOption('Tasted — needs work')
  await field(page, 'Ingredients').fill('Black tea, milk, mango syrup, tapioca')
  await field(page, 'Preparation').fill('2 scoops powder, 120ml milk, 60g pearls')
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()
  await goTo(page, 'Menu')

  // The menu is a catalog, not an activity list: the drink's name under its
  // own category, and where it stands. The planning numbers are on the record.
  await expect(page.locator('.menu-group').filter({ has: page.locator('h2', { hasText: /^Milk tea/ }) }))
    .toContainText('Honeydew Milk Tea')

  await row(page, 'Honeydew Milk Tea').locator('.item-open').click()
  await expect(page.locator('.detail-meta')).toContainText('Drink')
  await expect(page.locator('.product-summary')).toContainText('₹149 / ₹199')
  await expect(page.locator('.product-summary')).toContainText('Opening menu')
  // Fields are grouped into headed blocks — SELLING, RECIPE, COST — so the
  // assertion is on the document rather than on any one block.
  const details = page.locator('.detail-document')
  await expect(details).toContainText('Tasted — needs work')
  await expect(details).toContainText('Black tea, milk, mango syrup, tapioca')
  // A field labelled in rupees reads in rupees.
  await expect(details).toContainText('₹38.50')
  await expect(details).toContainText('₹149')
})

test('a drink can wait for phase two instead of being dropped', async ({ page }) => {
  await goTo(page, 'Menu')
  await page.locator('.add-button').click()
  await editor.title(page).fill('Fruit blends')
  // Held back is a real answer, not a rejection — and it is a launch phase
  // rather than a status. A drink pushed to Phase 2 is still being tested.
  await chooseStatus(page, 'Testing')
  await saveThenEdit(page, 'Fruit blends')
  await select(page, 'Launch phase').selectOption('Phase 2')
  await editor.save(page).click()
  await goTo(page, 'Menu')

  await expect(viewRow(page, 'Fruit blends')).toContainText('Testing')
  await row(page, 'Fruit blends').locator('.item-open').click()
  await expect(page.locator('.detail-meta')).toContainText('Testing')
  await expect(page.locator('.product-summary')).toContainText('Phase 2')
})

test('a supplier product hangs off the supplier that sells it', async ({ page }) => {
  await goTo(page, 'Suppliers')
  await page.locator('.add-button').click()
  await editor.title(page).fill('The Tea Planet')
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()

  await page.locator('.add-button').click()
  await chooseKind(page, 'Product link')
  await editor.title(page).fill('Mango popping boba 3.2kg')
  await field(page, 'Product link').fill('https://theteaplanet.com/products/mango-popping-boba')
  await field(page, 'Price').fill('820')
  await field(page, 'Supplier').fill('The Tea Planet')
  // Pack size and MOQ are terms you get by asking, so they are on the record.
  await saveThenEdit(page, 'Mango popping boba 3.2kg')
  await field(page, 'Product category').fill('Popping boba')
  await field(page, 'Pack size').fill('3.2 kg tub')
  await field(page, 'MOQ').fill('4 tubs')
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()
  await goTo(page, 'Suppliers')

  // It is its own record, and it points at the supplier.
  await row(page, 'Mango popping boba 3.2kg').locator('.item-open').click()
  await expect(page.locator('.detail-meta')).toContainText('Product link')
  await expect(page.locator('.product-summary')).toContainText('₹820')
  await editRecord(page)
  await openGroup(page, 'Related records')
  const related = editor.root(page).locator('.related-area')
  await related.locator('label', { hasText: 'Relationship' }).locator('select').selectOption('Supplied by')
  await related.locator('label', { hasText: 'Record' }).locator('select').selectOption({ label: 'The Tea Planet — Supplier · Suppliers' })
  await related.getByRole('button', { name: 'Link another record' }).click()
  await editor.save(page).click()

  await expect(page.locator('.detail-related')).toContainText('Supplied by · Supplier · Suppliers')
})

test('a marketing record separates talking to them from paying them', async ({ page }) => {
  await goTo(page, 'Marketing')
  await page.locator('.add-button').click()
  await expect(editor.root(page).locator('.eyebrow')).toHaveText('New marketing')

  await editor.title(page).fill('Khammam Food Explorer')
  await editor.body(page).fill('Messaged on Instagram, waiting to hear back.')
  await field(page, 'Instagram or profile link').fill('https://instagram.com/example')
  await field(page, 'Quoted cost').fill('4000')
  // Marketing has no status vocabulary: where the conversation stands is a
  // sentence, because "left a voice note, no reply" says more than any word
  // from a list of six could. The channel and what they promised are asked on
  // the record, once there is a record to hang them on.
  await saveThenEdit(page, 'Khammam Food Explorer')
  // No *status*. The chips that are here are the channel — the pill is the
  // shared control, so the assertion names the question rather than the class.
  await expect(editor.root(page).locator('fieldset.status-field', { has: page.locator('legend', { hasText: 'Status' }) })).toHaveCount(0)
  await chooseChip(page, 'Channel', 'Instagram')
  await field(page, 'Audience / reach').fill('18k local')
  await field(page, 'Deliverables').fill('One reel, two stories')
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()
  await goTo(page, 'Marketing')

  await row(page, 'Khammam Food Explorer').locator('.item-open').click()
  const summary = page.locator('.product-summary')
  // What they quoted. What was actually handed over is an expense in Money,
  // where it counts towards the totals, so this record no longer carries a
  // second number reading ₹0.00 for ever.
  await expect(summary).toContainText('₹4,000')
  await expect(summary).not.toContainText('Actually spent')
  // And no status: the standing of the conversation is in the writing.
  await expect(page.locator('.detail-meta')).not.toContainText('Contacted')
  await expect(page.locator('.detail-document')).toContainText('Messaged on Instagram')
  await expect(page.locator('.detail-document')).toContainText('18k local')
})

test('ticking a launch task makes it read as completed everywhere', async ({ page }) => {
  await seedLaunchTasks(page)
  await openStoreView(page, 'Launch checklist')

  const task = page.locator('.checklist-row', { hasText: 'Review the working brand name' })
  await task.getByRole('button', { name: /^Mark/ }).click()
  await expect(task).toHaveClass(/checked/)

  // The same answer after a reload, and the pin counts it without being
  // opened — the tick is one stored field, read in more than one place.
  await page.reload()
  await openStoreView(page, 'Launch checklist')
  await expect(page.locator('.checklist-row', { hasText: 'working brand name' })).toHaveClass(/checked/)
  await goTo(page, 'Inbox')
  await expect(page.locator('.pin-row', { hasText: 'Launch Checklist' })).toContainText('1 of 6 complete')
})

test('imported menu references arrive as drinks, with phase two held back', async ({ page }) => {
  await seedReferencePack(page)

  await goTo(page, 'Menu')
  await expect(viewRow(page, 'Flavored Milk Tea')).toBeVisible()
  // Phase 2 is a launch phase, not a status: these are drinks nobody has ruled
  // out, they are simply not on the opening board.
  await expect(viewRow(page, 'Phase 2 drinks')).toBeVisible()

  await row(page, 'Flavored Milk Tea').locator('.item-open').click()
  await expect(page.locator('.detail-meta')).toContainText('Drink')
  await expect(page.locator('.detail-document')).toContainText('Taro')
})
