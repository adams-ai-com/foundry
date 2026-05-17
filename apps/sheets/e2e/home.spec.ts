import { test, expect } from '@playwright/test'
import { createTestSheet, deleteTestSheet } from './helpers'

test.describe('Home page', () => {
  test('has correct page title', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Foundry Sheets/)
  })

  test('shows the app header', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('text=Foundry Sheets').first()).toBeVisible()
  })

  test('shows Change Requests link', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('a[href="/change-requests"]')).toBeVisible()
  })

  test('creating a new spreadsheet navigates to the editor', async ({ page }) => {
    await page.goto('/')
    await page.click('button:has-text("New spreadsheet")')
    await page.waitForURL(/\/editor\//)
    await expect(page.locator('[data-testid="spreadsheet-title"]')).toBeVisible()
  })

  test('new spreadsheet appears in list after navigating back', async ({ page }) => {
    const title = await createTestSheet(page)
    await page.goto('/')
    await expect(page.locator('[data-testid="sheet-list"]')).toBeVisible()
    await expect(page.locator('[data-testid="sheet-row"]').filter({ hasText: title })).toBeVisible()
    await deleteTestSheet(page, title)
  })

  test('clicking a spreadsheet row opens the editor', async ({ page }) => {
    const title = await createTestSheet(page)
    await page.goto('/')
    await page.locator('[data-testid="sheet-row"]').filter({ hasText: title }).locator('a').click()
    await page.waitForURL(/\/editor\//)
    await expect(page.locator('[data-testid="spreadsheet-title"]')).toHaveValue(title)
    await deleteTestSheet(page, title)
  })

  test('deleting a spreadsheet removes it from the list', async ({ page }) => {
    const title = await createTestSheet(page)
    await page.goto('/')
    const row = page.locator('[data-testid="sheet-row"]').filter({ hasText: title })
    await expect(row).toBeVisible()
    page.once('dialog', d => d.accept())
    await row.locator('button[aria-label="Delete spreadsheet"]').click()
    await expect(row).not.toBeVisible()
  })

  test('delete button is hidden by default and visible on hover', async ({ page }) => {
    const title = await createTestSheet(page)
    await page.goto('/')
    const row = page.locator('[data-testid="sheet-row"]').filter({ hasText: title })
    const deleteBtn = row.locator('button[aria-label="Delete spreadsheet"]')
    await expect(deleteBtn).toHaveCSS('opacity', '0')
    await row.hover()
    await expect(deleteBtn).toHaveCSS('opacity', '1')
    await deleteTestSheet(page, title)
  })
})
