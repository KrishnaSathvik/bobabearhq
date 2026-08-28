import { expect, test } from '@playwright/test'
import { chooseKind, contentPane, editor, goTo, inboxPane, openFreshWorkspace, row, viewRow , seedReferencePack , seedLaunchTasks } from './helpers'

// Six bugs a person found by using the app, locked so they stay found. Each one
// was invisible to the suite that was green at the time.

test.beforeEach(async ({ page }) => {
  await openFreshWorkspace(page)
})

async function addExpense(page: import('@playwright/test').Page, title: string, amount: string) {
  await goTo(page, 'Money')
  await page.locator('.add-button').click()
  await editor.title(page).fill(title)
  await page.getByRole('spinbutton').first().fill(amount)
  // Deliberately without touching Payment: the default is the bug.
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()
}

// The form showed "Paid" and stored nothing, so the row — which reads the
// stored value — could not say whether anything had been paid.
test('an expense saved without touching payment status stores and shows Paid', async ({ page }) => {
  await addExpense(page, 'Packaging samples', '4500')

  const stored = await page.evaluate(() => {
    const items = JSON.parse(localStorage.getItem('boba-bear-items') ?? '[]')
    return items.find((item: { title: string }) => item.title === 'Packaging samples')?.details?.paymentStatus
  })
  expect(stored, 'the payment status the form claimed was never written').toBe('Paid')

  // And the row says so, rather than leaving the money state a blank.
  await expect(viewRow(page, 'Packaging samples')).toContainText('Paid')
  await expect(viewRow(page, 'Packaging samples')).toContainText('₹4,500')
})

// A line through a title means a piece of work is finished. An expense that is
// paid is not a cancelled expense.
test('a paid expense is never struck through', async ({ page }) => {
  await addExpense(page, 'Packaging samples', '4500')

  // In Money, where you go to read what you have spent.
  await expect(viewRow(page, 'Packaging samples')).not.toHaveClass(/struck/)

  // And in Recent, where it turns up as activity.
  await goTo(page, 'Inbox')
  const inRecent = inboxPane(page).locator('.item-row', { hasText: 'Packaging samples' })
  await expect(inRecent).not.toHaveClass(/struck/)
  await expect(inRecent.locator('.item-copy strong')).toHaveCSS('text-decoration-line', 'none')
})

// The same rule from the other side: a finished task does get the line.
test('a completed task is struck through', async ({ page }) => {
  await seedLaunchTasks(page)
  await goTo(page, 'Launch Checklist')
  const task = page.locator('.checklist-row').first()
  const title = await task.locator('.check-title').innerText()
  await task.locator('.check-toggle').click()
  await expect(task.locator('.check-title')).toHaveCSS('text-decoration-line', 'line-through')

  // And it survives a reload, which is the point: the tick is one stored
  // field, not a mark the list keeps to itself.
  await page.reload()
  await goTo(page, 'Launch Checklist')
  await expect(page.locator('.checklist-row', { hasText: title })).toHaveClass(/checked/)
})

// Rendering the pins on an empty workspace pushed the welcome under the fold,
// with the floating + painted on top of it.
test('an empty workspace shows its welcome above the pins, clear of the button', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('boba-bear-items', '[]'))
  await page.reload()

  const welcome = inboxPane(page).locator('.empty-state.welcome')
  await expect(welcome).toBeVisible()
  await expect(page.locator('.pin-row')).toHaveCount(8)

  // Above the pins, and not underneath the button.
  const welcomeBox = (await welcome.boundingBox())!
  const firstPin = (await page.locator('.pin-row').first().boundingBox())!
  expect(welcomeBox.y, 'the welcome sits below the pins').toBeLessThan(firstPin.y)

  // The + sits on the Inbox line above, so it cannot be painted over anything.
  const add = (await page.locator('.add-button').boundingBox())!
  expect(add.y + add.height, 'the add button is painted over the welcome copy')
    .toBeLessThanOrEqual(welcomeBox.y + 1)
})

// The offer to import a starter sample plan was printed above the suppliers you
// already had.
// The sample tracker used to carry a starter-plan button, which was a second
// way to put records on a screen that already has the floating +. It is gone;
// what is left is the tracker stepping aside once there are suppliers to look
// at, which is the part that was worth keeping.
test('the suppliers screen never says it is empty while showing something', async ({ page }) => {
  // A Suppliers screen holding one supplier note used to announce itself empty
  // twice over: "No samples yet." from the sample tracker, which appeared
  // whenever there were no suppliers rather than whenever there were samples,
  // and "No suppliers yet." underneath it — both directly above the note.
  await goTo(page, 'Suppliers')
  await page.locator('.add-button').click()
  await chooseKind(page, 'Note')
  await editor.body(page).fill('Tea Planet, QQS and Zawaa are the candidates')
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()

  await goTo(page, 'Suppliers')
  expect(await contentPane(page).locator('.item-row').count()).toBeGreaterThan(0)
  await expect(contentPane(page).locator('.view-summary-empty, .quiet-offer, .sample-overview')).toHaveCount(0)

  await seedReferencePack(page)
  await goTo(page, 'Suppliers')
  await expect(viewRow(page, 'The Tea Planet')).toBeVisible()
  await expect(contentPane(page).locator('.view-summary-empty, .quiet-offer')).toHaveCount(0)
})

