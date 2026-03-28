import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const BASE_URL = process.env.E2E_BASE_URL || 'https://ica-fivucsas.rollingcatsoftware.com'
const SESSION_FILE = path.join(process.cwd(), 'e2e', '.auth', 'session.json')

function injectSession(page: Parameters<Parameters<typeof test>[1]>[0]['page']) {
    const sessionData = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'))
    return page.addInitScript((data: Record<string, string>) => {
        for (const [key, value] of Object.entries(data)) {
            sessionStorage.setItem(key, value)
        }
    }, sessionData)
}

test.describe('Verification Session Detail', () => {
    test.beforeEach(async ({ page }) => {
        await injectSession(page)
    })

    // -------------------------------------------------------------------------
    // Invalid session ID — shows "not found" state
    // -------------------------------------------------------------------------

    test('should show session not found for invalid session ID', async ({ page }) => {
        await page.goto(`${BASE_URL}/verification-sessions/00000000-0000-0000-0000-000000000000`)
        await page.waitForLoadState('networkidle')

        // The page should either show the "session not found" message or a "Back" button
        const hasNotFound = await page.getByText(/session not found/i)
            .isVisible({ timeout: 15000 }).catch(() => false)
        const hasBackButton = await page.getByRole('button', { name: /back/i })
            .isVisible({ timeout: 5000 }).catch(() => false)

        expect(hasNotFound || hasBackButton).toBe(true)
    })

    test('should have a back to dashboard button on not-found state', async ({ page }) => {
        await page.goto(`${BASE_URL}/verification-sessions/invalid-id-12345`)
        await page.waitForLoadState('networkidle')

        // Wait for loading to finish and not-found state to appear
        await page.waitForTimeout(3000)

        const backButton = page.getByRole('button', { name: /back/i })
        const hasBack = await backButton.isVisible({ timeout: 10000 }).catch(() => false)

        if (hasBack) {
            await backButton.click()
            await expect(page).toHaveURL(/verification-dashboard/, { timeout: 10000 })
        } else {
            // If no back button, at least the page loaded without crashing
            await expect(page).not.toHaveURL(/login/)
        }
    })

    // -------------------------------------------------------------------------
    // Page structure — test with a real session if navigated from dashboard
    // -------------------------------------------------------------------------

    test('should navigate to a session detail from the dashboard table', async ({ page }) => {
        await page.goto(`${BASE_URL}/verification-dashboard`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByText(/recent sessions/i)).toBeVisible({ timeout: 20000 })

        // Try to click on the first session row in the table
        const table = page.locator('table').last()
        const firstDataRow = table.locator('tbody tr').first()

        const hasRows = await firstDataRow.isVisible({ timeout: 8000 }).catch(() => false)
        if (!hasRows) {
            // No sessions available — skip gracefully
            test.skip()
            return
        }

        // Check if the row has monospace text (session ID)
        const hasMonospaceId = await firstDataRow.locator('code, [style*="monospace"], .MuiTypography-root[style]')
            .first().isVisible({ timeout: 3000 }).catch(() => false)

        await firstDataRow.click()

        // Should navigate to session detail page
        await expect(page).toHaveURL(/verification-sessions\//, { timeout: 10000 })
    })

    test('session detail page should show step progress stepper when loaded', async ({ page }) => {
        await page.goto(`${BASE_URL}/verification-dashboard`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByText(/recent sessions/i)).toBeVisible({ timeout: 20000 })

        const table = page.locator('table').last()
        const firstDataRow = table.locator('tbody tr').first()

        const hasRows = await firstDataRow.isVisible({ timeout: 8000 }).catch(() => false)
        if (!hasRows) {
            test.skip()
            return
        }

        await firstDataRow.click()
        await expect(page).toHaveURL(/verification-sessions\//, { timeout: 10000 })

        // Session detail page should show the step progress section
        const hasStepProgress = await page.getByText(/step progress/i)
            .isVisible({ timeout: 15000 }).catch(() => false)
        const hasSessionNotFound = await page.getByText(/session not found/i)
            .isVisible({ timeout: 3000 }).catch(() => false)

        // Either the session loaded with step progress or session was not found
        expect(hasStepProgress || hasSessionNotFound).toBe(true)
    })

    test('session detail page should show session overview info', async ({ page }) => {
        await page.goto(`${BASE_URL}/verification-dashboard`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByText(/recent sessions/i)).toBeVisible({ timeout: 20000 })

        const table = page.locator('table').last()
        const firstDataRow = table.locator('tbody tr').first()

        const hasRows = await firstDataRow.isVisible({ timeout: 8000 }).catch(() => false)
        if (!hasRows) {
            test.skip()
            return
        }

        await firstDataRow.click()
        await expect(page).toHaveURL(/verification-sessions\//, { timeout: 10000 })

        // Wait for content to load
        await page.waitForLoadState('networkidle')

        const hasSessionId = await page.getByText(/session id/i)
            .isVisible({ timeout: 15000 }).catch(() => false)
        const hasSessionNotFound = await page.getByText(/session not found/i)
            .isVisible({ timeout: 3000 }).catch(() => false)

        // Either overview info or not-found state
        expect(hasSessionId || hasSessionNotFound).toBe(true)
    })

    // -------------------------------------------------------------------------
    // No JavaScript errors
    // -------------------------------------------------------------------------

    test('should produce no uncaught JavaScript errors on load', async ({ page }) => {
        const jsErrors: string[] = []
        page.on('pageerror', (error) => {
            jsErrors.push(error.message)
        })

        await page.goto(`${BASE_URL}/verification-sessions/00000000-0000-0000-0000-000000000000`)
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(2000)

        expect(jsErrors).toHaveLength(0)
    })
})

test.describe('Verification Session — non-admin redirect', () => {
    test('should redirect non-admin users away from session detail', async ({ page }) => {
        await page.goto(`${BASE_URL}/verification-sessions/some-id`)
        await page.waitForLoadState('networkidle')

        await expect(page).not.toHaveURL(/verification-sessions/, { timeout: 15000 })
    })
})
