import { expect, test } from '@playwright/test'
import { chooseKind, chooseStatus, contentPane, editor, goTo, inboxPane, openFreshWorkspace, viewRow , seedReferencePack , seedLaunchTasks , chooseChip , turnInto } from './helpers'

// Every pin answers a different question, so every pin gets the shape that
// answers it. Nine views built out of one generic row and one generic detail
// page were consistent and told you nothing: Locations, Suppliers, Money and
// Menu read as the same list with different data in it. These tests are about
// the differences, and about the one thing they still share — the type scale,
// the rules, the spacing, and a single way to add.

test.beforeEach(async ({ page }) => {
  await openFreshWorkspace(page)
})

const field = (page: import('@playwright/test').Page, label: string) =>
  page.locator('form.editor label', { hasText: label }).locator('input').first()

async function addLocation(page: import('@playwright/test').Page, title: string, rent: string, area: string, size: string) {
  await goTo(page, 'Locations')
  await page.locator('.add-button').click()
  await editor.title(page).fill(title)
  await field(page, 'Monthly rent').fill(rent)
  await field(page, 'Area').fill(area)
  await field(page, 'Size (sq ft)').fill(size)
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()
}

async function addExpense(page: import('@playwright/test').Page, title: string, amount: string, status?: string, paid?: string) {
  await goTo(page, 'Money')
  await page.locator('.add-button').click()
  await chooseKind(page, 'Expense')
  await editor.title(page).fill(title)
  await page.getByRole('spinbutton').first().fill(amount)
  if (status) await editor.select(page, 'Payment').selectOption(status)
  if (paid) await field(page, 'Paid so far').fill(paid)
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()
}

// ── Locations ───────────────────────────────────────────────────────────────

test('locations is a property table you read across, not a list of notes', async ({ page }) => {
  await addLocation(page, 'Mamatha Road shop', '19000', 'Mamatha Road', '280')
  await addLocation(page, 'Zudio junction', '21500', 'Rotary Nagar', '350')
  await goTo(page, 'Locations')

  // The columns are named, because choosing a shop means reading rent and size
  // down a column rather than hunting for them inside two paragraphs.
  await expect(page.locator('.property-head')).toHaveText(/Property.*Area.*Rent.*Size.*Status/s)

  const row = contentPane(page).locator('.comparison-row', { hasText: 'Mamatha Road shop' })
  await expect(row).toContainText('Mamatha Road')
  await expect(row).toContainText('₹19,000')
  // A bare "280" under a heading is a number without a unit.
  await expect(row).toContainText('280 sqft')

  // One sentence above it, not a strip of tiles: how many, and what they cost.
  await expect(page.locator('.location-scouting .view-summary')).toHaveText('2 properties · ₹19k–₹22k rent')
})

test('a summary never claims a narrowing that narrows nothing', async ({ page }) => {
  // Both properties sit at Doing, so "2 shortlisted" out of 2 is not a fact
  // about the search — it is the row count said twice.
  await addLocation(page, 'One', '19000', 'Somewhere', '280')
  await addLocation(page, 'Two', '19000', 'Elsewhere', '280')
  await goTo(page, 'Locations')
  await expect(page.locator('.location-scouting .view-summary')).not.toContainText('shortlisted')
})

// ── Launch Checklist ────────────────────────────────────────────────────────

test('the checklist says how far through the launch is', async ({ page }) => {
  await seedLaunchTasks(page)
  await goTo(page, 'Launch Checklist')
  await expect(page.locator('.checklist-row').first()).toBeVisible()

  await expect(page.locator('.launch-checklist > header')).toContainText('0 of 6 complete')
  await expect(page.locator('.checklist-percent')).toHaveText('0%')

  // One list rather than twelve phase headings: a task is a line of text, and
  // choosing which of twelve buckets it belonged to was filing standing in
  // front of writing.
  await expect(page.locator('.checklist-phase')).toHaveCount(0)
  await page.locator('.checklist-row').first().locator('.check-toggle').click()
  await expect(page.locator('.launch-checklist > header')).toContainText('1 of 6 complete')
  await expect(page.locator('.checklist-percent')).toHaveText('17%')
})

// ── Menu ────────────────────────────────────────────────────────────────────

