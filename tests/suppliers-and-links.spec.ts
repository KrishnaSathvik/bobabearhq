import { expect, test, type Page } from '@playwright/test'
import { chooseKind, chooseStatus, editRecord, editor, goTo, openFreshWorkspace, openGroup, openStoreView, quickCapture, row, viewRow , seedReferencePack , saveThenEdit } from './helpers'

test.beforeEach(async ({ page }) => {
  await openFreshWorkspace(page)
})

const field = (page: Page, label: string) => editor.root(page).locator('label', { hasText: new RegExp(`^${label}`) }).locator('input').first()

async function addSupplier(page: Page, name: string) {
  await goTo(page, 'Suppliers')
  await page.locator('.add-button').click()
  await chooseKind(page, 'Supplier')
  await editor.title(page).fill(name)
  return editor
}

test('a supplier is its own record with supplier fields', async ({ page }) => {
  await addSupplier(page, 'The Tea Planet')
  // The button said supplier, so the form does not ask again.
  await expect(editor.root(page).locator('.eyebrow')).toHaveText('New supplier · Suppliers')

  await field(page, 'Website').fill('https://theteaplanet.com/')
  // What you know when you first write a supplier down: where they are and
  // what they might sell us.
  await field(page, 'Location').fill('Hyderabad')
  await field(page, 'What might we buy?').fill('Popping boba, powders, jelly')

  // Everything else is what the record still has to learn — the terms, the
  // people, whether they answer — and it is asked on the supplier itself.
  await saveThenEdit(page, 'The Tea Planet')
  await field(page, 'Contact person').fill('Sales desk')
  await field(page, 'Phone').fill('9000000000')
  await field(page, 'WhatsApp').fill('9000000000')
  await field(page, 'Email').fill('sales@example.com')
  await openGroup(page, 'Trade terms')
  await field(page, 'MOQ').fill('4 tubs')
  await field(page, 'Shipping terms').fill('Buyer pays courier')
  await field(page, 'Delivery time').fill('5 days to Khammam')
  await field(page, 'Payment terms').fill('Advance')
  await openGroup(page, 'Reliability and labels')
  await field(page, 'Reliability notes').fill('Answers on WhatsApp within a day')
  await field(page, 'FSSAI / label notes').fill('Imported labels need checking')
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()

  await row(page, 'The Tea Planet').locator('.item-open').click()
  const detail = page.locator('.detail-page')
  await expect(page.locator('.detail-meta')).toContainText('Supplier')
  await expect(detail).toContainText('Hyderabad')
  await expect(detail).toContainText('Buyer pays courier')
  await expect(detail).toContainText('Imported labels need checking')
})

// Each kind wears the words of its own journey. "Doing" on a supplier said
// nothing; "Contacted" says the ball is in their court.
test('a record offers its own kind of status, as chips rather than a wheel', async ({ page }) => {
  await addSupplier(page, 'Status check supplier')
  const chips = editor.root(page).locator('.status-chip')
  await expect(chips).toHaveText(['Researching', 'Contacted', 'Sampling', 'Approved', 'Rejected'])
  // A status is one tap, and tapping the same one again clears it.
  await chooseStatus(page, 'Contacted')
  await expect(chips.filter({ hasText: 'Contacted' })).toHaveAttribute('aria-pressed', 'true')
  await chips.filter({ hasText: 'Contacted' }).click()
  await expect(chips.filter({ hasText: 'Contacted' })).toHaveAttribute('aria-pressed', 'false')

  // And a different kind wears different words entirely.
  await openFreshWorkspace(page)
  await goTo(page, 'Locations')
  await page.locator('.add-button').click()
  await expect(editor.root(page).locator('.status-chip'))
    .toHaveText(['To visit', 'Considering', 'Shortlisted', 'Rejected', 'Selected'])
})

test('sample counters follow the sample, not the decision', async ({ page }) => {
  await goTo(page, 'Suppliers')

  const addSample = async (title: string, status: string) => {
    await page.locator('.add-button').click()
    await chooseKind(page, 'Supplier sample')
    await editor.title(page).fill(title)
    // A sample's status sits with its own fields, not in the filing drawer.
    await chooseStatus(page, status)
    await editor.save(page).click()
    await expect(editor.root(page)).toBeHidden()
  }

  await addSample('Mango popping boba', 'Needed')
  await addSample('Lychee jelly', 'Ordered')
  await addSample('Black tapioca', 'Received')
  await addSample('Taro powder', 'Received')

  // Where the parcels are, in the sample's own words.
  const tracker = page.locator('.sample-overview')
  await expect(tracker).toContainText('1 needed')
  await expect(tracker).toContainText('1 ordered')
  await expect(tracker).toContainText('2 received')
  // Tasted is read from the tasting fields, not from a status.
  await expect(tracker).toContainText('0 tasted')

  // The decision is a separate field: a received sample is not a chosen one.
  await row(page, 'Black tapioca').locator('.item-open').click()
  await editRecord(page)
  await openGroup(page, 'Checks and decision')
  await expect(editor.select(page, 'Decision')).toHaveValue('Not decided')
  await editor.select(page, 'Decision').selectOption('Shortlisted')
  await editor.save(page).click()
  await expect(page.locator('.detail-document')).toContainText('Shortlisted')
})

