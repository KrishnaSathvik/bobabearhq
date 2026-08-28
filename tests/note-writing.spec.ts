import { expect, test } from '@playwright/test'
import { chooseKind, editRecord, editor, goTo, inboxPane, openFreshWorkspace, openRow } from './helpers'

// A note is writing, and writing includes boxes.
//
// This was the drift that started the whole conformance pass. The editor was a
// bare textarea, the record-level NEXT STEPS list was hidden until a record was
// marked Done, and the two facts together meant a plain note could only grow a
// checklist after you had declared yourself finished with it. The interaction
// these tests describe — type, press ☑︎, keep typing — is the one the app was
// designed around and had quietly lost.

test.beforeEach(async ({ page }) => {
  await openFreshWorkspace(page)
})

const body = (page: import('@playwright/test').Page) => page.locator('form.editor .body-input')
const bodyValue = (page: import('@playwright/test').Page) => body(page).inputValue()

test('a note grows a checklist while it is being written', async ({ page }) => {
  await page.locator('.add-button').click()
  // The caret starts in the writing, and the tools are under it.
  await expect(body(page)).toBeFocused()
  await expect(editor.root(page).getByRole('group', { name: 'Writing tools' })).toBeVisible()

  await body(page).pressSequentially('Tea Planet sample call')
  await page.keyboard.press('Enter')
  await editor.root(page).getByRole('button', { name: 'Checklist' }).click()
  await body(page).pressSequentially('Ask MOQ')

  // Enter carries the list on, so the second box costs one key rather than a
  // trip back to the toolbar.
  await page.keyboard.press('Enter')
  await body(page).pressSequentially('Ask sample pricing')
  await page.keyboard.press('Enter')
  await body(page).pressSequentially('Ask delivery charge')
  expect(await bodyValue(page)).toBe('Tea Planet sample call\n☐ Ask MOQ\n☐ Ask sample pricing\n☐ Ask delivery charge')

  // Enter on an empty box is how you say "that's the lot" — the box comes off
  // and the writing carries on as writing.
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  expect(await bodyValue(page)).toBe('Tea Planet sample call\n☐ Ask MOQ\n☐ Ask sample pricing\n☐ Ask delivery charge\n')
  await body(page).pressSequentially('Call after 4pm')
  expect(await bodyValue(page)).toContain('☐ Ask delivery charge\nCall after 4pm')
})

