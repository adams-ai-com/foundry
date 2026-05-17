import { test, expect, Page } from '@playwright/test'

// ─── helpers ─────────────────────────────────────────────────────────────────

async function createDoc(page: Page): Promise<string> {
  await page.goto('/')
  await page.getByRole('button', { name: 'New document' }).click()
  await page.waitForURL(/\/editor\//)
  return page.url().split('/editor/')[1]
}

async function waitForSaved(page: Page) {
  // Use data-testid + exact text so we don't match "Unsaved" or "Saving…"
  await expect(page.getByTestId('save-state')).toHaveText('Saved', { timeout: 8000 })
}

// ─── home page ────────────────────────────────────────────────────────────────

test('home page shows app name and empty state', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Foundry Docs')).toBeVisible()
  await expect(page.getByTestId('empty-state')).toBeVisible()
  await expect(page.getByRole('button', { name: 'New document' })).toBeVisible()
})

// ─── create document ─────────────────────────────────────────────────────────

test('clicking New document creates a doc and navigates to the editor', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'New document' }).click()
  await expect(page).toHaveURL(/\/editor\/[0-9a-f-]{36}/)
  await expect(page.getByTestId('doc-title')).toBeVisible()
})

// ─── editor — title ──────────────────────────────────────────────────────────

test('title input auto-saves after typing', async ({ page }) => {
  await createDoc(page)

  const titleInput = page.getByTestId('doc-title')
  await titleInput.fill('My Playwright Doc')
  // Blur triggers immediate flush save
  await titleInput.blur()
  await waitForSaved(page)

  // Navigate home and confirm title appears in list
  await page.getByText('← Docs').click()
  await expect(page).toHaveURL('/')
  await expect(page.getByText('My Playwright Doc')).toBeVisible()
})

test('title persists after page reload', async ({ page }) => {
  const id = await createDoc(page)

  await page.getByTestId('doc-title').fill('Persistent Title')
  await page.getByTestId('doc-title').blur()
  await waitForSaved(page)

  await page.goto(`/editor/${id}`)
  await expect(page.getByTestId('doc-title')).toHaveValue('Persistent Title')
})

// ─── editor — content ────────────────────────────────────────────────────────

test('content auto-saves and persists after reload', async ({ page }) => {
  const id = await createDoc(page)

  // Click inside the TipTap editor and type
  const editor = page.locator('.tiptap')
  await editor.click()
  await page.keyboard.type('Hello from Playwright')

  // Wait for unsaved state to confirm typing was detected, then wait for save
  await expect(page.getByTestId('save-state')).toHaveText(/Unsaved|Saving/, { timeout: 3000 })
  await expect(page.getByTestId('save-state')).toHaveText('Saved', { timeout: 8000 })

  // Reload and verify content is still there
  await page.goto(`/editor/${id}`)
  await expect(page.locator('.tiptap')).toContainText('Hello from Playwright')
})

test('save indicator shows Unsaved while typing then Saved after debounce', async ({ page }) => {
  await createDoc(page)

  await page.locator('.tiptap').click()
  await page.keyboard.type('x')

  // Should briefly show Unsaved or Saving
  await expect(page.getByTestId('save-state')).toHaveText(/Unsaved|Saving/, { timeout: 3000 })

  // Then settle on Saved
  await expect(page.getByTestId('save-state')).toHaveText('Saved', { timeout: 8000 })
})

// ─── editor — title + content together ───────────────────────────────────────

test('changing title after editing content saves both correctly', async ({ page }) => {
  const id = await createDoc(page)

  // Type content first
  await page.locator('.tiptap').click()
  await page.keyboard.type('Content written first')

  // Then change title
  const titleInput = page.getByTestId('doc-title')
  await titleInput.fill('Title set second')
  await titleInput.blur()
  await waitForSaved(page)

  // Reload and verify both are persisted
  await page.goto(`/editor/${id}`)
  await expect(page.getByTestId('doc-title')).toHaveValue('Title set second')
  await expect(page.locator('.tiptap')).toContainText('Content written first')
})

// ─── home page — document list ────────────────────────────────────────────────

test('multiple documents appear in list ordered newest first', async ({ page }) => {
  // Create two docs with different titles
  await createDoc(page)
  await page.getByTestId('doc-title').fill('First Doc')
  await page.getByTestId('doc-title').blur()
  await waitForSaved(page)

  await createDoc(page)
  await page.getByTestId('doc-title').fill('Second Doc')
  await page.getByTestId('doc-title').blur()
  await waitForSaved(page)

  await page.goto('/')
  const rows = page.getByTestId('doc-title-link')
  // Newest updated first
  await expect(rows.first()).toContainText('Second Doc')
  await expect(rows.nth(1)).toContainText('First Doc')
})

test('clicking a document in the list opens it in the editor', async ({ page }) => {
  const id = await createDoc(page)
  await page.getByTestId('doc-title').fill('Click Me')
  await page.getByTestId('doc-title').blur()
  await waitForSaved(page)

  await page.goto('/')
  await page.getByText('Click Me').click()
  await expect(page).toHaveURL(`/editor/${id}`)
  await expect(page.getByTestId('doc-title')).toHaveValue('Click Me')
})

// ─── delete ───────────────────────────────────────────────────────────────────

test('deleting a document removes it from the list', async ({ page }) => {
  await createDoc(page)
  await page.getByTestId('doc-title').fill('Delete Me')
  await page.getByTestId('doc-title').blur()
  await waitForSaved(page)

  await page.goto('/')
  await expect(page.getByText('Delete Me')).toBeVisible()

  // Hover to reveal delete button, then click — handle the confirm dialog
  page.on('dialog', (dialog) => dialog.accept())
  await page.getByTestId('delete-doc').first().click()

  // Should redirect to home, doc gone
  await expect(page).toHaveURL('/')
  await expect(page.getByText('Delete Me')).not.toBeVisible()
})

// ─── 404 ─────────────────────────────────────────────────────────────────────

test('navigating to an unknown document id shows 404', async ({ page }) => {
  await page.goto('/editor/00000000-0000-0000-0000-000000000000')
  // Next.js 404 page renders both an h1 "404" and an h2 with the message
  await expect(page.getByRole('heading', { name: '404' })).toBeVisible()
})
