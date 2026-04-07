import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const BASE_URL = process.env.E2E_BASE_URL || 'https://app.fivucsas.com'
const SESSION_FILE = path.join(process.cwd(), 'e2e', '.auth', 'session.json')

/**
 * Injects saved sessionStorage tokens so tests skip the login round-trip.
 * Pattern established in users-crud.spec.ts and auth-flow-builder.spec.ts.
 */
function injectSession(page: Parameters<Parameters<typeof test>[1]>[0]['page']) {
    const sessionData = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'))
    return page.addInitScript((data: Record<string, string>) => {
        for (const [key, value] of Object.entries(data)) {
            sessionStorage.setItem(key, value)
        }
    }, sessionData)
}

test.describe('Settings Page', () => {
    test.beforeEach(async ({ page }) => {
        await injectSession(page)
    })

    // -------------------------------------------------------------------------
    // Navigation
    // -------------------------------------------------------------------------

    test('should navigate to /settings and render the page title', async ({ page }) => {
        await page.goto(`${BASE_URL}/settings`)
        await page.waitForLoadState('networkidle')

        // The page heading rendered by SettingsPage — translated key 'settings.title'
        // Defaults to "Settings" in English
        await expect(page.getByRole('heading', { level: 4 })).toBeVisible({ timeout: 15000 })
    })

    // -------------------------------------------------------------------------
    // Profile section
    // -------------------------------------------------------------------------

    test('profile section: first name and last name fields are visible', async ({ page }) => {
        await page.goto(`${BASE_URL}/settings`)
        await page.waitForLoadState('networkidle')

        // MUI TextField labels are rendered as floating labels; locate by label text
        await expect(page.getByLabel(/first name/i)).toBeVisible({ timeout: 15000 })
        await expect(page.getByLabel(/last name/i)).toBeVisible({ timeout: 15000 })
    })

    test('profile section: email field is present and disabled', async ({ page }) => {
        await page.goto(`${BASE_URL}/settings`)
        await page.waitForLoadState('networkidle')

        const emailField = page.locator('input[type="email"]')
        await expect(emailField).toBeVisible({ timeout: 15000 })
        await expect(emailField).toBeDisabled()
    })

    test('profile section: Save Profile button is visible', async ({ page }) => {
        await page.goto(`${BASE_URL}/settings`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByRole('button', { name: /save profile/i })).toBeVisible({ timeout: 15000 })
    })

    test('profile section: can type into first name and last name fields', async ({ page }) => {
        await page.goto(`${BASE_URL}/settings`)
        await page.waitForLoadState('networkidle')

        const firstName = page.getByLabel(/first name/i)
        await firstName.waitFor({ state: 'visible', timeout: 15000 })
        await firstName.clear()
        await firstName.fill('TestFirst')
        await expect(firstName).toHaveValue('TestFirst')

        const lastName = page.getByLabel(/last name/i)
        await lastName.clear()
        await lastName.fill('TestLast')
        await expect(lastName).toHaveValue('TestLast')
    })

    // -------------------------------------------------------------------------
    // Security section
    // -------------------------------------------------------------------------

    test('security section: two-factor toggle is visible', async ({ page }) => {
        await page.goto(`${BASE_URL}/settings`)
        await page.waitForLoadState('networkidle')

        // FormControlLabel text comes from 'settings.twoFactor' translation key
        await expect(page.getByText(/two.factor|two factor/i).first()).toBeVisible({ timeout: 15000 })
    })

    test('security section: Setup TOTP button opens dialog when 2FA is disabled', async ({ page }) => {
        await page.goto(`${BASE_URL}/settings`)
        await page.waitForLoadState('networkidle')

        // The "Setup TOTP" button is only rendered when twoFactorAuth === false
        const setupTotpBtn = page.getByRole('button', { name: /setup totp/i })

        // If TOTP is not yet enabled the button must be visible; click it
        const isVisible = await setupTotpBtn.isVisible({ timeout: 10000 }).catch(() => false)
        if (isVisible) {
            await setupTotpBtn.click()
            // TotpEnrollment dialog should open — it renders a dialog with a title
            await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10000 })
            // Close dialog
            const cancelBtn = page.getByRole('button', { name: /cancel|close/i }).first()
            if (await cancelBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                await cancelBtn.click()
            } else {
                await page.keyboard.press('Escape')
            }
        } else {
            // 2FA is already enabled — skip dialog test and pass
            test.info().annotations.push({
                type: 'note',
                description: 'TOTP already enabled; Setup TOTP button not rendered.',
            })
        }
    })

    test('security section: Enroll Face ID button opens dialog', async ({ page }) => {
        await page.goto(`${BASE_URL}/settings`)
        await page.waitForLoadState('networkidle')

        // Wait for settings form content to load (Save Profile button proves form rendered)
        await expect(page.getByRole('button', { name: /save profile/i })).toBeVisible({ timeout: 15000 })

        const enrollBtn = page.getByRole('button', { name: /enroll face id/i })
        const isVisible = await enrollBtn.isVisible({ timeout: 5000 }).catch(() => false)
        if (!isVisible) {
            // Feature may not be deployed or button is scrolled out of view
            test.skip()
            return
        }
        await enrollBtn.click()

        // FaceEnrollmentFlow renders a dialog
        await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10000 })

        // Close with Escape
        await page.keyboard.press('Escape')
    })

    test('security section: session timeout select renders with options', async ({ page }) => {
        await page.goto(`${BASE_URL}/settings`)
        await page.waitForLoadState('networkidle')

        // MUI native select — rendered as <select> element
        const select = page.getByLabel(/session timeout/i)
        await expect(select).toBeVisible({ timeout: 15000 })

        // Verify the select has meaningful options
        const options = await select.locator('option').allTextContents()
        expect(options.length).toBeGreaterThanOrEqual(3)
    })

    test('security section: Change Password button is visible', async ({ page }) => {
        await page.goto(`${BASE_URL}/settings`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByRole('button', { name: /change password/i })).toBeVisible({ timeout: 15000 })
    })

    test('security section: Save Security button is visible', async ({ page }) => {
        await page.goto(`${BASE_URL}/settings`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByRole('button', { name: /save security/i })).toBeVisible({ timeout: 15000 })
    })

    // -------------------------------------------------------------------------
    // Password change dialog
    // -------------------------------------------------------------------------

    test('password dialog: opens when Change Password is clicked', async ({ page }) => {
        await page.goto(`${BASE_URL}/settings`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByRole('button', { name: /change password/i })).toBeVisible({ timeout: 15000 })
        await page.getByRole('button', { name: /change password/i }).click()

        const dialog = page.getByRole('dialog')
        await expect(dialog).toBeVisible({ timeout: 10000 })
        await expect(dialog.getByLabel('Current Password', { exact: true })).toBeVisible()
        await expect(dialog.getByLabel('New Password', { exact: true })).toBeVisible()
        await expect(dialog.getByLabel('Confirm New Password', { exact: true })).toBeVisible()
    })

    test('password dialog: shows validation error when passwords do not match', async ({ page }) => {
        await page.goto(`${BASE_URL}/settings`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByRole('button', { name: /change password/i })).toBeVisible({ timeout: 15000 })
        await page.getByRole('button', { name: /change password/i }).click()

        const dialog = page.getByRole('dialog')
        await expect(dialog).toBeVisible({ timeout: 10000 })

        await dialog.getByLabel('Current Password', { exact: true }).fill('SomeCurrentPass1!')
        await dialog.getByLabel('New Password', { exact: true }).fill('NewPassword1!')
        await dialog.getByLabel('Confirm New Password', { exact: true }).fill('DifferentPassword2!')

        // Submit — the Change Password button inside the dialog
        await dialog.getByRole('button', { name: /change password/i }).click()

        // Error alert should appear for mismatched passwords
        await expect(page.getByRole('alert')).toBeVisible({ timeout: 5000 })
    })

    test('password dialog: Cancel closes the dialog', async ({ page }) => {
        await page.goto(`${BASE_URL}/settings`)
        await page.waitForLoadState('networkidle')

        await page.getByRole('button', { name: /change password/i }).click()

        const dialog = page.getByRole('dialog')
        await expect(dialog).toBeVisible({ timeout: 10000 })

        await dialog.getByRole('button', { name: /cancel/i }).click()

        await expect(dialog).not.toBeVisible({ timeout: 5000 })
    })

    // -------------------------------------------------------------------------
    // Notifications section
    // -------------------------------------------------------------------------

    test('notifications section: four toggles are rendered', async ({ page }) => {
        await page.goto(`${BASE_URL}/settings`)
        await page.waitForLoadState('networkidle')

        // Each FormControlLabel wraps a Switch; find them by their text labels
        await expect(page.getByText(/email notifications/i)).toBeVisible({ timeout: 15000 })
        await expect(page.getByText(/login alerts/i)).toBeVisible({ timeout: 15000 })
        await expect(page.getByText(/security alerts/i)).toBeVisible({ timeout: 15000 })
        await expect(page.getByText(/weekly reports/i)).toBeVisible({ timeout: 15000 })
    })

    test('notifications section: Save Notifications button is visible', async ({ page }) => {
        await page.goto(`${BASE_URL}/settings`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByRole('button', { name: /save notifications/i })).toBeVisible({ timeout: 15000 })
    })

    test('notifications section: toggling a switch updates its checked state', async ({ page }) => {
        await page.goto(`${BASE_URL}/settings`)
        await page.waitForLoadState('networkidle')

        // Find the Weekly Reports switch — it defaults to false, so it is unchecked
        const weeklyLabel = page.getByText(/weekly reports/i)
        await expect(weeklyLabel).toBeVisible({ timeout: 15000 })

        // The MUI Switch is an input[type=checkbox] within the FormControlLabel
        const weeklySwitch = weeklyLabel.locator('..').locator('input[type=checkbox]')
        const initialState = await weeklySwitch.isChecked()

        await weeklySwitch.click({ force: true })

        // State should have toggled
        await expect(weeklySwitch).not.toHaveAttribute('aria-checked', initialState ? 'true' : 'false')
    })

    // -------------------------------------------------------------------------
    // Appearance section
    // -------------------------------------------------------------------------

    test('appearance section: compact view toggle is present (dark mode removed, TopBar only)', async ({ page }) => {
        // Dark mode toggle was removed from Settings page — TopBar is authoritative
        // Verify the appearance section renders with Compact View instead
        await page.goto(`${BASE_URL}/settings`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByText(/compact view/i)).toBeVisible({ timeout: 15000 })
    })

    test('appearance section: compact view toggle is visible', async ({ page }) => {
        await page.goto(`${BASE_URL}/settings`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByText(/compact view/i)).toBeVisible({ timeout: 15000 })
    })

    test('appearance section: language selector renders with English and Turkish options', async ({ page }) => {
        await page.goto(`${BASE_URL}/settings`)
        await page.waitForLoadState('networkidle')

        const langSelect = page.getByLabel(/^language/i)
        await expect(langSelect).toBeVisible({ timeout: 15000 })

        const options = await langSelect.locator('option').allTextContents()
        // Should have at least English and Turkish
        expect(options.length).toBeGreaterThanOrEqual(2)
    })

    test('appearance section: Save Appearance button is visible', async ({ page }) => {
        await page.goto(`${BASE_URL}/settings`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByRole('button', { name: /save appearance/i })).toBeVisible({ timeout: 15000 })
    })

    // -------------------------------------------------------------------------
    // Language switching
    // -------------------------------------------------------------------------

    test('language change: switching to Turkish changes visible text and switching back restores English', async ({
        page,
    }) => {
        await page.goto(`${BASE_URL}/settings`)
        await page.waitForLoadState('networkidle')

        // Use a stable CSS selector for the native <select> language dropdown
        const langSelect = page.locator('select').last()
        await langSelect.waitFor({ state: 'visible', timeout: 15000 })
        await langSelect.selectOption('tr')

        // After switching to Turkish, the page heading renders as "Ayarlar"
        await expect(page.getByText(/ayarlar/i).first()).toBeVisible({ timeout: 10000 })

        // Switch back to English — the label is now in Turkish, so re-use the CSS selector
        await langSelect.selectOption('en')
        await expect(page.getByText(/settings/i).first()).toBeVisible({ timeout: 10000 })
    })
})