// The pin read "2 contacts" when both records were notes about marketing.
test('the marketing pin counts contacts, not everything filed there', async ({ page }) => {
  await seedReferencePack(page)

  // The reference pack files two marketing notes and no contacts.
  await goTo(page, 'Inbox')
  await expect(page.locator('.pin-row', { hasText: 'Marketing' })).toContainText('notes')

  await goTo(page, 'Marketing')
  await page.locator('.add-button').click()
  await editor.title(page).fill('Khammam Foodies')
  await editor.save(page).click()

  await goTo(page, 'Inbox')
  await expect(page.locator('.pin-row', { hasText: 'Marketing' })).toContainText('1 contact')
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  // Remember something while reading a supplier, and the one way to write it
  // down should not be two taps away.
  // Every screen wears the same header: the brand, search, and the account.
  // A record used to open on a bare back arrow with a + beside it — a page
  // that did not look like part of the app, offering to add something while
  // you were reading something else.
  test('a record reads like the rest of the app, and offers nothing to add', async ({ page }) => {
    await seedReferencePack(page)

    const header = async (where: string) => {
      const bar = page.locator('.topbar')
      await expect(bar, `${where} has no header`).toBeVisible()
      await expect(bar.locator('.brand')).toContainText('Boba Bear')
      await expect(bar.getByRole('button', { name: 'Account' })).toBeVisible()
    }

    await goTo(page, 'Suppliers')
    await header('a saved view')

    await row(page, 'The Tea Planet').locator('.item-open').click()
    await expect(page.locator('.detail-page')).toBeVisible()
    await header('an open record')

    // Reading a record is not the moment to add one, and the toolbar above it
    // is two controls: the way back, and everything else behind the •••.
    await expect(page.locator('.detail-toolbar .add-button')).toHaveCount(0)
    await expect(page.locator('.detail-toolbar button')).toHaveCount(2)

    // The editor keeps the same header too.
    await page.getByRole('button', { name: 'More actions' }).click()
    await page.locator('.sheet-option', { hasText: 'Edit' }).click()
    await expect(page.locator('form.editor')).toBeVisible()
    await header('the editor')
  })

  // Sighted users saw "Suppliers"; a screen reader was told it was the Inbox.
  test('a view names itself to a screen reader', async ({ page }) => {
    await goTo(page, 'Suppliers')
    await expect(page.getByRole('main', { name: 'Suppliers' })).toBeVisible()
    await goTo(page, 'Inbox')
    await expect(page.getByRole('main', { name: 'Inbox' })).toBeVisible()
  })
})

// The composer's type choices belong to the section it was opened in. They used
// to be read off the draft, which a choice refiles — so the first pick narrowed
// every pick after it, and a second change filed the record in the wrong place.
test.describe('changing your mind in the composer', () => {
  test('the inbox keeps offering every shape after a choice', async ({ page }) => {
    await page.locator('.add-button').click()
    await chooseKind(page, 'Expense')

    await page.locator('.kind-current').getByRole('button', { name: 'Turn into…' }).click()
    await expect(page.locator('.kind-option-name')).toHaveText([
      'Note', 'Task', 'Expense', 'Location', 'Supplier', 'Equipment', 'Marketing', 'Drink',
    ])
  })

  test('a thought reconsidered twice comes back to the inbox', async ({ page }) => {
    await page.locator('.add-button').click()
    await chooseKind(page, 'Expense')
    await chooseKind(page, 'Note')
    await editor.body(page).fill('Ask the landlord whether three-phase power is available')
    await editor.save(page).click()
    await expect(editor.root(page)).toBeHidden()

    // Where a note started from the Inbox belongs — and nowhere near Money.
    await goTo(page, 'Inbox')
    await expect(inboxPane(page).locator('.item-row', { hasText: 'three-phase power' })).toBeVisible()
    await goTo(page, 'Money')
    await expect(contentPane(page).locator('.item-row', { hasText: 'three-phase power' })).toHaveCount(0)
  })

  test('a note started in Money stays in Money', async ({ page }) => {
    await goTo(page, 'Money')
    await page.locator('.add-button').click()
    await chooseKind(page, 'Note')
    await editor.body(page).fill('Keep every receipt photo, the accountant will ask')
    await editor.save(page).click()
    await expect(editor.root(page)).toBeHidden()

    await expect(viewRow(page, 'Keep every receipt photo')).toBeVisible()
  })
})
