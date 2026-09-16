import { expect, test as setup } from '@playwright/test';

import { blockWebfonts, MERCHANT, MERCHANT_STATE } from './helpers';

/**
 * Sign in once for the whole suite.
 *
 * Every test logging in separately was both slow and flaky: the submit button
 * is wired by a client component, so filling and clicking immediately after
 * `domcontentloaded` sometimes hit the button before hydration and the form did
 * nothing at all. Doing it once, carefully, and reusing the cookie removes both
 * problems — and the login flow itself still has its own tests, run without
 * this state.
 *
 * The generous budget is for a cold start. This is the first request to a
 * freshly spawned production server, so it pays for the Prisma engine booting
 * and the first database connection on top of the password hash; a login that
 * takes ten seconds here says nothing about a warm one.
 */
setup.setTimeout(120_000);

setup('authenticate as the merchant', async ({ page, context }) => {
  await blockWebfonts(context);

  // Warm the server before timing anything that matters.
  await page.goto('/ar/login');
  await page.waitForLoadState('load');

  const submit = page.getByRole('button', { name: 'دخول', exact: true });
  await expect(submit).toBeEnabled();

  await page.fill('input[type="email"]', MERCHANT.email);
  await page.fill('input[type="password"]', MERCHANT.password);
  await submit.click();

  // `toHaveURL` polls the URL; `waitForURL` waits for a load event, which a
  // client-side router navigation never fires, so it would hang here even
  // though the sign-in succeeded.
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 90_000 });

  await context.storageState({ path: MERCHANT_STATE });
});
