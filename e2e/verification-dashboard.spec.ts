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

test.describe('Verification Dashboard', () => {
    test.beforeEach(async ({ page }) => {
        await injectSession(page)
    })

    // -------------------------------------------------------------------------
    // Page load
    // -------------------------------------------------------------------------

    test('should load the verification dashboard for admin user', async ({ page }) => {
        await page.goto(`${BASE_URL}/verification-dashboard`)
        await page.waitForLoadState('networkidle')

        await expect(page).not.toHaveURL(/login/)
        await expect(page).toHaveURL(/verification-dashboard/)
    })

    // -------------------------------------------------------------------------
    // Stat cards
    // -------------------------------------------------------------------------

    test('stat cards: Total Verifications card is rendered', async ({ page }) => {
        await page.goto(`${BASE_URL}/verification-dashboard`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByText(/total verifications/i)).toBeVisible({ timeout: 20000 })
    })

    test('stat cards: Completion Rate card is rendered', async ({ page }) => {
        await page.goto(`${BASE_URL}/verification-dashboard`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByText(/completion rate/i)).toBeVisible({ timeout: 20000 })
    })

    test('stat cards: Average Time card is rendered', async ({ page }) => {
        await page.goto(`${BASE_URL}/verification-dashboard`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByText(/avg.*time/i)).toBeVisible({ timeout: 20000 })
    })

    test('stat cards: Failure Rate card is rendered', async ({ page }) => {
        await page.goto(`${BASE_URL}/verification-dashboard`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByText(/failure rate/i)).toBeVisible({ timeout: 20000 })
    })

    // -------------------------------------------------------------------------
    // Charts — recharts renders SVG elements inside ResponsiveContainer
    // -------------------------------------------------------------------------

    test('charts: daily verifications chart section is rendered', async ({ page }) => {
        await page.goto(`${BASE_URL}/verification-dashboard`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByText(/daily/i).first()).toBeVisible({ timeout: 20000 })

        // Either a recharts SVG chart or a "no data" placeholder should be visible
        const hasSvg = await page.locator('.recharts-responsive-container svg').first()
            .isVisible({ timeout: 8000 }).catch(() => false)
        const hasNoData = await page.getByText(/no data/i).first()
            .isVisible({ timeout: 3000 }).catch(() => false)

        expect(hasSvg || hasNoData).toBe(true)
    })

    test('charts: status distribution section is rendered', async ({ page }) => {
        await page.goto(`${BASE_URL}/verification-dashboard`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByText(/status distribution/i)).toBeVisible({ timeout: 20000 })
    })

    test('charts: failure reasons section is rendered', async ({ page }) => {
        await page.goto(`${BASE_URL}/verification-dashboard`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByText(/failure reasons/i)).toBeVisible({ timeout: 20000 })
    })

    // -------------------------------------------------------------------------
    // Sessions table
    // -------------------------------------------------------------------------

    test('sessions table: Recent Sessions heading is visible', async ({ page }) => {
        await page.goto(`${BASE_URL}/verification-dashboard`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByText(/recent sessions/i)).toBeVisible({ timeout: 20000 })
    })

    test('sessions table: column headers are present', async ({ page }) => {
        await page.goto(`${BASE_URL}/verification-dashboard`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByText(/recent sessions/i)).toBeVisible({ timeout: 20000 })

        const table = page.locator('table').last()
        await expect(table).toBeVisible()

        // Check for key column headers
        await expect(page.getByRole('columnheader', { name: /status/i })).toBeVisible()
    })

    test('sessions table: status filter dropdown is visible', async ({ page }) => {
        await page.goto(`${BASE_URL}/verification-dashboard`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByText(/recent sessions/i)).toBeVisible({ timeout: 20000 })

        // Status filter select control near the sessions table
        const statusSelect = page.locator('.MuiSelect-select').last()
        await expect(statusSelect).toBeVisible({ timeout: 10000 })
    })

    test('sessions table: shows sessions or empty state', async ({ page }) => {
        await page.goto(`${BASE_URL}/verification-dashboard`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByText(/recent sessions/i)).toBeVisible({ timeout: 20000 })

        // Either session rows or a "no data" message
        const table = page.locator('table').last()
        const rows = table.locator('tbody tr')
        const rowCount = await rows.count()
        expect(rowCount).toBeGreaterThanOrEqual(1) // At least the data row or the empty-state row
    })

    // -------------------------------------------------------------------------
    // No JavaScript errors
    // -------------------------------------------------------------------------

    test('should produce no uncaught JavaScript errors on load', async ({ page }) => {
        const jsErrors: string[] = []
        page.on('pageerror', (error) => {
            jsErrors.push(error.message)
        })

        await page.goto(`${BASE_URL}/verification-dashboard`)
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(2000)

        expect(jsErrors).toHaveLength(0)
    })
})

test.describe('Verification Dashboard — non-admin redirect', () => {
    test('should redirect non-admin users away from dashboard', async ({ page }) => {
        // Without session injection, user is not authenticated / not admin
        await page.goto(`${BASE_URL}/verification-dashboard`)
        await page.waitForLoadState('networkidle')

        // Should be redirected away from the verification-dashboard page
        await expect(page).not.toHaveURL(/verification-dashboard/, { timeout: 15000 })
    })
})
