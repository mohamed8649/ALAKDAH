import { expect, test as setup } from '@playwright/test';

import { blockWebfonts, MERCHANT, MERCHANT_STATE } from './helpers';

/**
 * Sign in once for the whole suite.
 *
 * Every test logging in separately was both slow and flaky: the submit button
 * is wired by a client component, so filling and clicking immediately after
 * `domcontentloaded` sometimes hit the button before hydration and the form
 * did nothing at all. Doing it once, carefully, and reusing the cookie removes
 * both problems — and the login flow itself still has its own tests, run
 * without this state.
 */
setup('authenticate as the merchant', async ({ page, context }) => {
  await blockWebfonts(context);

  await page.goto('/ar/login');
  // `load` rather than `domcontentloaded`: the click must land on a hydrated
  // button, not on server-rendered markup.
  await page.waitForLoadState('load');

  const submit = page.getByRole('button', { name: 'دخول', exact: true });
  await expect(submit).toBeEnabled();

  await page.fill('input[type="email"]', MERCHANT.email);
  await page.fill('input[type="password"]', MERCHANT.password);
  await submit.click();

  await page.waitForURL('**/dashboard**', { timeout: 30_000 });
  await expect(page).toHaveURL(/\/dashboard/);

  await context.storageState({ path: MERCHANT_STATE });
});
