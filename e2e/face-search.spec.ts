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

test.describe('Face Search Page', () => {
    test.beforeEach(async ({ page }) => {
        await injectSession(page)
    })

    // -------------------------------------------------------------------------
    // Page load
    // -------------------------------------------------------------------------

    test('should load face search page with heading', async ({ page }) => {
        await page.goto(`${BASE_URL}/face-search`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByText(/face search/i).first()).toBeVisible({ timeout: 15000 })
    })

    test('should display description about 1:N face recognition', async ({ page }) => {
        await page.goto(`${BASE_URL}/face-search`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByText(/1:N face recognition/i)).toBeVisible({ timeout: 15000 })
    })

    // -------------------------------------------------------------------------
    // "Who Is This?" flow
    // -------------------------------------------------------------------------

    test('should show "Start Camera" button initially', async ({ page }) => {
        await page.goto(`${BASE_URL}/face-search`)
        await page.waitForLoadState('networkidle')

        await expect(
            page.getByRole('button', { name: /start camera/i })
        ).toBeVisible({ timeout: 10000 })
    })

    test('should not show "Who Is This?" button before camera starts', async ({ page }) => {
        await page.goto(`${BASE_URL}/face-search`)
        await page.waitForLoadState('networkidle')

        await expect(
            page.getByRole('button', { name: /who is this/i })
        ).toHaveCount(0)
    })

    test('should show placeholder text before camera starts', async ({ page }) => {
        await page.goto(`${BASE_URL}/face-search`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByText(/click.*start camera.*to begin/i)).toBeVisible({ timeout: 10000 })
    })

    // -------------------------------------------------------------------------
    // No JS errors
    // -------------------------------------------------------------------------

    test('should produce no uncaught JavaScript errors', async ({ page }) => {
        const jsErrors: string[] = []
        page.on('pageerror', (error) => {
            jsErrors.push(error.message)
        })

        await page.goto(`${BASE_URL}/face-search`)
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(2000)

        expect(jsErrors).toHaveLength(0)
    })
})
