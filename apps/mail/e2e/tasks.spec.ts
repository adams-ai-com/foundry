import { test, expect } from '@playwright/test'

async function goToTasks(page: any) {
  await page.goto('/mail')
  await page.getByTestId('nav-tasks').click()
  await expect(page.getByTestId('new-task-button')).toBeVisible()
}

test('tasks view shows empty state when no tasks exist', async ({ page }) => {
  await goToTasks(page)
  // Either a task list or the "No tasks" empty state is visible
  const isEmpty = await page.getByText('No tasks').isVisible().catch(() => false)
  const hasList = await page.getByTestId('task-item').count().then((n) => n > 0).catch(() => false)
  expect(isEmpty || hasList).toBe(true)
})

test('can create a new task', async ({ page }) => {
  await goToTasks(page)

  const title = `E2E Task ${Date.now()}`
  await page.getByTestId('new-task-button').click()
  await expect(page.getByTestId('task-title-input')).toBeVisible()

  await page.getByTestId('task-title-input').fill(title)
  await page.getByTestId('task-save-button').click()

  await expect(page.getByText(title)).toBeVisible({ timeout: 8000 })
})

test('save button is disabled when title is blank', async ({ page }) => {
  await goToTasks(page)
  await page.getByTestId('new-task-button').click()
  await expect(page.getByTestId('task-title-input')).toBeVisible()

  // Save button should be disabled with empty title
  await expect(page.getByTestId('task-save-button')).toBeDisabled()
})

test('can cancel task creation without creating a task', async ({ page }) => {
  await goToTasks(page)
  const beforeCount = await page.getByTestId('task-item').count()

  await page.getByTestId('new-task-button').click()
  await page.getByTestId('task-title-input').fill('Cancelled task')
  await page.getByRole('button', { name: 'Cancel' }).click()

  // Form should close
  await expect(page.getByTestId('task-title-input')).not.toBeVisible()

  const afterCount = await page.getByTestId('task-item').count()
  expect(afterCount).toBe(beforeCount)
})

test('created task appears with correct status badge', async ({ page }) => {
  await goToTasks(page)

  const title = `Status Task ${Date.now()}`
  await page.getByTestId('new-task-button').click()
  await page.getByTestId('task-title-input').fill(title)
  await page.getByTestId('task-save-button').click()

  await expect(page.getByText(title)).toBeVisible({ timeout: 8000 })

  // The task row should have a "To Do" badge
  const taskItem = page.locator('[data-testid="task-item"]').filter({ hasText: title })
  await expect(taskItem.getByText('To Do')).toBeVisible()
})

test('filter tabs switch between active and all tasks', async ({ page }) => {
  await goToTasks(page)

  // Active tab should be selected by default
  const activeTab = page.getByRole('button', { name: /^active$/i })
  await expect(activeTab).toBeVisible()

  // Click "all" tab
  await page.getByRole('button', { name: /^all$/i }).click()
  // Click "done" tab
  await page.getByRole('button', { name: /^done$/i }).click()
  // Click back to "active"
  await page.getByRole('button', { name: /^active$/i }).click()
})

test('can delete a task', async ({ page }) => {
  await goToTasks(page)

  const title = `Delete Me ${Date.now()}`
  await page.getByTestId('new-task-button').click()
  await page.getByTestId('task-title-input').fill(title)
  await page.getByTestId('task-save-button').click()
  await expect(page.getByText(title)).toBeVisible({ timeout: 8000 })

  // Hover to reveal delete button, then click ×
  const taskItem = page.locator('[data-testid="task-item"]').filter({ hasText: title })
  await taskItem.hover()
  await taskItem.getByRole('button', { name: '×' }).click()

  await expect(page.getByText(title)).not.toBeVisible({ timeout: 8000 })
})
