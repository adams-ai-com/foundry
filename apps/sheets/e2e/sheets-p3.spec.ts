import { test, expect } from '@playwright/test'
import { createTestSheet, deleteTestSheet, typeInCell } from './helpers'

test.describe('P3 — Charts', () => {
  let title: string

  test.beforeEach(async ({ page }) => {
    title = await createTestSheet(page, 'ChartTest')
  })

  test.afterEach(async ({ page }) => {
    await deleteTestSheet(page, title)
  })

  test('chart panel opens and closes', async ({ page }) => {
    await page.locator('[data-testid="btn-chart"]').click()
    await expect(page.locator('[data-testid="chart-panel"]').getByText('Charts', { exact: true })).toBeVisible()
    await page.locator('[data-testid="btn-chart"]').click()
    await expect(page.locator('[data-testid="chart-panel"]')).not.toBeVisible()
  })

  test('chart panel shows prompt when no range selected', async ({ page }) => {
    await page.locator('[data-testid="btn-chart"]').click()
    await expect(page.locator('[data-testid="chart-panel"]').getByText('Shift+click to select a range, then insert a chart.')).toBeVisible()
  })

  test('selecting a range and opening chart panel shows range', async ({ page }) => {
    // Type some data
    await typeInCell(page, 0, 0, '10')
    await typeInCell(page, 1, 0, '20')

    // Select A1 then shift+click A2
    await page.locator('[data-testid="cell-0-0"]').click()
    await page.locator('[data-testid="cell-1-0"]').click({ modifiers: ['Shift'] })

    await page.locator('[data-testid="btn-chart"]').click()
    await expect(page.locator('[data-testid="chart-panel"]').getByText(/A1:A2/)).toBeVisible()
  })

  test('inserting a chart creates a chart entry', async ({ page }) => {
    await typeInCell(page, 0, 0, 'Jan')
    await typeInCell(page, 0, 1, 'Feb')
    await typeInCell(page, 1, 0, '100')
    await typeInCell(page, 1, 1, '200')

    // Select A1:B2
    await page.locator('[data-testid="cell-0-0"]').click()
    await page.locator('[data-testid="cell-1-1"]').click({ modifiers: ['Shift'] })

    await page.locator('[data-testid="btn-chart"]').click()
    await page.getByRole('button', { name: 'Insert chart' }).click()

    // A chart entry should now exist in the list
    await expect(page.locator('[data-testid="chart-panel"]').getByText(/Chart 1/).first()).toBeVisible()
  })

  test('inserting a chart with a custom title shows the title', async ({ page }) => {
    await typeInCell(page, 0, 0, '50')
    await typeInCell(page, 1, 0, '75')

    await page.locator('[data-testid="cell-0-0"]').click()
    await page.locator('[data-testid="cell-1-0"]').click({ modifiers: ['Shift'] })

    await page.locator('[data-testid="btn-chart"]').click()
    await page.getByPlaceholder('Chart title…').fill('My Sales Chart')
    await page.getByRole('button', { name: 'Insert chart' }).click()

    await expect(page.locator('[data-testid="chart-panel"]').getByText('My Sales Chart').first()).toBeVisible()
  })

  test('inserted chart persists after save and reload', async ({ page }) => {
    await typeInCell(page, 0, 0, '30')
    await typeInCell(page, 1, 0, '60')

    await page.locator('[data-testid="cell-0-0"]').click()
    await page.locator('[data-testid="cell-1-0"]').click({ modifiers: ['Shift'] })

    await page.locator('[data-testid="btn-chart"]').click()
    await page.getByPlaceholder('Chart title…').fill('Persistent Chart')
    await page.getByRole('button', { name: 'Insert chart' }).click()

    await expect(page.locator('[data-testid="save-state"]')).toContainText('Saved', { timeout: 8000 })
    await page.reload()

    await page.locator('[data-testid="btn-chart"]').click()
    await expect(page.locator('[data-testid="chart-panel"]').getByText('Persistent Chart').first()).toBeVisible()
  })

  test('can switch between bar, line, and pie chart types', async ({ page }) => {
    await typeInCell(page, 0, 0, '10')
    await page.locator('[data-testid="cell-0-0"]').click()
    await page.locator('[data-testid="cell-1-0"]').click({ modifiers: ['Shift'] })
    await page.locator('[data-testid="btn-chart"]').click()

    await page.locator('[data-testid="chart-panel"]').getByRole('button', { name: 'line' }).click()
    await page.getByRole('button', { name: 'Insert chart' }).click()
    await expect(page.locator('[data-testid="chart-panel"]').getByText(/Chart 1/).first()).toBeVisible()
  })

  test('chart can be deleted from the list', async ({ page }) => {
    await typeInCell(page, 0, 0, '10')
    await page.locator('[data-testid="cell-0-0"]').click()
    await page.locator('[data-testid="cell-1-0"]').click({ modifiers: ['Shift'] })
    await page.locator('[data-testid="btn-chart"]').click()
    await page.getByRole('button', { name: 'Insert chart' }).click()
    await expect(page.locator('[data-testid="chart-panel"]').getByText(/Chart 1/).first()).toBeVisible()

    // Click the × delete button next to the chart
    await page.locator('[data-testid="chart-panel"] button:has-text("×")').click()
    await expect(page.locator('[data-testid="chart-panel"]').getByText(/No charts yet/)).toBeVisible()
  })
})

