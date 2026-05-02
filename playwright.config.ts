import { defineConfig, devices } from '@playwright/test'

/**
 * Project layout
 *  - `setup`         logs in once and saves sessionStorage (login-tests + authenticated reuse it).
 *  - `login-tests`   public login flow tests.
 *  - `authenticated` everything except destructive CRUD (default + safe to run).
 *  - `smoke`         minimal read-only coverage, triggered nightly via cron.
 *  - `destructive`   PROD-mutating CRUD specs — opt-in via workflow_dispatch only.
 *
 * Tag conventions:
 *  - `@destructive`  spec mutates PROD data (users, tenants, roles, enrollments CRUD).
 *                    Lives in the `destructive` project; excluded from `authenticated`.
 *  - `@readonly` `@smoke`  minimal happy-path; lives in the `smoke` project.
 *
 * Run examples:
 *   npx playwright test                              # setup + login-tests + authenticated (no destructive)
 *   npx playwright test --project=smoke              # nightly cron entry point
 *   npx playwright test --project=destructive        # opt-in PROD CRUD validation
 */
export default defineConfig({
    testDir: './e2e',
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: 1,
    workers: 1,
    reporter: 'html',
    timeout: 60000,
    expect: {
        timeout: 20000,
    },
    use: {
        baseURL: process.env.E2E_BASE_URL || 'https://app.fivucsas.com',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        actionTimeout: 20000,
        navigationTimeout: 45000,
    },
    projects: [
        // 1. Auth setup — logs in once, saves sessionStorage tokens
        {
            name: 'setup',
            testMatch: /auth\.setup\.ts/,
            use: { ...devices['Desktop Chrome'] },
        },
        // 2. Login tests — test login flow directly (no pre-auth needed)
        {
            name: 'login-tests',
            testMatch: /login.*\.spec\.ts/,
            use: { ...devices['Desktop Chrome'] },
            dependencies: ['setup'],
        },
        // 3. Authenticated tests — reuse saved session (no extra login calls).
        //    `grepInvert` keeps destructive CRUD specs out of the default run.
        {
            name: 'authenticated',
            testIgnore: /login.*\.spec\.ts|auth\.setup\.ts|smoke\.spec\.ts/,
            use: { ...devices['Desktop Chrome'] },
            dependencies: ['setup'],
            grepInvert: /@destructive/,
        },
        // 4. Smoke — public, no auth required. Triggered from CI nightly cron.
        //    Run via: `npx playwright test --project=smoke`.
        {
            name: 'smoke',
            testMatch: /smoke\.spec\.ts/,
            use: { ...devices['Desktop Chrome'] },
            grep: /@smoke/,
        },
        // 5. Destructive — opt-in only. Workflow_dispatch passes
        //    `--project=destructive` to enable PROD-mutating CRUD coverage.
        {
            name: 'destructive',
            testIgnore: /login.*\.spec\.ts|auth\.setup\.ts|smoke\.spec\.ts/,
            use: { ...devices['Desktop Chrome'] },
            dependencies: ['setup'],
            grep: /@destructive/,
        },
    ],
})
