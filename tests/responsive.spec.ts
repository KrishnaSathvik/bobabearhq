import { expect, test, type Page } from '@playwright/test'
import { contentPane, createRecord, editor, goTo, openFreshWorkspace, openRow } from './helpers'

// Phones are where most of this gets used, so every width has to hold the same
// promise: nothing clipped, nothing sideways, and Save always reachable.
// The awkward widths matter more than the round ones: 820 and 900 are where a
// header stops fitting long before anyone tests a phone.
const widths = [1440, 1280, 1100, 1024, 900, 820, 768, 430, 390, 375]

async function assertNoHorizontalOverflow(page: Page, label: string, width: number) {
  const result = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    offenders: Array.from(document.querySelectorAll('*'))
      .filter(element => element.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
      .slice(0, 6)
      .map(element => `${element.tagName}.${(element.className || '').toString().split(' ')[0]}`),
  }))
  expect(result.scrollWidth, `${label} at ${width}px scrolls sideways: ${result.offenders.join(', ')}`)
    .toBeLessThanOrEqual(result.clientWidth + 1)
}

for (const width of widths) {
  test(`the workspace fits a ${width}px screen`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await openFreshWorkspace(page)

    const account = await page.getByRole('button', { name: 'Account' }).boundingBox()
    expect(account!.x + account!.width, `the account button is cut off at ${width}px`).toBeLessThanOrEqual(width + 1)

    // Not-broken is not the promise. The promise is that the one thing you do
    // most is always on screen — on the line that names the screen now, rather
    // than floating over the bottom-right corner of whatever you were reading.
    const add = page.locator('.add-button')
    await expect(add, `no add button at ${width}px`).toBeVisible()
    const addBox = await add.boundingBox()
    // §17 puts the floor at 44px on every control, and this is the control the
    // whole app is pressed through. It used to be drawn at 38.
    expect(addBox!.width, `the add button is ${addBox!.width}px wide at ${width}px`).toBeGreaterThanOrEqual(44)
    expect(addBox!.height, `the add button is ${addBox!.height}px tall at ${width}px`).toBeGreaterThanOrEqual(44)
    // Above the fold and clear of both edges, wherever the window ends.
    expect(addBox!.y, `the add button is off the top at ${width}px`).toBeGreaterThanOrEqual(0)
    expect(addBox!.y + addBox!.height, `the add button is below the fold at ${width}px`).toBeLessThanOrEqual(901)
    expect(addBox!.x + addBox!.width, `the add button is cut off at ${width}px`).toBeLessThanOrEqual(width + 1)

    // It sits on the heading, so it never covers the writing underneath it.
    const heading = (await page.locator('.screen-heading').first().boundingBox())!
    expect(addBox!.y, `the add button left the heading line at ${width}px`)
      .toBeGreaterThanOrEqual(heading.y - 1)

    // And it is the only navigation there is — nothing else is pinned to the
    // bottom of the window competing with it.
    await expect(page.locator('.tabbar')).toHaveCount(0)

    await assertNoHorizontalOverflow(page, 'inbox', width)

    await goTo(page, 'Suppliers')
    await assertNoHorizontalOverflow(page, 'suppliers', width)

    await goTo(page, 'Equipment')
    await assertNoHorizontalOverflow(page, 'store setup', width)

    // Every header action has to be fully on screen, however they wrap.
    const actions = page.locator('.top-actions button')
    for (let index = 0; index < await actions.count(); index += 1) {
      const box = await actions.nth(index).boundingBox()
      const label = (await actions.nth(index).innerText()).replace(/\s+/g, ' ').trim()
      expect(box, `action "${label}" has no box at ${width}px`).not.toBeNull()
      expect(box!.x, `action "${label}" is cut off on the left at ${width}px`).toBeGreaterThanOrEqual(-1)
      expect(box!.x + box!.width, `action "${label}" is cut off on the right at ${width}px`).toBeLessThanOrEqual(width + 1)
    }

    await page.locator('.add-button').click()
    await expect(editor.root(page)).toBeVisible()
    await assertNoHorizontalOverflow(page, 'editor', width)
    // Long option labels in the editor are a reliable source of sideways scroll.
    const editorOverflow = await editor.root(page).locator('.editor-document')
      .evaluate(node => node.scrollWidth - node.clientWidth)
    expect(editorOverflow, `the editor scrolls sideways at ${width}px`).toBeLessThanOrEqual(1)
    await expect(editor.save(page)).toBeVisible()
    // The editor is a page at every width — never a strip pinned to one edge —
    // and its text is held to a readable measure rather than stretched across a
    // whole monitor. 720px is the measure the design system fixes.
    const editorBox = await editor.root(page).boundingBox()
    expect(editorBox!.width, `the editor is a strip at ${width}px`)
      .toBeGreaterThanOrEqual(Math.min(width - 40, 720) - 60)
    expect(editorBox!.width, `the editor is stretched at ${width}px`).toBeLessThanOrEqual(720)
    await editor.root(page).getByRole('button', { name: /^Back to / }).click()

    await goTo(page, 'Money')
    await assertNoHorizontalOverflow(page, 'money', width)

    await goTo(page, 'Library')
    await assertNoHorizontalOverflow(page, 'library', width)

    // The account menu hangs off the right edge, so it gets its own check.
    await page.getByRole('button', { name: 'Account' }).click()
    await expect(page.getByRole('menu')).toBeVisible()
    await assertNoHorizontalOverflow(page, 'account menu', width)
  })

  // A record opened from a view carries "← Locations" rather than a bare arrow,
  // and the box that holds it was fixed at 44px wide. On a phone that pushed the
  // arrow off the left edge of the screen: the way back out of every record
  // reached from every view was drawn outside the window.
  test(`the way back out of a record is on screen at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await openFreshWorkspace(page)
    await createRecord(page, 'Suppliers', 'Tea Planet')
    await goTo(page, 'Suppliers')
    await openRow(page, 'Tea Planet')

    const back = contentPane(page).locator('.detail-back')
    await expect(back, `no back control at ${width}px`).toBeVisible()
    const box = (await back.boundingBox())!
    expect(box.x, `back is off the left edge at ${width}px`).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width, `back is off the right edge at ${width}px`).toBeLessThanOrEqual(width + 1)

    // Including the arrow inside it, which is the part that went missing.
    const arrow = (await back.locator('svg').boundingBox())!
    expect(arrow.width, `the back arrow collapsed at ${width}px`).toBeGreaterThan(0)
    expect(arrow.x, `the back arrow is off the left edge at ${width}px`).toBeGreaterThanOrEqual(0)
  })
}
