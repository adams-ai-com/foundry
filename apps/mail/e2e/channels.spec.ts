import { test, expect } from '@playwright/test'

async function goToChannels(page: any) {
  await page.goto('/mail')
  await page.getByTestId('nav-channels').click()
  await expect(page.getByTestId('new-channel-button')).toBeVisible()
}

test('channels view shows channels sidebar and new-channel button', async ({ page }) => {
  await goToChannels(page)
  await expect(page.getByTestId('new-channel-button')).toBeVisible()
})

test('can create a new channel', async ({ page }) => {
  await goToChannels(page)

  const name = `test-${Date.now()}`
  await page.getByTestId('new-channel-button').click()
  await expect(page.getByText('New Channel')).toBeVisible()

  await page.getByPlaceholder('e.g. engineering').fill(name)
  await page.getByRole('button', { name: 'Create' }).click()

  // Channel should appear in the sidebar
  await expect(page.getByTestId(`channel-item-${name}`)).toBeVisible({ timeout: 8000 })
})

test('create button is disabled when channel name is blank', async ({ page }) => {
  await goToChannels(page)
  await page.getByTestId('new-channel-button').click()
  await expect(page.getByRole('button', { name: 'Create' })).toBeDisabled()
})

test('can cancel new channel creation', async ({ page }) => {
  await goToChannels(page)
  await page.getByTestId('new-channel-button').click()
  await expect(page.getByText('New Channel')).toBeVisible()

  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByText('New Channel')).not.toBeVisible()
})

test('can post a message to a channel', async ({ page }) => {
  await goToChannels(page)

  // Create a channel first
  const name = `msg-${Date.now()}`
  await page.getByTestId('new-channel-button').click()
  await page.getByPlaceholder('e.g. engineering').fill(name)
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByTestId(`channel-item-${name}`)).toBeVisible({ timeout: 8000 })

  // Post a message
  const messageText = `Hello ${Date.now()}`
  await page.getByTestId('message-input').fill(messageText)
  await page.getByTestId('message-send-button').click()

  await expect(page.getByText(messageText)).toBeVisible({ timeout: 8000 })
})

test('send button is disabled when message is blank', async ({ page }) => {
  await goToChannels(page)

  // Create a channel to activate the compose area
  const name = `empty-msg-${Date.now()}`
  await page.getByTestId('new-channel-button').click()
  await page.getByPlaceholder('e.g. engineering').fill(name)
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByTestId('message-input')).toBeVisible({ timeout: 8000 })

  await expect(page.getByTestId('message-send-button')).toBeDisabled()
})

test('pressing Enter in message input sends the message', async ({ page }) => {
  await goToChannels(page)

  const name = `enter-${Date.now()}`
  await page.getByTestId('new-channel-button').click()
  await page.getByPlaceholder('e.g. engineering').fill(name)
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByTestId('message-input')).toBeVisible({ timeout: 8000 })

  const messageText = `Enter to send ${Date.now()}`
  await page.getByTestId('message-input').fill(messageText)
  await page.getByTestId('message-input').press('Enter')

  await expect(page.getByText(messageText)).toBeVisible({ timeout: 8000 })
})

test('clicking a channel in sidebar activates it', async ({ page }) => {
  await goToChannels(page)

  // Create two channels
  const name1 = `ch1-${Date.now()}`
  const name2 = `ch2-${Date.now()}`

  await page.getByTestId('new-channel-button').click()
  await page.getByPlaceholder('e.g. engineering').fill(name1)
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByTestId(`channel-item-${name1}`)).toBeVisible({ timeout: 8000 })

  await page.getByTestId('new-channel-button').click()
  await page.getByPlaceholder('e.g. engineering').fill(name2)
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByTestId(`channel-item-${name2}`)).toBeVisible({ timeout: 8000 })

  // Switch back to ch1
  await page.getByTestId(`channel-item-${name1}`).click()
  await expect(page.getByPlaceholder(`Message #${name1}`)).toBeVisible()
})
