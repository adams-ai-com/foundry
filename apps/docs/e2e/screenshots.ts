import { chromium } from 'playwright'
import postgres from 'postgres'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

dotenv.config({ path: path.join(__dirname, '../.env') })

const OUT = '/tmp/foundry-screenshots'
fs.mkdirSync(OUT, { recursive: true })

async function run() {
  const sql = postgres(process.env.DATABASE_URL!)
  await sql`DELETE FROM documents`

  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  // 1. Home — empty state
  await page.goto('http://localhost:3001/')
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: `${OUT}/01-home-empty.png`, fullPage: true })

  // 2. Create a doc and screenshot the editor (fresh/empty)
  await page.getByRole('button', { name: 'New document' }).click()
  await page.waitForURL(/\/editor\//)
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: `${OUT}/02-editor-empty.png`, fullPage: true })

  // 3. Add a title
  const titleInput = page.getByTestId('doc-title')
  await titleInput.fill('Q2 Business Review')
  await titleInput.blur()
  await page.getByTestId('save-state').waitFor({ state: 'visible' })
  await page.screenshot({ path: `${OUT}/03-editor-with-title.png`, fullPage: true })

  // 4. Add rich content
  const editor = page.locator('.tiptap')
  await editor.click()

  // Type some realistic document content
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')

  // Add a heading
  await page.locator('select').selectOption('1')
  await page.keyboard.type('Executive Summary')
  await page.keyboard.press('Enter')
  await page.locator('select').selectOption('0')

  await page.keyboard.type('This quarter saw strong performance across all business units, with revenue exceeding targets by 12%. Key highlights include expansion into three new markets and a 28% improvement in customer retention rates.')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')

  // Heading 2
  await page.locator('select').selectOption('2')
  await page.keyboard.type('Key Metrics')
  await page.keyboard.press('Enter')
  await page.locator('select').selectOption('0')

  await page.keyboard.type('Revenue growth, customer acquisition, and operational efficiency all trended positively.')

  await page.screenshot({ path: `${OUT}/04-editor-with-content.png`, fullPage: true })

  // Wait for save
  await page.getByTestId('save-state').filter({ hasText: /Unsaved|Saving/ }).waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
  await page.getByTestId('save-state').filter({ hasText: 'Saved' }).waitFor({ state: 'visible', timeout: 8000 }).catch(() => {})

  // 5. Toolbar close-up — screenshot just the top bar area
  await page.screenshot({ path: `${OUT}/05-editor-saved-state.png`, fullPage: false })

  // 6. Create more docs for list view
  await page.goto('http://localhost:3001/')
  await page.getByRole('button', { name: 'New document' }).click()
  await page.waitForURL(/\/editor\//)
  await page.getByTestId('doc-title').fill('Product Roadmap — H2 2026')
  await page.getByTestId('doc-title').blur()
  await page.waitForTimeout(500)

  await page.goto('http://localhost:3001/')
  await page.getByRole('button', { name: 'New document' }).click()
  await page.waitForURL(/\/editor\//)
  await page.getByTestId('doc-title').fill('Team Onboarding Guide')
  await page.getByTestId('doc-title').blur()
  await page.waitForTimeout(500)

  // 7. Home — populated list
  await page.goto('http://localhost:3001/')
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: `${OUT}/07-home-with-docs.png`, fullPage: true })

  // 8. Hover state on doc row (to reveal delete)
  const firstRow = page.getByTestId('doc-row').first()
  await firstRow.hover()
  await page.screenshot({ path: `${OUT}/08-home-hover-row.png`, fullPage: true })

  // 9. Mobile viewport
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://localhost:3001/')
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: `${OUT}/09-home-mobile.png`, fullPage: true })

  // 10. Mobile editor
  await page.getByRole('button', { name: 'New document' }).click()
  await page.waitForURL(/\/editor\//)
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: `${OUT}/10-editor-mobile.png`, fullPage: true })

  await browser.close()
  await sql.end()
  console.log(`Screenshots saved to ${OUT}`)
}

run().catch(console.error)
