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

    test('login page renders identifier-first form', async ({ page }) => {
        // The dashboard login is IDENTIFIER-FIRST (config-driven, login-config
        // engineActive=true): the opening screen collects the email and the
        // password field is revealed only after a valid identifier + Continue.
        // (Before the config-driven work it was a combined email+password form;
        // this assertion was updated 2026-06-12 to the shipped flow — verified
        // live on app.fivucsas.com: initial render had NO password field, a
        // "Continue" button, and the password+"Sign in" appeared after Continue.)
        //
        // When the login-config fetch fails (e.g. a network that blocks the API)
        // the page degrades to the legacy combined email+password form — so we
        // assert the email box + EITHER a "Continue" (identifier-first) or a
        // "Sign in" (legacy fallback) button, both of which are valid healthy
        // states. We do NOT submit anything (read-only smoke).
        await page.goto(`${BASE_URL}/login`)
        await expect(page.locator('input[name="email"]')).toBeVisible({ timeout: 15000 })
        const continueBtn = page.getByRole('button', { name: /continue/i })
        const signInBtn = page.getByRole('button', { name: /sign in/i })
        await expect(continueBtn.or(signInBtn).first()).toBeVisible()
    })
})
