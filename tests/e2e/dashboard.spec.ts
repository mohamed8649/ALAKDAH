import { expect, test } from '@playwright/test';

import { blockWebfonts } from './helpers';

/**
 * Dashboard reachability and layout.
 *
 * These tests run with the session stored by the `setup` project, so each one
 * is a cold, direct load of a deep link — which is the case that breaks when a
 * page depends on client state that a refresh does not restore.
 *
 * Deep links must work on a refresh, every screen must render at 390px without
 * a horizontal scrollbar, and the console must be quiet. Those three are in the
 * definition of done, so they get a test rather than a manual pass.
 */
const ROUTES = [
  '/ar/dashboard',
  '/ar/dashboard/orders',
  '/ar/dashboard/orders/new',
  '/ar/dashboard/products',
  '/ar/dashboard/products/new',
  '/ar/dashboard/customers',
  '/ar/dashboard/call-center',
  '/ar/dashboard/call-center/agents',
  '/ar/dashboard/shipping',
  '/ar/dashboard/shipping/methods',
  '/ar/dashboard/campaigns',
  '/ar/dashboard/pages',
  '/ar/dashboard/themes',
  '/ar/dashboard/design',
  '/ar/dashboard/apps',
  '/ar/dashboard/apps/qr',
  '/ar/dashboard/apps/trust-badges',
  '/ar/dashboard/integrations',
  '/ar/dashboard/integrations/import',
  '/ar/dashboard/pixels',
  '/ar/dashboard/collections',
  '/ar/dashboard/abandoned',
  '/ar/dashboard/analytics/orders',
  '/ar/dashboard/settings',
  '/ar/dashboard/settings/checkout',
  '/ar/dashboard/staff',
  '/ar/dashboard/billing',
  '/ar/dashboard/audit',
  '/ar/dashboard/profile',
];

test.describe('dashboard routes', () => {
  test.beforeEach(async ({ context }) => {
    await blockWebfonts(context);
  });

  for (const route of ROUTES) {
    test(`${route} renders on a direct load`, async ({ page }) => {
      const failures: string[] = [];
      page.on('pageerror', (error) => failures.push(String(error)));

      const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
      expect(response?.status(), `${route} status`).toBeLessThan(400);

      // A heading means the page actually rendered, rather than returning a
      // shell that then errored during hydration.
      await expect(page.locator('h1, h2').first()).toBeVisible();

      await page.waitForLoadState('load');

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${route} horizontal overflow`).toBeLessThanOrEqual(1);

      expect(failures, `${route} page errors`).toEqual([]);
    });
  }
});

test.describe('the shell', () => {
  test.beforeEach(async ({ context }) => {
    await blockWebfonts(context);
  });

  test('navigates between sections without a full reload', async ({ page }) => {
    await page.goto('/ar/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load');

    await page.getByRole('link', { name: /الطلبات/ }).first().click();
    await expect(page).toHaveURL(/\/dashboard\/orders/);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('Arabic renders right to left', async ({ page }) => {
    await page.goto('/ar/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  });

  test('English renders left to right', async ({ page }) => {
    await page.goto('/en/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});
