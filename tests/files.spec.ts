import { expect, test } from '@playwright/test'
import { editRecord, editor, goTo, openFreshWorkspace, row } from './helpers'

test.beforeEach(async ({ page }) => {
  await openFreshWorkspace(page)
})

const textFile = (name: string, body = 'quote') => ({ name, mimeType: 'text/plain', buffer: Buffer.from(body) })

// A real 1x1 PNG, so the browser will decode it into an object URL.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

function filePicker(page: import('@playwright/test').Page) {
  return page.locator('form.editor input[type="file"]')
}

async function createWithFiles(page: import('@playwright/test').Page, title: string, files: Parameters<ReturnType<typeof filePicker>['setInputFiles']>[0]) {
  await goTo(page, 'Suppliers')
  await page.locator('.add-button').click()
  await editor.title(page).fill(title)
  await filePicker(page).setInputFiles(files)
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()
}

test('a file attached in the editor stays with the record', async ({ page }) => {
  await createWithFiles(page, 'Tea Planet quote', textFile('quotation.pdf'))

  await row(page, 'Tea Planet quote').locator('.item-open').click()
  await expect(page.locator('.detail-attachments')).toContainText('quotation.pdf')

  await page.reload()
  await goTo(page, 'Suppliers')
  await row(page, 'Tea Planet quote').locator('.item-open').click()
  await expect(page.locator('.detail-attachments')).toContainText('quotation.pdf')
})

test('several files can be attached to one record, and land where they belong', async ({ page }) => {
  await createWithFiles(page, 'Sample photos', [textFile('front.jpg'), textFile('label.jpg'), textFile('invoice.pdf')])

  await row(page, 'Sample photos').locator('.item-open').click()
  // Three files, split by what you do with them: two you look at, one you open.
  await expect(page.locator('.detail-photo')).toHaveCount(2)
  await expect(page.locator('.detail-photos')).toContainText('label.jpg')
  await expect(page.locator('.detail-attachments button')).toHaveCount(1)
  await expect(page.locator('.detail-attachments')).toContainText('invoice.pdf')
})

