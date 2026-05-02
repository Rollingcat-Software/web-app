import { test, expect } from '@playwright/test'

const BASE_URL = process.env.E2E_BASE_URL || 'https://app.fivucsas.com'

/**
 * Read-only smoke suite. Runs against PROD on a nightly cron and on PRs.
 *
 * Constraints:
 *  - No mutations (no POST/DELETE, no form submissions).
 *  - No authentication required (covers public/landing surface only).
 *  - Must succeed on a cold cache.
 *
 * Tagged @readonly @smoke so the `smoke` Playwright project picks it up
 * via `--grep` while excluding @destructive specs from the default project.
 */
test.describe('Smoke — readonly', { tag: ['@readonly', '@smoke'] }, () => {
    test('landing/root loads without error', async ({ page }) => {
        const response = await page.goto(`${BASE_URL}/`)
        // Either the app shell renders (200) or we get redirected to /login (also 2xx/3xx).
        expect(response?.status()).toBeLessThan(500)
        await page.waitForLoadState('domcontentloaded')
        // Any visible top-level heading or the FIVUCSAS branding should be on screen.
        const branding = page.getByText(/FIVUCSAS/i).first()
        const heading = page.locator('h1').first()
        await expect(branding.or(heading)).toBeVisible({ timeout: 15000 })
    })

    test('login page renders form', async ({ page }) => {
        await page.goto(`${BASE_URL}/login`)
        await expect(page.locator('input[name="email"]')).toBeVisible({ timeout: 15000 })
        await expect(page.locator('input[name="password"]')).toBeVisible()
        await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
    })
})