test('the menu answers three questions: what is it, what does it cost, is it ready', async ({ page }) => {
  const addDrink = async (title: string, category: string, small?: string, regular?: string) => {
    await goTo(page, 'Menu')
    await page.locator('.add-button').click()
    await editor.title(page).fill(title)
    await chooseChip(page, 'Category', category)
    if (small) await field(page, 'Planning price — small').fill(small)
    if (regular) await field(page, 'Planning price — regular').fill(regular)
    await editor.save(page).click()
    await expect(editor.root(page)).toBeHidden()
  }
  await addDrink('Mango Milk Tea', 'Milk tea', '149', '199')
  await addDrink('Mango Lassi', 'Boba lassi', '129')
  await addDrink('Black Tapioca', 'Toppings')
  await goTo(page, 'Menu')

  // Price earns a column of its own: it is one of the few things worth seeing
  // without opening a drink, and a column is how you compare twenty-two of them.
  await expect(viewRow(page, 'Mango Milk Tea').locator('.item-trailing')).toHaveText('₹149 / ₹199')
  // One size prints one price rather than half of a pair.
  await expect(viewRow(page, 'Mango Lassi').locator('.item-trailing')).toHaveText('₹129')
  // A topping nobody has priced prints nothing, not a dash standing in for a
  // decision that has not been made.
  await expect(viewRow(page, 'Black Tapioca').locator('.item-trailing')).toHaveCount(0)

  // And nothing else. Recipe, supplier and taste score are read one drink at a
  // time, and the old facts string put two of them in the way of the price.
  const drink = viewRow(page, 'Mango Milk Tea')
  await expect(drink).not.toContainText('Updated')
  await expect(drink.locator('.item-copy small')).toHaveCount(0)
  await expect(page.locator('.menu-group h2').first()).toContainText('Milk tea')
})

// ── Suppliers ───────────────────────────────────────────────────────────────

test('a supplier row says who, where, and what they can sell us', async ({ page }) => {
  await goTo(page, 'Suppliers')
  await page.locator('.add-button').click()
  await chooseKind(page, 'Supplier')
  await editor.title(page).fill('Tea Planet')
  await editor.root(page).locator('label', { hasText: /^Location/ }).locator('input').fill('Hyderabad')
  await editor.root(page).locator('label', { hasText: /^What might we buy/ }).locator('input').fill('Tapioca, popping boba, taro')
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()
  await goTo(page, 'Suppliers')

  const supplier = contentPane(page).locator('.supplier-row', { hasText: 'Tea Planet' })
  await expect(supplier).toContainText('Hyderabad')
  // The third line is the reason a supplier is on the list at all.
  await expect(supplier.locator('.supplier-categories')).toHaveText('Tapioca, popping boba, taro')
})

// ── Money ───────────────────────────────────────────────────────────────────

test('money separates what went out, what is owed and what is only expected', async ({ page }) => {
  await addExpense(page, 'Packaging samples', '4500', 'Paid')
  await addExpense(page, 'Cup sealer', '18000', 'Committed')
  await addExpense(page, 'Shop deposit', '60000', 'Planned')
  await goTo(page, 'Money')

  const totals = page.locator('.money-totals')
  await expect(totals).toContainText('₹4,500')
  await expect(totals).toContainText('₹18,000')
  await expect(totals).toContainText('₹60,000')
  await expect(page.locator('.money-totals > span > span')).toHaveText(['paid', 'committed', 'planned'])
})

test('a part paid purchase shows both numbers, because one line hides them', async ({ page }) => {
  await addExpense(page, 'Stainless counter', '40000', 'Part paid', '10000')
  await goTo(page, 'Money')

  const entry = page.locator('.money-entry', { hasText: 'Stainless counter' })
  await expect(entry).toContainText('₹40,000 · Part paid')
  await expect(entry.locator('.money-split')).toHaveText('₹10,000 paid · ₹30,000 outstanding')
})

test('a paid expense is not dressed as a finished piece of work', async ({ page }) => {
  await addExpense(page, 'Packaging samples', '4500', 'Paid')
  await goTo(page, 'Money')

  // Its payment is stored as Done underneath, because that is how the workflow
  // reads a settled bill. Saying so in grey on screen is the workflow word
  // spoken in colour, and an expense must never show one.
  const paidRow = page.locator('.money-entry', { hasText: 'Packaging samples' }).locator('.item-row')
  await expect(paidRow).not.toHaveClass(/done/)
  await expect(paidRow).not.toHaveClass(/struck/)

  await paidRow.locator('.item-open').click()
  await expect(page.locator('.detail-meta')).not.toContainText('Done')
  await expect(page.locator('.detail-meta')).toContainText('Expense')
})

