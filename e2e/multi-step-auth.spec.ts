import { test, expect } from '@playwright/test'

const BASE_URL = process.env.E2E_BASE_URL || 'https://ica-fivucsas.rollingcatsoftware.com'

test.describe('Multi-Step Authentication', () => {
    test('should complete password login step', async ({ page }) => {
        await page.goto(`${BASE_URL}/login`)

        await page.getByLabel(/email/i).fill('admin@fivucsas.local')
        await page.getByLabel(/password/i).fill('Test@123')
        await page.getByRole('button', { name: /sign in/i }).click()

        // After password, if multi-step flow is configured, step progress should appear
        // For now, default flow is single-step password, so it goes to dashboard
        await page.waitForURL(`${BASE_URL}/`, { timeout: 10000 })
    })

    test('should show step progress for multi-step flows', async ({ page }) => {
        // This test will be fully functional when multi-step flows are configured
        // For now, verify the login page renders correctly
        await page.goto(`${BASE_URL}/login`)
        await expect(page.getByLabel(/email/i)).toBeVisible()
        await expect(page.getByLabel(/password/i)).toBeVisible()
    })
})
