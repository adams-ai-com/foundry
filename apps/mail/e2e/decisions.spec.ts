import { test, expect } from '@playwright/test'

async function goToDecisions(page: any) {
  await page.goto('/mail')
  await page.getByTestId('nav-decisions').click()
  await expect(page.getByTestId('log-decision-button')).toBeVisible()
}

test('decisions view shows empty or existing decisions', async ({ page }) => {
  await goToDecisions(page)
  const isEmpty = await page.getByText('No decisions logged yet').isVisible().catch(() => false)
  const hasList = await page.getByTestId('decision-item').count().then((n) => n > 0).catch(() => false)
  expect(isEmpty || hasList).toBe(true)
})

test('can log a new decision', async ({ page }) => {
  await goToDecisions(page)

  const subject = `Decision ${Date.now()}`
  const outcome = `We decided to test thoroughly. ${Date.now()}`

  await page.getByTestId('log-decision-button').click()
  await expect(page.getByTestId('decision-subject-input')).toBeVisible()

  await page.getByTestId('decision-subject-input').fill(subject)
  await page.getByTestId('decision-outcome-input').fill(outcome)
  await page.getByTestId('decision-save-button').click()

  await expect(page.getByText(subject)).toBeVisible({ timeout: 8000 })
})

test('save button disabled when subject or outcome is blank', async ({ page }) => {
  await goToDecisions(page)
  await page.getByTestId('log-decision-button').click()

  // Both fields blank → disabled
  await expect(page.getByTestId('decision-save-button')).toBeDisabled()

  // Subject filled but outcome blank → still disabled
  await page.getByTestId('decision-subject-input').fill('Some subject')
  await expect(page.getByTestId('decision-save-button')).toBeDisabled()

  // Both filled → enabled
  await page.getByTestId('decision-outcome-input').fill('Some outcome')
  await expect(page.getByTestId('decision-save-button')).toBeEnabled()
})

test('can cancel decision creation', async ({ page }) => {
  await goToDecisions(page)
  const beforeCount = await page.getByTestId('decision-item').count()

  await page.getByTestId('log-decision-button').click()
  await page.getByTestId('decision-subject-input').fill('Cancelled decision')
  await page.getByTestId('decision-outcome-input').fill('Never mind')
  await page.getByRole('button', { name: 'Cancel' }).click()

  await expect(page.getByTestId('decision-subject-input')).not.toBeVisible()
  const afterCount = await page.getByTestId('decision-item').count()
  expect(afterCount).toBe(beforeCount)
})

test('decision shows subject and outcome after creation', async ({ page }) => {
  await goToDecisions(page)

  const subject = `Architecture ${Date.now()}`
  const outcome = `Use pnpm monorepo for shared packages.`

  await page.getByTestId('log-decision-button').click()
  await page.getByTestId('decision-subject-input').fill(subject)
  await page.getByTestId('decision-outcome-input').fill(outcome)
  await page.getByTestId('decision-save-button').click()

  const item = page.locator('[data-testid="decision-item"]').filter({ hasText: subject })
  await expect(item).toBeVisible({ timeout: 8000 })
  await expect(item.getByText(outcome)).toBeVisible()
})

test('can delete a decision', async ({ page }) => {
  await goToDecisions(page)

  const subject = `Delete This Decision ${Date.now()}`
  await page.getByTestId('log-decision-button').click()
  await page.getByTestId('decision-subject-input').fill(subject)
  await page.getByTestId('decision-outcome-input').fill('To be deleted.')
  await page.getByTestId('decision-save-button').click()
  await expect(page.getByText(subject)).toBeVisible({ timeout: 8000 })

  const item = page.locator('[data-testid="decision-item"]').filter({ hasText: subject })
  await item.hover()
  await item.getByRole('button', { name: '×' }).click()

  await expect(page.getByText(subject)).not.toBeVisible({ timeout: 8000 })
})

test('clicking a decision expands its outcome', async ({ page }) => {
  await goToDecisions(page)

  const subject = `Expand Me ${Date.now()}`
  const outcome = 'This outcome should be visible on expand.'

  await page.getByTestId('log-decision-button').click()
  await page.getByTestId('decision-subject-input').fill(subject)
  await page.getByTestId('decision-outcome-input').fill(outcome)
  await page.getByTestId('decision-save-button').click()
  await expect(page.getByText(subject)).toBeVisible({ timeout: 8000 })

  const item = page.locator('[data-testid="decision-item"]').filter({ hasText: subject })
  await item.click()
  await expect(item.getByText(outcome)).toBeVisible()
})
