import { expect, test } from '@playwright/test'
import { chooseKind, chooseStatus, contentPane, editRecord, editor, goTo, inboxPane, openFreshWorkspace, openGroup, openStoreView, type View , saveThenEdit } from './helpers'

test.beforeEach(async ({ page }) => {
  await openFreshWorkspace(page)
})

test('the avatar opens a small account menu that closes with Escape', async ({ page }) => {
  await expect(page.getByRole('menu')).toHaveCount(0)

  await page.getByRole('button', { name: 'Account' }).click()
  const menu = page.getByRole('menu')
  await expect(menu).toContainText('bobabearkhammam@gmail.com')
  await expect(menu.getByRole('menuitem', { name: 'Sign out' })).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toHaveCount(0)

  // Clicking anywhere else closes it too.
  await page.getByRole('button', { name: 'Account' }).click()
  await expect(page.getByRole('menu')).toBeVisible()
  await inboxPane(page).click({ position: { x: 5, y: 5 } })
  await expect(page.getByRole('menu')).toHaveCount(0)
})

test('locations are compared on the things you argue about', async ({ page }) => {
  await goTo(page, 'Locations')

  for (const property of [
    { title: 'Mamatha Hospital Road shop', rent: '35000', deposit: '200000', parking: 'Two-wheelers only' },
    { title: 'Kaviraj Nagar corner', rent: '28000', deposit: '150000', parking: 'Open frontage' },
  ]) {
    // Each property is written down, then opened and filled in — so the loop
    // comes back to the view each time rather than starting from the record it
    // was last editing.
    await goTo(page, 'Locations')
    await page.locator('.add-button').click()
    await chooseKind(page, 'Location')
    await editor.title(page).fill(property.title)
    await editor.root(page).locator('label', { hasText: /^Monthly rent/ }).locator('input').fill(property.rent)
    await editor.root(page).locator('label', { hasText: /^Deposit/ }).locator('input').fill(property.deposit)
    await chooseStatus(page, 'Shortlisted')
    // Parking is something you find out by going, so it is asked on the saved
    // record rather than on the screen that writes the property down.
    await saveThenEdit(page, property.title)
    await openGroup(page, 'Visit findings')
    await editor.root(page).locator('label', { hasText: /^Parking/ }).locator('input').fill(property.parking)
    await editor.save(page).click()
    await expect(editor.root(page)).toBeHidden()
  }

  await openStoreView(page, 'Locations')
  await page.getByRole('checkbox', { name: 'Select Mamatha Hospital Road shop for comparison' }).check()
  await page.getByRole('checkbox', { name: 'Select Kaviraj Nagar corner for comparison' }).check()
  await page.locator('.location-scouting').getByRole('button', { name: 'Compare', exact: true }).click()

  const table = page.locator('.location-scouting .compare-table')
  const field = (name: string) => table.locator('tr').filter({ has: page.locator('th', { hasText: new RegExp(`^${name}`) }) })
  await expect(field('Monthly rent')).toContainText('₹35,000')
  await expect(field('Monthly rent')).toContainText('₹28,000')
  await expect(field('Deposit')).toContainText('₹2,00,000')
  await expect(field('Deposit')).toContainText('₹1,50,000')
  await expect(field('Parking')).toContainText('Two-wheelers only')
  // The cheaper rent is not automatically the answer.
  await expect(table).not.toContainText('Recommended')
  await expect(table).not.toContainText('Done')
})

test('a part paid purchase counts as spending only for the amount handed over', async ({ page }) => {
  await goTo(page, 'Money')
  await page.locator('.add-button').click()
  await chooseKind(page, 'Expense')
  await editor.title(page).fill('Cup sealer deposit')
  await editor.root(page).locator('label', { hasText: /^Expense amount/ }).locator('input').fill('30000')
  await editor.select(page, 'Payment').selectOption('Part paid')
  await editor.root(page).locator('label', { hasText: /^Paid so far/ }).locator('input').fill('10000')
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()

  const tile = (label: string) => page.locator('.money-totals > span')
    .filter({ has: page.locator('span', { hasText: new RegExp(`^${label}$`) }) }).locator('strong')
  await expect(tile('paid')).toHaveText('₹10,000')
  // A part-paid purchase is money agreed, so what is left is committed rather
  // than merely planned.
  await expect(tile('committed')).toHaveText('₹20,000')
})

