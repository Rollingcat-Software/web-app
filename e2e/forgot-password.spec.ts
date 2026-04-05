import { test, expect } from '@playwright/test'

const BASE_URL = process.env.E2E_BASE_URL || 'https://ica-fivucsas.rollingcatsoftware.com'

test.describe('Forgot Password Flow', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(`${BASE_URL}/forgot-password`)
        await page.waitForLoadState('networkidle')
    })

    // -------------------------------------------------------------------------
    // Page load
    // -------------------------------------------------------------------------

    test('should display forgot password page with form elements', async ({ page }) => {
        // Logo (Fingerprint icon) should be visible
        await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 })

        // Email input field should be present
        await expect(page.locator('input[type="email"]')).toBeVisible()

        // Submit button should be present
        await expect(page.getByRole('button', { name: /send|reset/i })).toBeVisible()
    })

    test('should display page title', async ({ page }) => {
        // The page has a heading with the forgot password title
        await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 })
    })

    test('should display back to login link', async ({ page }) => {
        await expect(page.getByText(/back to login/i)).toBeVisible({ timeout: 10000 })
    })

    // -------------------------------------------------------------------------
    // Validation
    // -------------------------------------------------------------------------

    test('should show validation error for invalid email', async ({ page }) => {
        const emailInput = page.locator('input[type="email"]')
        await emailInput.fill('not-an-email')

        await page.getByRole('button', { name: /send|reset/i }).click()

        // Should show a validation helper text for invalid email
        await expect(page.getByText(/invalid email/i)).toBeVisible({ timeout: 5000 })
    })

    test('should show validation error for empty email', async ({ page }) => {
        // Click submit without filling anything
        await page.getByRole('button', { name: /send|reset/i }).click()

        // Should show required validation
        await expect(page.getByText(/email is required/i)).toBeVisible({ timeout: 5000 })
    })

    // -------------------------------------------------------------------------
    // Form submission (with route mock to avoid real API calls)
    // -------------------------------------------------------------------------

    test('should navigate to reset-password page after submitting email', async ({ page }) => {
        // Mock the forgot-password API to avoid real network calls
        await page.route('**/auth/forgot-password', (route) => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ message: 'Reset code sent' }),
            })
        })

        const emailInput = page.locator('input[type="email"]')
        await emailInput.fill('user@example.com')

        await page.getByRole('button', { name: /send|reset/i }).click()

        // Should navigate to reset-password page with email as query param
        await page.waitForURL(/reset-password.*email/, { timeout: 15000 })
        expect(page.url()).toContain('reset-password')
        expect(page.url()).toContain('user%40example.com')
    })

    test('should navigate to reset-password even on API error (anti-enumeration)', async ({ page }) => {
        // Mock the API to return an error
        await page.route('**/auth/forgot-password', (route) => {
            route.fulfill({
                status: 404,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'Not found' }),
            })
        })

        const emailInput = page.locator('input[type="email"]')
        await emailInput.fill('nonexistent@example.com')

        await page.getByRole('button', { name: /send|reset/i }).click()

        // Should still navigate (prevents email enumeration)
        await page.waitForURL(/reset-password/, { timeout: 15000 })
        expect(page.url()).toContain('reset-password')
    })

    // -------------------------------------------------------------------------
    // Navigation
    // -------------------------------------------------------------------------

    test('should navigate back to login when back link is clicked', async ({ page }) => {
        await page.getByText(/back to login/i).click()

        await page.waitForURL(/login/, { timeout: 10000 })
        expect(page.url()).toContain('/login')
    })

    // -------------------------------------------------------------------------
    // No JS errors
    // -------------------------------------------------------------------------

    test('should produce no uncaught JavaScript errors', async ({ page }) => {
        const jsErrors: string[] = []
        page.on('pageerror', (error) => {
            jsErrors.push(error.message)
        })

        await page.goto(`${BASE_URL}/forgot-password`)
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(2000)

        expect(jsErrors).toHaveLength(0)
    })
})