// ── Library ─────────────────────────────────────────────────────────────────

test('the library keeps documents and references apart', async ({ page }) => {
  await seedReferencePack(page)
  await goTo(page, 'Library')

  // A document is a file we hold; a reference is a page that lives somewhere
  // else. "Where is the material I need" has a different answer for each.
  await expect(page.locator('.library-files .eyebrow')).toHaveText(['Documents', 'References'])
  await expect(page.locator('.library-row').first()).toBeVisible()

  // The eight guides the workspace was built from are documents we have the
  // names of, not links. They used to be dropped on the floor: the only test
  // for whether a File deserved to render was whether its url began https, so
  // the Business Plan and both cost workbooks were invisible in the one screen
  // whose entire job is finding them.
  await expect(page.locator('.library-row', { hasText: 'Business Plan v3' })).toBeVisible()
  await expect(page.locator('.library-row', { hasText: 'Cost Per Drink workbook v3' })).toContainText('XLSX')

  // The heading, the body and the pin count one population. "Library 8" over a
  // body listing five things is the screen disagreeing with itself.
  const summary = await page.locator('.library-files > header').innerText()
  const documents = Number(summary.match(/(\d+) documents?/)![1])
  const references = Number(summary.match(/(\d+) references?/)![1])
  await expect(page.locator('.saved-view .screen-count')).toHaveText(String(documents + references))
  await goTo(page, 'Inbox')
  await expect(page.locator('.pin-row', { hasText: 'Library' })).toContainText(`${documents + references} references`)
})

test('a link written into a note finds its way into the library', async ({ page }) => {
  await page.locator('.add-button').click()
  await editor.body(page).fill('Packaging options\n\nCheck https://store.yenchuan.co/carrier-2-cups for the handle version.')
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()

  // A link inside writing has no other home in the app — nothing else will ever
  // show it to you again — so the Library is where it lives, named after where
  // it points rather than after the note, and still attached to that note.
  // The starter pack already carries yenchuan links, so this asserts on the one
  // the note just contributed rather than on the host.
  await goTo(page, 'Library')
  const reference = page.locator('.library-row', { hasText: 'Carrier 2 cups' })
  await expect(reference.locator('.library-open')).toContainText('store.yenchuan.co')
  await expect(reference.locator('.library-parent')).toContainText('Inbox')

  // Mentioning the same page again does not add a second row.
  await goTo(page, 'Inbox')
  await page.locator('.add-button').click()
  await editor.body(page).fill('Ask about https://store.yenchuan.co/carrier-2-cups pricing too.')
  await editor.save(page).click()
  await goTo(page, 'Library')
  await expect(page.locator('.library-row', { hasText: 'Carrier 2 cups' })).toHaveCount(1)
})

test('the library pin counts what the library screen shows', async ({ page }) => {
  // The Library is the one view that is not a drawer of its own records: the
  // material hangs off records all over the workspace. The pin used to count
  // the Library *section* instead, so a link saved on a note in the Inbox
  // showed on the screen and was invisible to the pin — "Nothing yet" over a
  // screen listing files.
  await page.locator('.add-button').click()
  await editor.body(page).fill('Compare https://store.yenchuan.co/carrier-2-cups before deciding')
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()

  await goTo(page, 'Library')
  const summary = await page.locator('.library-files > header').innerText()
  const documents = Number(summary.match(/(\d+) documents?/)![1])
  const references = Number(summary.match(/(\d+) references?/)![1])
  const total = documents + references
  expect(total).toBeGreaterThan(0)
  await expect(page.locator('.saved-view .screen-count')).toHaveText(String(total))

  await goTo(page, 'Inbox')
  const pin = page.locator('.pin-row', { hasText: 'Library' })
  await expect(pin).not.toContainText('Nothing yet')
  await expect(pin).toContainText(`${total} reference`)
})

test('a supplier website stays on the supplier and out of the library', async ({ page }) => {
  await goTo(page, 'Suppliers')
  await page.locator('.add-button').click()
  await chooseKind(page, 'Supplier')
  await editor.title(page).fill('Zawaa Foods')
  await editor.root(page).locator('label', { hasText: /^Website/ }).locator('input').fill('https://zawaafoods.com/')
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()

  // The url field of a structured record already has a home: the record. Pulling
  // those in would make the Library a list of every address in the workspace,
  // which is how it stops being a library.
  await goTo(page, 'Library')
  await expect(page.locator('.library-row', { hasText: 'zawaafoods.com' })).toHaveCount(0)
})