// A property's counters count a property's own states. They used to count New,
// Doing, Waiting and Done — the same four a supplier and a drink wore, which
// told you nothing about whether anyone had actually been to the place.
test('location counters follow a property\'s own states and filter the list', async ({ page }) => {
  await goTo(page, 'Locations')

  const addLocation = async (title: string, status: string) => {
    await page.locator('.add-button').click()
    await chooseKind(page, 'Location')
    await editor.title(page).fill(title)
    await chooseStatus(page, status)
    await editor.save(page).click()
    await expect(editor.root(page)).toBeHidden()
  }

  await addLocation('Kaviraj Nagar shortlist', 'Selected')
  await addLocation('Rotary Nagar plan', 'Shortlisted')
  await addLocation('Zudio area idea', 'Considering')

  await openStoreView(page, 'Locations')
  const scouting = page.locator('.location-scouting')
  // Properties and equipment are both piles of options being narrowed down, so
  // they are narrowed the same way: one row of tabs, each carrying its count.
  const stage = (label: string) => scouting.getByRole('tab', { name: new RegExp(`^${label}`) })
  await expect(stage('To visit')).toContainText('0')
  await expect(stage('Considering')).toContainText('1')
  await expect(stage('Shortlisted')).toContainText('1')
  await expect(stage('Selected')).toContainText('1')

  await stage('Shortlisted').click()
  await expect(scouting.locator('.comparison-row')).toHaveCount(1)
  await expect(scouting.locator('.comparison-row')).toContainText('Rotary Nagar plan')
  await stage('All').click()
  await expect(scouting.locator('.comparison-row')).toHaveCount(3)

  // A status nothing holds says so, instead of leaving the page blank.
  await stage('To visit').click()
  await expect(scouting.locator('.comparison-row')).toHaveCount(0)
  await expect(scouting.locator('.comparison-empty')).toContainText('No property is marked')
})

test('money totals read in the order money moves: spent, owed, expected', async ({ page }) => {
  await goTo(page, 'Money')
  // A quote is not spending at all, so with no quotes on file the line is the
  // three numbers about actual money and nothing else.
  await expect(page.locator('.money-totals > span > span')).toHaveText(['paid', 'committed', 'planned'])
})

test('counters read as counts, not as buttons shouting for attention', async ({ page }) => {
  await goTo(page, 'Locations')
  await page.locator('.add-button').click()
  await chooseKind(page, 'Location')
  await editor.title(page).fill('Somewhere to look at')
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()

  await openStoreView(page, 'Locations')
  // The tab you are standing on carries a quiet tint; the ones you are not
  // must stay unpainted. Neither is ever the solid orange of a real action.
  const resting = page.locator('.location-scouting .comparison-tab:not(.active)').first()
  const paint = await resting.evaluate(node => {
    const style = getComputedStyle(node)
    return { background: style.backgroundColor, color: style.color }
  })
  expect(paint.background).toBe('rgba(0, 0, 0, 0)')
  expect(paint.color).not.toBe('rgb(255, 255, 255)')

  // And the widget no longer carries its own duplicate of the section's Add.
  await expect(page.locator('.location-scouting').getByRole('button', { name: /^Add/ })).toHaveCount(0)
  await expect(page.locator('.add-button')).toHaveCount(1)
})

