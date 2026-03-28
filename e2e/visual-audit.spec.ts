/* eslint-disable no-console */
/**
 * FIVUCSAS Visual Audit - Comprehensive UI Testing
 * Tests every page, form, button, dialog, and interaction
 * Generates screenshots for AI review
 */
import { test, expect, Page } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const SESSION_FILE = path.join(__dirname, '.auth', 'session.json')
const SCREENSHOT_DIR = path.join(__dirname, '..', 'test-results', 'visual-audit')

// Ensure screenshot directory exists
test.beforeAll(() => {
    if (!fs.existsSync(SCREENSHOT_DIR)) {
        fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
    }
})

async function injectSession(page: Page) {
    if (!fs.existsSync(SESSION_FILE)) {
        throw new Error('Session file not found. Run auth.setup.ts first.')
    }
    const sessionData = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'))
    await page.addInitScript((data: Record<string, string>) => {
        for (const [key, value] of Object.entries(data)) {
            sessionStorage.setItem(key, value)
        }
    }, sessionData)
}

async function screenshotPage(page: Page, name: string) {
    await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `${name}.png`),
        fullPage: true
    })
}

// ============================================================================
// LOGIN & AUTH PAGES (No session needed)
// ============================================================================
test.describe('Login Page Audit', () => {
    test('login page - full render', async ({ page }) => {
        await page.goto('/login')
        await page.waitForLoadState('networkidle')
        await screenshotPage(page, '01-login-page')

        // Check all elements
        await expect(page.getByPlaceholder(/email/i)).toBeVisible()
        await expect(page.getByPlaceholder(/password/i)).toBeVisible()
        await expect(page.getByRole('button', { name: /sign in|login|log in/i })).toBeVisible()

        // Test empty form submission
        await page.getByRole('button', { name: /sign in|login|log in/i }).click()
        await page.waitForTimeout(500)
        await screenshotPage(page, '01-login-validation-errors')
    })

    test('login page - invalid credentials', async ({ page }) => {
        await page.goto('/login')
        await page.waitForLoadState('networkidle')
        await page.getByPlaceholder(/email/i).fill('wrong@email.com')
        await page.getByPlaceholder(/password/i).fill('WrongPassword123!')
        await page.getByRole('button', { name: /sign in|login|log in/i }).click()
        await page.waitForTimeout(3000)
        await screenshotPage(page, '01-login-invalid-credentials')
    })

    test('login page - successful login', async ({ page }) => {
        await page.goto('/login')
        await page.waitForLoadState('networkidle')
        await page.getByPlaceholder(/email/i).fill('admin@fivucsas.local')
        await page.getByPlaceholder(/password/i).fill('Test@123')
        await page.getByRole('button', { name: /sign in|login|log in/i }).click()
        await page.waitForTimeout(3000)
        await screenshotPage(page, '01-login-success-redirect')
    })

    test('register page - full render', async ({ page }) => {
        await page.goto('/register')
        await page.waitForLoadState('networkidle')
        await screenshotPage(page, '02-register-page')
    })
})

// ============================================================================
// AUTHENTICATED PAGES
// ============================================================================
test.describe('Dashboard Audit', () => {
    test.beforeEach(async ({ page }) => {
        await injectSession(page)
    })

    test('dashboard - full render with stats', async ({ page }) => {
        await page.goto('/')
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(2000)
        await screenshotPage(page, '03-dashboard')

        // Check stat cards
        const cards = page.locator('.MuiCard-root, [class*="card"]')
        const cardCount = await cards.count()
        console.log(`Dashboard cards found: ${cardCount}`)
    })
})

test.describe('Users Pages Audit', () => {
    test.beforeEach(async ({ page }) => {
        await injectSession(page)
    })

    test('users list - table with data', async ({ page }) => {
        await page.goto('/users')
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(2000)
        await screenshotPage(page, '04-users-list')

        // Check table
        const rows = page.locator('table tbody tr, [role="row"]')
        const rowCount = await rows.count()
        console.log(`User rows found: ${rowCount}`)
    })

    test('user create form', async ({ page }) => {
        await page.goto('/users/create')
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(1000)
        await screenshotPage(page, '04-user-create-form')
    })

    test('user details page', async ({ page }) => {
        await page.goto('/users')
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(2000)
        // Click first user row
        const firstRow = page.locator('table tbody tr, [role="row"]').first()
        if (await firstRow.isVisible()) {
            await firstRow.click()
            await page.waitForTimeout(2000)
            await screenshotPage(page, '04-user-details')
        }
    })
})

test.describe('Tenants Pages Audit', () => {
    test.beforeEach(async ({ page }) => {
        await injectSession(page)
    })

    test('tenants list', async ({ page }) => {
        await page.goto('/tenants')
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(2000)
        await screenshotPage(page, '05-tenants-list')
    })

    test('tenant create form', async ({ page }) => {
        await page.goto('/tenants/create')
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(1000)
        await screenshotPage(page, '05-tenant-create-form')
    })
})

