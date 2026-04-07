import { defineConfig, devices } from '@playwright/test'

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
        // 3. Authenticated tests — reuse saved session (no extra login calls)
        {
            name: 'authenticated',
            testIgnore: /login.*\.spec\.ts|auth\.setup\.ts/,
            use: { ...devices['Desktop Chrome'] },
            dependencies: ['setup'],
        },
    ],
})