test('a file over 25 MB is rejected before the record is changed', async ({ page }) => {
  await goTo(page, 'Suppliers')
  await page.locator('.add-button').click()
  await editor.title(page).fill('Too big to save')
  await filePicker(page).setInputFiles({ name: 'huge.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(26 * 1024 * 1024) })
  await editor.save(page).click()

  await expect(editor.root(page).getByRole('alert')).toContainText('larger than the 25 MB file limit')
  // The editor is still open and nothing was written.
  await expect(editor.root(page)).toBeVisible()
  await editor.root(page).getByRole('button', { name: /^Back to / }).click()
  await page.getByRole('dialog', { name: 'Discard changes?' }).getByRole('button', { name: 'Discard' }).click()
  await expect(row(page, 'Too big to save')).toHaveCount(0)
})

test('removing a file is staged until save, and closing the editor keeps it', async ({ page }) => {
  await createWithFiles(page, 'Invoice record', textFile('invoice.pdf'))

  await row(page, 'Invoice record').locator('.item-open').click()
  await editRecord(page)
  await editor.root(page).locator('.attachment-record', { hasText: 'invoice.pdf' }).getByRole('button', { name: 'Remove' }).click()
  await expect(editor.root(page).locator('.attachment-record.removing')).toContainText('Will be removed when you save')

  // Closing without saving is not a delete.
  await editor.root(page).getByRole('button', { name: /^Back to / }).click()
  await page.getByRole('dialog', { name: 'Discard changes?' }).getByRole('button', { name: 'Discard' }).click()
  await expect(editor.root(page)).toBeHidden()
  await expect(page.locator('.detail-attachments')).toContainText('invoice.pdf')

  // Undo puts it back too.
  await editRecord(page)
  await editor.root(page).locator('.attachment-record', { hasText: 'invoice.pdf' }).getByRole('button', { name: 'Remove' }).click()
  await editor.root(page).getByRole('button', { name: 'Undo' }).click()
  await expect(editor.root(page).locator('.attachment-record.removing')).toHaveCount(0)

  // Saving is what finalises the removal.
  await editor.root(page).locator('.attachment-record', { hasText: 'invoice.pdf' }).getByRole('button', { name: 'Remove' }).click()
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()
  await expect(page.locator('.detail-attachments')).toHaveCount(0)
})

test('the library lists every document with the record it belongs to', async ({ page }) => {
  await createWithFiles(page, 'Tea Planet catalogue', textFile('catalogue.pdf'))

  await goTo(page, 'Library')
  const libraryRow = page.locator('.library-row', { hasText: 'catalogue.pdf' })
  await expect(libraryRow).toContainText('PDF')
  await expect(libraryRow).toContainText('Tea Planet catalogue')
  await expect(libraryRow).toContainText('Suppliers')

  // The point of the library is getting back to the record.
  await libraryRow.getByRole('button', { name: /Tea Planet catalogue/ }).click()
  await expect(page.locator('.detail-heading h1')).toHaveText('Tea Planet catalogue')
})

test('the library holds links as well as documents', async ({ page }) => {
  // A link captured from the bar is a thing that lives somewhere else, same as
  // a document, so it has to be findable in the same place.
  await page.locator('.add-button').click()
  await editor.body(page).fill('https://theteaplanet.com/products/popping-boba')
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()

  await goTo(page, 'Library')
  // The starter workspace already carries a Tea Planet link, so this asserts on
  // the one just captured rather than on the host.
  const saved = page.locator('.library-row', { hasText: 'Popping boba' })
  await expect(saved).toBeVisible()
  await expect(saved).toContainText('theteaplanet.com')
  await expect(page.locator('.library-files header')).toContainText('references')

  // And it still points back at the record it came from.
  await saved.getByRole('button', { name: 'Open the record' }).click()
  await expect(page.locator('.detail-page')).toBeVisible()
})

test('a long note reads as writing, not as a headline repeated twice', async ({ page }) => {
  const thought = 'Met the Tea Planet rep today at the Hyderabad office.\nMOQ is 5kg per flavour which is a lot for us starting out.'
  await page.locator('.add-button').click()
  await editor.body(page).fill(thought)
  await editor.save(page).click()
  await page.locator('.inbox .item-row').first().click()

  // The auto-title came from the first words, so it is not printed above them.
  await expect(page.locator('.detail-heading h1')).toHaveCount(0)
  await expect(page.locator('.detail-body-lead')).toContainText('MOQ is 5kg per flavour')
  // "Note" on a note says nothing, so the line under it says only when it last
  // moved.
  await expect(page.locator('.detail-meta')).toHaveText(/^Updated /)
})

test('writing happens on a full page, never in a strip', async ({ page }) => {
  await page.locator('.add-button').click()

  // The + opens a page to write on, not a one-line box that grows. The body is
  // the tallest thing on it, because writing is what this screen is for.
  const body = await editor.body(page).boundingBox()
  expect(body!.height).toBeGreaterThan(200)

  await editor.body(page).fill('Everything I need to ask Tea Planet')
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()
  await expect(row(page, 'Everything I need to ask Tea Planet')).toBeVisible()
})

test('photographs on a record are shown at a size you can read', async ({ page }) => {
  await page.locator('.add-button').click()
  await editor.body(page).fill('Shop near Ibaco — photos from the Saturday visit')
  await filePicker(page).setInputFiles([
    { name: 'storefront.png', mimeType: 'image/png', buffer: Buffer.from('not really a png') },
    textFile('notes.txt'),
  ])
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()

  // A photograph is read by looking at it; a text file is read by opening it.
  // They used to share one list of 40px squares, which served the second and
  // wasted the first — a storefront at 40px might as well not be there.
  await expect(page.locator('.detail-photos h2')).toHaveText('Photo')
  const tile = page.locator('.detail-photo').first()
  await expect(tile).toBeVisible()
  await expect(tile).toContainText('storefront.png')
  const box = (await tile.locator('img, .detail-photo-placeholder').boundingBox())!
  expect(box.width).toBeGreaterThan(180)
  expect(box.height).toBeGreaterThan(120)

  // Paperwork keeps its compact row, and the photo is not listed twice.
  const files = page.locator('.detail-attachments')
  await expect(files.locator('h2')).toHaveText('Files')
  await expect(files).toContainText('notes.txt')
  await expect(files).not.toContainText('storefront.png')
})

test('a photo you have just picked is shown before it is uploaded anywhere', async ({ page }) => {
  await page.locator('.add-button').click()
  await editor.body(page).fill('Shop near Ibaco — Saturday visit')
  await filePicker(page).setInputFiles([
    { name: 'storefront.png', mimeType: 'image/png', buffer: PNG },
    textFile('quote.pdf'),
  ])

  // The file is already in the browser. Waiting for an upload before showing it
  // means a row reading "IMG_4413.jpg · 2.1 MB", which is no way to check you
  // attached the right photo.
  const preview = editor.root(page).locator('.attachment-preview')
  await expect(preview).toHaveCount(1)
  await expect(preview).toHaveAttribute('src', /^blob:/)
  // Paperwork gets no preview: there is nothing to look at.
  await expect(editor.root(page).locator('.attachment-record', { hasText: 'quote.pdf' }).locator('img')).toHaveCount(0)
})

test('a photo that cannot load says so, rather than showing a mute square', async ({ page }) => {
  await page.locator('.add-button').click()
  await editor.body(page).fill('Shop near Ibaco')
  await filePicker(page).setInputFiles([{ name: 'storefront.png', mimeType: 'image/png', buffer: PNG }])
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()

  // The suite runs with no file storage to sign against, which is one of the two
  // reasons a tile can be blank — and it used to be indistinguishable from the
  // other, because both showed the same grey square saying nothing.
  await expect(page.locator('.detail-photo-placeholder')).toContainText('Could not load this photo')
})
