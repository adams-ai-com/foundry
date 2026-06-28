import { test, expect } from '@playwright/test'

test('app loads and shows OWL Mail branding', async ({ page }) => {
  await page.goto('/mail')
  await expect(page.getByText('OWL Mail')).toBeVisible()
})

test('Compose button is visible on load', async ({ page }) => {
  await page.goto('/mail')
  await expect(page.getByTestId('compose-button')).toBeVisible()
})

test('inbox mailbox is shown in the sidebar', async ({ page }) => {
  await page.goto('/mail')
  await expect(page.getByRole('button', { name: 'Inbox' })).toBeVisible()
})

test('clicking Tasks nav switches to tasks view', async ({ page }) => {
  await page.goto('/mail')
  await page.getByTestId('nav-tasks').click()
  await expect(page.getByTestId('new-task-button')).toBeVisible()
})

test('clicking Decisions nav switches to decisions view', async ({ page }) => {
  await page.goto('/mail')
  await page.getByTestId('nav-decisions').click()
  await expect(page.getByTestId('log-decision-button')).toBeVisible()
})

test('clicking Channels nav switches to channels view', async ({ page }) => {
  await page.goto('/mail')
  await page.getByTestId('nav-channels').click()
  await expect(page.getByTestId('new-channel-button')).toBeVisible()
})

test('clicking Calendar nav switches to calendar view', async ({ page }) => {
  await page.goto('/mail')
  await page.getByTestId('nav-calendar').click()
  await expect(page.getByTestId('calendar-view')).toBeVisible()
})

test('clicking Files nav switches to files view', async ({ page }) => {
  await page.goto('/mail')
  await page.getByTestId('nav-files').click()
  await expect(page.getByRole('heading', { name: 'Files' })).toBeVisible()
})

test('navigating back to mail shows inbox', async ({ page }) => {
  await page.goto('/mail')
  await page.getByTestId('nav-tasks').click()
  await page.getByRole('button', { name: 'Inbox' }).click()
  await expect(page.getByTestId('new-task-button')).not.toBeVisible()
})

test('Compose button opens compose modal', async ({ page }) => {
  await page.goto('/mail')
  await page.getByTestId('compose-button').click()
  // Compose modal should appear — check for a "To" field or similar
  await expect(page.getByPlaceholder(/to/i)).toBeVisible({ timeout: 5000 })
})
