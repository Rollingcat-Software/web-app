import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const BASE_URL = process.env.E2E_BASE_URL || 'https://app.fivucsas.com'
const SESSION_FILE = path.join(process.cwd(), 'e2e', '.auth', 'session.json')

test.describe('Users CRUD', { tag: '@destructive' }, () => {
    test.beforeEach(async ({ page }) => {
        // Inject saved sessionStorage tokens (from auth.setup.ts) to avoid rate limiting
        const sessionData = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'))

        await page.addInitScript((data: Record<string, string>) => {
            for (const [key, value] of Object.entries(data)) {
                sessionStorage.setItem(key, value)
            }
        }, sessionData)
    })

    test('should navigate to users list', async ({ page }) => {
        await page.goto(`${BASE_URL}/`)
        await expect(page.getByRole('button', { name: 'Users' })).toBeVisible({ timeout: 15000 })
        await page.getByRole('button', { name: 'Users' }).click()
        await expect(page.getByText(/users/i).first()).toBeVisible({ timeout: 10000 })
    })

    test('should display users table', async ({ page }) => {
        await page.goto(`${BASE_URL}/users`)
        await expect(page.locator('table')).toBeVisible({ timeout: 15000 })
    })

    test('should navigate to create user form', async ({ page }) => {
        await page.goto(`${BASE_URL}/users`)
        const createBtn = page.getByRole('link', { name: /create|add/i }).or(page.getByRole('button', { name: /create|add/i }))
        await expect(createBtn.first()).toBeVisible({ timeout: 10000 })
    })
})
