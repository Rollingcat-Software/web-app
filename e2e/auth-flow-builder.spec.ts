import { test, expect } from '@playwright/test'

const BASE_URL = process.env.E2E_BASE_URL || 'https://ica-fivucsas.rollingcatsoftware.com'

test.describe('Auth Flow Builder', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(`${BASE_URL}/login`)
        await page.getByLabel(/email/i).fill('admin@fivucsas.local')
        await page.getByLabel(/password/i).fill('Test@123')
        await page.getByRole('button', { name: /sign in/i }).click()
        await page.waitForURL(`${BASE_URL}/`, { timeout: 10000 })
    })

    test('should navigate to auth flows page', async ({ page }) => {
        await page.getByText('Auth Flows').click()
        await page.waitForURL(`${BASE_URL}/auth-flows`)
        await expect(page.getByText(/authentication flows/i)).toBeVisible()
    })

    test('should open create flow dialog', async ({ page }) => {
        await page.goto(`${BASE_URL}/auth-flows`)
        await page.getByRole('button', { name: /create flow/i }).click()
        await expect(page.getByText(/authentication flow builder/i)).toBeVisible()
    })

    test('should enforce password for APP_LOGIN', async ({ page }) => {
        await page.goto(`${BASE_URL}/auth-flows`)
        await page.getByRole('button', { name: /create flow/i }).click()

        // Select APP_LOGIN operation type (default)
        await expect(page.getByText(/require password as the first step/i)).toBeVisible()
    })

    test('should allow freedom for DOOR_ACCESS', async ({ page }) => {
        await page.goto(`${BASE_URL}/auth-flows`)
        await page.getByRole('button', { name: /create flow/i }).click()

        // Change operation type to DOOR_ACCESS
        await page.getByLabel(/operation type/i).click()
        await page.getByRole('option', { name: /door access/i }).click()

        // Password warning should not be visible
        await expect(page.getByText(/require password as the first step/i)).not.toBeVisible()
    })
})
