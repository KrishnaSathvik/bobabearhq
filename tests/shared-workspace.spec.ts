import { expect, test, type Page } from '@playwright/test'

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
    await page.getByRole('button', { name: 'Sign in' }).click()
  }
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible()
}

async function createNote(page: Page, title: string) {
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Notes', exact: true }).click()
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await page.locator('form.editor .title-input').fill(title)
  await page.locator('form.editor').getByRole('button', { name: 'Save' }).click()
  await expect(page.locator('form.editor')).toBeHidden()
}

async function deleteRecord(page: Page, title: string) {
  await page.locator('.item-row', { hasText: title }).first().click()
  await page.getByRole('button', { name: 'Edit' }).click()
  await page.locator('form.editor').getByRole('button', { name: 'Delete', exact: true }).click()
  await page.locator('form.editor').getByRole('button', { name: 'Delete permanently' }).click()
}

test('wrong credentials are rejected with a visible reason', async ({ page }) => {
  await page.goto(baseURL!)
  await page.getByRole('textbox', { name: 'Password' }).fill('definitely-not-the-password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeHidden()
})

test('workspace content is hidden until signed in', async ({ page }) => {
  await page.goto(baseURL!)
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeHidden()
})

test('a session survives a reload and sign out returns to the login screen', async ({ page }) => {
  await signIn(page)
  await page.reload()
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible()

  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Sign out of the shared account' }).click()
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
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
    await second.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Notes', exact: true }).click()

    await createNote(first, title)
    await expect(second.locator('.item-row', { hasText: title })).toBeVisible({ timeout: 15_000 })

    await first.locator('.item-row', { hasText: title }).first().click()
    await first.getByRole('button', { name: 'Edit' }).click()
    await first.locator('form.editor .title-input').fill(`${title} edited`)
    await first.locator('form.editor').getByRole('button', { name: 'Save' }).click()
    await expect(second.locator('.item-row', { hasText: `${title} edited` })).toBeVisible({ timeout: 15_000 })

    await first.getByRole('button', { name: 'Edit' }).click()
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
    await second.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Notes', exact: true }).click()
    await expect(second.locator('.item-row', { hasText: title })).toBeVisible({ timeout: 15_000 })
    await second.locator('.item-row', { hasText: title }).first().click()

    await first.locator('.item-row', { hasText: title }).first().click()
    await first.getByRole('button', { name: 'Edit' }).click()
    const chooser = first.waitForEvent('filechooser')
    await first.locator('form.editor').getByText('Attach files').click()
    await (await chooser).setFiles({ name: 'e2e-upload.txt', mimeType: 'text/plain', buffer: Buffer.from('e2e') })
    await first.locator('form.editor').getByRole('button', { name: 'Save' }).click()

    await expect(second.getByRole('button', { name: 'e2e-upload.txt' })).toBeVisible({ timeout: 15_000 })

    first.once('dialog', dialog => dialog.accept())
    await first.getByRole('button', { name: 'Edit' }).click()
    await first.locator('.attachment-record').getByRole('button', { name: 'Remove' }).first().click()
    await expect(second.getByRole('button', { name: 'e2e-upload.txt' })).toHaveCount(0, { timeout: 15_000 })

    await first.locator('form.editor').getByRole('button', { name: 'Close editor' }).click().catch(() => undefined)
    await first.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Notes', exact: true }).click()
    await deleteRecord(first, title)
  } finally {
    await one.close()
    await two.close()
  }
})
