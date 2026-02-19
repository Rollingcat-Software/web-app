import { test, expect } from '@playwright/test'

const BASE_URL = process.env.E2E_BASE_URL || 'https://ica-fivucsas.rollingcatsoftware.com'

test.describe('Login Flow', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(`${BASE_URL}/login`)
    })

    test('should display login page with form elements', async ({ page }) => {
        await expect(page.getByText('FIVUCSAS')).toBeVisible()
        await expect(page.getByLabel(/email/i)).toBeVisible()
        await expect(page.getByLabel(/password/i)).toBeVisible()
        await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
    })

    test('should show validation errors for empty fields', async ({ page }) => {
        await page.getByRole('button', { name: /sign in/i }).click()
        await expect(page.getByText(/email is required/i)).toBeVisible()
    })

    test('should login with valid credentials', async ({ page }) => {
        await page.getByLabel(/email/i).fill('admin@fivucsas.local')
        await page.getByLabel(/password/i).fill('Test@123')
        await page.getByRole('button', { name: /sign in/i }).click()

        // Should redirect to dashboard
        await page.waitForURL(`${BASE_URL}/`, { timeout: 10000 })
        await expect(page.getByText(/dashboard/i)).toBeVisible()
    })

    test('should show error for invalid credentials', async ({ page }) => {
        await page.getByLabel(/email/i).fill('wrong@email.com')
        await page.getByLabel(/password/i).fill('wrongpassword')
        await page.getByRole('button', { name: /sign in/i }).click()

        await expect(page.getByRole('alert')).toBeVisible({ timeout: 5000 })
    })
})
