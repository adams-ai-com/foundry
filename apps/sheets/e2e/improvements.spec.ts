import { test, expect } from '@playwright/test'
import { createTestSheet, deleteTestSheet, typeInCell } from './helpers'

test.describe('Keyboard shortcuts', () => {
  let title: string

  test.beforeEach(async ({ page }) => {
    title = await createTestSheet(page, 'ShortcutTest')
  })

  test.afterEach(async ({ page }) => {
    await deleteTestSheet(page, title)
  })

  test('Ctrl+B toggles bold on selected cell', async ({ page }) => {
    await page.locator('[data-testid="cell-0-0"]').click()
    await page.keyboard.press('Control+b')
    await expect(page.locator('[data-testid="cell-0-0"]')).toHaveClass(/font-bold/)
    await page.keyboard.press('Control+b')
    await expect(page.locator('[data-testid="cell-0-0"]')).not.toHaveClass(/font-bold/)
  })

  test('Ctrl+I toggles italic on selected cell', async ({ page }) => {
    await page.locator('[data-testid="cell-0-0"]').click()
    await page.keyboard.press('Control+i')
    await expect(page.locator('[data-testid="cell-0-0"]')).toHaveClass(/italic/)
  })

  test('Ctrl+U toggles underline on selected cell', async ({ page }) => {
    await page.locator('[data-testid="cell-0-0"]').click()
    await page.keyboard.press('Control+u')
    await expect(page.locator('[data-testid="cell-0-0"]')).toHaveClass(/underline/)
  })

  test('Ctrl+B applies bold to entire selection range', async ({ page }) => {
    await page.locator('[data-testid="cell-0-0"]').click()
    await page.locator('[data-testid="cell-1-1"]').click({ modifiers: ['Shift'] })
    await page.keyboard.press('Control+b')
    await expect(page.locator('[data-testid="cell-0-0"]')).toHaveClass(/font-bold/)
    await expect(page.locator('[data-testid="cell-0-1"]')).toHaveClass(/font-bold/)
    await expect(page.locator('[data-testid="cell-1-0"]')).toHaveClass(/font-bold/)
    await expect(page.locator('[data-testid="cell-1-1"]')).toHaveClass(/font-bold/)
  })

  test('Home key moves to column A in the same row', async ({ page }) => {
    await page.locator('[data-testid="cell-2-5"]').click()
    await expect(page.locator('[data-testid="formula-address"]')).toHaveText('F3')
    await page.keyboard.press('Home')
    await expect(page.locator('[data-testid="formula-address"]')).toHaveText('A3')
  })

  test('Tab wraps to next row at last column', async ({ page }) => {
    // Navigate to last column (Z = col 25)
    await page.locator('[data-testid="cell-0-25"]').click()
    await expect(page.locator('[data-testid="formula-address"]')).toHaveText('Z1')
    const input = page.locator('[data-testid="cell-0-25"] input.cell-input')
    await input.waitFor({ state: 'visible' })
    await input.press('Tab')
    await expect(page.locator('[data-testid="formula-address"]')).toHaveText('A2')
  })
})

test.describe('Undo/Redo', () => {
  let title: string

  test.beforeEach(async ({ page }) => {
    title = await createTestSheet(page, 'UndoTest')
  })

  test.afterEach(async ({ page }) => {
    await deleteTestSheet(page, title)
  })

  test('Ctrl+Z undoes a cell edit', async ({ page }) => {
    await typeInCell(page, 0, 0, 'hello')
    await expect(page.locator('[data-testid="cell-0-0"]')).toContainText('hello')
    await page.locator('[data-testid="cell-1-0"]').click()
    await page.keyboard.press('Control+z')
    await page.locator('[data-testid="cell-0-1"]').click()
    await expect(page.locator('[data-testid="cell-0-0"]')).toHaveText('')
  })

  test('Ctrl+Y redoes after undo', async ({ page }) => {
    await typeInCell(page, 0, 0, 'hello')
    await page.locator('[data-testid="cell-1-0"]').click()
    await page.keyboard.press('Control+z')
    await page.locator('[data-testid="cell-0-1"]').click()
    await expect(page.locator('[data-testid="cell-0-0"]')).toHaveText('')
    await page.keyboard.press('Control+y')
    await page.locator('[data-testid="cell-2-0"]').click()
    await expect(page.locator('[data-testid="cell-0-0"]')).toContainText('hello')
  })

  test('undo button is disabled when nothing to undo', async ({ page }) => {
    await expect(page.locator('[data-testid="btn-undo"]')).toBeDisabled()
  })

  test('undo button enables after a cell edit', async ({ page }) => {
    await typeInCell(page, 0, 0, 'data')
    await page.locator('[data-testid="cell-1-0"]').click()
    await expect(page.locator('[data-testid="btn-undo"]')).toBeEnabled()
  })

  test('undo button click undoes last change', async ({ page }) => {
    await typeInCell(page, 0, 0, 'undo-me')
    await page.locator('[data-testid="cell-1-0"]').click()
    await page.locator('[data-testid="btn-undo"]').click()
    await page.locator('[data-testid="cell-0-1"]').click()
    await expect(page.locator('[data-testid="cell-0-0"]')).toHaveText('')
  })
})
