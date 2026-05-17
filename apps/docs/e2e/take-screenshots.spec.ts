import { test, expect } from '@playwright/test'
import postgres from 'postgres'
import * as dotenv from 'dotenv'
import * as path from 'path'

const OUT = '/tmp/foundry-screenshots'

test.beforeAll(async () => {
  dotenv.config({ path: path.join(__dirname, '../.env') })
  const sql = postgres(process.env.DATABASE_URL!)
  await sql`DELETE FROM documents`
  await sql.end()
})

test('01 home empty state', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: `${OUT}/01-home-empty.png`, fullPage: true })
})

test('02 editor empty', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'New document' }).click()
  await page.waitForURL(/\/editor\//)
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: `${OUT}/02-editor-empty.png`, fullPage: true })
})

test('03 editor with title', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'New document' }).click()
  await page.waitForURL(/\/editor\//)
  await page.getByTestId('doc-title').fill('Q2 Business Review')
  await page.getByTestId('doc-title').blur()
  await page.getByTestId('save-state').filter({ hasText: 'Saved' }).waitFor({ timeout: 5000 }).catch(() => {})
  await page.screenshot({ path: `${OUT}/03-editor-with-title.png`, fullPage: true })
})

test('04 editor with rich content', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'New document' }).click()
  await page.waitForURL(/\/editor\//)
  await page.getByTestId('doc-title').fill('Q2 Business Review')

  const editor = page.locator('.tiptap')
  await editor.click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')

  await page.locator('select').selectOption('1')
  await page.keyboard.type('Executive Summary')
  await page.keyboard.press('Enter')
  await page.locator('select').selectOption('0')
  await page.keyboard.type('This quarter saw strong performance across all business units, with revenue exceeding targets by 12%. Key highlights include expansion into three new markets and a 28% improvement in customer retention rates.')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')

  await page.locator('select').selectOption('2')
  await page.keyboard.type('Key Metrics')
  await page.keyboard.press('Enter')
  await page.locator('select').selectOption('0')
  await page.keyboard.type('Revenue growth, customer acquisition, and operational efficiency all trended positively this quarter.')

  await page.screenshot({ path: `${OUT}/04-editor-rich-content.png`, fullPage: true })
})

test('05 editor saving state', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'New document' }).click()
  await page.waitForURL(/\/editor\//)
  const editor = page.locator('.tiptap')
  await editor.click()
  await page.keyboard.type('Watching the save indicator...')
  await page.getByTestId('save-state').filter({ hasText: /Unsaved|Saving/ }).waitFor({ timeout: 3000 }).catch(() => {})
  await page.screenshot({ path: `${OUT}/05-editor-saving.png`, fullPage: false })
})

test('06 home with multiple docs', async ({ page }) => {
  // Create doc 1
  await page.goto('/')
  await page.getByRole('button', { name: 'New document' }).click()
  await page.waitForURL(/\/editor\//)
  await page.getByTestId('doc-title').fill('Product Roadmap — H2 2026')
  await page.getByTestId('doc-title').blur()
  await page.getByTestId('save-state').filter({ hasText: 'Saved' }).waitFor({ timeout: 5000 }).catch(() => {})

  // Create doc 2
  await page.goto('/')
  await page.getByRole('button', { name: 'New document' }).click()
  await page.waitForURL(/\/editor\//)
  await page.getByTestId('doc-title').fill('Team Onboarding Guide')
  await page.getByTestId('doc-title').blur()
  await page.getByTestId('save-state').filter({ hasText: 'Saved' }).waitFor({ timeout: 5000 }).catch(() => {})

  // Create doc 3
  await page.goto('/')
  await page.getByRole('button', { name: 'New document' }).click()
  await page.waitForURL(/\/editor\//)
  await page.getByTestId('doc-title').fill('Q2 Business Review')
  await page.getByTestId('doc-title').blur()
  await page.getByTestId('save-state').filter({ hasText: 'Saved' }).waitFor({ timeout: 5000 }).catch(() => {})

  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: `${OUT}/06-home-with-docs.png`, fullPage: true })
})

test('07 home hover row', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  const firstRow = page.getByTestId('doc-row').first()
  await firstRow.hover()
  await page.screenshot({ path: `${OUT}/07-home-hover-row.png`, fullPage: true })
})

test('08 mobile home', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: `${OUT}/08-mobile-home.png`, fullPage: true })
})

test('09 mobile editor', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: 'New document' }).click()
  await page.waitForURL(/\/editor\//)
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: `${OUT}/09-mobile-editor.png`, fullPage: true })
})

test('10 toolbar closeup', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 300 })
  await page.goto('/')
  await page.getByRole('button', { name: 'New document' }).click()
  await page.waitForURL(/\/editor\//)
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: `${OUT}/10-toolbar-closeup.png`, fullPage: false })
})
