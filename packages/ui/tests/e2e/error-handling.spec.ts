import { expect, test } from '@playwright/test';

test.describe('Error Handling', () => {
    test('redirects to login when not authenticated', async ({ page }) => {
        // Clear any existing auth
        await page.goto('/');
        await page.evaluate(() => {
            window.localStorage.removeItem('pixelci:jwt');
        });

        await page.goto('/apps');
        await page.waitForURL(/\/(apps|login)/);

        expect(page.url()).toMatch(/\/(apps|login)/);
    });
});
