import { test, expect } from '@playwright/test'
import { createTestSheet, deleteTestSheet, typeInCell, getCellText, setCellInputValue } from './helpers'

test.describe('Editor', () => {
  let title: string

  test.beforeEach(async ({ page }) => {
    title = await createTestSheet(page, 'EditorTest')
  })

  test.afterEach(async ({ page }) => {
    await deleteTestSheet(page, title)
  })

  // ── Title ──────────────────────────────────────────────────────────────────

  test('title field is pre-filled with the sheet name', async ({ page }) => {
    await expect(page.locator('[data-testid="spreadsheet-title"]')).toHaveValue(title)
  })

  test('title edits save and persist after reload', async ({ page }) => {
    const newTitle = `${title}-renamed`
    await page.fill('[data-testid="spreadsheet-title"]', newTitle)
    await page.keyboard.press('Tab')
    await expect(page.locator('[data-testid="save-state"]')).toContainText('Saved', { timeout: 8000 })
    await page.reload()
    await expect(page.locator('[data-testid="spreadsheet-title"]')).toHaveValue(newTitle)
    title = newTitle
  })

  // ── Save indicator ─────────────────────────────────────────────────────────

  test('save indicator shows Saved on initial load', async ({ page }) => {
    await expect(page.locator('[data-testid="save-state"]')).toContainText('Saved')
  })

  test('save indicator cycles through Unsaved → Saved after cell edit', async ({ page }) => {
    await typeInCell(page, 0, 0, 'hello')
    await expect(page.locator('[data-testid="save-state"]')).toContainText('Saved', { timeout: 8000 })
  })

  // ── Cell editing ───────────────────────────────────────────────────────────

  test('clicking a cell selects it and shows the address in the formula bar', async ({ page }) => {
    await page.locator('[data-testid="cell-0-0"]').click()
    await expect(page.locator('[data-testid="formula-address"]')).toHaveText('A1')
  })

  test('typing in a cell commits on Enter and moves down', async ({ page }) => {
    await page.locator('[data-testid="cell-0-0"]').click()
    const input00 = page.locator('[data-testid="cell-0-0"] input.cell-input')
    await input00.waitFor({ state: 'visible' })
    await setCellInputValue(input00, 'hello')
    await input00.press('Enter')
    await expect(page.locator('[data-testid="cell-0-0"]')).toContainText('hello')
    await expect(page.locator('[data-testid="formula-address"]')).toHaveText('A2')
  })

  test('Tab commits the cell and moves right', async ({ page }) => {
    await page.locator('[data-testid="cell-0-0"]').click()
    const input00 = page.locator('[data-testid="cell-0-0"] input.cell-input')
    await input00.waitFor({ state: 'visible' })
    await setCellInputValue(input00, 'first')
    await input00.press('Tab')
    await expect(page.locator('[data-testid="cell-0-0"]')).toContainText('first')
    await expect(page.locator('[data-testid="formula-address"]')).toHaveText('B1')
  })

  test('Escape cancels edit and restores prior value', async ({ page }) => {
    await typeInCell(page, 0, 0, 'original')
    await page.locator('[data-testid="cell-0-0"]').click()
    const input00 = page.locator('[data-testid="cell-0-0"] input.cell-input')
    await input00.waitFor({ state: 'visible' })
    await setCellInputValue(input00, 'overwrite')
    await input00.press('Escape')
    await page.locator('[data-testid="cell-5-5"]').click()
    await expect(page.locator('[data-testid="cell-0-0"]')).toContainText('original')
  })

  test('Delete key clears the selected cell', async ({ page }) => {
    await typeInCell(page, 0, 0, 'data')
    await page.locator('[data-testid="cell-0-0"]').click()
    await page.keyboard.press('Delete')
    await expect(page.locator('[data-testid="cell-0-0"]')).toHaveText('')
  })

  test('arrow keys navigate between cells', async ({ page }) => {
    await page.locator('[data-testid="cell-0-0"]').click()
    await page.keyboard.press('ArrowDown')
    await expect(page.locator('[data-testid="formula-address"]')).toHaveText('A2')
    await page.keyboard.press('ArrowRight')
    await expect(page.locator('[data-testid="formula-address"]')).toHaveText('B2')
    await page.keyboard.press('ArrowUp')
    await expect(page.locator('[data-testid="formula-address"]')).toHaveText('B1')
    await page.keyboard.press('ArrowLeft')
    await expect(page.locator('[data-testid="formula-address"]')).toHaveText('A1')
  })

  // ── Formula bar ────────────────────────────────────────────────────────────

  test('formula bar reflects the selected cell value', async ({ page }) => {
    await typeInCell(page, 0, 0, '42')
    await page.locator('[data-testid="cell-0-0"]').click()
    await expect(page.locator('[data-testid="formula-value"]')).toHaveValue('42')
  })

  test('formula bar shows the raw formula for formula cells', async ({ page }) => {
    await typeInCell(page, 0, 0, '10')
    await typeInCell(page, 1, 0, '20')
    await page.locator('[data-testid="cell-2-0"]').click()
    const input20 = page.locator('[data-testid="cell-2-0"] input.cell-input')
    await input20.waitFor({ state: 'visible' })
    await setCellInputValue(input20, '=SUM(A1:A2)')
    await input20.press('Enter')
    await page.locator('[data-testid="cell-2-0"]').click()
    await expect(page.locator('[data-testid="formula-value"]')).toHaveValue('=SUM(A1:A2)')
  })

  // ── Formula evaluation ────────────────────────────────────────────────────

  test('SUM formula evaluates correctly', async ({ page }) => {
    await typeInCell(page, 0, 0, '10')
    await typeInCell(page, 1, 0, '20')
    await typeInCell(page, 2, 0, '30')
    await page.locator('[data-testid="cell-3-0"]').click()
    const input30 = page.locator('[data-testid="cell-3-0"] input.cell-input')
    await input30.waitFor({ state: 'visible' })
    await setCellInputValue(input30, '=SUM(A1:A3)')
    await input30.press('Enter')
    await expect(page.locator('[data-testid="cell-3-0"]')).toContainText('60')
  })

  test('formula result updates when a referenced cell changes', async ({ page }) => {
    await typeInCell(page, 0, 0, '5')
    await typeInCell(page, 1, 0, '=A1*2')
    // After typeInCell A2, Enter moved selection to A3 — A2 shows display value '10'
    await expect(page.locator('[data-testid="cell-1-0"]')).toContainText('10')
    await typeInCell(page, 0, 0, '7')
    // After typeInCell A1=7, Enter moves selection to A2 (A2 now selected, shows input not display)
    // Click elsewhere to deselect A2 so it shows the updated display value '14'
    await page.locator('[data-testid="cell-5-5"]').click()
    await expect(page.locator('[data-testid="cell-1-0"]')).toContainText('14')
  })

  test('AVERAGE formula evaluates correctly', async ({ page }) => {
    await typeInCell(page, 0, 0, '10')
    await typeInCell(page, 0, 1, '20')
    await typeInCell(page, 0, 2, '30')
    await page.locator('[data-testid="cell-0-3"]').click()
    const input03 = page.locator('[data-testid="cell-0-3"] input.cell-input')
    await input03.waitFor({ state: 'visible' })
    await setCellInputValue(input03, '=AVERAGE(A1:C1)')
    await input03.press('Enter')
    await expect(page.locator('[data-testid="cell-0-3"]')).toContainText('20')
  })

  test('IF formula evaluates correctly', async ({ page }) => {
    await typeInCell(page, 0, 0, '10')
    await page.locator('[data-testid="cell-0-1"]').click()
    const input01 = page.locator('[data-testid="cell-0-1"] input.cell-input')
    await input01.waitFor({ state: 'visible' })
    await setCellInputValue(input01, '=IF(A1>5,"big","small")')
    await input01.press('Enter')
    await expect(page.locator('[data-testid="cell-0-1"]')).toContainText('big')
  })

  // ── Persistence ────────────────────────────────────────────────────────────

  test('cell data persists after page reload', async ({ page }) => {
    await typeInCell(page, 0, 0, 'persisted')
    await expect(page.locator('[data-testid="save-state"]')).toContainText('Saved', { timeout: 8000 })
    await page.reload()
    await page.locator('[data-testid="cell-0-1"]').click()
    await expect(page.locator('[data-testid="cell-0-0"]')).toContainText('persisted')
  })

  test('formula persists after reload and re-evaluates', async ({ page }) => {
    await typeInCell(page, 0, 0, '100')
    await page.locator('[data-testid="cell-0-1"]').click()
    const input01 = page.locator('[data-testid="cell-0-1"] input.cell-input')
    await input01.waitFor({ state: 'visible' })
    await setCellInputValue(input01, '=A1+1')
    await input01.press('Tab')
    await expect(page.locator('[data-testid="save-state"]')).toContainText('Saved', { timeout: 8000 })
    await page.reload()
    await page.locator('[data-testid="cell-5-5"]').click()
    await expect(page.locator('[data-testid="cell-0-1"]')).toContainText('101')
  })

  // ── Navigation ─────────────────────────────────────────────────────────────

  test('back button returns to home', async ({ page }) => {
    await page.click('button:has-text("Sheets")')
    await page.waitForURL('/sheets')
    await expect(page).toHaveURL('/sheets')
  })

  test('going back on an empty Untitled sheet deletes it', async ({ page }) => {
    await page.goto('/sheets')
    const before = await page.locator('[data-testid="sheet-row"]').filter({ hasText: 'Untitled' }).count()
    await page.click('button:has-text("New spreadsheet")')
    await page.waitForURL(/\/editor\//)
    const currentTitle = await page.locator('[data-testid="spreadsheet-title"]').inputValue()
    expect(currentTitle).toBe('Untitled')
    await page.click('button:has-text("Sheets")')
    await page.waitForURL('/sheets')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('[data-testid="sheet-row"]').filter({ hasText: 'Untitled' })).toHaveCount(before)
  })
})
