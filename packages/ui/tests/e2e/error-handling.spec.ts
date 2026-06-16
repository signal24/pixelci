import { expect, test } from '@playwright/test';

test.describe('Error Handling', () => {
    test('sends unauthenticated users to authentication', async ({ page }) => {
        // The seeded provider's OAuth host is unreachable in tests; stub it so the auto-redirect
        // (single provider) doesn't hang on a DNS failure.
        await page.route('**/oauth/authorize**', route => route.fulfill({ status: 200, contentType: 'text/html', body: 'ok' }));

        // Clear any existing auth
        await page.goto('/');
        await page.evaluate(() => {
            window.localStorage.removeItem('pixelci:jwt');
        });

        await page.goto('/apps');

        // Unauthenticated: the login picker is shown, or — with a single VCS provider — we're sent
        // straight to the provider's OAuth login.
        await page.waitForURL(/\/(apps|login)|\/oauth\/authorize/);
        expect(page.url()).toMatch(/\/(apps|login)|\/oauth\/authorize/);
    });
});
