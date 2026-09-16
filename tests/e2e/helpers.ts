import type { BrowserContext, Page } from '@playwright/test';

/** Credentials created by `npm run db:seed`. */
export const MERCHANT = { email: 'demo@alakdah.ly', password: 'demo1234' };

export const STORE_SLUG = 'demo';

/** Where `auth.setup.ts` writes the signed-in cookie jar. */
export const MERCHANT_STATE = 'tests/e2e/.auth/merchant.json';

/**
 * Block webfonts.
 *
 * The sandbox this suite runs in cannot reach fonts.googleapis.com, and a
 * pending stylesheet request makes every network-idle wait hang. Fonts are not
 * what these tests are checking.
 */
export async function blockWebfonts(context: BrowserContext): Promise<void> {
  await context.route('**fonts.googleapis.com**', (route) => route.abort());
  await context.route('**fonts.gstatic.com**', (route) => route.abort());
}

/**
 * Sign in within a single test.
 *
 * Most tests inherit a session from the `setup` project instead; this is for
 * the tests that are about logging in. It waits for `load` so the click lands
 * on a hydrated button rather than on server-rendered markup.
 */
export async function loginAsMerchant(page: Page, locale = 'ar'): Promise<void> {
  await page.goto(`/${locale}/login`);
  await page.waitForLoadState('load');

  await page.fill('input[type="email"]', MERCHANT.email);
  await page.fill('input[type="password"]', MERCHANT.password);
  await page.getByRole('button', { name: 'دخول', exact: true }).click();

  await page.waitForURL('**/dashboard**', { timeout: 30_000 });
}

/** A phone number that is unique per run, so repeated runs do not collide. */
export function uniquePhone(): string {
  const suffix = String(Date.now()).slice(-7);
  return `09123${suffix.slice(0, 5)}`;
}
