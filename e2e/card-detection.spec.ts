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

test.describe('Card Detection Page', () => {
    test.beforeEach(async ({ page }) => {
        await injectSession(page)
    })

    // -------------------------------------------------------------------------
    // Page load
    // -------------------------------------------------------------------------

    test('should load card detection page with heading', async ({ page }) => {
        await page.goto(`${BASE_URL}/card-detection`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByText(/card detection/i).first()).toBeVisible({ timeout: 15000 })
    })

    test('should display description text', async ({ page }) => {
        await page.goto(`${BASE_URL}/card-detection`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByText(/capture an image/i)).toBeVisible({ timeout: 15000 })
    })

    // -------------------------------------------------------------------------
    // Camera controls
    // -------------------------------------------------------------------------

    test('should show "Start Camera" button initially', async ({ page }) => {
        await page.goto(`${BASE_URL}/card-detection`)
        await page.waitForLoadState('networkidle')

        await expect(
            page.getByRole('button', { name: /start camera/i })
        ).toBeVisible({ timeout: 10000 })
    })

    test('should show placeholder text before camera starts', async ({ page }) => {
        await page.goto(`${BASE_URL}/card-detection`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByText(/click.*start camera.*to begin/i)).toBeVisible({ timeout: 10000 })
    })

    test('should not show "Capture & Detect" button before camera starts', async ({ page }) => {
        await page.goto(`${BASE_URL}/card-detection`)
        await page.waitForLoadState('networkidle')

        await expect(
            page.getByRole('button', { name: /capture.*detect/i })
        ).toHaveCount(0)
    })

    // -------------------------------------------------------------------------
    // No JS errors
    // -------------------------------------------------------------------------

    test('should produce no uncaught JavaScript errors', async ({ page }) => {
        const jsErrors: string[] = []
        page.on('pageerror', (error) => {
            jsErrors.push(error.message)
        })

        await page.goto(`${BASE_URL}/card-detection`)
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(2000)

        expect(jsErrors).toHaveLength(0)
    })
})
