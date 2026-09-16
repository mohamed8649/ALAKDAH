import { expect, test } from '@playwright/test';

import { blockWebfonts, loginAsMerchant, STORE_SLUG, uniquePhone } from './helpers';

/**
 * The public storefront.
 *
 * These tests run with no stored session on purpose: a storefront test that is
 * quietly signed in as the merchant is not testing what a customer sees.
 *
 * The checkout is the flow the whole product exists for — a customer finds a
 * product and places an order without paying — and it runs at both viewports,
 * because a broken mobile checkout is a broken business.
 */
test.describe('storefront checkout', () => {
  test.beforeEach(async ({ context }) => {
    await blockWebfonts(context);
  });

  test('a customer can place a cash-on-delivery order', async ({ page }) => {
    await page.goto(`/ar/${STORE_SLUG}/products`);
    await page.waitForLoadState('load');

    const firstProduct = page.locator(`a[href^="/ar/${STORE_SLUG}/products/"]`).first();
    await expect(firstProduct).toBeVisible();
    await firstProduct.click();

    await expect(page).toHaveURL(new RegExp(`/${STORE_SLUG}/products/`));
    await expect(page.locator('h1').first()).toBeVisible();
    await page.waitForLoadState('load');

    // Straight to checkout — the direct-buy path a landing page also uses.
    await page.getByRole('button', { name: /اشتر|اطلب/ }).first().click();
    await expect(page).toHaveURL(new RegExp(`/${STORE_SLUG}/checkout`), { timeout: 30_000 });
    await page.waitForLoadState('load');

    await page.fill('input[type="tel"]', uniquePhone());

    // Only the fields this merchant configured are rendered, so each is filled
    // if it exists rather than assumed. Every required one has to actually
    // land, though: an unfilled required field is how this test previously
    // "passed" while watching the form correctly refuse to submit.
    for (const [label, value] of [
      ['اسم العميل', 'عميل اختبار'],
      ['المنطقة', 'طرابلس'],
      ['المدينة', 'تاجوراء'],
      ['العنوان', 'شارع الاختبار، مبنى ١'],
    ] as const) {
      const field = page.getByLabel(label).first();
      if (await field.count()) await field.fill(value);
    }

    await page.getByRole('button', { name: 'تأكيد الطلب' }).click();

    // No field-level error means the form was accepted rather than rejected.
    await expect(page.getByText('هذا الحقل مطلوب')).toHaveCount(0);

    // Polled rather than `waitForURL`: the redirect after a successful order is
    // a client-side router navigation, which fires no load event.
    await expect(page).toHaveURL(/order-success/, { timeout: 30_000 });
    await expect(page.locator('body')).toContainText(/شكرا|شكراً|تم/);
  });

  test('checkout refuses an empty form instead of failing silently', async ({ page }) => {
    await page.goto(`/ar/${STORE_SLUG}/products`);
    await page.waitForLoadState('load');

    await page.locator(`a[href^="/ar/${STORE_SLUG}/products/"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`/${STORE_SLUG}/products/`));
    await page.waitForLoadState('load');

    await page.getByRole('button', { name: /اشتر|اطلب/ }).first().click();
    await expect(page).toHaveURL(new RegExp(`/${STORE_SLUG}/checkout`), { timeout: 30_000 });
    await page.waitForLoadState('load');

    await page.getByRole('button', { name: 'تأكيد الطلب' }).click();

    // The order must not be created, and the customer must stay where they can
    // fix it — with the problem named, not just a silent no-op.
    await expect(page).toHaveURL(/\/checkout/);
    await expect(page.getByText('هذا الحقل مطلوب').first()).toBeVisible();
  });
});

test.describe('order tracking', () => {
  test.beforeEach(async ({ context }) => {
    await blockWebfonts(context);
  });

  test('does not reveal an order to someone with the wrong phone', async ({ page }) => {
    await page.goto(`/ar/${STORE_SLUG}/track`);
    await page.waitForLoadState('load');
    await expect(page.locator('h1').first()).toBeVisible();

    const inputs = page.locator('input:visible');
    const count = await inputs.count();
    expect(count).toBeGreaterThan(0);

    // A guessable order number plus a phone that does not own it must return
    // nothing — order numbers alone are not a credential.
    await inputs.first().fill('AKD-1001');
    if (count > 1) await inputs.nth(1).fill('0999999999');

    await page.getByRole('button', { name: /تتبع|بحث|استعلام/ }).first().click();
    await page.waitForTimeout(3000);

    await expect(page.locator('body')).not.toContainText('طرابلس');
  });
});

test.describe('authentication', () => {
  test.beforeEach(async ({ context }) => {
    await blockWebfonts(context);
  });

  test('a signed-out visitor is sent to login, not to an empty dashboard', async ({ page }) => {
    await page.goto('/ar/dashboard/orders', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login/);
  });

  test('wrong credentials give a generic error and no session', async ({ page }) => {
    await page.goto('/ar/login');
    await page.waitForLoadState('load');

    await page.fill('input[type="email"]', 'nobody@example.com');
    await page.fill('input[type="password"]', 'wrong-password');
    await page.getByRole('button', { name: 'دخول', exact: true }).click();

    await expect(page).toHaveURL(/\/login/);

    // The message must not distinguish "no such account" from "wrong password",
    // or it becomes an account-enumeration oracle.
    await expect(page.locator('body')).not.toContainText(/غير موجود|not found|no such/i);
  });

  test('a merchant can sign in and reach the dashboard', async ({ page }) => {
    await loginAsMerchant(page);
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
