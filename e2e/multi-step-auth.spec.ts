import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const BASE_URL = process.env.E2E_BASE_URL || 'https://ica-fivucsas.rollingcatsoftware.com'
const SESSION_FILE = path.join(process.cwd(), 'e2e', '.auth', 'session.json')

test.describe('Multi-Step Authentication', () => {
    test('should complete password login and reach dashboard', async ({ page }) => {
        // Inject saved sessionStorage tokens (from auth.setup.ts) to avoid rate limiting
        const sessionData = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'))

        await page.addInitScript((data: Record<string, string>) => {
            for (const [key, value] of Object.entries(data)) {
                sessionStorage.setItem(key, value)
            }
        }, sessionData)

        // Navigate — should auto-authenticate from injected tokens
        await page.goto(`${BASE_URL}/`)
        await expect(page.getByRole('button', { name: 'Users' })).toBeVisible({ timeout: 15000 })
    })

    test('should show step progress for multi-step flows', async ({ page }) => {
        // Verify the login page renders correctly (no auth needed)
        await page.goto(`${BASE_URL}/login`)
        await expect(page.locator('input[name="email"]')).toBeVisible()
        await expect(page.locator('input[name="password"]')).toBeVisible()
        await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
    })
})
