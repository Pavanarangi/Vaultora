import { test, expect } from '@playwright/test'

test.describe('TrustVault Authentication Flow', () => {
  test('displays login page with branded header', async ({ page }) => {
    await page.goto('/login')

    await expect(page.locator('h1')).toContainText('TrustVault')
    await expect(page.locator('#email')).toBeVisible()
    await expect(page.locator('#password')).toBeVisible()
    await expect(page.locator('#submit-btn')).toBeVisible()
  })

  test('switches between Sign In and Sign Up tabs', async ({ page }) => {
    await page.goto('/login')

    // Initial state: Sign In
    await expect(page.locator('#full-name')).not.toBeVisible()

    // Switch to Sign Up
    await page.getByRole('button', { name: 'Sign Up' }).click()
    await expect(page.locator('#full-name')).toBeVisible()
    await expect(page.locator('#submit-btn')).toContainText('Create Account')

    // Switch back to Sign In
    await page.getByRole('button', { name: 'Sign In' }).click()
    await expect(page.locator('#full-name')).not.toBeVisible()
    await expect(page.locator('#submit-btn')).toContainText('Sign In')
  })

  test('redirects unauthenticated users to /login', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/.*\/login/)
  })
})