test('boxes written into a note are read back as boxes, and tick in place', async ({ page }) => {
  await page.locator('.add-button').click()
  await body(page).fill('Tea Planet sample call\n☐ Ask MOQ\n☐ Ask sample pricing')
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()

  // The title is taken from the writing, and a marker is not part of a name.
  await expect(page.locator('.detail-heading h1, .detail-body-lead').first()).toContainText('Tea Planet sample call')

  const first = page.getByRole('button', { name: 'Mark Ask MOQ done' })
  await expect(first).toBeVisible()
  await first.click()
  await expect(page.getByRole('button', { name: 'Mark Ask MOQ not done' })).toBeVisible()

  // Ticking is a save, like ticking anything else in the app.
  await page.reload()
  await openRow(page, 'Tea Planet sample call')
  await expect(page.getByRole('button', { name: 'Mark Ask MOQ not done' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mark Ask sample pricing done' })).toBeVisible()
})

test('a note is not asked to structure itself twice', async ({ page }) => {
  await page.locator('.add-button').click()
  await body(page).fill('Ask Tea Planet about black tapioca\n☐ Ask MOQ')
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()

  // The boxes are in the writing where they belong, so the record-level list is
  // not offered alongside them. One sentence with two invitations to become a
  // form is what made capture feel like filing.
  await expect(page.locator('.body-task')).toHaveCount(1)
  await expect(page.locator('.record-checklist')).toHaveCount(0)
  await expect(page.locator('.record-checklist-offer')).toHaveCount(0)
})

test('a note carries no status at all, and a record carries its own', async ({ page }) => {
  await page.locator('.add-button').click()
  // A note is not at a stage in anything. It is a thing you wrote. If it turns
  // out to need finishing, it becomes a task — which is why tasks exist.
  await expect(editor.root(page).locator('.status-chip')).toHaveCount(0)
  // And with no status, no filing and nothing yet to link to, + Details would
  // open onto an empty space — so it is not offered until there is an answer.
  await expect(editor.root(page).locator('.write-tool-details')).toHaveCount(0)

  await editor.body(page).fill('Their Hyderabad depot is closer than New Delhi')
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()
  await openRow(page, 'Hyderabad depot')
  await editRecord(page)
  await editor.root(page).locator('.write-tool-details').click()
  await expect(editor.root(page).locator('.editor-group-head', { hasText: 'Filing' })).toBeVisible()
  await expect(editor.root(page).locator('.status-chip')).toHaveCount(0)
  await editor.root(page).getByRole('button', { name: /^Back to / }).click()

  // A supplier is fields, so its fields are on the page and there is nothing to
  // disclose. The writing tools are still there.
  await openFreshWorkspace(page)
  await goTo(page, 'Suppliers')
  await page.locator('.add-button').click()
  await chooseKind(page, 'Supplier')
  await expect(editor.root(page).locator('.write-tool-details')).toHaveCount(0)
  await expect(editor.root(page).getByRole('button', { name: 'Checklist' })).toBeVisible()
  await expect(editor.root(page).locator('.status-chip')).toHaveCount(5)
})

test('the Aa menu marks a line without disturbing the rest of the writing', async ({ page }) => {
  await page.locator('.add-button').click()
  await body(page).pressSequentially('Sample call notes')
  await page.keyboard.press('Enter')
  await editor.root(page).getByRole('button', { name: 'Text style' }).click()
  await page.getByRole('menuitem', { name: 'Bulleted list' }).click()
  await body(page).pressSequentially('Bring our own cups')
  expect(await bodyValue(page)).toBe('Sample call notes\n• Bring our own cups')

  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()
  await expect(page.locator('.body-bullet')).toContainText('Bring our own cups')
})

// ── Pasting from somewhere else ─────────────────────────────────────────────

// A dispatched paste does not carry the browser's own insertion with it, so
// this reports whether the app took the event over. Text the app leaves alone
// is inserted by the browser in real use and by nothing at all in here — which
// is exactly the difference the second test is checking for.
async function paste(page: import('@playwright/test').Page, text: string) {
  await page.locator('form.editor .body-input').focus()
  return page.evaluate(value => {
    const field = document.querySelector('.body-input') as HTMLTextAreaElement
    const data = new DataTransfer()
    data.setData('text/plain', value)
    const event = new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true })
    field.dispatchEvent(event)
    return event.defaultPrevented
  }, text)
}

test('a document pasted from somewhere else arrives as writing, not as punctuation', async ({ page }) => {
  await page.locator('.add-button').click()
  await paste(page, [
    '# Boba Bear — Daily Prep',
    '',
    '## Store Timing',
    '',
    '**Staff arrives:** 8:30 AM',
    '',
    '* Wash hands',
    '* Check ice level',
    '',
    '---',
    '',
    '### Batch 1',
    '',
    '1. Choose drink',
    '2. Choose flavor',
    '',
    '- [ ] Confirm the MOQ',
    '- [x] Ask for samples',
    '',
    '> Do not over-steep Jasmine tea.',
    '',
    'See the [guide](https://theteaplanet.com/g) for `MOQ` details.',
  ].join('\n'))

  // Nothing the app cannot express is left lying in the text. `#` and `##` are
  // this app's own two heading markers, so they are what a heading should have
  // become — everything below is markdown it has no way to say.
  const written = await body(page).inputValue()
  expect(written).not.toMatch(/\*\*|`|~~|^>|^\s*---\s*$|^\s*[-*+]\s|^#{3,}\s|\]\(/m)
  expect(written).toContain('# Boba Bear — Daily Prep')
  expect(written).toContain('## Store Timing')
  expect(written).toContain('Staff arrives: 8:30 AM')
  expect(written).toContain('• Wash hands')
  expect(written).toContain('1. Choose drink')
  // A box pasted as a box is a box.
  expect(written).toContain('☐ Confirm the MOQ')
  expect(written).toContain('☑ Ask for samples')
  // A reference keeps its address; losing it loses the reference.
  expect(written).toContain('See the guide (https://theteaplanet.com/g) for MOQ details.')

  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()

  // Two heading levels, so a section and a sub-block inside it still read as
  // different things after the paste.
  await expect(page.locator('.body-heading').first()).toHaveText('Boba Bear — Daily Prep')
  await expect(page.locator('.body-subheading').first()).toHaveText('Store Timing')
  await expect(page.locator('.body-bullet').first()).toContainText('Wash hands')
  await expect(page.getByRole('button', { name: 'Mark Confirm the MOQ done' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mark Ask for samples not done' })).toBeVisible()
  await expect(page.locator('.detail-body')).not.toContainText('**')
})

test('pasting ordinary writing changes nothing about it', async ({ page }) => {
  await page.locator('.add-button').click()
  // A paste is not an invitation to reformat somebody's writing. The asterisk
  // and the dash here are punctuation, not markup.
  const plain = 'Rang the Tea Planet number at 4pm, no answer.\nTry again tomorrow before the sample order goes in.'
  expect(await paste(page, plain)).toBe(false)

  // And a document does get taken over, so the two paths are really different.
  expect(await paste(page, '## Store Timing\n\n**Staff arrives:** 8:30 AM')).toBe(true)
})

test('a link written into a note is a link you can press', async ({ page }) => {
  await page.locator('.add-button').click()
  await paste(page, 'Compare [two-cup carrier](https://store.yenchuan.co/carrier-2-cups) against\nhttps://cafepack.com.tr/cup-holder before deciding.')
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()

  const links = page.locator('.detail-body a.body-link')
  await expect(links).toHaveCount(2)
  await expect(links.first()).toHaveAttribute('href', 'https://store.yenchuan.co/carrier-2-cups')
  await expect(links.first()).toHaveAttribute('target', '_blank')
  // The full stop belongs to the sentence, not to the address.
  await expect(links.nth(1)).toHaveAttribute('href', 'https://cafepack.com.tr/cup-holder')

  // Tapping the writing opens it for writing. Tapping a link inside the writing
  // must not, or the link is unreachable.
  await links.first().click({ modifiers: ['Alt'] })
  await expect(editor.root(page)).toBeHidden()
})

test('a row shows the writing, not the marks that give it structure', async ({ page }) => {
  await page.locator('.add-button').click()
  await body(page).fill('# Boba Bear — Daily Prep\n\n## Store Timing\n\n• Wash hands\n☐ Confirm the MOQ')
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()

  // A marker is structure, and structure needs a page to be structure on. On one
  // line of a list "## Store Timing" is not a heading — it is two hashes to read
  // past, which is what the Inbox was showing.
  const preview = inboxPane(page).locator('.item-row', { hasText: 'Daily Prep' }).locator('.item-copy > *').nth(1)
  await expect(preview).not.toContainText('#')
  await expect(preview).not.toContainText('•')
  await expect(preview).not.toContainText('☐')
  await expect(preview).toContainText('Store Timing')
  await expect(preview).toContainText('Confirm the MOQ')

  // Opened, the same writing is a heading, a sub-heading, a bullet and a box.
  await openRow(page, 'Daily Prep')
  await expect(page.locator('.body-heading')).toHaveText('Boba Bear — Daily Prep')
  await expect(page.locator('.body-subheading')).toHaveText('Store Timing')
  await expect(page.locator('.body-bullet')).toContainText('Wash hands')
  await expect(page.getByRole('button', { name: 'Mark Confirm the MOQ done' })).toBeVisible()
})
