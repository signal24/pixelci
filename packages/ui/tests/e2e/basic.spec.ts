import { expect, Page, test } from '@playwright/test';

const colorSchemes = ['light', 'dark'] as const;

colorSchemes.forEach(colorScheme => {
    test.describe(`${colorScheme} mode`, () => {
        test.use({ colorScheme });

        const takeScreenshot = (page: Page, name: string) =>
            page.screenshot({ path: `screenshots/${name} (${colorScheme}).png` });

        test('displays all the things', async ({ page }) => {
            await page.goto('/');

            await expect(page.url()).toMatch(/\/apps$/);
            await takeScreenshot(page, 'Login');

            await page.evaluate(() => {
                // jwt for zero ID valid until 2049
                window.localStorage.setItem(
                    'pixelci:jwt',
                    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJhcHAiLCJzdWIiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDAiLCJleHAiOjI1MjQ2MDc5OTksImlhdCI6MTc0NzYzMjc2Mn0.7FmHrOWWRWmH8i8floyAE-VvYu4Lya_9c-Qy68r8puI'
                );
            });

            await page.reload();
            await takeScreenshot(page, 'App List');

            await page.locator('.app').first().click();
            await page.waitForSelector('.build');
            await page
                .locator('.build-date')
                .evaluateAll(els => els.forEach(el => (el.textContent = '1/1/25 12:32 PM')));
            await takeScreenshot(page, 'Build List');

            await page.route(/\/image$/, async route => {
                await new Promise(resolve => setTimeout(resolve, 1500));
                await route.continue();
            });
            await page.route(/\/diff$/, async route => {
                await new Promise(resolve => setTimeout(resolve, 2500));
                await route.continue();
            });

            await page.locator('.build').first().click();
            await page.waitForSelector('.screen');
            await takeScreenshot(page, 'Screen List - Loading');
            await page.waitForSelector('.image-wrapper.left img');
            await takeScreenshot(page, 'Screen List');

            await page.locator('input[data-testid="diff-check"]').check();
            await takeScreenshot(page, 'Screen List - Diff Mode - Loading');
            await page.waitForSelector('.image-wrapper.right .diff img');
            await takeScreenshot(page, 'Screen List - Diff Mode');

            await page.locator('input[data-testid="diff-check"]').uncheck();
            await page.locator('input[data-testid="changes-check"]').uncheck();
            await page.locator('.screen').last().locator('.image-wrapper img').waitFor({ timeout: 10000 });
            const mainScrollHeight = await page.evaluate(() => document.querySelector('main')!.scrollHeight);
            const viewportSize = page.viewportSize()!;
            await page.setViewportSize({ width: viewportSize.width, height: mainScrollHeight });
            await takeScreenshot(page, 'Screen List - All Screens');
            await page.setViewportSize(viewportSize);
        });
    });
});
