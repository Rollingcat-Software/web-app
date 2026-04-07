import { test as setup, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const BASE_URL = process.env.E2E_BASE_URL || 'https://app.fivucsas.com'
const E2E_EMAIL = process.env.E2E_EMAIL || 'admin@fivucsas.local'
const E2E_PASSWORD = process.env.E2E_PASSWORD || 'Test@123'
const AUTH_DIR = path.join(process.cwd(), 'e2e', '.auth')
const SESSION_FILE = path.join(AUTH_DIR, 'session.json')

setup('authenticate', async ({ page }) => {
    // Navigate to login page and wait for it to be fully loaded
    await page.goto(`${BASE_URL}/login`)
    await page.waitForLoadState('networkidle')

    // Fill credentials (configurable via env vars)
    await page.locator('input[name="email"]').fill(E2E_EMAIL)
    await page.locator('input[name="password"]').fill(E2E_PASSWORD)

    // Click sign in and wait for the API response
    const loginResponsePromise = page.waitForResponse(
        (resp) => resp.url().includes('/auth/login') && resp.request().method() === 'POST',
        { timeout: 20000 }
    )
    await page.getByRole('button', { name: /sign in/i }).click()

    // Wait for the login API response to detect server-side auth failures early
    const loginResponse = await loginResponsePromise
    if (!loginResponse.ok()) {
        const body = await loginResponse.text().catch(() => 'no body')
        throw new Error(
            `Login API returned ${loginResponse.status()}: ${body}. ` +
            `Check E2E_EMAIL/E2E_PASSWORD env vars or that the test user exists on the server.`
        )
    }

    // Wait for dashboard sidebar to confirm successful SPA navigation
    await expect(page.getByRole('button', { name: 'Users' })).toBeVisible({ timeout: 30000 })

    // Capture sessionStorage tokens (JWT stored there by SecureStorageService)
    const sessionData = await page.evaluate(() => {
        const data: Record<string, string> = {}
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i)
            if (key) data[key] = sessionStorage.getItem(key) || ''
        }
        return data
    })

    // Verify we actually got tokens
    const hasTokens = Object.keys(sessionData).some(
        (key) => key.includes('token') || key.includes('Token')
    )
    if (!hasTokens) {
        throw new Error(
            'Login appeared successful but no tokens found in sessionStorage. ' +
            'The app may store tokens differently now.'
        )
    }

    // Save session data for authenticated tests
    if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true })
    fs.writeFileSync(SESSION_FILE, JSON.stringify(sessionData))
})