test('every screen offers exactly one way to add', async ({ page }) => {
  const views: View[] = ['Inbox', 'Menu', 'Suppliers', 'Locations', 'Equipment', 'Marketing', 'Money', 'Library']
  for (const view of views) {
    await goTo(page, view)
    // Exactly one way to add, per screen. On most views that is the + on the
    // line naming the screen; on the Launch Checklist it is the row at the foot
    // of the list, which writes a task without opening anything — so that view
    // has no heading + at all, or there would be two plus signs doing one job.
    const adds = await page.locator('.add-button, .checklist-add').count()
    expect(adds, `${view} should offer one add`).toBe(1)
    // A widget may offer to import a starter plan; none of them may offer a
    // second way to add a record.
    await expect(page.locator('.screen').getByRole('button', { name: /^Add$|^Add the first one$/ }), `${view} should not repeat the add`).toHaveCount(0)
  }

  // Pressing + inside a view has already said what you are adding, so the Add
  // screen opens on the fields rather than on the question. The way out, for
  // the shapes no view has a + of its own for, is at the foot of the form.
  await goTo(page, 'Money')
  await page.locator('.add-button').click()
  await expect(page.locator('.kind-current')).toHaveCount(0)
  await expect(editor.root(page).locator('.eyebrow')).toHaveText('New expense · Money')
  await page.locator('.kind-escape > button').click()
  await expect(page.locator('.kind-option-name')).toHaveText(['Quote', 'Expense', 'Note'])
  await expect(page.locator('.kind-options')).toContainText('Money you actually spent')
  await editor.root(page).getByRole('button', { name: /^Back to / }).click()

  await goTo(page, 'Menu')
  await page.locator('.add-button').click()
  await expect(page.locator('.kind-current')).toHaveCount(0)
  await expect(editor.root(page).locator('.eyebrow')).toHaveText('New drink · Menu')
  await editor.root(page).getByRole('button', { name: /^Back to / }).click()

  // Home holds anything, so it leads with a note and keeps the rest one tap
  // away — the writing is never behind the question.
  await goTo(page, 'Inbox')
  await page.locator('.add-button').click()
  await expect(page.locator('.kind-current')).toHaveText('Adding a noteTurn into…')
  await page.locator('.kind-current').getByRole('button', { name: 'Turn into…' }).click()
  await expect(page.locator('.kind-option-name')).toHaveText([
    'Note', 'Task', 'Expense', 'Location', 'Supplier', 'Equipment', 'Marketing', 'Drink',
  ])
})

test('store setup lists each record once, not twice', async ({ page }) => {
  await goTo(page, 'Equipment')
  await page.locator('.add-button').click()
  await chooseKind(page, 'Equipment')
  await editor.title(page).fill('Only once please')
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()

  // It belongs to the equipment widget, so the view must not repeat it in a
  // plain list underneath. (The Inbox on the left lists everything — that is
  // the one list, and it is not a repeat.)
  await expect(contentPane(page).locator('.item-list .item-row', { hasText: 'Only once please' })).toHaveCount(0)
  await openStoreView(page, 'Equipment')
  await expect(page.locator('.comparison-row', { hasText: 'Only once please' })).toHaveCount(1)

  // Moved to another section it reappears in that section's list, or it would
  // be unreachable.
  await page.locator('.comparison-row', { hasText: 'Only once please' }).getByRole('button', { name: /Only once please/ }).click()
  await editRecord(page)
  await openGroup(page, 'Filing')
  await editor.select(page, 'Belongs to').selectOption('Notes')
  await editor.save(page).click()
  await goTo(page, 'Inbox')
  await expect(page.locator('.item-list .item-row', { hasText: 'Only once please' })).toHaveCount(1)
})

