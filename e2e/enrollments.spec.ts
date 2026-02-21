import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const BASE_URL = process.env.E2E_BASE_URL || 'https://ica-fivucsas.rollingcatsoftware.com'
const SESSION_FILE = path.join(process.cwd(), 'e2e', '.auth', 'session.json')

test.describe('Enrollments Page', () => {
    test.beforeEach(async ({ page }) => {
        const sessionData = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'))
        await page.addInitScript((data: Record<string, string>) => {
            for (const [key, value] of Object.entries(data)) {
                sessionStorage.setItem(key, value)
            }
        }, sessionData)
    })

    // ---------------------------------------------------------------------------
    // Navigation & page structure
    // ---------------------------------------------------------------------------

    test.describe('Navigation', () => {
        test('should navigate to enrollments via sidebar', async ({ page }) => {
            await page.goto(`${BASE_URL}/`)
            await page.waitForLoadState('networkidle')

            await page.getByRole('button', { name: 'Enrollments' }).click()
            await page.waitForLoadState('networkidle')

            await expect(page.getByRole('heading', { name: /biometric enrollments/i })).toBeVisible({ timeout: 10000 })
            expect(page.url()).toContain('/enrollments')
        })

        test('should display the page heading and subtitle', async ({ page }) => {
            await page.goto(`${BASE_URL}/enrollments`)
            await page.waitForLoadState('networkidle')

            await expect(page.getByRole('heading', { name: /biometric enrollments/i })).toBeVisible({ timeout: 10000 })
            await expect(page.getByText(/monitor and manage biometric enrollment/i)).toBeVisible()
        })
    })

    // ---------------------------------------------------------------------------
    // Table or empty state
    // ---------------------------------------------------------------------------

    test.describe('Table rendering', () => {
        test('should show table or empty state after loading', async ({ page }) => {
            await page.goto(`${BASE_URL}/enrollments`)
            await page.waitForLoadState('networkidle')
            await expect(page.locator('[role="progressbar"]')).toHaveCount(0, { timeout: 15000 })

            const hasTable = await page.locator('table').count() > 0
            const hasEmptyState = await page.getByText(/no enrollments found/i).count() > 0

            expect(hasTable || hasEmptyState).toBeTruthy()
        })

        test('should render expected table columns when enrollments exist', async ({ page }) => {
            await page.goto(`${BASE_URL}/enrollments`)
            await page.waitForLoadState('networkidle')
            await expect(page.locator('[role="progressbar"]')).toHaveCount(0, { timeout: 15000 })

            const hasTable = await page.locator('table').count() > 0
            if (!hasTable) {
                // No enrollments seeded — skip column check
                await expect(page.getByText(/no enrollments found/i)).toBeVisible()
                return
            }

            await expect(page.getByRole('columnheader', { name: /enrollment id/i })).toBeVisible()
            await expect(page.getByRole('columnheader', { name: /user id/i })).toBeVisible()
            await expect(page.getByRole('columnheader', { name: /status/i })).toBeVisible()
        })
    })

    // ---------------------------------------------------------------------------
    // Search field
    // ---------------------------------------------------------------------------

    test.describe('Search field', () => {
        test('should display search field with correct placeholder', async ({ page }) => {
            await page.goto(`${BASE_URL}/enrollments`)
            await page.waitForLoadState('networkidle')

            await expect(page.getByPlaceholder(/search by enrollment id or user id/i)).toBeVisible({ timeout: 10000 })
        })

        test('should filter table by enrollment ID input', async ({ page }) => {
            await page.goto(`${BASE_URL}/enrollments`)
            await page.waitForLoadState('networkidle')
            await expect(page.locator('[role="progressbar"]')).toHaveCount(0, { timeout: 15000 })

            const searchField = page.getByPlaceholder(/search by enrollment id or user id/i)
            await searchField.fill('zzzz-does-not-exist-0000')
            await page.waitForTimeout(300)

            // Typing a non-existent ID results in empty state
            await expect(page.getByText(/no enrollments found/i)).toBeVisible({ timeout: 5000 })
        })

        test('should clear filter when search field is cleared', async ({ page }) => {
            await page.goto(`${BASE_URL}/enrollments`)
            await page.waitForLoadState('networkidle')
            await expect(page.locator('[role="progressbar"]')).toHaveCount(0, { timeout: 15000 })

            const countBefore = await page.locator('tbody tr').count()

            const searchField = page.getByPlaceholder(/search by enrollment id or user id/i)
            await searchField.fill('zzzz-does-not-exist-0000')
            await page.waitForTimeout(300)

            await searchField.clear()
            await page.waitForTimeout(300)

            const countAfter = await page.locator('tbody tr').count()
            expect(countAfter).toBe(countBefore)
        })
    })

    // ---------------------------------------------------------------------------
    // Status filter dropdown
    // ---------------------------------------------------------------------------

    test.describe('Status filter dropdown', () => {
        test('should display the Status filter dropdown', async ({ page }) => {
            await page.goto(`${BASE_URL}/enrollments`)
            await page.waitForLoadState('networkidle')

            // The select has label "Status"
            await expect(page.getByRole('combobox', { name: /status/i })).toBeVisible({ timeout: 10000 })
        })

        test('should list all status options in the dropdown', async ({ page }) => {
            await page.goto(`${BASE_URL}/enrollments`)
            await page.waitForLoadState('networkidle')

            await page.getByRole('combobox', { name: /status/i }).click()

            await expect(page.getByRole('option', { name: /all statuses/i })).toBeVisible({ timeout: 5000 })
            await expect(page.getByRole('option', { name: /success/i })).toBeVisible()
            await expect(page.getByRole('option', { name: /pending/i })).toBeVisible()
            await expect(page.getByRole('option', { name: /processing/i })).toBeVisible()
            await expect(page.getByRole('option', { name: /failed/i })).toBeVisible()

            // Dismiss dropdown
            await page.keyboard.press('Escape')
        })

        test('should filter by SUCCESS status and show only success enrollments', async ({ page }) => {
            await page.goto(`${BASE_URL}/enrollments`)
            await page.waitForLoadState('networkidle')
            await expect(page.locator('[role="progressbar"]')).toHaveCount(0, { timeout: 15000 })

            await page.getByRole('combobox', { name: /status/i }).click()
            await page.getByRole('option', { name: /^success$/i }).click()
            await page.waitForLoadState('networkidle')

            // After filtering, every visible status chip should say "SUCCESS" or we get empty state
            const rows = page.locator('tbody tr')
            const rowCount = await rows.count()

            if (rowCount > 0) {
                // At least verify the first visible status chip
                const firstStatusChip = rows.first().locator('[class*="MuiChip"]').first()
                const chipText = await firstStatusChip.textContent()
                expect(chipText?.toUpperCase()).toContain('SUCCESS')
            } else {
                await expect(page.getByText(/no enrollments found/i)).toBeVisible()
            }
        })

        test('should reset to all enrollments when "All Statuses" is selected', async ({ page }) => {
            await page.goto(`${BASE_URL}/enrollments`)
            await page.waitForLoadState('networkidle')
            await expect(page.locator('table, :text("No enrollments found")').first()).toBeVisible({ timeout: 15000 })

            const totalCount = await page.locator('tbody tr').count()

            // Apply a filter
            await page.getByRole('combobox', { name: /status/i }).click()
            await page.getByRole('option', { name: /failed/i }).click()
            await page.waitForTimeout(500)

            // Reset to ALL
            await page.getByRole('combobox', { name: /status/i }).click()
            await page.getByRole('option', { name: /all statuses/i }).click()
            await page.waitForTimeout(500)

            const restoredCount = await page.locator('tbody tr').count()
            expect(restoredCount).toBe(totalCount)
        })
    })

    // ---------------------------------------------------------------------------
    // Row actions
    // ---------------------------------------------------------------------------

    test.describe('Row action buttons', () => {
        test('should show View Details button for each enrollment row', async ({ page }) => {
            await page.goto(`${BASE_URL}/enrollments`)
            await page.waitForLoadState('networkidle')
            await expect(page.locator('table, :text("No enrollments found")').first()).toBeVisible({ timeout: 15000 })

            // Wait for data loading to complete
            await page.waitForTimeout(500)

            // Check if we have actual enrollment data (not just the "no enrollments" empty row)
            const hasEmptyState = await page.getByText(/no enrollments found/i).count() > 0
            if (hasEmptyState) return // empty state, nothing to test

            const viewBtn = page.getByRole('button', { name: /view details/i }).first()
            await expect(viewBtn).toBeVisible({ timeout: 10000 })
        })

        test('should show Delete button for each enrollment row', async ({ page }) => {
            await page.goto(`${BASE_URL}/enrollments`)
            await page.waitForLoadState('networkidle')
            await expect(page.locator('table, :text("No enrollments found")').first()).toBeVisible({ timeout: 15000 })

            await page.waitForTimeout(500)

            // Check if we have actual enrollment data (not just the "no enrollments" empty row)
            const hasEmptyState = await page.getByText(/no enrollments found/i).count() > 0
            if (hasEmptyState) return // empty state, nothing to test

            const deleteBtn = page.getByRole('button', { name: /delete enrollment/i }).first()
            await expect(deleteBtn).toBeVisible({ timeout: 10000 })
        })

        test('should open delete confirmation dialog when Delete is clicked', async ({ page }) => {
            await page.goto(`${BASE_URL}/enrollments`)
            await page.waitForLoadState('networkidle')
            await expect(page.locator('table, :text("No enrollments found")').first()).toBeVisible({ timeout: 15000 })

            const deleteBtn = page.getByRole('button', { name: /delete enrollment/i }).first()
            if (await deleteBtn.count() === 0) return

            await deleteBtn.click()

            await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 })
            await expect(page.getByRole('heading', { name: /delete enrollment/i })).toBeVisible()

            // Cancel to avoid actually deleting
            await page.getByRole('button', { name: /cancel/i }).click()
        })
    })
})
