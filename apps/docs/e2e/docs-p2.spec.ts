import { test, expect, Page } from '@playwright/test'

async function createDoc(page: Page): Promise<string> {
  await page.goto('/docs')
  await page.getByRole('button', { name: 'New document' }).click()
  await page.waitForURL(/\/docs\/editor\//)
  return page.url().split('/editor/')[1]
}

async function waitForSaved(page: Page) {
  await expect(page.getByTestId('save-state')).toHaveText('Saved', { timeout: 8000 })
}

// ─── Version history ─────────────────────────────────────────────────────────

test('version history panel opens and closes', async ({ page }) => {
  await createDoc(page)
  await page.locator('button[title="Version history"]').click()
  await expect(page.getByRole('dialog', { name: 'Version history' })).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('dialog', { name: 'Version history' })).not.toBeVisible()
})

test('version history shows empty state before edits', async ({ page }) => {
  await createDoc(page)
  await page.locator('button[title="Version history"]').click()
  await expect(page.getByText('No versions yet')).toBeVisible()
})

test('auto-checkpoint appears in history after editing', async ({ page }) => {
  const id = await createDoc(page)
  await page.locator('.tiptap').click()
  await page.keyboard.type('Checkpoint content')
  await waitForSaved(page)

  // Force a second save to trigger checkpoint (need content change)
  await page.goto(`/docs/editor/${id}`)
  await page.locator('.tiptap').click()
  await page.keyboard.type(' more')
  await waitForSaved(page)

  await page.locator('button[title="Version history"]').click()
  // At least one version entry should exist after edits
  await expect(page.locator('[role="dialog"][aria-label="Version history"] ul li').first()).toBeVisible({ timeout: 5000 })
})

test('named version: save and appears in list', async ({ page }) => {
  await createDoc(page)
  await page.locator('.tiptap').click()
  await page.keyboard.type('Content for named version')
  await waitForSaved(page)

  await page.locator('button[title="Version history"]').click()
  await page.getByText('+ Name this version').click()
  await page.getByPlaceholder('Version name…').fill('My milestone')
  await page.getByRole('button', { name: 'Save' }).click({ force: true })

  await expect(page.getByText('My milestone')).toBeVisible({ timeout: 5000 })
})

// ─── Comments ────────────────────────────────────────────────────────────────

test('comments panel opens and closes', async ({ page }) => {
  await createDoc(page)
  await page.locator('button[title="Comments"]').evaluate(btn => btn.click())
  await expect(page.getByRole('dialog', { name: 'Comments' })).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('dialog', { name: 'Comments' })).not.toBeVisible()
})

test('adding a comment shows it in the list', async ({ page }) => {
  await createDoc(page)
  await page.locator('button[title="Comments"]').evaluate(btn => btn.click())
  await expect(page.getByText('No comments yet')).toBeVisible()

  await page.getByPlaceholder('Add a comment…').fill('This is a test comment')
  await page.getByRole('button', { name: 'Comment', exact: true }).click()

  await expect(page.getByText('This is a test comment')).toBeVisible({ timeout: 5000 })
})

test('resolving a comment moves it to resolved section', async ({ page }) => {
  await createDoc(page)
  await page.locator('button[title="Comments"]').evaluate(btn => btn.click())
  await page.getByPlaceholder('Add a comment…').fill('Resolve me')
  await page.getByRole('button', { name: 'Comment', exact: true }).click()
  await expect(page.getByText('Resolve me')).toBeVisible({ timeout: 5000 })

  // Hover the comment to reveal the Resolve button
  const commentItem = page.locator('[role="dialog"][aria-label="Comments"] li').filter({ hasText: 'Resolve me' })
  await commentItem.hover()
  await commentItem.getByRole('button', { name: 'Resolve', exact: true }).click()

  await expect(page.getByText('Resolved')).toBeVisible({ timeout: 5000 })
  await expect(page.locator('.line-through', { hasText: 'Resolve me' })).toBeVisible()
})

// ─── Export ───────────────────────────────────────────────────────────────────

test('export link triggers a .docx download', async ({ page }) => {
  const id = await createDoc(page)
  await page.getByTestId('doc-title').fill('Test Export Doc')
  await page.getByTestId('doc-title').blur()
  await waitForSaved(page)

  // Navigate back to the doc to pick up the saved title
  await page.goto(`/docs/editor/${id}`)

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('a[title="Export as .docx"]').click(),
  ])
  expect(download.suggestedFilename()).toMatch(/\.docx$/)
})

// ─── Import ───────────────────────────────────────────────────────────────────

test('import button is visible in the editor header', async ({ page }) => {
  await createDoc(page)
  await expect(page.getByRole('button', { name: 'Import' })).toBeVisible()
})

// ─── History + Comments mutually exclusive ────────────────────────────────────

test('opening comments panel closes history panel', async ({ page }) => {
  await createDoc(page)
  await page.locator('button[title="Version history"]').click()
  await expect(page.getByRole('dialog', { name: 'Version history' })).toBeVisible()

  await page.locator('button[title="Comments"]').evaluate(btn => btn.click())
  await expect(page.getByRole('dialog', { name: 'Version history' })).not.toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Comments' })).toBeVisible()
})
