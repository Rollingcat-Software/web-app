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

test.describe('Dashboard Page', () => {
    test.beforeEach(async ({ page }) => {
        await injectSession(page)
    })

    // -------------------------------------------------------------------------
    // Page load
    // -------------------------------------------------------------------------

    test('should load the dashboard without redirecting to /login', async ({ page }) => {
        await page.goto(`${BASE_URL}/`)
        await page.waitForLoadState('networkidle')

        await expect(page).not.toHaveURL(/login/)
    })

    test('should render the sidebar navigation', async ({ page }) => {
        await page.goto(`${BASE_URL}/`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByRole('navigation')).toBeVisible({ timeout: 15000 })
    })

    // -------------------------------------------------------------------------
    // Stat cards — DashboardPage renders 6 stat cards once data loads.
    // Card titles are i18n keys; their default English values are tested here.
    // -------------------------------------------------------------------------

    test('stat cards: Total Users card is rendered', async ({ page }) => {
        await page.goto(`${BASE_URL}/`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByText(/total users/i)).toBeVisible({ timeout: 20000 })
    })

    test('stat cards: Active Users card is rendered', async ({ page }) => {
        await page.goto(`${BASE_URL}/`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByText(/active users/i)).toBeVisible({ timeout: 20000 })
    })

    test('stat cards: Total Tenants card is rendered', async ({ page }) => {
        await page.goto(`${BASE_URL}/`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByText(/total tenants/i)).toBeVisible({ timeout: 20000 })
    })

    test('stat cards: Biometric Enrolled card is rendered', async ({ page }) => {
        await page.goto(`${BASE_URL}/`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByText(/biometric enrolled/i)).toBeVisible({ timeout: 20000 })
    })

    test('stat cards: Pending Enrollments card is rendered', async ({ page }) => {
        await page.goto(`${BASE_URL}/`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByText(/pending enrollments/i)).toBeVisible({ timeout: 20000 })
    })

    test('stat cards: Failed Enrollments card is rendered', async ({ page }) => {
        await page.goto(`${BASE_URL}/`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByText(/failed enrollments/i)).toBeVisible({ timeout: 20000 })
    })

    // -------------------------------------------------------------------------
    // System Metrics section
    // -------------------------------------------------------------------------

    test('system metrics: section heading is visible', async ({ page }) => {
        await page.goto(`${BASE_URL}/`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByText(/system metrics/i)).toBeVisible({ timeout: 20000 })
    })

    test('system metrics: Auth Success Rate metric is rendered with a progress bar', async ({ page }) => {
        await page.goto(`${BASE_URL}/`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByText(/auth success rate/i)).toBeVisible({ timeout: 20000 })

        // MUI LinearProgress renders as role="progressbar"
        const progressBars = page.getByRole('progressbar')
        await expect(progressBars.first()).toBeVisible({ timeout: 10000 })
    })

    test('system metrics: Verification Rate metric is rendered', async ({ page }) => {
        await page.goto(`${BASE_URL}/`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByText(/verification rate/i)).toBeVisible({ timeout: 20000 })
    })

    test('system metrics: Total Verifications metric is rendered', async ({ page }) => {
        await page.goto(`${BASE_URL}/`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByText(/total verifications/i)).toBeVisible({ timeout: 20000 })
    })

    test('system metrics: page renders at least two progress bars', async ({ page }) => {
        await page.goto(`${BASE_URL}/`)
        await page.waitForLoadState('networkidle')

        // Wait for data to load so progress bars are mounted
        await expect(page.getByText(/system metrics/i)).toBeVisible({ timeout: 20000 })
        const progressBars = page.getByRole('progressbar')
        expect(await progressBars.count()).toBeGreaterThanOrEqual(2)
    })

    // -------------------------------------------------------------------------
    // Recent Activity section
    // -------------------------------------------------------------------------

    test('recent activity: section heading is visible', async ({ page }) => {
        await page.goto(`${BASE_URL}/`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByText(/recent activity/i)).toBeVisible({ timeout: 20000 })
    })

    test('recent activity: section renders either activity items or a no-data message', async ({ page }) => {
        await page.goto(`${BASE_URL}/`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByText(/recent activity/i)).toBeVisible({ timeout: 20000 })

        // Either the audit log list or the "no recent activity" placeholder must be present
        const activityList = page.locator('ul[class*="MuiList"]').first()
        const noDataMsg = page.getByText(/no recent activity/i)

        const hasActivity = await activityList.isVisible({ timeout: 8000 }).catch(() => false)
        const hasNoData = await noDataMsg.isVisible({ timeout: 3000 }).catch(() => false)

        expect(hasActivity || hasNoData).toBe(true)
    })

    // -------------------------------------------------------------------------
    // Loading state
    // -------------------------------------------------------------------------

    test('loading state: resolves and displays stat cards within 20 seconds', async ({ page }) => {
        await page.goto(`${BASE_URL}/`)
        // Do NOT call waitForLoadState('networkidle') — capture the loading-to-loaded transition

        // The loading state renders "Loading Dashboard" text (i18n key dashboard.loadingDashboard)
        // After data arrives the stat cards replace it. Either the cards appear or there is no
        // network error — both mean the loading state resolved.
        await expect(page.getByText(/total users/i)).toBeVisible({ timeout: 20000 })
    })

    // -------------------------------------------------------------------------
    // No JavaScript errors
    // -------------------------------------------------------------------------

    test('should produce no uncaught JavaScript errors on load', async ({ page }) => {
        const jsErrors: string[] = []
        page.on('pageerror', (error) => {
            jsErrors.push(error.message)
        })

        await page.goto(`${BASE_URL}/`)
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(2000)

        expect(jsErrors).toHaveLength(0)
    })
})
