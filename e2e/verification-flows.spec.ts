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

test.describe('Verification Flow Builder', () => {
    test.beforeEach(async ({ page }) => {
        await injectSession(page)
    })

    // -------------------------------------------------------------------------
    // Page load
    // -------------------------------------------------------------------------

    test('should load the verification flows page for admin user', async ({ page }) => {
        await page.goto(`${BASE_URL}/verification-flows`)
        await page.waitForLoadState('networkidle')

        await expect(page).not.toHaveURL(/login/)
        await expect(page).toHaveURL(/verification-flows/)
    })

    // -------------------------------------------------------------------------
    // Flow table
    // -------------------------------------------------------------------------

    test('should display the flows table with headers', async ({ page }) => {
        await page.goto(`${BASE_URL}/verification-flows`)
        await page.waitForLoadState('networkidle')

        // Table should be visible (either with flows or the empty-state row)
        const table = page.locator('table')
        await expect(table).toBeVisible({ timeout: 15000 })

        // Column headers
        await expect(page.getByRole('columnheader', { name: /name/i })).toBeVisible()
        await expect(page.getByRole('columnheader', { name: /status/i })).toBeVisible()
    })

    // -------------------------------------------------------------------------
    // Buttons
    // -------------------------------------------------------------------------

    test('should have a "Create Flow" button', async ({ page }) => {
        await page.goto(`${BASE_URL}/verification-flows`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByRole('button', { name: /create flow/i })).toBeVisible({ timeout: 15000 })
    })

    test('should have a "Create from Template" button', async ({ page }) => {
        await page.goto(`${BASE_URL}/verification-flows`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByRole('button', { name: /create from template/i })).toBeVisible({ timeout: 15000 })
    })

    // -------------------------------------------------------------------------
    // Create flow dialog
    // -------------------------------------------------------------------------

    test('should open the create flow dialog when clicking Create Flow', async ({ page }) => {
        await page.goto(`${BASE_URL}/verification-flows`)
        await page.waitForLoadState('networkidle')

        await page.getByRole('button', { name: /create flow/i }).click()

        // Dialog should appear with step editor and step type buttons
        await expect(page.getByText(/step editor/i)).toBeVisible({ timeout: 10000 })
        await expect(page.getByRole('button', { name: /document scan/i })).toBeVisible()
        await expect(page.getByRole('button', { name: /face match/i })).toBeVisible()
    })

    // -------------------------------------------------------------------------
    // Template selector dialog
    // -------------------------------------------------------------------------

    test('should open template selector dialog when clicking Create from Template', async ({ page }) => {
        await page.goto(`${BASE_URL}/verification-flows`)
        await page.waitForLoadState('networkidle')

        await page.getByRole('button', { name: /create from template/i }).click()

        // Template selector dialog should appear
        await expect(page.getByText(/select template/i)).toBeVisible({ timeout: 10000 })
    })

    test('template selector should show templates with step chips or empty state', async ({ page }) => {
        await page.goto(`${BASE_URL}/verification-flows`)
        await page.waitForLoadState('networkidle')

        await page.getByRole('button', { name: /create from template/i }).click()
        await expect(page.getByText(/select template/i)).toBeVisible({ timeout: 10000 })

        // Either template cards with chips or the "no templates" message should be present
        const hasTemplates = await page.locator('.MuiChip-root').first()
            .isVisible({ timeout: 8000 }).catch(() => false)
        const hasNoTemplates = await page.getByText(/no templates/i)
            .isVisible({ timeout: 3000 }).catch(() => false)

        expect(hasTemplates || hasNoTemplates).toBe(true)
    })

    // -------------------------------------------------------------------------
    // No JavaScript errors
    // -------------------------------------------------------------------------

    test('should produce no uncaught JavaScript errors on load', async ({ page }) => {
        const jsErrors: string[] = []
        page.on('pageerror', (error) => {
            jsErrors.push(error.message)
        })

        await page.goto(`${BASE_URL}/verification-flows`)
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(2000)

        expect(jsErrors).toHaveLength(0)
    })
})

test.describe('Verification Flows — non-admin redirect', () => {
    test('should redirect non-admin users to dashboard', async ({ page }) => {
        // Without session injection, user is not authenticated / not admin
        // AdminRoute redirects to "/" for non-admin users
        await page.goto(`${BASE_URL}/verification-flows`)
        await page.waitForLoadState('networkidle')

        // Should be redirected away from the verification-flows page
        // Either to /login (unauthenticated) or / (non-admin)
        await expect(page).not.toHaveURL(/verification-flows/, { timeout: 15000 })
    })
})
