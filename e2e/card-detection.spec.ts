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

test.describe('Card Detection (Biometric Tools)', () => {
    test.beforeEach(async ({ page }) => {
        await injectSession(page)
    })

    // -------------------------------------------------------------------------
    // Redirect — /card-detection now redirects to /biometric-tools
    // -------------------------------------------------------------------------

    test('should redirect /card-detection to /biometric-tools', async ({ page }) => {
        await page.goto(`${BASE_URL}/card-detection`)
        await page.waitForLoadState('networkidle')

        await expect(page).toHaveURL(/biometric-tools/)
    })

    // -------------------------------------------------------------------------
    // Biometric Tools page loads with tabs
    // -------------------------------------------------------------------------

    test('should load Biometric Tools page with 4 tabs', async ({ page }) => {
        await page.goto(`${BASE_URL}/biometric-tools`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByRole('tab')).toHaveCount(4, { timeout: 15000 })
    })

    // -------------------------------------------------------------------------
    // Card Detection tab content
    // -------------------------------------------------------------------------

    test('should display Card Detection content after clicking card tab', async ({ page }) => {
        await page.goto(`${BASE_URL}/biometric-tools`)
        await page.waitForLoadState('networkidle')

        // Click the Card tab (3rd tab, index 2)
        const cardTab = page.getByRole('tab').nth(2)
        await expect(cardTab).toBeVisible({ timeout: 15000 })
        await cardTab.click()

        // CardDetectionPage renders a "Start Camera" button when camera is not active
        await expect(page.getByRole('button', { name: /start camera/i })).toBeVisible({ timeout: 10000 })
    })

    test('should show camera prompt before camera is started', async ({ page }) => {
        await page.goto(`${BASE_URL}/biometric-tools`)
        await page.waitForLoadState('networkidle')

        const cardTab = page.getByRole('tab').nth(2)
        await expect(cardTab).toBeVisible({ timeout: 15000 })
        await cardTab.click()

        // Prompt text should be visible before camera starts
        await expect(page.getByText(/start camera/i).first()).toBeVisible({ timeout: 10000 })
    })

    test('should render card detection heading', async ({ page }) => {
        await page.goto(`${BASE_URL}/biometric-tools`)
        await page.waitForLoadState('networkidle')

        const cardTab = page.getByRole('tab').nth(2)
        await expect(cardTab).toBeVisible({ timeout: 15000 })
        await cardTab.click()

        // CardDetectionPage renders an h4 heading
        const heading = page.locator('h4')
        await expect(heading).toBeVisible({ timeout: 10000 })
    })

    test('should not show detection results before any capture', async ({ page }) => {
        await page.goto(`${BASE_URL}/biometric-tools`)
        await page.waitForLoadState('networkidle')

        const cardTab = page.getByRole('tab').nth(2)
        await expect(cardTab).toBeVisible({ timeout: 15000 })
        await cardTab.click()

        await page.waitForTimeout(1000)

        // No detection result card should be visible initially
        const resultHeading = page.getByText(/detection result/i)
        await expect(resultHeading).toHaveCount(0)
  