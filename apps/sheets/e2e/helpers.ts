import { type Page, type Locator, expect } from '@playwright/test'

/** Creates a new spreadsheet, sets a unique title, and waits for first save. Returns the title. */
export async function createTestSheet(page: Page, label = 'E2E'): Promise<string> {
  const title = `${label}-${Date.now()}`
  await page.goto('/sheets')
  await page.waitForLoadState('networkidle')
  await page.click('button:has-text("New spreadsheet")')
  await page.waitForURL(/\/editor\//)
  await page.fill('[data-testid="spreadsheet-title"]', title)
  await page.keyboard.press('Tab')
  await expect(page.locator('[data-testid="save-state"]')).toContainText('Saved', { timeout: 8000 })
  return title
}

/** Navigates to home and deletes the sheet with the given title. */
export async function deleteTestSheet(page: Page, title: string) {
  await page.goto('/sheets')
  await page.waitForLoadState('networkidle')
  const row = page.locator('[data-testid="sheet-row"]').filter({ hasText: title })
  if (await row.count() === 0) return
  page.once('dialog', d => d.accept())
  await row.locator('button[aria-label="Delete spreadsheet"]').click()
  await expect(row).not.toBeVisible({ timeout: 8000 })
  await page.waitForLoadState('networkidle')
}

/**
 * Sets a cell-input's value via the native HTMLInputElement setter so React's
 * synthetic onChange fires and the editValueRef (in Grid) is updated.
 */
export async function setCellInputValue(input: Locator, value: string) {
  await input.evaluate((el: HTMLInputElement, v) => {
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value',
    )!.set!
    nativeSetter.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }, value)
}

/** Types a value into a cell and commits with Enter. */
export async function typeInCell(page: Page, row: number, col: number, value: string) {
  await page.locator(`[data-testid="cell-${row}-${col}"]`).click()
  const input = page.locator(`[data-testid="cell-${row}-${col}"] input.cell-input`)
  await input.waitFor({ state: 'visible' })
  await setCellInputValue(input, value)
  await input.press('Enter')
}

/** Returns the visible text of a cell (the display value, not the input). */
export async function getCellText(page: Page, row: number, col: number): Promise<string> {
  return page.locator(`[data-testid="cell-${row}-${col}"]`).innerText()
}