test('a quote can point at both the equipment and the supplier it came from', async ({ page }) => {
  await addSupplier(page, 'Tea Planet')
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()

  await goTo(page, 'Equipment')
  await page.locator('.add-button').click()
  await chooseKind(page, 'Equipment')
  await editor.title(page).fill('Automatic cup sealer')
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()

  await goTo(page, 'Money')
  await page.locator('.add-button').click()
  await chooseKind(page, 'Quote')
  await editor.title(page).fill('Cup sealer quote')
  await editor.root(page).locator('label', { hasText: /^Quoted amount/ }).locator('input').fill('30000')
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()

  // Links are made on the saved record, where the thing to link to exists.
  await row(page, 'Cup sealer quote').locator('.item-open').click()
  await editRecord(page)
  await openGroup(page, 'Related records')
  const related = editor.root(page).locator('.related-area')
  await related.locator('label', { hasText: 'Relationship' }).locator('select').selectOption('Quote for')
  await related.locator('label', { hasText: 'Record' }).locator('select').selectOption({ label: 'Automatic cup sealer — Equipment · Store Setup' })
  await related.getByRole('button', { name: 'Link another record' }).click()

  await related.locator('label', { hasText: 'Relationship' }).locator('select').selectOption('Supplied by')
  await related.locator('label', { hasText: 'Record' }).locator('select').selectOption({ label: 'Tea Planet — Supplier · Suppliers' })
  await related.getByRole('button', { name: 'Link another record' }).click()

  await expect(related.locator('.related-record')).toHaveCount(2)
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()

  // Saving returns to the quote, where both ends of the link are visible…
  const relatedSection = page.locator('.detail-related')
  await expect(relatedSection).toContainText('Automatic cup sealer')
  await expect(relatedSection).toContainText('Quote for · Equipment · Store Setup')
  await expect(relatedSection).toContainText('Supplied by · Supplier · Suppliers')

  // …and from the machine, read the other way round.
  await relatedSection.locator('.detail-related-open', { hasText: 'Automatic cup sealer' }).click()
  await expect(page.locator('.detail-heading h1')).toHaveText('Automatic cup sealer')
  await expect(page.locator('.detail-related')).toContainText('Quote · Quote · Money')
})

test('a link can be removed again from the record that made it', async ({ page }) => {
  await goTo(page, 'Equipment')
  for (const title of ['First sealer', 'Second sealer']) {
    await page.locator('.add-button').click()
    await chooseKind(page, 'Equipment')
    await editor.title(page).fill(title)
    await editor.save(page).click()
    await expect(editor.root(page)).toBeHidden()
  }

  await openStoreView(page, 'Equipment')
  await page.locator('.comparison-row', { hasText: 'First sealer' }).locator('.comparison-open').click()
  await editRecord(page)
  await openGroup(page, 'Related records')
  const related = editor.root(page).locator('.related-area')
  await related.locator('label', { hasText: 'Relationship' }).locator('select').selectOption('Replaces')
  await related.locator('label', { hasText: 'Record' }).locator('select').selectOption({ label: 'Second sealer — Equipment · Store Setup' })
  await related.getByRole('button', { name: 'Link another record' }).click()
  await editor.save(page).click()
  await expect(page.locator('.detail-related')).toContainText('Second sealer')

  await editRecord(page)
  // A record that already has links opens with them showing.
  await expect(editor.root(page).locator('.editor-group-head', { hasText: 'Related records' })).toHaveAttribute('aria-expanded', 'true')
  await editor.root(page).locator('.related-record', { hasText: 'Second sealer' }).getByRole('button', { name: 'Remove' }).click()
  await editor.save(page).click()
  // The section stays, because it is also where a connection is made; what goes
  // is the connection itself.
  await expect(page.locator('.detail-related-row')).toHaveCount(0)
  await expect(page.locator('.detail-related')).toContainText('Nothing is connected to this yet')
})

