import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const BASE_URL = process.env.E2E_BASE_URL || 'https://app.fivucsas.com'
const SESSION_FILE = path.join(process.cwd(), 'e2e', '.auth', 'session.json')

function injectSession(page: Parameters<Parameters<typeof test>[1]>[0]['page']) {
    const sessionData = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'))
    return page.addInitScript((data: Record<string, string>) => {
        for (const [key, value] of Object.entries(data)) {
            sessionStorage.setItem(key, value)
        }
    }, sessionData)
}

test.describe('NFC Enrollment Page', () => {
    test.beforeEach(async ({ page }) => {
        await injectSession(page)
    })

    // -------------------------------------------------------------------------
    // Page load
    // -------------------------------------------------------------------------

    test('should load NFC enrollment page with heading', async ({ page }) => {
        await page.goto(`${BASE_URL}/nfc-enrollment`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByText(/nfc enrollment/i).first()).toBeVisible({ timeout: 15000 })
    })

    // -------------------------------------------------------------------------
    // Fallback message on non-NFC browsers
    // -------------------------------------------------------------------------

    test('should show "Web NFC Not Available" fallback on desktop browsers', async ({ page }) => {
        await page.goto(`${BASE_URL}/nfc-enrollment`)
        await page.waitForLoadState('networkidle')

        // Desktop Chrome does NOT support Web NFC (NDEFReader), so the fallback view should appear
        await expect(page.getByText(/web nfc not available/i)).toBeVisible({ timeout: 10000 })
    })

    test('should show mobile app suggestion in fallback view', async ({ page }) => {
        await page.goto(`${BASE_URL}/nfc-enrollment`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByText(/chrome for android/i).first()).toBeVisible({ timeout: 10000 })
    })

    test('should show tip alert in fallback view', async ({ page }) => {
        await page.goto(`${BASE_URL}/nfc-enrollment`)
        await page.waitForLoadState('networkidle')

        // The Alert with severity="info" contains a tip about opening on Chrome for Android
        await expect(page.getByRole('alert')).toBeVisible({ timeout: 10000 })
        await expect(page.getByText(/tip/i)).toBeVisible()
    })

    // -------------------------------------------------------------------------
    // No JS errors
    // -------------------------------------------------------------------------

    test('should produce no uncaught JavaScript errors', async ({ page }) => {
        const jsErrors: string[] = []
        page.on('pageerror', (error) => {
            jsErrors.push(error.message)
        })

        await page.goto(`${BASE_URL}/nfc-enrollment`)
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(2000)

        expect(jsErrors).toHaveLength(0)
    })
})