test('the pinned views are the whole navigation system', async ({ page }) => {
  // Eight pins and no tabs. Each one says what is inside it in its own words,
  // which is the job the six section tabs used to do badly.
  const pins = page.locator('.pin-row')
  await expect(pins).toHaveCount(8)
  await expect(pins.locator('strong')).toHaveText([
    'Launch Checklist', 'Menu', 'Suppliers', 'Locations',
    'Equipment', 'Money', 'Marketing', 'Library',
  ])

  // Nothing is stacked on the home screen: the widgets live inside their view.
  await expect(page.locator('.launch-checklist')).toHaveCount(0)
  await expect(page.locator('.equipment-comparison')).toHaveCount(0)
  await expect(page.locator('.location-scouting')).toHaveCount(0)

  await goTo(page, 'Equipment')
  await page.locator('.add-button').click()
  await editor.title(page).fill('Counter fridge')
  await chooseStatus(page, 'Comparing')
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()

  // The pin now counts what is inside it.
  await goTo(page, 'Inbox')
  await expect(pins.filter({ hasText: 'Equipment' }).locator('small')).toHaveText('1 item')

  await goTo(page, 'Equipment')
  await expect(page.locator('.equipment-comparison')).toBeVisible()
  // A single option has nothing to compare against, so the compare bar stays away.
  await expect(page.locator('.comparison-toolbar')).toHaveCount(0)

  // One way out of a view, and it goes to the one place there is to go.
  await page.locator('.screen .detail-back').click()
  await expect(page.getByRole('heading', { name: 'Inbox', level: 1 })).toBeVisible()
})

test('every view opens its add on the thing that view is for', async ({ page }) => {
  const expected: Array<[View, string]> = [
    ['Menu', 'New drink · Menu'],
    ['Suppliers', 'New supplier · Suppliers'],
    ['Equipment', 'New equipment · Store Setup'],
    ['Locations', 'New location · Store Setup'],
    // A marketing record lives in Marketing, so the headline says it once.
    ['Marketing', 'New marketing'],
    ['Money', 'New expense · Money'],
    // Library creates nothing of its own any more: a document is a note with a
    // file on it, and the Library indexes attachments wherever they hang.
    ['Library', 'Add to Library'],
  ]

  for (const [section, headline] of expected) {
    await goTo(page, section)
    await page.locator('.add-button').click()
    // The headline says what is being added, and "equipment" takes no article.
    await expect(editor.root(page).locator('.eyebrow')).toHaveText(headline)
    // Adding is capture. The + already said what this is, so the screen does
    // not open by asking again — the line that used to do that is gone from
    // every view, and survives only on the Inbox, where the + cannot know.
    await expect(editor.root(page).locator('.kind-current')).toHaveCount(0)
    // And it opens on a handful of fields rather than on the whole record:
    // the folded groups belong to a record that exists.
    await expect(editor.root(page).locator('.editor-group-head'),
      `${section} opens its add on folded groups`).toHaveCount(0)
    await editor.root(page).getByRole('button', { name: /^Back to / }).click()
  }

  // Home leads with a note and says so, and the caret is already in the
  // writing rather than in a list of things this might turn out to be.
  await goTo(page, 'Inbox')
  await page.locator('.add-button').click()
  await expect(editor.root(page).locator('.eyebrow')).toHaveText('Add to Inbox')
  await expect(editor.root(page).locator('.kind-current')).toContainText('Adding a note')
  await expect(editor.body(page)).toBeFocused()
})

