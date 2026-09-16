import { expect, test } from '@playwright/test';

import { AGENT, blockWebfonts, STORE_SLUG } from './helpers';

/**
 * The call-centre portal.
 *
 * A second authentication realm with its own table, its own cookie and its own
 * UI. The tests that matter here are the boundaries: an agent is not a
 * merchant, a merchant session is not an agent session, and a failed agent
 * login must not reveal whether the store or the username existed.
 */
test.describe('agent portal', () => {
  test.beforeEach(async ({ context }) => {
    await blockWebfonts(context);
  });

  test('an agent signs in and lands on their own queue', async ({ page }) => {
    await page.goto('/ar/agent/login');
    await page.waitForLoadState('load');

    await page.getByLabel(/معرّف المتجر|المتجر/).first().fill(STORE_SLUG);
    await page.getByLabel(/اسم المستخدم/).first().fill(AGENT.username);
    await page.getByLabel(/كلمة المرور/).first().fill(AGENT.password);

    await page.getByRole('button', { name: /دخول/ }).first().click();

    await expect(page).toHaveURL(/\/agent\//, { timeout: 30_000 });
    await expect(page).not.toHaveURL(/\/agent\/login/);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('an agent session does not open the merchant dashboard', async ({ page }) => {
    await page.goto('/ar/agent/login');
    await page.waitForLoadState('load');

    await page.getByLabel(/معرّف المتجر|المتجر/).first().fill(STORE_SLUG);
    await page.getByLabel(/اسم المستخدم/).first().fill(AGENT.username);
    await page.getByLabel(/كلمة المرور/).first().fill(AGENT.password);
    await page.getByRole('button', { name: /دخول/ }).first().click();
    await expect(page).toHaveURL(/\/agent\//, { timeout: 30_000 });

    // The two realms have separate cookies; an agent cookie must not be
    // mistaken for a merchant session.
    await page.goto('/ar/dashboard/orders', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/\/dashboard\/orders/);
  });

  test('a wrong agent login does not reveal which part was wrong', async ({ page }) => {
    await page.goto('/ar/agent/login');
    await page.waitForLoadState('load');

    // A store that does not exist and a username that does not exist must
    // produce the same message as a merely wrong password, or the form becomes
    // an enumeration oracle for both.
    await page.getByLabel(/معرّف المتجر|المتجر/).first().fill('no-such-store');
    await page.getByLabel(/اسم المستخدم/).first().fill('nobody');
    await page.getByLabel(/كلمة المرور/).first().fill('wrong-password');
    await page.getByRole('button', { name: /دخول/ }).first().click();

    await expect(page).toHaveURL(/\/agent\/login/);
    await expect(page.locator('body')).not.toContainText(/غير موجود|not found|no such/i);
  });

  test('the portal is reachable without a session only at its login', async ({ page }) => {
    const response = await page.goto('/ar/agent/orders', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/agent\/login/);
  });
});