// ── Needs you ───────────────────────────────────────────────────────────────

test('the action queue says which part of the shop each thing belongs to', async ({ page }) => {
  await page.locator('.add-button').click()
  // A note carries no status and so can never be waiting on anyone. Chasing a
  // quote is a piece of work, which is a task.
  await chooseKind(page, 'Task')
  await editor.title(page).fill('Chase the signage quote')
  await chooseStatus(page, 'Waiting')
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()

  await goTo(page, 'Needs you')
  const queued = viewRow(page, 'Chase the signage quote')
  // Not the two facts an Inbox row carries, and not a timestamp: the one thing
  // you need to decide what to pick up is where it lives.
  await expect(queued).not.toContainText('Updated')
  // Still a place you can finish something, or it is a list of complaints.
  await expect(queued.getByRole('button', { name: /^Mark/ })).toBeVisible()
})

// ── Search ──────────────────────────────────────────────────────────────────

test('a record is read in headed blocks, not as one grid of every field', async ({ page }) => {
  await addLocation(page, 'Mamatha Road shop', '19000', 'Mamatha Road', '280')
  await goTo(page, 'Locations')
  await page.locator('.comparison-open', { hasText: 'Mamatha Road shop' }).click()

  const property = page.locator('.detail-section', { hasText: 'Property' })
  await expect(property.locator('h2')).toHaveText('Property')
  await expect(property).toContainText('₹19,000')

  // Nothing may fall out of the shape into a nameless leftover pile: a field
  // the record knows about belongs under a heading that says what it is.
  await expect(page.locator('.detail-section h2', { hasText: 'Details' })).toHaveCount(0)
})

test('a one sentence note is asked nothing at all', async ({ page }) => {
  await page.locator('.add-button').click()
  await editor.body(page).fill('Ask Tea Planet about black tapioca sample pricing')
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()
  await inboxPane(page).locator('.item-row', { hasText: 'Ask Tea Planet' }).locator('.item-open').click()

  // A sentence is a sentence. No row of shapes asking what it might really be,
  // no empty NEXT STEPS heading with an input under it, and no CONNECTED
  // heading offering to join it to something — three blocks of chrome under
  // three words of writing is what this test exists to prevent.
  await expect(page.locator('.promote')).toHaveCount(0)
  await expect(page.locator('.record-checklist')).toHaveCount(0)
  await expect(page.locator('.record-checklist-offer')).toHaveCount(0)
  await expect(page.locator('.detail-related')).toHaveCount(0)

  // Given a shape, it is a piece of work, and work has next steps.
  await turnInto(page, 'Task')
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()
})

test('a record that is not writing carries its next steps openly', async ({ page }) => {
  await addLocation(page, 'Mamatha Road shop', '19000', 'Mamatha Road', '280')
  await goTo(page, 'Locations')
  await page.locator('.comparison-open', { hasText: 'Mamatha Road shop' }).click()

  // A property is never a thought that might turn into something. Visiting it,
  // checking the drainage and negotiating the deposit are the whole job.
  await expect(page.locator('.record-checklist')).toBeVisible()
  await expect(page.locator('.promote')).toHaveCount(0)
  // And it does carry the connections block: a property is something quotes
  // and expenses point at.
  await expect(page.locator('.detail-related')).toBeVisible()
})

// A decision does not need an object type. "Use full-cream milk instead of
// creamer" followed by why is a note, and making you pick "Decision" from a
// menu of nine before you could write it was classification standing in front
// of a sentence. The kind still exists for records already saved as one; it is
// simply not something you can create any more.
test('a decision is a note that says what was decided, and why', async ({ page }) => {
  await page.locator('.add-button').click()
  await expect(page.locator('.kind-option-name', { hasText: /^Decision$/ })).toHaveCount(0)

  await editor.body(page).fill('Use full-cream milk instead of creamer\n\nTaste was better in testing and it fits the positioning better.')
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()

  await inboxPane(page).locator('.item-row', { hasText: 'full-cream milk' }).locator('.item-open').click()
  await expect(page.locator('.detail-body')).toContainText('Taste was better in testing')
  // A note is not at a stage in anything, so it wears no status at all.
  await expect(page.locator('.detail-meta')).not.toContainText('New')
})
