/**
 * End-to-end proof of the authors-only trial page in a REAL Chromium with a
 * fake camera. No real backend, no account, no internet: the stub backend in
 * `stub-server.mjs` implements the contract and stores every attempt.
 *
 * Run exactly:
 *
 *   npx playwright test --config=playwright.author-trial.config.ts
 *
 * What is asserted:
 *   - the access-code gate connects and the auto-detected device enables Start;
 *   - Start creates a REAL trial session (stub row) and mounts the shared
 *     PUZZLE step, whose stub challenge never completes;
 *   - the page's per-attempt timeout (3 s) finishes the attempt as
 *     error/attempt_timeout;
 *   - the CSV downloaded BY THE PAGE contains that attempt id and is marked
 *     excluded;
 *   - the page calls POST /attempts/{id}/finish (the stub records it).
 */
import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

const STUB = 'http://127.0.0.1:4321'
const ACCESS_CODE = 'e2e-trial-key'

test('runs one real timed-out attempt, finishes it, and exports it as CSV', async ({ page, request }) => {
    await request.post(`${STUB}/__test__/reset`)

    await page.goto('/author-trial?attemptTimeoutMs=3000')

    // ── Access-code gate ──────────────────────────────────────────────────
    await page.getByLabel('Access code').fill(ACCESS_CODE)
    await page.getByRole('button', { name: 'Open the trial' }).click()

    const start = page.getByTestId('trial-start')
    await expect(start).toBeVisible()
    // Detection probes the fake camera; once it settles the button enables.
    await expect(start).toBeEnabled({ timeout: 30_000 })
    await expect(page.getByTestId('participant-select')).toBeVisible()

    // ── One attempt: real session -> shared PUZZLE step -> timeout ───────
    await start.click()
    const feedEntry = page.getByTestId('attempt-feed-entry').first()
    await expect(feedEntry).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('trial-stop')).toBeVisible()
    // The loop mounts/unmounts the attempt stage under the action button while
    // it cycles, so the button's box can still be moving when Playwright samples
    // it. It is visible and enabled; force the click (actionability otherwise
    // retries "element is not stable" forever during a fast attempt loop).
    await page.getByTestId('trial-stop').click({ force: true })

    // The stub store proves the session row + the page's finish call.
    await expect
        .poll(
            async () => {
                const state = await (await request.get(`${STUB}/__test__/state`)).json()
                return state.attempts.length
            },
            { timeout: 15_000 },
        )
        .toBeGreaterThan(0)

    const state = await (await request.get(`${STUB}/__test__/state`)).json()
    const attempt = state.attempts[0]
    expect(attempt.attemptId).toMatch(/^attempt-/)
    expect(attempt.body.participantCode).toBe('P1')
    expect(attempt.body.mode).toBe('genuine')
    expect(attempt.body.env).toBeTruthy()
    expect(attempt.body.device).toBeTruthy()
    expect(attempt.finish).toBeTruthy()
    expect(attempt.finish.clientOutcome).toBe('error')
    expect(attempt.finish.failureReason).toBe('attempt_timeout')

    // ── Export downloaded by the page (not by the test) ──────────────────
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download CSV' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe('author_trial_sessions.csv')
    const filePath = await download.path()
    expect(filePath).toBeTruthy()
    const csv = readFileSync(filePath as string, 'utf8')

    expect(csv.split(/\r?\n/)[0]).toContain('attempt_id')
    expect(csv).toContain(attempt.attemptId)
    expect(csv).toContain('excluded')
    expect(csv).toContain('attempt_timeout')
    expect(csv).toContain('bona_fide')
})