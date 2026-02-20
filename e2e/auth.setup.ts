import { test as setup, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const BASE_URL = process.env.E2E_BASE_URL || 'https://ica-fivucsas.rollingcatsoftware.com'
const AUTH_DIR = path.join(process.cwd(), 'e2e', '.auth')
const SESSION_FILE = path.join(AUTH_DIR, 'session.json')

setup('authenticate', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)
    await page.locator('input[name="email"]').fill('admin@fivucsas.local')
    await page.locator('input[name="password"]').fill('Test@123')
    await page.getByRole('button', { name: /sign in/i }).click()

    // Wait for dashboard sidebar to confirm login success
    await expect(page.getByRole('button', { name: 'Users' })).toBeVisible({ timeout: 15000 })

    // Capture sessionStorage tokens (JWT stored there by SecureStorageService)
    const sessionData = await page.evaluate(() => {
        const data: Record<string, string> = {}
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i)
            if (key) data[key] = sessionStorage.getItem(key) || ''
        }
        return data
    })

    // Save session data for authenticated tests
    if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true })
    fs.writeFileSync(SESSION_FILE, JSON.stringify(sessionData))
})
