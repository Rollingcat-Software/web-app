import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const BASE_URL = process.env.E2E_BASE_URL || 'https://app.fivucsas.com'
const E2E_EMAIL = process.env.E2E_EMAIL || 'admin@fivucsas.local'
const E2E_PASSWORD = process.env.E2E_PASSWORD || 'Test@123'
const SESSION_FILE = path.join(process.cwd(), 'e2e', '.auth', 'session.json')

/**
 * Nav item definitions mirror the menuItems array in Sidebar.tsx.
 * labelKey -> default English translation (from public/locales/en/translation.json)
 * path     -> expected URL segment after navigation
 *
 * The sidebar renders ListItemButton elements whose accessible name comes from
 * the translated label text, NOT a role="button" with that name in all cases.
 * We locate them with getByRole('button', { name: ... }) since MUI ListItemButton
 * renders as a <div role="button"> when inside a List.
 */
const NAV_ITEMS = [
    { label: 'Dashboard', path: '/' },
    { label: 'Users', path: '/users' },
    { label: 'Tenants', path: '/tenants' },
    { label: 'Roles', path: '/roles' },
    { label: 'Auth Flows', path: '/auth-flows' },
    { label: 'Devices', path: '/devices' },
    { label: 'Enrollments', path: '/enrollments' },
    { label: 'Audit Logs', path: '/audit-logs' },
    { label: 'Analytics', path: '/analytics' },
    { label: 'Settings', path: '/settings' },
] as const

function injectSession(page: Parameters<Parameters<typeof test>[1]>[0]['page']) {
    const sessionData = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'))
    return page.addInitScript((data: Record<string, string>) => {
        for (const [key, value] of Object.entries(data)) {
            sessionStorage.setItem(key, value)
        }
    }, sessionData)
}

