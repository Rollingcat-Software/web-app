import { test, expect } from '@playwright/test'

const BASE_URL = process.env.E2E_BASE_URL || 'https://ica-fivucsas.rollingcatsoftware.com'

test.describe('Users CRUD', () => {
    test.beforeEach(async ({ page }) => {
        // Login first
        await page.goto(`${BASE_URL}/login`)
        await page.getByLabel(/email/i).fill('admin@fivucsas.local')
        await page.getByLabel(/password/i).fill('Test@123')
        await page.getByRole('button', { name: /sign in/i }).click()
        await page.waitForURL(`${BASE_URL}/`, { timeout: 10000 })
    })

    test('should navigate to users list', async ({ page }) => {
        await page.getByText('Users').click()
        await page.waitForURL(`${BASE_URL}/users`)
        await expect(page.getByText(/users/i)).toBeVisible()
    })

    test('should display users table', async ({ page }) => {
        await page.goto(`${BASE_URL}/users`)
        await expect(page.locator('table')).toBeVisible({ timeout: 10000 })
    })

    test('should navigate to create user form', async ({ page }) => {
        await page.goto(`${BASE_URL}/users`)
        const createBtn = page.getByRole('button', { name: /create|add/i })
        if (await createBtn.isVisible()) {
            await createBtn.click()
            await page.waitForURL(`${BASE_URL}/users/create`)
        }
    })
})
