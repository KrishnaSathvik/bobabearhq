import { expect, type Page } from '@playwright/test'

// The suite runs against a build with no Supabase credentials, so the workspace
// lives in localStorage. Clearing it gives every test the same starting point.
export async function openFreshWorkspace(page: Page) {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Home', level: 1 })).toBeVisible()
}

export function nav(page: Page, section: string) {
  return page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: section, exact: true })
}

export const editor = {
  root: (page: Page) => page.locator('form.editor'),
  title: (page: Page) => page.locator('form.editor .title-input'),
  body: (page: Page) => page.getByRole('textbox', { name: 'Write anything…' }),
  save: (page: Page) => page.locator('form.editor').getByRole('button', { name: 'Save' }),
  select: (page: Page, label: string) => page.locator('form.editor label', { hasText: label }).locator('select').first(),
}

export async function createRecord(page: Page, section: string, title: string, body = '') {
  await nav(page, section).click()
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await editor.title(page).fill(title)
  if (body) await editor.body(page).fill(body)
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()
}

export function row(page: Page, title: string) {
  return page.locator('.item-row', { hasText: title })
}
