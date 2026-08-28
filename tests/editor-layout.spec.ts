import { expect, test } from '@playwright/test'
import { chooseKind, openDetails, contentPane, editRecord, editor, goTo, openFreshWorkspace, openGroup , saveThenEdit } from './helpers'

test.beforeEach(async ({ page }) => {
  await openFreshWorkspace(page)
})

// A sample with all twenty of its fields on screen — which is a record that
// exists. Adding one asks for the supplier, the cost and the link; the tasting,
// the checks and the decision are what the sample is opened for afterwards.
// The Add screen for a sample: what you know when you ask for one.
async function newSampleEditor(page: import('@playwright/test').Page) {
  await goTo(page, 'Suppliers')
  await page.locator('.add-button').click()
  await chooseKind(page, 'Supplier sample')
  await expect(editor.root(page)).toBeVisible()
}

// A sample with all twenty of its fields on screen — which is a record that
// exists. Adding one asks for the supplier, the cost and the link; the tasting,
// the checks and the decision are what the sample is opened for afterwards.
async function openSampleEditor(page: import('@playwright/test').Page) {
  await newSampleEditor(page)
  await editor.title(page).fill('Popping boba sample')
  await saveThenEdit(page, 'Popping boba sample')
  await expect(editor.root(page)).toBeVisible()
}

test('editing takes over the page instead of opening a panel over it', async ({ page }) => {
  await goTo(page, 'Suppliers')
  await page.locator('.add-button').click()

  // No overlay, no dimmed backdrop, no drawer pinned to an edge: the editor
  // takes the note pane whole, with the list beside it as it always is.
  await expect(page.locator('.modal-backdrop')).toHaveCount(0)
  await expect(contentPane(page).locator('.screen')).toHaveCount(0)
  await expect(contentPane(page).locator('form.editor')).toBeVisible()

  const box = await editor.root(page).boundingBox()
  const pane = await contentPane(page).boundingBox()
  const viewport = page.viewportSize()!
  // A readable measure, not a column and not the whole monitor.
  expect(box!.width).toBeGreaterThan(400)
  expect(box!.width).toBeLessThanOrEqual(760)
  // Centred in the pane it belongs to, rather than flush to either edge.
  const leftGap = box!.x - pane!.x
  const rightGap = (pane!.x + pane!.width) - (box!.x + box!.width)
  expect(Math.abs(rightGap - leftGap)).toBeLessThan(40)
  expect(pane!.x + pane!.width).toBeCloseTo(viewport.width, 0)

  // The way back is a normal back link, not a close button.
  await expect(editor.root(page).getByRole('button', { name: /Back to Suppliers/ })).toBeVisible()
})

test('save and back stay in reach at the bottom of a long record', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await openSampleEditor(page)
  await openGroup(page, 'Tasting notes')
  await openGroup(page, 'Checks and decision')

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  const toolbar = await editor.root(page).locator('.editor-toolbar').boundingBox()
  expect(toolbar!.y).toBeGreaterThanOrEqual(-1)
  expect(toolbar!.y).toBeLessThan(200)
  await expect(editor.save(page)).toBeVisible()
  // The way out rides along with Save. There is one of it now: Cancel used to
  // sit beside this arrow doing exactly what the arrow does.
  await expect(editor.root(page).getByRole('button', { name: /^Back to / })).toBeVisible()
})

test('a note opens as a page to write on, not a slot above a form', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.locator('.add-button').click()

  // The writing area is the point of the screen, so it gets most of it.
  const height = await editor.body(page).evaluate(node => node.getBoundingClientRect().height)
  expect(height).toBeGreaterThan(900 * 0.35)
  // And typing is where the cursor already is.
  await expect(editor.body(page)).toBeFocused()

  // It still grows past its opening size rather than scrolling inside itself.
  await editor.body(page).fill(Array.from({ length: 30 }, (_, index) => `Line ${index + 1} of a long thought about suppliers`).join('\n'))
  const grown = await editor.body(page).evaluate(node => node.getBoundingClientRect().height)
  expect(grown).toBeGreaterThan(height)
})

test('a record that is mostly fields keeps a shorter writing area', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await openSampleEditor(page)
  const height = await editor.body(page).evaluate(node => node.getBoundingClientRect().height)
  expect(height).toBeLessThan(900 * 0.3)
  expect(height).toBeGreaterThan(100)
})

test('a thought can be saved without inventing a title first', async ({ page }) => {
  await goTo(page, 'Menu')
  await page.locator('.add-button').click()
  // Menu's + adds a drink, and a drink is a thing with a name — so it asks for
  // one rather than offering to skip it. A thought is the case this test is
  // about, and a thought never has to be named.
  await expect(editor.title(page)).toHaveAttribute('placeholder', 'Drink name')
  await chooseKind(page, 'Note')
  await expect(editor.title(page)).toHaveAttribute('placeholder', 'Title (optional)')


  // Nothing written yet, nothing to save.
  await expect(editor.save(page)).toBeDisabled()

  await editor.body(page).fill('Fruit tea syrup supplier still not decided. Ask Tea Planet and QQS for prices per litre.')
  await expect(editor.save(page)).toBeEnabled()
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()

  // The list still needs something to show, so the title comes from the writing.
  const saved = page.locator('.item-row', { hasText: 'Fruit tea syrup supplier still not decided' }).first()
  await expect(saved).toBeVisible()
  await saved.click()
  // A note whose title is its own first words reads as the writing, not as a
  // headline printed above the same sentence.
  await expect(page.locator('.detail-body-lead')).toContainText('Fruit tea syrup supplier still not decided')
  // The thought itself is kept whole.
  await expect(page.locator('.detail-body')).toContainText('Ask Tea Planet and QQS for prices per litre.')
})