test.describe('Roles Pages Audit', () => {
    test.beforeEach(async ({ page }) => {
        await injectSession(page)
    })

    test('roles list', async ({ page }) => {
        await page.goto('/roles')
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(2000)
        await screenshotPage(page, '06-roles-list')
    })

    test('role create form', async ({ page }) => {
        await page.goto('/roles/create')
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(1000)
        await screenshotPage(page, '06-role-create-form')
    })
})

test.describe('Auth Flows Audit', () => {
    test.beforeEach(async ({ page }) => {
        await injectSession(page)
    })

    test('auth flows list', async ({ page }) => {
        await page.goto('/auth-flows')
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(2000)
        await screenshotPage(page, '07-auth-flows-list')
    })
})

test.describe('Devices & Sessions Audit', () => {
    test.beforeEach(async ({ page }) => {
        await injectSession(page)
    })

    test('devices page', async ({ page }) => {
        await page.goto('/devices')
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(2000)
        await screenshotPage(page, '08-devices-page')
    })

    test('auth sessions page', async ({ page }) => {
        await page.goto('/auth-sessions')
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(2000)
        await screenshotPage(page, '09-auth-sessions-page')
    })
})

test.describe('Enrollments Audit', () => {
    test.beforeEach(async ({ page }) => {
        await injectSession(page)
    })

    test('enrollments list', async ({ page }) => {
        await page.goto('/enrollments')
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(2000)
        await screenshotPage(page, '10-enrollments-list')
    })
})

test.describe('Audit Logs Audit', () => {
    test.beforeEach(async ({ page }) => {
        await injectSession(page)
    })

    test('audit logs with filters', async ({ page }) => {
        await page.goto('/audit-logs')
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(2000)
        await screenshotPage(page, '11-audit-logs')
    })
})

test.describe('Analytics Audit', () => {
    test.beforeEach(async ({ page }) => {
        await injectSession(page)
    })

    test('analytics page with charts', async ({ page }) => {
        await page.goto('/analytics')
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(3000) // Extra time for chart rendering
        await screenshotPage(page, '12-analytics-page')
    })
})

test.describe('Settings Audit', () => {
    test.beforeEach(async ({ page }) => {
        await injectSession(page)
    })

    test('settings page', async ({ page }) => {
        await page.goto('/settings')
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(2000)
        await screenshotPage(page, '13-settings-page')
    })
})

test.describe('Navigation Audit', () => {
    test.beforeEach(async ({ page }) => {
        await injectSession(page)
    })

    test('sidebar navigation - all links', async ({ page }) => {
        await page.goto('/')
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(1000)

        // Collect all sidebar navigation links
        const navLinks = page.locator('nav a, [role="navigation"] a, aside a')
        const linkCount = await navLinks.count()
        console.log(`Sidebar navigation links found: ${linkCount}`)

        const linkTexts: string[] = []
        for (let i = 0; i < linkCount; i++) {
            const text = await navLinks.nth(i).textContent()
            if (text?.trim()) linkTexts.push(text.trim())
        }
        console.log(`Navigation items: ${linkTexts.join(', ')}`)
        await screenshotPage(page, '14-sidebar-navigation')
    })

    test('theme toggle', async ({ page }) => {
        await page.goto('/settings')
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(1000)

        // Look for theme toggle
        const themeToggle = page.locator('[aria-label*="theme"], [data-testid*="theme"], button:has-text("Dark"), button:has-text("Light")')
        if (await themeToggle.first().isVisible()) {
            await themeToggle.first().click()
            await page.waitForTimeout(1000)
            await screenshotPage(page, '14-theme-toggled')
        }
    })

    test('language toggle', async ({ page }) => {
        await page.goto('/settings')
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(1000)

        // Look for language selector
        const langSelector = page.locator('[aria-label*="language"], [data-testid*="language"], select:has-text("English"), select:has-text("Turkish")')
        if (await langSelector.first().isVisible()) {
            await screenshotPage(page, '14-language-selector')
        }
    })
})

test.describe('Responsive Design Audit', () => {
    test.beforeEach(async ({ page }) => {
        await injectSession(page)
    })

    test('mobile viewport - dashboard', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 }) // iPhone X
        await page.goto('/')
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(2000)
        await screenshotPage(page, '15-mobile-dashboard')
    })

    test('mobile viewport - users list', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 })
        await page.goto('/users')
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(2000)
        await screenshotPage(page, '15-mobile-users')
    })

    test('tablet viewport - dashboard', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 1024 }) // iPad
        await page.goto('/')
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(2000)
        await screenshotPage(page, '15-tablet-dashboard')
    })
})
