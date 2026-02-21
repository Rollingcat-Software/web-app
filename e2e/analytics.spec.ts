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

test.describe('Analytics Page', () => {
    test.beforeEach(async ({ page }) => {
        await injectSession(page)
    })

    // -------------------------------------------------------------------------
    // Navigation
    // -------------------------------------------------------------------------

    test('should navigate to /analytics via sidebar', async ({ page }) => {
        await page.goto(`${BASE_URL}/`)
        await page.waitForLoadState('networkidle')

        const analyticsBtn = page.getByRole('button', { name: 'Analytics' })
        await expect(analyticsBtn).toBeVisible({ timeout: 15000 })
        await analyticsBtn.click()
        await page.waitForLoadState('networkidle')

        await expect(page).toHaveURL(/analytics/)
    })

    // -------------------------------------------------------------------------
    // Page render
    // -------------------------------------------------------------------------

    test('should render the Analytics heading without errors', async ({ page }) => {
        await page.goto(`${BASE_URL}/analytics`)
        await page.waitForLoadState('networkidle')

        // AnalyticsPage always renders an "Analytics" heading (hardcoded, not translated)
        await expect(page.getByText('Analytics').first()).toBeVisible({ timeout: 15000 })
    })

    test('should render the descriptive subtitle text', async ({ page }) => {
        await page.goto(`${BASE_URL}/analytics`)
        await page.waitForLoadState('networkidle')

        await expect(
            page.getByText(/visual insights from your identity platform data/i)
        ).toBeVisible({ timeout: 15000 })
    })

    test('should not render an error alert under normal conditions', async ({ page }) => {
        await page.goto(`${BASE_URL}/analytics`)
        await page.waitForLoadState('networkidle')

        // The error path renders "Failed to load analytics" — it must NOT be present
        await expect(page.getByText(/failed to load analytics/i)).not.toBeVisible({ timeout: 15000 })
    })

    // -------------------------------------------------------------------------
    // Chart sections — card titles from AnalyticsPage.tsx
    // -------------------------------------------------------------------------

    test('should render the Platform Overview chart card', async ({ page }) => {
        await page.goto(`${BASE_URL}/analytics`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByText('Platform Overview')).toBeVisible({ timeout: 20000 })
    })

    test('should render the Success Rates chart card', async ({ page }) => {
        await page.goto(`${BASE_URL}/analytics`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByText('Success Rates')).toBeVisible({ timeout: 20000 })
    })

    test('should render the User Status Distribution chart card', async ({ page }) => {
        await page.goto(`${BASE_URL}/analytics`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByText('User Status Distribution')).toBeVisible({ timeout: 20000 })
    })

    test('should render the Enrollment Status chart card', async ({ page }) => {
        await page.goto(`${BASE_URL}/analytics`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByText('Enrollment Status')).toBeVisible({ timeout: 20000 })
    })

    test('should render the Activity by Type chart card', async ({ page }) => {
        await page.goto(`${BASE_URL}/analytics`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByText('Activity by Type')).toBeVisible({ timeout: 20000 })
    })

    test('should render the Activity Timeline chart card', async ({ page }) => {
        await page.goto(`${BASE_URL}/analytics`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByText('Activity Timeline')).toBeVisible({ timeout: 20000 })
    })

    // -------------------------------------------------------------------------
    // No JavaScript errors
    // -------------------------------------------------------------------------

    test('should produce no uncaught JavaScript errors', async ({ page }) => {
        const jsErrors: string[] = []

        page.on('pageerror', (error) => {
            jsErrors.push(error.message)
        })

        await page.goto(`${BASE_URL}/analytics`)
        await page.waitForLoadState('networkidle')

        // Allow animations and async data fetching to complete
        await page.waitForTimeout(3000)

        expect(jsErrors).toHaveLength(0)
    })

    // -------------------------------------------------------------------------
    // Recharts SVG elements are mounted (charts actually render)
    // -------------------------------------------------------------------------

    test('should mount at least one SVG chart element on the page', async ({ page }) => {
        await page.goto(`${BASE_URL}/analytics`)
        await page.waitForLoadState('networkidle')

        // Recharts renders <svg> elements with class "recharts-surface" inside ResponsiveContainer
        await expect(page.locator('.recharts-surface').first()).toBeVisible({ timeout: 20000 })
    })

    // -------------------------------------------------------------------------
    // Loading state transition
    // -------------------------------------------------------------------------

    test('should not remain in loading state indefinitely', async ({ page }) => {
        await page.goto(`${BASE_URL}/analytics`)

        // The loading state renders a single CircularProgress — it must eventually disappear
        // and be replaced by the chart grid
        await expect(page.getByText('Platform Overview')).toBeVisible({ timeout: 20000 })
    })
})