test('a list reads as records, not as a dashboard', async ({ page }) => {
  await goTo(page, 'Suppliers')
  const add = async (title: string, kind: string, fill: (page: import('@playwright/test').Page) => Promise<void>) => {
    await page.locator('.add-button').click()
    await chooseKind(page, kind)
    await editor.title(page).fill(title)
    await fill(page)
    await editor.save(page).click()
    await expect(editor.root(page)).toBeHidden()
  }

  await add('The Tea Planet', 'Supplier', async () => {
    await editor.root(page).locator('label', { hasText: /^Location/ }).locator('input').fill('Hyderabad')
  })
  // Who you actually speak to is something you learn from the conversation, so
  // it is asked on the supplier rather than on the screen that creates one.
  await page.locator('.item-open').filter({ hasText: 'The Tea Planet' }).first().click()
  await editRecord(page)
  await openGroup(page, 'Supplier contact')
  await editor.root(page).locator('label', { hasText: /^Contact person/ }).locator('input').fill('Sales desk')
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()
  await goTo(page, 'Suppliers')

  // The row says what the record is, not the first line of its body.
  const supplierRow = page.locator('.item-row', { hasText: 'The Tea Planet' }).first()
  await expect(supplierRow).toContainText('Hyderabad')

  // Every supplier sits at Researching, so a column repeating it is noise.
  await goTo(page, 'Suppliers')
  await add('QQS Bubble Tea', 'Supplier', async () => {})
  await expect(page.locator('.item-meta')).toHaveCount(0)

  // A decision is worth showing, even on its own.
  await supplierRow.click()
  await editRecord(page)
  await chooseStatus(page, 'Contacted')
  await editor.save(page).click()
  await goTo(page, 'Suppliers')
  await expect(page.locator('.item-row', { hasText: 'The Tea Planet' }).first()).toContainText('Contacted')

  // No onboarding cards and no metric tiles anywhere in the view. A heading
  // that groups records — "Notes" here, "Documents" in the Library, "Recent" in
  // Money — is not a tile; it is what stops two different lists reading as one.
  await expect(page.locator('.sample-empty')).toHaveCount(0)
  await expect(contentPane(page).locator('.pin-row')).toHaveCount(0)
  await expect(contentPane(page).locator('.money-totals, .empty-state.welcome')).toHaveCount(0)
  await expect(contentPane(page).locator('.eyebrow')).toHaveText(['Notes'])
})

test('a focused view says its own name and gives itself back after a detour', async ({ page }) => {
  await openStoreView(page, 'Locations')

  // One place, one name, one way back out of it — not the section's title and
  // the section's count with a second back link stacked underneath.
  await expect(page.getByRole('heading', { name: 'Locations', level: 1 })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Store Setup', level: 1 })).toHaveCount(0)
  await expect(page.locator('.screen .detail-back')).toHaveCount(1)

  // Add here offers a property, not whatever Store Setup happens to lead with.
  await page.locator('.add-button').click()
  await expect(editor.root(page).locator('.eyebrow')).toHaveText('New location · Store Setup')
  await editor.title(page).fill('Wyra Road corner')
  await editor.save(page).click()
  await expect(editor.root(page)).toBeHidden()
  // Saving comes back to the properties, not to the section's front page.
  await expect(page.locator('.location-scouting')).toBeVisible()

  // Reading one of them takes the same pane the properties were filling, and
  // says where Back goes — the view you came from, not a generic list.
  await page.locator('.comparison-open', { hasText: 'Wyra Road corner' }).click()
  await expect(contentPane(page).locator('.detail-page')).toBeVisible()
  await expect(page.locator('.location-scouting')).toHaveCount(0)
  await page.getByRole('button', { name: 'Back to Locations' }).click()
  await expect(page.locator('.location-scouting')).toBeVisible()

  // The Inbox never left the other side while any of that happened.
  await expect(inboxPane(page).locator('.pin-row', { hasText: 'Locations' })).toBeVisible()

  // There is no Store Setup any more — this place is called what it holds.
  await expect(page.getByRole('heading', { name: 'Store Setup', level: 1 })).toHaveCount(0)
})

test('nothing inside a view adds a record; the + is the only way', async ({ page }) => {
  // Every starter pack is gone, so there is nothing left inside a view that
  // puts records on the screen. A plan you did not write is a plan you cannot
  // trust, and the + writes one task as easily as it writes anything else.
  const addsInside = async (view: View) => {
    await goTo(page, view)
    return contentPane(page).getByRole('button')
      .filter({ hasText: /^Add|starter plan|search areas/i })
      .allInnerTexts()
  }

  expect(await addsInside('Locations')).toEqual([])
  expect(await addsInside('Suppliers')).toEqual([])
  expect(await addsInside('Menu')).toEqual([])
  expect(await addsInside('Equipment')).toEqual([])
  expect(await addsInside('Money')).toEqual([])
  expect(await addsInside('Marketing')).toEqual([])

  expect(await addsInside('Launch Checklist')).toEqual([])
  expect(await addsInside('Library')).toEqual([])
})