test.describe('Global Navigation', () => {
    test.beforeEach(async ({ page }) => {
        await injectSession(page)
    })

    // -------------------------------------------------------------------------
    // Sidebar nav links
    // -------------------------------------------------------------------------

    for (const item of NAV_ITEMS) {
        test(`sidebar: clicking "${item.label}" navigates to ${item.path}`, async ({ page }) => {
            await page.goto(`${BASE_URL}/`)
            await page.waitForLoadState('networkidle')

            // Wait for sidebar to be present
            await expect(page.getByRole('navigation')).toBeVisible({ timeout: 15000 })

            const navBtn = page.getByRole('button', { name: item.label })
            await expect(navBtn).toBeVisible({ timeout: 10000 })
            await navBtn.click()
            await page.waitForLoadState('networkidle')

            // Verify URL updated
            if (item.path === '/') {
                await expect(page).toHaveURL(BASE_URL + '/')
            } else {
                await expect(page).toHaveURL(new RegExp(item.path.replace('/', '\\/')))
            }
        })
    }

    // -------------------------------------------------------------------------
    // Active state highlighting
    // -------------------------------------------------------------------------

    test('sidebar: active nav item is visually selected on Dashboard', async ({ page }) => {
        await page.goto(`${BASE_URL}/`)
        await page.waitForLoadState('networkidle')

        // MUI ListItemButton receives aria-selected="true" or the Mui-selected CSS class
        // when selected={true}. We check the Dashboard item is selected.
        const dashboardBtn = page.getByRole('button', { name: 'Dashboard' })
        await expect(dashboardBtn).toBeVisible({ timeout: 15000 })

        // The selected ListItemButton carries the aria-current or Mui-selected class
        const isSelected =
            (await dashboardBtn.getAttribute('aria-selected')) === 'true' ||
            (await dashboardBtn.evaluate((el) => el.classList.contains('Mui-selected')))
        expect(isSelected).toBe(true)
    })

    test('sidebar: active nav item changes when navigating to Users', async ({ page }) => {
        await page.goto(`${BASE_URL}/users`)
        await page.waitForLoadState('networkidle')

        const usersBtn = page.getByRole('button', { name: 'Users' })
        await expect(usersBtn).toBeVisible({ timeout: 15000 })

        const isSelected =
            (await usersBtn.getAttribute('aria-selected')) === 'true' ||
            (await usersBtn.evaluate((el) => el.classList.contains('Mui-selected')))
        expect(isSelected).toBe(true)

        // Dashboard should NOT be active
        const dashboardBtn = page.getByRole('button', { name: 'Dashboard' })
        const dashboardSelected =
            (await dashboardBtn.getAttribute('aria-selected')) === 'true' ||
            (await dashboardBtn.evaluate((el) => el.classList.contains('Mui-selected')))
        expect(dashboardSelected).toBe(false)
    })

    // -------------------------------------------------------------------------
    // TopBar user menu
    // -------------------------------------------------------------------------

    test('topbar: clicking avatar opens user dropdown menu', async ({ page }) => {
        await page.goto(`${BASE_URL}/`)
        await page.waitForLoadState('networkidle')

        const avatarBtn = page.getByRole('button', { name: /user menu/i })
        await expect(avatarBtn).toBeVisible({ timeout: 15000 })
        await avatarBtn.click()

        // The MUI Menu renders as a role="menu" element
        await expect(page.getByRole('menu')).toBeVisible({ timeout: 5000 })
    })

    test('topbar: user menu contains Profile & Settings, Settings, and Logout items', async ({ page }) => {
        await page.goto(`${BASE_URL}/`)
        await page.waitForLoadState('networkidle')

        const avatarBtn = page.getByRole('button', { name: /user menu/i })
        await expect(avatarBtn).toBeVisible({ timeout: 15000 })
        await avatarBtn.click()

        const menu = page.getByRole('menu')
        await expect(menu).toBeVisible({ timeout: 5000 })

        // topbar.profileSettings = "Profile & Settings"
        await expect(menu.getByText(/profile.*settings/i)).toBeVisible()
        // nav.settings = "Settings"
        await expect(menu.getByText(/^settings$/i)).toBeVisible()
        // topbar.logout = "Logout"
        await expect(menu.getByText(/logout/i)).toBeVisible()
    })

    test('topbar: clicking Settings in user menu navigates to /settings', async ({ page }) => {
        await page.goto(`${BASE_URL}/`)
        await page.waitForLoadState('networkidle')

        const avatarBtn = page.getByRole('button', { name: /user menu/i })
        await expect(avatarBtn).toBeVisible({ timeout: 15000 })
        await avatarBtn.click()

        const menu = page.getByRole('menu')
        await expect(menu).toBeVisible({ timeout: 5000 })

        // Click the Settings menu item; exact: true avoids matching "Profile & Settings"
        await menu.getByText('Settings', { exact: true }).click()
        await page.waitForLoadState('networkidle')

        await expect(page).toHaveURL(/settings/)
    })

    // -------------------------------------------------------------------------
    // Logout flow
    // -------------------------------------------------------------------------

    test('logout: clicking Logout redirects to /login', async ({ browser }) => {
        // Use a fresh context with its own login so the shared session token
        // is NOT blacklisted by the backend logout endpoint.
        const ctx = await browser.newContext()
        const page = await ctx.newPage()

        // Login with a fresh token
        await page.goto(`${BASE_URL}/login`)
        await page.locator('input[name="email"]').fill(E2E_EMAIL)
        await page.locator('input[name="password"]').fill(E2E_PASSWORD)
        const loginResponsePromise = page.waitForResponse(
            (resp) => resp.url().includes('/auth/login') && resp.request().method() === 'POST',
            { timeout: 20000 }
        )
        await page.getByRole('button', { name: /sign in/i }).click()
        await loginResponsePromise
        await expect(page.getByRole('button', { name: 'Users' })).toBeVisible({ timeout: 30000 })

        const avatarBtn = page.getByRole('button', { name: /user menu/i })
        await expect(avatarBtn).toBeVisible({ timeout: 15000 })
        await avatarBtn.click()

        const menu = page.getByRole('menu')
        await expect(menu).toBeVisible({ timeout: 5000 })
        // The MUI MenuItem wraps a Typography with color="error" — use the role
        await menu.getByRole('menuitem', { name: /logout/i }).click()

        // After logout the app navigates to /login
        await expect(page).toHaveURL(/login/, { timeout: 10000 })
        await ctx.close()
    })

    // -------------------------------------------------------------------------
    // Protected route guard
    // -------------------------------------------------------------------------

    test('protected route: unauthenticated visit to / redirects to /login', async ({ browser }) => {
        // Create a fresh context with NO sessionStorage — simulates unauthenticated user
        const freshContext = await browser.newContext()
        const freshPage = await freshContext.newPage()

        await freshPage.goto(`${BASE_URL}/`)
        await freshPage.waitForLoadState('networkidle')

        await expect(freshPage).toHaveURL(/login/, { timeout: 10000 })

        await freshContext.close()
    })

    test('protected route: unauthenticated visit to /users redirects to /login', async ({ browser }) => {
        const freshContext = await browser.newContext()
        const freshPage = await freshContext.newPage()

        await freshPage.goto(`${BASE_URL}/users`)
        await freshPage.waitForLoadState('networkidle')

        await expect(freshPage).toHaveURL(/login/, { timeout: 10000 })

        await freshContext.close()
    })

    // -------------------------------------------------------------------------
    // Language toggle in TopBar
    // -------------------------------------------------------------------------

    test('topbar: language toggle button is visible', async ({ page }) => {
        await page.goto(`${BASE_URL}/`)
        await page.waitForLoadState('networkidle')

        const langBtn = page.getByRole('button', { name: /toggle language/i })
        await expect(langBtn).toBeVisible({ timeout: 15000 })
    })

    test('topbar: language toggle switches between EN and TR labels', async ({ page }) => {
        await page.goto(`${BASE_URL}/`)
        await page.waitForLoadState('networkidle')

        const langBtn = page.getByRole('button', { name: /toggle language/i })
        await expect(langBtn).toBeVisible({ timeout: 15000 })

        // Get the current language label shown inside the button (EN or TR)
        const initialText = await langBtn.textContent()

        await langBtn.click()
        await page.waitForTimeout(500) // allow i18n state to settle

        const updatedText = await langBtn.textContent()

        // Language label must have changed
        expect(updatedText).not.toEqual(initialText)

        // Toggle back to restore original state for subsequent tests
        await langBtn.click()
        await page.waitForTimeout(500)
    })

    // -------------------------------------------------------------------------
    // Dark mode toggle in TopBar
    // -------------------------------------------------------------------------

    test('topbar: dark mode toggle button is visible', async ({ page }) => {
        await page.goto(`${BASE_URL}/`)
        await page.waitForLoadState('networkidle')

        const darkModeBtn = page.getByRole('button', { name: /toggle dark mode/i })
        await expect(darkModeBtn).toBeVisible({ timeout: 15000 })
    })
})
