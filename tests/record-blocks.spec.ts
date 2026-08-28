import { expect, test } from '@playwright/test'
import { chooseKind, editRecord, editor, goTo, openFreshWorkspace, openGroup, openRow, turnInto } from './helpers'

// A record page is a set of headed blocks, and which blocks it has is what
// makes a supplier read like a supplier and a property like a property.
//
// Two rules were lost. A block with nothing in it used to vanish, so a supplier
// nobody had asked about MOQ looked exactly like one whose terms were settled —
// the record said "this does not matter" when it meant "we still need to find
// this out". And every external link on every record was called "Open product
// page", including a supplier's website.

test.beforeEach(async ({ page }) => {
  await openFreshWorkspace(page)
})

const field = (page: import('@playwright/test').Page, label: string) =>
  page.locator('form.editor label', { hasText: label }).locator('input').first()

function blocks(page: import('@playwright/test').Page) {
  return page.locator('.detail-section h2')
}

function rowsOf(page: import('@playwright/test').Page, title: string) {
  return page.locator('.detail-section', { has: page.locator('h2', { hasText: title }) }).locator('.detail-grid > div')
}

test('a supplier asks its four commercial questions whether or not they are answered', async ({ page }) => {
  await goTo(page, 'Suppliers')
  await page.locator('.add-button').click()
  await chooseKind(page, 'Supplier')
  await editor.title(page).fill('The Tea Planet')
  await field(page, 'What might we buy?').fill('Popping boba, tapioca, milk-tea powders')
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()
  await openRow(page, 'The Tea Planet')

  // Nothing commercial has been asked yet, and the record says so out loud.
  await expect(blocks(page)).toHaveText(['What we may buy', 'Commercial', 'Contact'])
  await expect(rowsOf(page, 'Commercial')).toHaveText([
    'MOQ—', 'Shipping terms—', 'Lead time—', 'Payment terms—',
  ])

  // What a supplier sells is the reason they are on the list, so it leads the
  // record rather than falling into a trailing DETAILS block. It comes from the
  // supplier's own line — no product records need to exist first.
  const catalogue = page.locator('.supplier-catalogue')
  await expect(catalogue.locator('.supplier-catalogue-name')).toHaveText(['Popping boba', 'Tapioca', 'Milk-tea powders'])
  await expect(page.locator('.detail-section h2', { hasText: 'Details' })).toHaveCount(0)

  // An answered question replaces its dash rather than adding a second row.
  await editRecord(page)
  await openGroup(page, 'Trade terms')
  await field(page, 'MOQ').fill('5 kg per flavour')
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()
  await expect(rowsOf(page, 'Commercial')).toHaveText([
    'MOQ5 kg per flavour', 'Shipping terms—', 'Lead time—', 'Payment terms—',
  ])
})

test('a property says what has not been found out yet', async ({ page }) => {
  await goTo(page, 'Locations')
  await page.locator('.add-button').click()
  await editor.title(page).fill('Shop near Ibaco')
  await field(page, 'Monthly rent').fill('22000')
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()
  await page.locator('.comparison-open', { hasText: 'Shop near Ibaco' }).click()

  await expect(blocks(page)).toHaveText(['Property', 'Assessment', 'Contact'])
  await expect(rowsOf(page, 'Property')).toHaveText([
    'Monthly rent (₹)₹22,000', 'Deposit (₹)—', 'Size (sq ft)—', 'Property / address—',
  ])
  // Nobody has visited, so there is no verdict — which is the single most
  // useful thing this block can tell you before you go.
  await expect(rowsOf(page, 'Assessment')).toHaveText(['Pros—', 'Concerns—'])
})

test('next steps belong to a record from the moment it exists', async ({ page }) => {
  await goTo(page, 'Suppliers')
  await page.locator('.add-button').click()
  await chooseKind(page, 'Supplier')
  await editor.title(page).fill('QQS Bubble Tea')
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()
  await openRow(page, 'QQS Bubble Tea')

  // This used to appear only once the record was marked Done, so the list of
  // what to do next arrived after there was nothing left to do.
  await expect(page.locator('.detail-meta')).toContainText('Researching')
  const steps = page.locator('.record-checklist')
  await expect(steps).toBeVisible()
  await steps.getByRole('textbox', { name: 'Add a step' }).fill('Ask for the sample list')
  await steps.getByRole('textbox', { name: 'Add a step' }).press('Enter')
  await expect(page.getByRole('button', { name: 'Mark Ask for the sample list done' })).toBeVisible()
})

test('a link is called what it is on the record that carries it', async ({ page }) => {
  await goTo(page, 'Suppliers')
  await page.locator('.add-button').click()
  await chooseKind(page, 'Supplier')
  await editor.title(page).fill('Zawaa Foods')
  await editor.root(page).locator('label', { hasText: /^Website/ }).locator('input').fill('https://zawaafoods.com/')
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()
  await openRow(page, 'Zawaa Foods')
  await expect(page.locator('.primary-link')).toHaveText('Open website')

  // The editor already asks a marketing contact for "Instagram or profile
  // link". The page reading it back used to call that a product page.
  await goTo(page, 'Marketing')
  await page.locator('.add-button').click()
  await editor.title(page).fill('Khammam food blogger')
  await editor.root(page).locator('label', { hasText: /^Instagram or profile link/ }).locator('input').fill('https://instagram.com/example')
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()
  await openRow(page, 'Khammam food blogger')
  await expect(page.locator('.primary-link')).toHaveText('Open profile')
})