test('a connection is made where the record is read, and a note can carry one', async ({ page }) => {
  await goTo(page, 'Equipment')
  await page.locator('.add-button').click()
  await chooseKind(page, 'Equipment')
  await editor.title(page).fill('Automatic cup sealer')
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()

  // A photographed price list is a note, and a note used to be the one thing
  // that could not be joined to anything at all.
  await quickCapture(page, 'Sealing film is sold separately, 2000 rolls minimum')
  // A plain note is a note: it lands on the one list, not in this view.
  await goTo(page, 'Inbox')
  await page.locator('.inbox .item-row', { hasText: 'Sealing film' }).locator('.item-open').click()

  // A note reads as writing: no CONNECTED heading, and no offer to join it to
  // something, standing under one sentence nobody has connected to anything.
  await expect(page.locator('.detail-related')).toHaveCount(0)

  // The connection is made where the rest of a note's structure is: in the
  // editor, under Related records.
  await editRecord(page)
  await openGroup(page, 'Related records')
  const connect = editor.root(page).locator('.related-add')
  await connect.locator('label', { hasText: 'Relationship' }).locator('select').selectOption('Reference for')
  await connect.locator('label', { hasText: 'Record' }).locator('select').selectOption({ label: 'Automatic cup sealer — Equipment · Store Setup' })
  await connect.getByRole('button', { name: 'Link another record' }).click()
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()

  // And once it carries one, the note shows it. The block is hidden when it is
  // empty, never when there is something in it.
  await expect(page.locator('.detail-related-row')).toContainText('Automatic cup sealer')
  await expect(page.locator('.detail-related-row')).toContainText('Reference for · Equipment · Store Setup')

  // It survives a reload. (A reload always lands on the Inbox: which record is
  // open is state, not a URL.)
  await page.reload()
  await goTo(page, 'Inbox')
  await page.locator('.inbox .item-row', { hasText: 'Sealing film' }).locator('.item-open').click()
  await expect(page.locator('.detail-related-row')).toContainText('Automatic cup sealer')

  // And it reads the other way round from the machine.
  await page.locator('.detail-related-open', { hasText: 'Automatic cup sealer' }).click()
  await expect(page.locator('.detail-heading h1')).toHaveText('Automatic cup sealer')
  await expect(page.locator('.detail-related')).toContainText('Reference · Note · Inbox')

  // The far end shows the link but does not offer to break it.
  await expect(page.locator('.detail-related-remove')).toHaveCount(0)

  // Back on the record that made it, one tap disconnects.
  await page.locator('.detail-related-open', { hasText: 'Sealing film' }).click()
  await page.locator('.detail-related-remove').click()
  await expect(page.locator('.detail-related-row')).toHaveCount(0)
})

test('a captured thought gets a short title, never a truncated sentence', async ({ page }) => {
  await page.locator('.add-button').click()
    await editor.body(page).fill('Ask Tea Planet whether the popping boba containers need refrigeration after opening.')
  await editor.save(page).click()

  const saved = page.locator('.inbox .item-row').first()
  const title = (await saved.locator('strong').innerText()).trim()
  expect(title).toBe('Ask Tea Planet about popping boba containers')
  expect(title).not.toContain('…')
  expect(title.split(' ').length).toBeLessThanOrEqual(8)
  // The thought itself is untouched.
  await saved.click()
  await expect(page.locator('.detail-body')).toHaveText('Ask Tea Planet whether the popping boba containers need refrigeration after opening.')
})

test('the menu lists drinks by category, with their planning counts on the record', async ({ page }) => {
  await seedReferencePack(page)

  // The list is a catalog: the name under its category, and where it stands.
  await goTo(page, 'Menu')
  await expect(viewRow(page, 'Flavored Milk Tea')).toContainText('Testing')
  await expect(page.locator('.menu-group', { hasText: 'Toppings' })).toContainText('Popping boba toppings')

  // The counts and the prices are what you compare, and comparing happens on
  // the record — not down a column of twenty-two drinks.
  await viewRow(page, 'Flavored Milk Tea').locator('.item-open').click()
  await expect(page.locator('.detail-document')).toContainText('Matcha; Mango / Alphonso')
  await expect(page.locator('.product-summary')).toContainText('₹149 / ₹199')
})

test('imported reference suppliers are supplier records, not loose links', async ({ page }) => {
  await seedReferencePack(page)

  await goTo(page, 'Suppliers')
  await row(page, 'The Tea Planet').locator('.item-open').click()
  await expect(page.locator('.detail-meta')).toContainText('Supplier')
  await expect(page.locator('.detail-document')).toContainText('Hyderabad')
  await expect(page.locator('.detail-meta')).toContainText('Researching')
})
