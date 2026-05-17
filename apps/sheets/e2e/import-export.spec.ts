import { test, expect } from '@playwright/test'
import { createTestSheet, deleteTestSheet } from './helpers'

const SAMPLE_CSV = 'Name,Score,Note\nAlice,95,Top\nBob,87,Good\nCharlie,100,Perfect'
const SAMPLE_CSV_WITH_QUOTES = '"Last, First",Score\n"Smith, Jane",92\n"Doe, John",88'

test.describe('CSV Import', () => {
  let title: string

  test.beforeEach(async ({ page }) => {
    title = await createTestSheet(page, 'ImportTest')
  })

  test.afterEach(async ({ page }) => {
    await deleteTestSheet(page, title)
  })

  test('imports a CSV file and populates cells', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'data.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(SAMPLE_CSV),
    })
    // Click away so cell-0-0 (auto-selected) shows its text value not the raw input
    await page.locator('[data-testid="cell-5-5"]').click()

    await expect(page.locator('[data-testid="cell-0-0"]')).toContainText('Name')
    await expect(page.locator('[data-testid="cell-0-1"]')).toContainText('Score')
    await expect(page.locator('[data-testid="cell-1-0"]')).toContainText('Alice')
    await expect(page.locator('[data-testid="cell-1-1"]')).toContainText('95')
    await expect(page.locator('[data-testid="cell-3-0"]')).toContainText('Charlie')
    await expect(page.locator('[data-testid="cell-3-2"]')).toContainText('Perfect')
  })

  test('CSV import handles quoted fields with commas', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'quoted.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(SAMPLE_CSV_WITH_QUOTES),
    })
    await page.locator('[data-testid="cell-5-5"]').click()

    await expect(page.locator('[data-testid="cell-0-0"]')).toContainText('Last, First')
    await expect(page.locator('[data-testid="cell-1-0"]')).toContainText('Smith, Jane')
  })

  test('CSV import replaces existing cell content', async ({ page }) => {
    // Type something first
    await page.locator('[data-testid="cell-0-0"]').click()
    const inp = page.locator('[data-testid="cell-0-0"] input.cell-input')
    await inp.waitFor({ state: 'visible' })
    await inp.click()
    await page.keyboard.type('old data')
    await page.keyboard.press('Enter')

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'replace.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('new,data'),
    })
    await page.locator('[data-testid="cell-5-5"]').click()

    await expect(page.locator('[data-testid="cell-0-0"]')).toContainText('new')
    await expect(page.locator('[data-testid="cell-0-1"]')).toContainText('data')
  })

  test('imported data persists after save and reload', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'persist.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('hello,world'),
    })
    await page.locator('[data-testid="cell-5-5"]').click()

    await expect(page.locator('[data-testid="cell-0-0"]')).toContainText('hello')
    await expect(page.locator('[data-testid="save-state"]')).toContainText('Saved', { timeout: 8000 })
    await page.reload()
    // Click a cell not being checked to deselect cell-0-0
    await page.locator('[data-testid="cell-2-2"]').click()
    await expect(page.locator('[data-testid="cell-0-0"]')).toContainText('hello')
    await expect(page.locator('[data-testid="cell-0-1"]')).toContainText('world')
  })
})

test.describe('CSV Export', () => {
  let title: string

  test.beforeEach(async ({ page }) => {
    title = await createTestSheet(page, 'ExportCSVTest')
    // Populate some cells
    await page.locator('[data-testid="cell-0-0"]').click()
    let inp = page.locator('[data-testid="cell-0-0"] input.cell-input')
    await inp.waitFor({ state: 'visible' })
    await inp.click()
    await page.keyboard.type('Name')
    await page.keyboard.press('Tab')
    inp = page.locator('[data-testid="cell-0-1"] input.cell-input')
    await inp.waitFor({ state: 'visible' })
    await inp.click()
    await page.keyboard.type('Score')
    await page.keyboard.press('Enter')
    await page.locator('[data-testid="cell-1-0"]').click()
    inp = page.locator('[data-testid="cell-1-0"] input.cell-input')
    await inp.waitFor({ state: 'visible' })
    await inp.click()
    await page.keyboard.type('Alice')
    await page.keyboard.press('Tab')
    inp = page.locator('[data-testid="cell-1-1"] input.cell-input')
    await inp.waitFor({ state: 'visible' })
    await inp.click()
    await page.keyboard.type('95')
    await page.keyboard.press('Enter')
  })

  test.afterEach(async ({ page }) => {
    await deleteTestSheet(page, title)
  })

  test('csv export button triggers a download', async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('[data-testid="btn-export-csv"]').click(),
    ])
    expect(download.suggestedFilename()).toBe('spreadsheet.csv')
  })

  test('exported CSV contains the cell data', async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('[data-testid="btn-export-csv"]').click(),
    ])
    const path = await download.path()
    const fs = await import('fs/promises')
    const content = await fs.readFile(path!, 'utf-8')
    expect(content).toContain('Name')
    expect(content).toContain('Score')
    expect(content).toContain('Alice')
    expect(content).toContain('95')
  })

  test('re-importing an exported CSV round-trips the data', async ({ page }) => {
    // Export
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('[data-testid="btn-export-csv"]').click(),
    ])
    const path = await download.path()
    const fs = await import('fs/promises')
    const csvBuffer = await fs.readFile(path!)

    // Import back
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({ name: 'roundtrip.csv', mimeType: 'text/csv', buffer: csvBuffer })
    await page.locator('[data-testid="cell-5-5"]').click()

    await expect(page.locator('[data-testid="cell-0-0"]')).toContainText('Name')
    await expect(page.locator('[data-testid="cell-1-0"]')).toContainText('Alice')
    await expect(page.locator('[data-testid="cell-1-1"]')).toContainText('95')
  })
})

test.describe('Excel (.xlsx) Export', () => {
  let title: string

  test.beforeEach(async ({ page }) => {
    title = await createTestSheet(page, 'ExportXlsxTest')
    await page.locator('[data-testid="cell-0-0"]').click()
    const inp = page.locator('[data-testid="cell-0-0"] input.cell-input')
    await inp.waitFor({ state: 'visible' })
    await inp.click()
    await page.keyboard.type('Hello')
    await page.keyboard.press('Enter')
  })

  test.afterEach(async ({ page }) => {
    await deleteTestSheet(page, title)
  })

  test('xlsx export button triggers a download with .xlsx extension', async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('[data-testid="btn-export-xlsx"]').click(),
    ])
    expect(download.suggestedFilename()).toBe('spreadsheet.xlsx')
  })

  test('exported xlsx file is non-empty', async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('[data-testid="btn-export-xlsx"]').click(),
    ])
    const path = await download.path()
    const fs = await import('fs/promises')
    const stat = await fs.stat(path!)
    expect(stat.size).toBeGreaterThan(1000)
  })
})