test('a view says it is empty only when it is empty', async ({ page }) => {
  // Empty means nothing on screen — not "nothing of the kind this view leads
  // with". Suppliers holding a supplier note used to print "No suppliers yet."
  // directly above that note, and "No samples yet." above that, so a screen
  // with a record on it announced itself as empty twice over.
  await goTo(page, 'Marketing')
  await expect(page.locator('.view-summary-empty')).toContainText('No outreach contacts yet.')

  await page.locator('.add-button').click()
  await chooseKind(page, 'Note')
  await editor.body(page).fill('Contact the colleges once the location is final.')
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()

  await goTo(page, 'Marketing')
  expect(await page.locator('.saved-view .item-row').count()).toBeGreaterThan(0)
  await expect(page.locator('.view-summary-empty')).toHaveCount(0)
  await expect(page.locator('.saved-view .eyebrow')).toHaveText(['Notes'])
})

test('no view claims to be empty while it is showing something', async ({ page }) => {
  // One note filed into each of the views that lead with a structured kind.
  for (const [view, text] of [
    ['Menu', 'Milk tea, fruit tea, lassi and toppings'],
    ['Suppliers', 'Tea Planet, QQS and Zawaa are the candidates'],
    ['Money', 'Old workbook amounts are references, not a budget'],
  ] as const) {
    await goTo(page, view)
    await page.locator('.add-button').click()
    await chooseKind(page, 'Note')
    await editor.body(page).fill(text)
    await editor.save(page).click()
    await expect(editor.root(page)).toBeHidden()
  }

  for (const view of ['Menu', 'Suppliers', 'Money'] as const) {
    await goTo(page, view)
    expect(await page.locator('.saved-view .item-row').count(), `${view} lost its record`).toBeGreaterThan(0)
    await expect(
      page.locator('.saved-view').locator('.view-summary-empty, .quiet-offer, .empty-state, .sample-overview'),
      `${view} says it is empty while showing a record`,
    ).toHaveCount(0)
  }
})

test('no view seeds records into itself', async ({ page }) => {
  // A document is a note with a file on it, and a launch plan is thirty-seven
  // guesses about a shop nobody has opened. Both used to arrive by pressing a
  // button inside a view; neither does now.
  for (const view of ['Library', 'Launch Checklist'] as const) {
    await goTo(page, view)
    await expect(
      page.getByRole('button', { name: /Add references|Add checklist|starter/i }),
      `${view} still seeds records`,
    ).toHaveCount(0)
  }
})

test('turning a record into a note sheds the fields a note cannot say', async ({ page }) => {
  await page.locator('.add-button').click()
  await editor.body(page).fill('Ask Tea Planet about tapioca shelf life')
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()

  // A thought that looked like it might be a property, filled in, then thought
  // better of. The rent and the frontage used to travel back with it — invisible
  // in the editor, because a note has no fields, and printed on the record under
  // a trailing DETAILS heading. "Monthly rent ₹22,000" on a note about tapioca.
  await openRow(page, 'tapioca shelf life')
  await turnInto(page, 'Location')
  await openGroup(page, 'Property details')
  await field(page, 'Monthly rent').fill('22000')
  await field(page, 'Size (sq ft)').fill('280')
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()

  await goTo(page, 'Locations')
  await page.locator('.comparison-open', { hasText: 'tapioca shelf life' }).click()
  await expect(rowsOf(page, 'Property').first()).toContainText('Monthly rent')

  await editRecord(page)
  await openGroup(page, 'Filing')
  await editor.select(page, 'Type').selectOption('Note')
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()

  await goTo(page, 'Inbox')
  await openRow(page, 'tapioca shelf life')
  await expect(page.locator('.detail-section')).toHaveCount(0)
  await expect(page.locator('.detail-document')).not.toContainText('Monthly rent')
  // And it is no longer filed where a property would have been.
  await expect(page.locator('.detail-kicker')).not.toHaveText('Locations')
})

test('a record carries the words of its own journey, and only a task carries the generic four', async ({ page }) => {
  const chipsFor = async (view: 'Suppliers' | 'Money' | 'Inbox', kind: string) => {
    await openFreshWorkspace(page)
    await goTo(page, view)
    await page.locator('.add-button').click()
    await chooseKind(page, kind)
    return editor.root(page).locator('.status-chip').allInnerTexts()
  }

  // The three that used to be honest placeholders wearing New / Doing / Waiting
  // / Done. A sample's status is where the parcel is, not whether we liked it.
  expect(await chipsFor('Suppliers', 'Supplier sample')).toEqual(['Needed', 'Ordered', 'Received', 'Tested'])
  expect(await chipsFor('Suppliers', 'Product link')).toEqual(['Considering', 'Sampling', 'Approved', 'Rejected'])
  // A quote tracks the quote. Money leaving the account is the expense's job.
  expect(await chipsFor('Money', 'Quote')).toEqual(['Requested', 'Received', 'Accepted', 'Declined', 'Expired'])
  // And the one kind those four words were ever right for. Started from the
  // Inbox, because the Launch Checklist writes its tasks on the list itself and
  // so has no + to open an editor with.
  expect(await chipsFor('Inbox', 'Task')).toEqual(['New', 'Doing', 'Waiting', 'Done'])
})
