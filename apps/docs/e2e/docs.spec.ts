import { test, expect, Page } from '@playwright/test'
import postgres from 'postgres'
import * as dotenv from 'dotenv'
import * as path from 'path'

test.beforeAll(async () => {
  dotenv.config({ path: path.join(__dirname, '../.env') })
  const db = postgres(process.env.DATABASE_URL!)
  await db`DELETE FROM documents`
  await db.end()
})

// ─── helpers ─────────────────────────────────────────────────────────────────

async function createDoc(page: Page): Promise<string> {
  await page.goto('/docs')
  await page.getByRole('button', { name: 'New document' }).click()
  await page.waitForURL(/\/docs\/editor\//)
  return page.url().split('/editor/')[1]
}

async function waitForSaved(page: Page) {
  await expect(page.getByTestId('save-state')).toHaveText('Saved', { timeout: 8000 })
}

// ─── home page ────────────────────────────────────────────────────────────────

test('home page has correct title and shows empty state', async ({ page }) => {
  await page.goto('/docs')
  await expect(page).toHaveTitle('OWL Docs')
  await expect(page.getByTestId('empty-state')).toBeVisible()
  await expect(page.getByRole('button', { name: 'New document' })).toBeVisible()
})

// ─── create document ─────────────────────────────────────────────────────────

test('clicking New document creates a doc and navigates to the editor', async ({ page }) => {
  await page.goto('/docs')
  await page.getByRole('button', { name: 'New document' }).click()
  await expect(page).toHaveURL(/\/docs\/editor\/[0-9a-f-]{36}/)
  await expect(page.getByTestId('doc-title')).toBeVisible()
})

// ─── editor — title ──────────────────────────────────────────────────────────

test('title input auto-saves after typing', async ({ page }) => {
  await createDoc(page)

  const titleInput = page.getByTestId('doc-title')
  await titleInput.fill('My Playwright Doc')
  await titleInput.blur()
  await waitForSaved(page)

  await page.getByRole('button', { name: 'Docs' }).click()
  await expect(page).toHaveURL('/docs')
  await expect(page.getByText('My Playwright Doc')).toBeVisible()
})

test('title persists after page reload', async ({ page }) => {
  const id = await createDoc(page)

  await page.getByTestId('doc-title').fill('Persistent Title')
  await page.getByTestId('doc-title').blur()
  await waitForSaved(page)

  await page.goto(`/docs/editor/${id}`)
  await expect(page.getByTestId('doc-title')).toHaveValue('Persistent Title')
})

// ─── editor — content ────────────────────────────────────────────────────────

test('content auto-saves and persists after reload', async ({ page }) => {
  const id = await createDoc(page)

  const editor = page.locator('.tiptap')
  await editor.click()
  await page.keyboard.type('Hello from Playwright')

  await expect(page.getByTestId('save-state')).toHaveText(/Unsaved|Saving/, { timeout: 3000 })
  await expect(page.getByTestId('save-state')).toHaveText('Saved', { timeout: 8000 })

  await page.goto(`/docs/editor/${id}`)
  await expect(page.locator('.tiptap')).toContainText('Hello from Playwright')
})

test('save indicator shows Unsaved while typing then Saved after debounce', async ({ page }) => {
  await createDoc(page)

  await page.locator('.tiptap').click()
  await page.keyboard.type('x')

  await expect(page.getByTestId('save-state')).toHaveText(/Unsaved|Saving/, { timeout: 3000 })
  await expect(page.getByTestId('save-state')).toHaveText('Saved', { timeout: 8000 })
})

// ─── editor — title + content together ───────────────────────────────────────

test('changing title after editing content saves both correctly', async ({ page }) => {
  const id = await createDoc(page)

  await page.locator('.tiptap').click()
  await page.keyboard.type('Content written first')

  const titleInput = page.getByTestId('doc-title')
  await titleInput.fill('Title set second')
  await titleInput.blur()
  await waitForSaved(page)

  await page.goto(`/docs/editor/${id}`)
  await expect(page.getByTestId('doc-title')).toHaveValue('Title set second')
  await expect(page.locator('.tiptap')).toContainText('Content written first')
})

// ─── home page — document list ────────────────────────────────────────────────

test('multiple documents appear in list ordered newest first', async ({ page }) => {
  await createDoc(page)
  await page.getByTestId('doc-title').fill('First Doc')
  await page.getByTestId('doc-title').blur()
  await waitForSaved(page)

  await createDoc(page)
  await page.getByTestId('doc-title').fill('Second Doc')
  await page.getByTestId('doc-title').blur()
  await waitForSaved(page)

  await page.goto('/docs')
  const rows = page.getByTestId('doc-title-link')
  await expect(rows.first()).toContainText('Second Doc')
  await expect(rows.nth(1)).toContainText('First Doc')
})

test('clicking a document in the list opens it in the editor', async ({ page }) => {
  const id = await createDoc(page)
  await page.getByTestId('doc-title').fill('Click Me')
  await page.getByTestId('doc-title').blur()
  await waitForSaved(page)

  await page.goto('/docs')
  await page.getByText('Click Me').click()
  await expect(page).toHaveURL(`/docs/editor/${id}`)
  await expect(page.getByTestId('doc-title')).toHaveValue('Click Me')
})

// ─── delete ───────────────────────────────────────────────────────────────────

test('deleting a document removes it from the list', async ({ page }) => {
  await createDoc(page)
  await page.getByTestId('doc-title').fill('Delete Me')
  await page.getByTestId('doc-title').blur()
  await waitForSaved(page)

  await page.goto('/docs')
  await expect(page.getByText('Delete Me')).toBeVisible()

  page.on('dialog', (dialog) => dialog.accept())
  await page.getByTestId('delete-doc').first().click()

  await expect(page).toHaveURL('/docs')
  await expect(page.getByText('Delete Me')).not.toBeVisible()
})

// ─── 404 ─────────────────────────────────────────────────────────────────────

test('navigating to an unknown document id shows 404', async ({ page }) => {
  await page.goto('/docs/editor/00000000-0000-0000-0000-000000000000')
  await expect(page.getByRole('heading', { name: '404' })).toBeVisible()
})
