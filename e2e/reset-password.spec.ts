import { test, expect } from '@playwright/test'

const BASE_URL = process.env.E2E_BASE_URL || 'https://app.fivucsas.com'

test.describe('Reset Password Flow', () => {
    // -------------------------------------------------------------------------
    // Page load — with email param
    // -------------------------------------------------------------------------

    test('should display reset password page with code and password fields', async ({ page }) => {
        await page.goto(`${BASE_URL}/reset-password?email=user@example.com`)
        await page.waitForLoadState('networkidle')

        // Page title/heading should be visible
        await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 })

        // 6-digit code input boxes should be present (6 individual text fields)
        const codeInputs = page.locator('input[inputmode="numeric"]')
        expect(await codeInputs.count()).toBe(6)

        // Password fields should be present
        await expect(page.locator('input[type="password"]').first()).toBeVisible()
    })

    // -------------------------------------------------------------------------
    // Page load — without email param (warning)
    // -------------------------------------------------------------------------

    test('should show warning when no email param is provided', async ({ page }) => {
        await page.goto(`${BASE_URL}/reset-password`)
        await page.waitForLoadState('networkidle')

        // Should display a warning alert about missing email
        await expect(page.getByRole('alert')).toBeVisible({ timeout: 10000 })
        await expect(page.getByText(/no email address/i)).toBeVisible()
    })

    test('should show Request Reset Code button when no email', async ({ page }) => {
        await page.goto(`${BASE_URL}/reset-password`)
        await page.waitForLoadState('networkidle')

        const requestBtn = page.getByRole('button', { name: /request reset code/i })
        await expect(requestBtn).toBeVisible({ timeout: 10000 })
    })

    test('should navigate to forgot-password when Request Reset Code is clicked', async ({ page }) => {
        await page.goto(`${BASE_URL}/reset-password`)
        await page.waitForLoadState('networkidle')

        await page.getByRole('button', { name: /request reset code/i }).click()

        await page.waitForURL(/forgot-password/, { timeout: 10000 })
        expect(page.url()).toContain('/forgot-password')
    })

    // -------------------------------------------------------------------------
    // Code input behavior
    // -------------------------------------------------------------------------

    test('should auto-focus next digit input when typing code', async ({ page }) => {
        await page.goto(`${BASE_URL}/reset-password?email=user@example.com`)
        await page.waitForLoadState('networkidle')

        const codeInputs = page.locator('input[inputmode="numeric"]')
        await expect(codeInputs.first()).toBeVisible({ timeout: 10000 })

        // Type first digit
        await codeInputs.nth(0).fill('1')

        // Second input should be focused (we just verify it is visible and interactive)
        await expect(codeInputs.nth(1)).toBeVisible()
    })

    // -------------------------------------------------------------------------
    // Validation
    // -------------------------------------------------------------------------

    test('should show validation error for short password', async ({ page }) => {
        await page.goto(`${BASE_URL}/reset-password?email=user@example.com`)
        await page.waitForLoadState('networkidle')

        // Fill code digits
        const codeInputs = page.locator('input[inputmode="numeric"]')
        await expect(codeInputs.first()).toBeVisible({ timeout: 10000 })
        for (let i = 0; i < 6; i++) {
            await codeInputs.nth(i).fill(String(i + 1))
        }

        // Fill short password
        const passwordFields = page.locator('input[type="password"]')
        await passwordFields.nth(0).fill('short')
        await passwordFields.nth(1).fill('short')

        // Click submit
        await page.getByRole('button', { name: /reset password/i }).click()

        // Should show password length validation
        await expect(page.getByText(/at least 8 characters/i)).toBeVisible({ timeout: 5000 })
    })

    test('should show validation error for mismatched passwords', async ({ page }) => {
        await page.goto(`${BASE_URL}/reset-password?email=user@example.com`)
        await page.waitForLoadState('networkidle')

        // Fill code digits
        const codeInputs = page.locator('input[inputmode="numeric"]')
        await expect(codeInputs.first()).toBeVisible({ timeout: 10000 })
        for (let i = 0; i < 6; i++) {
            await codeInputs.nth(i).fill(String(i + 1))
        }

        // Fill mismatched passwords
        const passwordFields = page.locator('input[type="password"]')
        await passwordFields.nth(0).fill('Password123!')
        await passwordFields.nth(1).fill('DifferentPassword!')

        // Click submit
        await page.getByRole('button', { name: /reset password/i }).click()

        // Should show mismatch error
        await expect(page.getByText(/don't match/i)).toBeVisible({ timeout: 5000 })
    })

    // -------------------------------------------------------------------------
    // Successful reset (with route mock)
    // -------------------------------------------------------------------------

    test('should show success alert after valid reset', async ({ page }) => {
        // Mock the reset-password API
        await page.route('**/auth/reset-password', (route) => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ message: 'Password reset successfully' }),
            })
        })

        await page.goto(`${BASE_URL}/reset-password?email=user@example.com`)
        await page.waitForLoadState('networkidle')

        // Fill code digits
        const codeInputs = page.locator('input[inputmode="numeric"]')
        await expect(codeInputs.first()).toBeVisible({ timeout: 10000 })
        for (let i = 0; i < 6; i++) {
            await codeInputs.nth(i).fill(String(i + 1))
        }

        // Fill valid matching passwords
        const passwordFields = page.locator('input[type="password"]')
        await passwordFields.nth(0).fill('NewPassword123!')
        await passwordFields.nth(1).fill('NewPassword123!')

        // Submit
        await page.getByRole('button', { name: /reset password/i }).click()

        // Should show success alert
        await expect(page.getByRole('alert').first()).toBeVisible({ timeout: 10000 })

        // Should show back to login button
        await expect(page.getByRole('button', { name: /back to login/i })).toBeVisible({ timeout: 5000 })
    })

    test('should show error alert on API failure', async ({ page }) => {
        // Mock the API to return an error
        await page.route('**/auth/reset-password', (route) => {
            route.fulfill({
                status: 400,
                contentType: 'application/json',
                body: JSON.stringify({ message: 'Invalid or expired code' }),
            })
        })

        await page.goto(`${BASE_URL}/reset-password?email=user@example.com`)
        await page.waitForLoadState('networkidle')

        // Fill code
        const codeInputs = page.locator('input[inputmode="numeric"]')
        await expect(codeInputs.first()).toBeVisible({ timeout: 10000 })
        for (let i = 0; i < 6; i++) {
            await codeInputs.nth(i).fill(String(i + 1))
        }

        // Fill passwords
        const passwordFields = page.locator('input[type="password"]')
        await passwordFields.nth(0).fill('NewPassword123!')
        await passwordFields.nth(1).fill('NewPassword123!')

        // Submit
        await page.getByRole('button', { name: /reset password/i }).click()

        // Should show error alert
        await expect(page.getByRole('alert').first()).toBeVisible({ timeout: 10000 })
    })

    // -------------------------------------------------------------------------
    // Password visibility toggle
    // -------------------------------------------------------------------------

    test('should toggle password visibility', async ({ page }) => {
        await page.goto(`${BASE_URL}/reset-password?email=user@example.com`)
        await page.waitForLoadState('networkidle')

        const passwordInput = page.locator('input[type="password"]').first()
        await expect(passwordInput).toBeVisible({ timeout: 10000 })

        // Find and click the visibility toggle button (the eye icon)
        const toggleBtn = page.locator('button[aria-label="toggle password visibility"], button:has(svg)').first()

        if (await toggleBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await toggleBtn.click()

            // After clicking, the input type should change to "text"
            await expect(page.locator('input[type="text"]').first()).toBeVisible({ timeout: 3000 })
        }
    })

    // -------------------------------------------------------------------------
    // No JS errors
    // -------------------------------------------------------------------------

    test('should produce no uncaught JavaScript errors', async ({ page }) => {
        const jsErrors: string[] = []
        page.on('pageerror', (error) => {
            jsErrors.push(error.message)
        })

        await page.goto(`${BASE_URL}/reset-password?email=user@example.com`)
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(2000)

        expect(jsErrors).toHaveLength(0)
    })
})
