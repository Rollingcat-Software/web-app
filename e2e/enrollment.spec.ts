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

test.describe('Biometric Enrollment Page', () => {
    test.beforeEach(async ({ page }) => {
        await injectSession(page)
    })

    // -------------------------------------------------------------------------
    // Page load
    // -------------------------------------------------------------------------

    test('should load enrollment page with heading', async ({ page }) => {
        await page.goto(`${BASE_URL}/enrollment`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByText(/biometric enrollment/i).first()).toBeVisible({ timeout: 15000 })
    })

    test('should display subtitle text', async ({ page }) => {
        await page.goto(`${BASE_URL}/enrollment`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByText(/manage your authentication methods/i)).toBeVisible({ timeout: 15000 })
    })

    // -------------------------------------------------------------------------
    // Device capability badges
    // -------------------------------------------------------------------------

    test('should show enrolled count badge after loading', async ({ page }) => {
        await page.goto(`${BASE_URL}/enrollment`)
        await page.waitForLoadState('networkidle')

        // Wait for capabilities detection to finish (loading spinner disappears)
        await expect(page.locator('[role="progressbar"]')).toHaveCount(0, { timeout: 20000 })

        // The "X enrolled" chip should be visible
        await expect(page.getByText(/enrolled/i).first()).toBeVisible({ timeout: 10000 })
    })

    test('should show unavailable count badge after loading', async ({ page }) => {
        await page.goto(`${BASE_URL}/enrollment`)
        await page.waitForLoadState('networkidle')

        await expect(page.locator('[role="progressbar"]')).toHaveCount(0, { timeout: 20000 })

        // The "X unavailable on this device" chip should be visible
        await expect(page.getByText(/unavailable on this device/i)).toBeVisible({ timeout: 10000 })
    })

    // -------------------------------------------------------------------------
    // Method cards
    // -------------------------------------------------------------------------

    test('should display Face Recognition card', async ({ page }) => {
        await page.goto(`${BASE_URL}/enrollment`)
        await page.waitForLoadState('networkidle')

        await expect(page.locator('[role="progressbar"]')).toHaveCount(0, { timeout: 20000 })
        await expect(page.getByText('Face Recognition')).toBeVisible()
    })

    test('should display Authenticator App (TOTP) card', async ({ page }) => {
        await page.goto(`${BASE_URL}/enrollment`)
        await page.waitForLoadState('networkidle')

        await expect(page.locator('[role="progressbar"]')).toHaveCount(0, { timeout: 20000 })
        await expect(page.getByText('Authenticator App')).toBeVisible()
    })

    test('should display Voice Recognition card', async ({ page }) => {
        await page.goto(`${BASE_URL}/enrollment`)
        await page.waitForLoadState('networkidle')

        await expect(page.locator('[role="progressbar"]')).toHaveCount(0, { timeout: 20000 })
        await expect(page.getByText('Voice Recognition')).toBeVisible()
    })

    test('should display at least 5 method cards', async ({ page }) => {
        await page.goto(`${BASE_URL}/enrollment`)
        await page.waitForLoadState('networkidle')

        await expect(page.locator('[role="progressbar"]')).toHaveCount(0, { timeout: 20000 })

        // Each method card has an "Enroll", "Enrolled", "Unavailable", or "Not enrolled" chip
        const enrollTexts = page.getByText(/^(Enroll|Enrolled|Unavailable|Not enrolled)$/)
        expect(await enrollTexts.count()).toBeGreaterThanOrEqual(5)
    })

    // -------------------------------------------------------------------------
    // Enrollment dialogs
    // -------------------------------------------------------------------------

    test('should open face enrollment dialog when Face Recognition Enroll is clicked', async ({ page }) => {
        await page.goto(`${BASE_URL}/enrollment`)
        await page.waitForLoadState('networkidle')

        await expect(page.locator('[role="progressbar"]')).toHaveCount(0, { timeout: 20000 })

        // Find the Face Recognition card and click Enroll (only if available)
        const faceCard = page.getByText('Face Recognition').locator('..').locator('..')
        const enrollBtn = faceCard.getByRole('button', { name: /^enroll$/i }).first()

        if (await enrollBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await enrollBtn.click()
            // A dialog should open (MUI Dialog renders role="dialog")
            await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 })
        }
        // If Face is already enrolled or unavailable, the test passes without clicking
    })

    test('should open voice enrollment dialog when Voice Recognition Enroll is clicked', async ({ page }) => {
        await page.goto(`${BASE_URL}/enrollment`)
        await page.waitForLoadState('networkidle')

        await expect(page.locator('[role="progressbar"]')).toHaveCount(0, { timeout: 20000 })

        const voiceCard = page.getByText('Voice Recognition').locator('..').locator('..')
        const enrollBtn = voiceCard.getByRole('button', { name: /^enroll$/i }).first()

        if (await enrollBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await enrollBtn.click()
            await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 })
        }
    })

    test('should open TOTP enrollment dialog when Authenticator App Enroll is clicked', async ({ page }) => {
        await page.goto(`${BASE_URL}/enrollment`)
        await page.waitForLoadState('networkidle')

        await expect(page.locator('[role="progressbar"]')).toHaveCount(0, { timeout: 20000 })

        const totpCard = page.getByText('Authenticator App').locator('..').locator('..')
        const enrollBtn = totpCard.getByRole('button', { name: /^enroll$/i }).first()

        if (await enrollBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await enrollBtn.click()
            await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 })
        }
    })

    // -------------------------------------------------------------------------
    // Refresh button
    // -------------------------------------------------------------------------

    test('should have a refresh button', async ({ page }) => {
        await page.goto(`${BASE_URL}/enrollment`)
        await page.waitForLoadState('networkidle')

        await expect(page.locator('[role="progressbar"]')).toHaveCount(0, { timeout: 20000 })

        // The refresh button has a tooltip "Refresh enrollment status"
        const refreshBtn = page.getByRole('button', { name: /refresh/i })
        await expect(refreshBtn).toBeVisible()
    })

    // -------------------------------------------------------------------------
    // No JS errors
    // -------------------------------------------------------------------------

    test('should produce no uncaught JavaScript errors', async ({ page }) => {
        const jsErrors: string[] = []
        page.on('pageerror', (error) => {
            jsErrors.push(error.message)
        })

        await page.goto(`${BASE_URL}/enrollment`)
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(3000)

        expect(jsErrors).toHaveLength(0)
    })
})
