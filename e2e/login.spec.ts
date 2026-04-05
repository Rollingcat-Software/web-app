import { test, expect } from '@playwright/test'

const BASE_URL = process.env.E2E_BASE_URL || 'https://ica-fivucsas.rollingcatsoftware.com'
const E2E_EMAIL = process.env.E2E_EMAIL || 'admin@fivucsas.local'
const E2E_PASSWORD = process.env.E2E_PASSWORD || 'Test@123'

test.describe('Login Flow', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(`${BASE_URL}/login`)
    })

    test('should display login page with form elements', async ({ page }) => {
        await expect(page.getByText('FIVUCSAS')).toBeVisible()
        await expect(page.locator('input[name="email"]')).toBeVisible()
        await expect(page.locator('input[name="password"]')).toBeVisible()
        await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
    })

    test('should show validation errors for empty fields', async ({ page }) => {
        // HTML5 required attributes prevent form submission with empty fields
        // Verify the email input has the required attribute and form stays on login page
        const emailInput = page.locator('input[name="email"]')
        await expect(emailInput).toHaveAttribute('required', '')
        await page.getByRole('button', { name: /sign in/i }).click()
        // Form should not navigate away — still on login page
        await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
    })

    test('should login with valid credentials', async ({ page }) => {
        await page.locator('input[name="email"]').fill(E2E_EMAIL)
        await page.locator('input[name="password"]').fill(E2E_PASSWORD)

        // Wait for the login API call before checking UI
        const loginResponsePromise = page.waitForResponse(
            (resp) => resp.url().includes('/auth/login') && resp.request().method() === 'POST',
            { timeout: 20000 }
        )
        await page.getByRole('button', { name: /sign in/i }).click()
        await loginResponsePromise

        // Wait for dashboard sidebar to appear (SPA navigation, no page reload)
        await expect(page.getByRole('button', { name: 'Users' })).toBeVisible({ timeout: 30000 })
    })

    test('should show error for invalid credentials', async ({ page }) => {
        await page.locator('input[name="email"]').fill('wrong@email.com')
        await page.locator('input[name="password"]').fill('wrongpassword')
        await page.getByRole('button', { name: /sign in/i }).click()

        await expect(page.getByRole('alert').first()).toBeVisible({ timeout: 10000 })
    })
})
