import { expect, test, type Page } from '@playwright/test'
import { editRecord, goTo, row } from './helpers'

// These are the flows that only exist when the app is wired to Supabase:
// the login boundary, cross-session sync, and file upload. They run against a
// real project, so they are opt-in and skipped unless credentials are supplied:
//
//   BOBA_E2E_URL=http://localhost:4173 \
//   BOBA_E2E_PASSWORD=... \
//   npx playwright test tests/shared-workspace.spec.ts --config playwright.supabase.config.ts
//
// Point BOBA_E2E_URL at a build made with real Supabase credentials. Prefer a
// scratch Supabase project: these tests create and delete records.
const password = process.env.BOBA_E2E_PASSWORD
const baseURL = process.env.BOBA_E2E_URL

test.skip(!password || !baseURL, 'Set BOBA_E2E_URL and BOBA_E2E_PASSWORD to run the shared-workspace tests.')

const unique = () => `E2E ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

async function signIn(page: Page) {
  await page.goto(baseURL!)
  const passwordField = page.getByRole('textbox', { name: 'Password' })
  if (await passwordField.isVisible().catch(() => false)) {
    await passwordField.fill(password!)
    await page.getByRole('button', { name: 'Log in' }).click()
  }
  await expect(page.getByRole('heading', { name: 'Inbox', level: 1 })).toBeVisible()
}

async function createNote(page: Page, title: string) {
  await goTo(page, 'Inbox')
  await page.locator('.add-button').click()
  await page.locator('form.editor .title-input').fill(title)
  await page.locator('form.editor').getByRole('button', { name: 'Save' }).click()
  await expect(page.locator('form.editor')).toBeHidden()
}

async function deleteRecord(page: Page, title: string) {
  await row(page, title).first().locator('.item-open').click()
  await editRecord(page)
  await page.locator('form.editor').getByRole('button', { name: 'Delete', exact: true }).click()
  await page.locator('form.editor').getByRole('button', { name: 'Delete permanently' }).click()
}

test('wrong credentials are rejected with a visible reason', async ({ page }) => {
  await page.goto(baseURL!)
  await page.getByRole('textbox', { name: 'Password' }).fill('definitely-not-the-password')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Inbox', level: 1 })).toBeHidden()
})

test('workspace content is hidden until signed in', async ({ page }) => {
  await page.goto(baseURL!)
  await expect(page.getByRole('heading', { name: 'Shared workspace' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Inbox', level: 1 })).toBeHidden()
})

test('a session survives a reload and sign out returns to the login screen', async ({ page }) => {
  await signIn(page)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Inbox', level: 1 })).toBeVisible()

  await page.getByRole('button', { name: 'Account' }).click()
  await expect(page.getByRole('menu')).toContainText('bobabearkhammam@gmail.com')
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await expect(page.getByRole('heading', { name: 'Shared workspace' })).toBeVisible()

  // Back must not walk into the workspace behind the login form.
  await page.goBack().catch(() => undefined)
  await expect(page.getByRole('heading', { name: 'Inbox', level: 1 })).toBeHidden()
})

test('records, edits and deletes reach the other session without a reload', async ({ browser }) => {
  const one = await browser.newContext()
  const two = await browser.newContext()
  const first = await one.newPage()
  const second = await two.newPage()
  const title = unique()

  try {
    await signIn(first)
    await signIn(second)
    await goTo(second, 'Inbox')

    await createNote(first, title)
    await expect(second.locator('.item-row', { hasText: title })).toBeVisible({ timeout: 15_000 })

    await first.locator('.item-row', { hasText: title }).first().locator('.item-open').click()
    await editRecord(first)
    await first.locator('form.editor .title-input').fill(`${title} edited`)
    await first.locator('form.editor').getByRole('button', { name: 'Save' }).click()
    await expect(second.locator('.item-row', { hasText: `${title} edited` })).toBeVisible({ timeout: 15_000 })

    await editRecord(first)
    await first.locator('form.editor').getByRole('button', { name: 'Delete', exact: true }).click()
    await first.locator('form.editor').getByRole('button', { name: 'Delete permanently' }).click()
    await expect(second.locator('.item-row', { hasText: title })).toHaveCount(0, { timeout: 15_000 })
  } finally {
    await one.close()
    await two.close()
  }
})

test('an attachment added in one session appears in the other, and removal propagates', async ({ browser }) => {
  const one = await browser.newContext()
  const two = await browser.newContext()
  const first = await one.newPage()
  const second = await two.newPage()
  const title = unique()

  try {
    await signIn(first)
    await signIn(second)
    await createNote(first, title)

    // Sit on the record's page in the other session: this is where a missing
    // attachment event used to leave a stale page.
    await goTo(second, 'Inbox')
    await expect(second.locator('.item-row', { hasText: title })).toBeVisible({ timeout: 15_000 })
    await second.locator('.item-row', { hasText: title }).first().locator('.item-open').click()

    await first.locator('.item-row', { hasText: title }).first().locator('.item-open').click()
    await editRecord(first)
    const chooser = first.waitForEvent('filechooser')
    await first.locator('form.editor').getByText('Attach files').click()
    await (await chooser).setFiles({ name: 'e2e-upload.txt', mimeType: 'text/plain', buffer: Buffer.from('e2e') })
    await first.locator('form.editor').getByRole('button', { name: 'Save' }).click()

    await expect(second.getByRole('button', { name: 'e2e-upload.txt' })).toBeVisible({ timeout: 15_000 })

    // Removal is staged: the other session must not lose the file until Save.
    await editRecord(first)
    await first.locator('.attachment-record').getByRole('button', { name: 'Remove' }).first().click()
    await expect(first.locator('.attachment-record.removing')).toBeVisible()
    await expect(second.getByRole('button', { name: 'e2e-upload.txt' })).toBeVisible()

    await first.locator('form.editor').getByRole('button', { name: 'Save' }).click()
    await expect(second.getByRole('button', { name: 'e2e-upload.txt' })).toHaveCount(0, { timeout: 15_000 })

    await goTo(first, 'Inbox')
    await deleteRecord(first, title)
  } finally {
    await one.close()
    await two.close()
  }
})

test('a checklist box ticked in one session ticks in the other', async ({ browser }) => {
  const one = await browser.newContext()
  const two = await browser.newContext()
  const first = await one.newPage()
  const second = await two.newPage()
  const title = unique()

  try {
    await signIn(first)
    await signIn(second)

    // A checklist task is just a record, created here so the test never depends
    // on the imported plan being present.
    await goTo(first, 'Launch Checklist')
    await first.locator('.add-button').click()
    await first.locator('form.editor .title-input').fill(title)
    await first.locator('form.editor').getByRole('button', { name: 'Save' }).click()
    await expect(first.locator('form.editor')).toBeHidden()

    await goTo(second, 'Launch Checklist')
    const otherRow = second.locator('.checklist-row', { hasText: title })
    await expect(otherRow).toBeVisible({ timeout: 15_000 })

    await first.locator('.checklist-row', { hasText: title }).getByRole('button', { name: `Mark ${title} complete` }).click()
    await expect(otherRow).toHaveClass(/checked/, { timeout: 15_000 })
  } finally {
    await one.close()
    await two.close()
  }
})

test('a link made in one session shows on both records in the other', async ({ browser }) => {
  const one = await browser.newContext()
  const two = await browser.newContext()
  const first = await one.newPage()
  const second = await two.newPage()
  const supplier = unique()
  const machine = unique()

  try {
    await signIn(first)
    await signIn(second)

    await createNote(first, supplier)
    await createNote(first, machine)

    await first.locator('.item-row', { hasText: machine }).first().locator('.item-open').click()
    await editRecord(first)
    const related = first.locator('form.editor .related-area')
    await related.locator('label', { hasText: 'Relationship' }).locator('select').selectOption('Supplied by')
    await related.locator('label', { hasText: 'Record' }).locator('select').selectOption({ label: `${supplier} — Note · Inbox` })
    await related.getByRole('button', { name: 'Link another record' }).click()
    await first.locator('form.editor').getByRole('button', { name: 'Save' }).click()
    await expect(first.locator('form.editor')).toBeHidden()

    // The other session sees it from the record at the far end of the link.
    await goTo(second, 'Inbox')
    await expect(second.locator('.item-row', { hasText: supplier })).toBeVisible({ timeout: 15_000 })
    await second.locator('.item-row', { hasText: supplier }).first().locator('.item-open').click()
    await expect(second.locator('.detail-related')).toContainText(machine, { timeout: 15_000 })

    await goTo(second, 'Inbox')
    await deleteRecord(second, machine)
    await goTo(second, 'Inbox')
    await deleteRecord(second, supplier)
  } finally {
    await one.close()
    await two.close()
  }
})

// The last two steps of the smoke test: money that has to add up in both
// sessions, and finding it again months later from the other person's screen.
test('an expense reaches the other session, counts in its totals, and is searchable there', async ({ browser }) => {
  const one = await browser.newContext()
  const two = await browser.newContext()
  const first = await one.newPage()
  const second = await two.newPage()
  const title = unique()

  try {
    await signIn(first)
    await signIn(second)

    // The + inside Money adds an expense, so there is no type to choose.
    await goTo(first, 'Money')
    await first.locator('.add-button').click()
    await first.locator('form.editor .title-input').fill(title)
    await first.getByRole('spinbutton').first().fill('4500')
    await first.locator('form.editor').getByRole('button', { name: 'Save' }).click()
    await expect(first.locator('form.editor')).toBeHidden()

    // The other session sees the record and the money it moved, without a reload.
    await goTo(second, 'Money')
    await expect(second.locator('.item-row', { hasText: title })).toBeVisible({ timeout: 15_000 })
    await expect(second.locator('.money-totals')).toContainText('₹4,500', { timeout: 15_000 })

    // And the pin on the other session's Inbox counts it too.
    await goTo(second, 'Inbox')
    await expect(second.locator('.pin-row', { hasText: 'Money' })).toContainText('spent', { timeout: 15_000 })

    // Search is how it is found again when nobody remembers where it was filed.
    await second.getByRole('textbox', { name: 'Search Boba Bear' }).fill(title)
    const found = second.locator('.item-row', { hasText: title })
    await expect(found).toBeVisible()
    await expect(found).toContainText('Expense')

    await goTo(second, 'Money')
    await deleteRecord(second, title)
  } finally {
    await one.close()
    await two.close()
  }
})