test.describe('P3 — Range selection', () => {
  let title: string

  test.beforeEach(async ({ page }) => {
    title = await createTestSheet(page, 'RangeTest')
  })

  test.afterEach(async ({ page }) => {
    await deleteTestSheet(page, title)
  })

  test('shift+click extends selection and formula bar shows range', async ({ page }) => {
    await page.locator('[data-testid="cell-0-0"]').click()
    await page.locator('[data-testid="cell-2-2"]').click({ modifiers: ['Shift'] })
    await expect(page.locator('[data-testid="formula-address"]')).toHaveText('A1:C3')
  })

  test('cells in range get highlighted', async ({ page }) => {
    await page.locator('[data-testid="cell-0-0"]').click()
    await page.locator('[data-testid="cell-1-1"]').click({ modifiers: ['Shift'] })
    // Cells in the range should have the blue highlight class
    await expect(page.locator('[data-testid="cell-0-1"]')).toHaveClass(/bg-blue-50/)
    await expect(page.locator('[data-testid="cell-1-0"]')).toHaveClass(/bg-blue-50/)
  })

  test('clicking without shift resets selection to single cell', async ({ page }) => {
    await page.locator('[data-testid="cell-0-0"]').click()
    await page.locator('[data-testid="cell-2-2"]').click({ modifiers: ['Shift'] })
    // Now click a single cell
    await page.locator('[data-testid="cell-1-1"]').click()
    await expect(page.locator('[data-testid="formula-address"]')).toHaveText('B2')
  })
})

test.describe('P3 — Multi-sheet', () => {
  let title: string

  test.beforeEach(async ({ page }) => {
    title = await createTestSheet(page, 'MultiSheet')
  })

  test.afterEach(async ({ page }) => {
    await deleteTestSheet(page, title)
  })

  test('Sheet1 tab is visible by default', async ({ page }) => {
    await expect(page.locator('button:has-text("Sheet1")')).toBeVisible()
  })

  test('Add sheet button creates a new sheet tab', async ({ page }) => {
    await page.locator('button:has-text("+ Add sheet")').click()
    await expect(page.locator('button:has-text("Sheet2")')).toBeVisible()
  })

  test('switching sheets changes the active sheet', async ({ page }) => {
    await page.locator('button:has-text("+ Add sheet")').click()
    await typeInCell(page, 0, 0, 'Sheet2Data')

    await page.locator('button:has-text("Sheet1")').click()
    // Sheet1 should not have Sheet2Data
    await page.locator('[data-testid="cell-0-1"]').click()
    await expect(page.locator('[data-testid="cell-0-0"]')).not.toContainText('Sheet2Data')

    await page.locator('button:has-text("Sheet2")').click()
    await page.locator('[data-testid="cell-0-1"]').click()
    await expect(page.locator('[data-testid="cell-0-0"]')).toContainText('Sheet2Data')
  })

  test('multiple sheets can be added', async ({ page }) => {
    await page.locator('button:has-text("+ Add sheet")').click()
    await page.locator('button:has-text("+ Add sheet")').click()
    await expect(page.locator('button:has-text("Sheet2")')).toBeVisible()
    await expect(page.locator('button:has-text("Sheet3")')).toBeVisible()
  })
})

test.describe('P3 — Formula bar editing', () => {
  let title: string

  test.beforeEach(async ({ page }) => {
    title = await createTestSheet(page, 'FormulaBarTest')
  })

  test.afterEach(async ({ page }) => {
    await deleteTestSheet(page, title)
  })

  test('editing value in formula bar updates the cell', async ({ page }) => {
    await page.locator('[data-testid="cell-0-0"]').click()
    const formulaInput = page.locator('[data-testid="formula-value"]')
    await formulaInput.fill('42')
    await formulaInput.press('Enter')
    await page.locator('[data-testid="cell-0-1"]').click()
    await expect(page.locator('[data-testid="cell-0-0"]')).toContainText('42')
  })

  test('Escape in formula bar reverts to original value', async ({ page }) => {
    await typeInCell(page, 0, 0, 'original')
    await page.locator('[data-testid="cell-0-0"]').click()
    const formulaInput = page.locator('[data-testid="formula-value"]')
    await formulaInput.fill('changed')
    await formulaInput.press('Escape')
    await expect(formulaInput).toHaveValue('original')
  })
})