test('adding from a section asks for nothing the section already knows', async ({ page }) => {
  await goTo(page, 'Menu')
  await page.locator('.add-button').click()
  // Menu leads with a drink; a plain thought is one chip away.
  await expect(editor.root(page).locator('.eyebrow')).toHaveText('New drink · Menu')
  await chooseKind(page, 'Note')

  // The destination is stated, not asked.
  await expect(editor.root(page).locator('.eyebrow')).toHaveText('Add to Menu')
  await expect(editor.root(page).locator('.editor-fields')).toHaveCount(0)
  await expect(editor.root(page).locator('.editor-group-head')).toHaveCount(0)

  // What is left is a title, a place to write, and files.
  await expect(editor.title(page)).toBeVisible()
  await expect(editor.body(page)).toBeVisible()
  await expect(editor.root(page).getByText('Attach files')).toBeVisible()

  // Filing and connections appear once the record exists. A source to cite is
  // still the one thing a plain note does not carry.
  await editor.body(page).fill('Fruit tea syrup supplier still open.')
  await editor.save(page).click()
  await page.locator('.item-row', { hasText: 'Fruit tea syrup supplier still open' }).first().locator('.item-open').click()
  await editRecord(page)
  // On a note these live behind + Details. The writing is what a note is for,
  // and status, filing and links are not the first thing a thought should meet.
  await expect(editor.root(page).locator('.editor-group-head')).toHaveCount(0)
  await openDetails(page)
  await expect(editor.root(page).locator('.editor-group-head', { hasText: 'Filing' })).toBeVisible()
  // A note is a record like any other once it exists: it can be joined to the
  // decision it is about.
  await expect(editor.root(page).locator('.editor-group-head', { hasText: 'Related records' })).toBeVisible()

  await openGroup(page, 'Filing')
  const filing = editor.root(page).locator('.editor-fields label')
  await expect(filing).toHaveCount(3)
  await expect(filing.nth(0)).toContainText('Type')
  await expect(filing.nth(1)).toContainText('Belongs to')
  await expect(filing.nth(2)).toContainText('Area')
  await expect(editor.root(page).locator('.source-field')).toHaveCount(0)
})

test('a record with money and links keeps its full filing drawer', async ({ page }) => {
  await goTo(page, 'Money')
  await page.locator('.add-button').click()
  await editor.title(page).fill('Cup sealer quote')
  await editor.save(page).click()

  await page.locator('.item-row', { hasText: 'Cup sealer quote' }).first().locator('.item-open').click()
  await editRecord(page)
  await expect(editor.root(page).locator('.editor-group-head', { hasText: 'Related records' })).toBeVisible()
  await openGroup(page, 'Filing')
  // Three: type, section, area. Status used to be a fourth copy in here, and
  // two places to change one word is one place too many.
  await expect(editor.root(page).locator('.editor-fields label')).toHaveCount(3)
  await expect(editor.root(page).locator('.source-field')).toBeVisible()
})

test('secondary field groups start folded and say what is inside them', async ({ page }) => {
  await openSampleEditor(page)

  const head = (name: string) => editor.root(page).locator('.editor-group-head', { hasText: name })
  await expect(head('Sample details')).toHaveAttribute('aria-expanded', 'true')
  await expect(head('Tasting notes')).toHaveAttribute('aria-expanded', 'false')
  await expect(head('Checks and decision')).toHaveAttribute('aria-expanded', 'false')
  await expect(head('Checks and decision')).not.toContainText('filled')
  await expect(editor.root(page).locator('label', { hasText: 'Sweetness' })).toHaveCount(0)

  await openGroup(page, 'Tasting notes')
  await editor.root(page).locator('label', { hasText: 'Sweetness' }).locator('input').fill('Balanced')
  await editor.root(page).locator('label', { hasText: 'Texture' }).locator('input').fill('Chewy')

  // Folding it away must not hide the fact that something is in there.
  await head('Tasting notes').click()
  await expect(head('Tasting notes')).toHaveAttribute('aria-expanded', 'false')
  await expect(head('Tasting notes')).toContainText('2 filled')

  // And the values survive the fold.
  await editor.title(page).fill('Mango popping boba')
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()
  await page.locator('.item-row', { hasText: 'Mango popping boba' }).first().locator('.item-open').click()
  await expect(page.locator('.detail-grid')).toContainText('Balanced')
  await expect(page.locator('.detail-grid')).toContainText('Chewy')
})

test('the editor says what kind of record is being edited', async ({ page }) => {
  await newSampleEditor(page)
  await expect(editor.root(page).locator('.eyebrow')).toHaveText('New supplier sample · Suppliers')
  await editor.title(page).fill('Lychee jelly')
  await editor.save(page).click()

  await page.locator('.item-row', { hasText: 'Lychee jelly' }).first().locator('.item-open').click()
  await editRecord(page)
  await expect(editor.root(page).locator('.eyebrow')).toHaveText('Edit supplier sample')
})

test('leaving with the back link asks before discarding', async ({ page }) => {
  await newSampleEditor(page)
  await editor.title(page).fill('Half typed sample')
  await editor.root(page).getByRole('button', { name: /Back to Suppliers/ }).click()

  const discard = page.getByRole('dialog', { name: 'Discard changes?' })
  await expect(discard).toBeVisible()
  await discard.getByRole('button', { name: 'Keep editing' }).click()
  await expect(editor.title(page)).toHaveValue('Half typed sample')

  await editor.root(page).getByRole('button', { name: /Back to Suppliers/ }).click()
  await page.getByRole('dialog', { name: 'Discard changes?' }).getByRole('button', { name: 'Discard' }).click()
  await expect(editor.root(page)).toBeHidden()
  await expect(page.getByRole('heading', { name: 'Suppliers', level: 1 })).toBeVisible()
})
