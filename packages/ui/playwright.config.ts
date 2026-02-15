import { defineConfig, devices } from '@playwright/test';
import process from 'node:process';

export default defineConfig({
    testDir: './tests/e2e',
    timeout: 30 * 1000,
    expect: {
        timeout: 5000
    },
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    maxFailures: process.env.CI ? 1 : undefined,
    reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'html',
    use: {
        actionTimeout: 10_000,
        baseURL: process.env.CI ? 'http://localhost:7924' : 'http://localhost:7925',
        trace: 'on-first-retry',
        headless: !!process.env.CI,
        video: 'retain-on-failure'
    },
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome']
            }
        }
    ],
    outputDir: 'test-results/',
    ...(!process.env.CI && {
        webServer: {
            command: 'npm run dev',
            port: 7925,
            reuseExistingServer: true
        }
    })
});
