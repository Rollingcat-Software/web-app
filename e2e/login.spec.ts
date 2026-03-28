import { test, expect } from '@playwright/test'

const BASE_URL = process.env.E2E_BASE_URL || 'https://ica-fivucsas.rollingcatsoftware.com'

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
        await page.locator('input[name="email"]').fill('admin@fivucsas.local')
        await page.locator('input[name="password"]').fill('Test@123')
        await page.getByRole('button', { name: /sign in/i }).click()

        // Wait for dashboard sidebar to appear (SPA navigation, no page reload)
        await expect(page.getByRole('button', { name: 'Users' })).toBeVisible({ timeout: 15000 })
    })

    test('should show error for invalid credentials', async ({ page }) => {
        await page.locator('input[name="email"]').fill('wrong@email.com')
        await page.locator('input[name="password"]').fill('wrongpassword')
        await page.getByRole('button', { name: /sign in/i }).click()

        await expect(page.getByRole('alert').first()).toBeVisible({ timeout: 10000 })
    })
})
