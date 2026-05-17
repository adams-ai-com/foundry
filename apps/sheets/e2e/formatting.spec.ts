import { test, expect } from '@playwright/test'
import { createTestSheet, deleteTestSheet, typeInCell } from './helpers'

test.describe('Cell formatting', () => {
  let title: string

  test.beforeEach(async ({ page }) => {
    title = await createTestSheet(page, 'FmtTest')
  })

  test.afterEach(async ({ page }) => {
    await deleteTestSheet(page, title)
  })

  // ── Bold ───────────────────────────────────────────────────────────────────

  test('Bold button toggles bold on the selected cell', async ({ page }) => {
    await page.locator('[data-testid="cell-0-0"]').click()
    const bold = page.locator('[data-testid="btn-bold"]')
    // Initially not active
    await expect(bold).not.toHaveClass(/bg-blue-100/)
    await bold.click()
    await expect(bold).toHaveClass(/bg-blue-100/)
    // Cell text should have font-bold
    await expect(page.locator('[data-testid="cell-0-0"]')).toHaveClass(/font-bold/)
  })

  test('Bold toggles off on second click', async ({ page }) => {
    await page.locator('[data-testid="cell-0-0"]').click()
    const bold = page.locator('[data-testid="btn-bold"]')
    await bold.click()
    await bold.click()
    await expect(bold).not.toHaveClass(/bg-blue-100/)
    await expect(page.locator('[data-testid="cell-0-0"]')).not.toHaveClass(/font-bold/)
  })

  test('Bold applies independently per cell', async ({ page }) => {
    await page.locator('[data-testid="cell-0-0"]').click()
    await page.locator('[data-testid="btn-bold"]').click()
    await page.locator('[data-testid="cell-0-1"]').click()
    await expect(page.locator('[data-testid="btn-bold"]')).not.toHaveClass(/bg-blue-100/)
    await expect(page.locator('[data-testid="cell-0-0"]')).toHaveClass(/font-bold/)
    await expect(page.locator('[data-testid="cell-0-1"]')).not.toHaveClass(/font-bold/)
  })

  // ── Italic ─────────────────────────────────────────────────────────────────

  test('Italic button toggles italic on the selected cell', async ({ page }) => {
    await page.locator('[data-testid="cell-0-0"]').click()
    const italic = page.locator('[data-testid="btn-italic"]')
    await italic.click()
    await expect(italic).toHaveClass(/bg-blue-100/)
    await expect(page.locator('[data-testid="cell-0-0"]')).toHaveClass(/italic/)
  })

  // ── Underline ──────────────────────────────────────────────────────────────

  test('Underline button toggles underline on the selected cell', async ({ page }) => {
    await page.locator('[data-testid="cell-0-0"]').click()
    const ul = page.locator('[data-testid="btn-underline"]')
    await ul.click()
    await expect(ul).toHaveClass(/bg-blue-100/)
    await expect(page.locator('[data-testid="cell-0-0"]')).toHaveClass(/underline/)
  })

  // ── Combined formatting ────────────────────────────────────────────────────

  test('Bold and italic can both be active simultaneously', async ({ page }) => {
    await page.locator('[data-testid="cell-0-0"]').click()
    await page.locator('[data-testid="btn-bold"]').click()
    await page.locator('[data-testid="btn-italic"]').click()
    const cell = page.locator('[data-testid="cell-0-0"]')
    await expect(cell).toHaveClass(/font-bold/)
    await expect(cell).toHaveClass(/italic/)
  })

  // ── Number formats ─────────────────────────────────────────────────────────

  test('Number format displays with locale separators', async ({ page }) => {
    await typeInCell(page, 0, 0, '1234567')
    await page.locator('[data-testid="cell-0-0"]').click()
    await page.locator('[data-testid="select-numformat"]').selectOption('number')
    await expect(page.locator('[data-testid="cell-0-0"]')).toContainText('1,234,567')
  })

  test('Currency format adds $ sign', async ({ page }) => {
    await typeInCell(page, 0, 0, '42.5')
    await page.locator('[data-testid="cell-0-0"]').click()
    await page.locator('[data-testid="select-numformat"]').selectOption('currency')
    await expect(page.locator('[data-testid="cell-0-0"]')).toContainText('$42.50')
  })

  test('Percent format multiplies by 100 and appends %', async ({ page }) => {
    await typeInCell(page, 0, 0, '0.75')
    await page.locator('[data-testid="cell-0-0"]').click()
    await page.locator('[data-testid="select-numformat"]').selectOption('percent')
    await expect(page.locator('[data-testid="cell-0-0"]')).toContainText('75%')
  })

  test('format selector shows the current format of the selected cell', async ({ page }) => {
    await page.locator('[data-testid="cell-0-0"]').click()
    await page.locator('[data-testid="select-numformat"]').selectOption('currency')
    // Move away and back
    await page.locator('[data-testid="cell-0-1"]').click()
    await page.locator('[data-testid="cell-0-0"]').click()
    await expect(page.locator('[data-testid="select-numformat"]')).toHaveValue('currency')
  })

  // ── Persistence ────────────────────────────────────────────────────────────

  test('formatting persists after page reload', async ({ page }) => {
    await page.locator('[data-testid="cell-0-0"]').click()
    await page.locator('[data-testid="btn-bold"]').click()
    await page.locator('[data-testid="btn-italic"]').click()
    await expect(page.locator('[data-testid="save-state"]')).toContainText('Saved', { timeout: 8000 })
    await page.reload()
    const cell = page.locator('[data-testid="cell-0-0"]')
    await expect(cell).toHaveClass(/font-bold/)
    await expect(cell).toHaveClass(/italic/)
  })

  test('number format persists after page reload', async ({ page }) => {
    await typeInCell(page, 0, 0, '9999')
    await page.locator('[data-testid="cell-0-0"]').click()
    await page.locator('[data-testid="select-numformat"]').selectOption('currency')
    await expect(page.locator('[data-testid="save-state"]')).toContainText('Saved', { timeout: 8000 })
    await page.reload()
    await expect(page.locator('[data-testid="cell-0-0"]')).toContainText('$9,999.00')
  })
})
