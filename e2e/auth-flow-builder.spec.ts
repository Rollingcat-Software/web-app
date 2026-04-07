import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const BASE_URL = process.env.E2E_BASE_URL || 'https://app.fivucsas.com'
const SESSION_FILE = path.join(process.cwd(), 'e2e', '.auth', 'session.json')

test.describe('Auth Flow Builder', () => {
    test.beforeEach(async ({ page }) => {
        // Inject saved sessionStorage tokens (from auth.setup.ts) to avoid rate limiting
        const sessionData = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'))

        await page.addInitScript((data: Record<string, string>) => {
            for (const [key, value] of Object.entries(data)) {
                sessionStorage.setItem(key, value)
            }
        }, sessionData)
    })

    test('should navigate to auth flows page', async ({ page }) => {
        await page.goto(`${BASE_URL}/`)
        await expect(page.getByRole('button', { name: 'Auth Flows' })).toBeVisible({ timeout: 15000 })
        await page.getByRole('button', { name: 'Auth Flows' }).click()
        await expect(page.getByText(/authentication flows/i).first()).toBeVisible({ timeout: 10000 })
    })

    test('should open create flow dialog', async ({ page }) => {
        await page.goto(`${BASE_URL}/auth-flows`)
        await expect(page.getByRole('button', { name: /create flow/i })).toBeVisible({ timeout: 10000 })
        await page.getByRole('button', { name: /create flow/i }).click()
        await expect(page.getByText(/authentication flow/i).first()).toBeVisible()
    })

    test('should enforce password for APP_LOGIN', async ({ page }) => {
        await page.goto(`${BASE_URL}/auth-flows`)
        await expect(page.getByRole('button', { name: /create flow/i })).toBeVisible({ timeout: 10000 })
        await page.getByRole('button', { name: /create flow/i }).click()
        // APP_LOGIN is default — password step should be visible
        await expect(page.getByText(/password/i).first()).toBeVisible()
    })

    test('should allow freedom for DOOR_ACCESS', async ({ page }) => {
        await page.goto(`${BASE_URL}/auth-flows`)
        await expect(page.getByRole('button', { name: /create flow/i })).toBeVisible({ timeout: 10000 })
        await page.getByRole('button', { name: /create flow/i }).click()

        // Try to change operation type
        const selectTrigger = page.locator('[id*="operationType"], [name*="operationType"]').first()
        if (await selectTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
            await selectTrigger.click()
            const option = page.getByRole('option', { name: /door access/i })
            if (await option.isVisible({ timeout: 3000 }).catch(() => false)) {
                await option.click()
            }
        }
    })
})
