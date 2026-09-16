import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const MERCHANT_STATE = 'tests/e2e/.auth/merchant.json';

/**
 * End-to-end configuration.
 *
 * Tests run against a production build, not the dev server: the things most
 * likely to break in this app — server actions, RSC payloads, redirects after
 * login — behave differently under `next dev`.
 *
 * Signing in happens once, in the `setup` project, and the resulting cookie is
 * reused. The public projects deliberately run with no stored session, because
 * a storefront test that is quietly signed in as the merchant is not testing
 * what a customer sees.
 *
 * Desktop and a 390px mobile both run: mobile is the primary surface for this
 * product's customers, and half the bugs in a COD storefront are layout bugs
 * on a phone.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  // A shared database means parallel workers would fight over the same store's
  // stock and order numbers.
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  timeout: 60_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: BASE_URL,
    locale: 'ar-LY',
    timezoneId: 'Africa/Tripoli',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'public',
      testMatch: /(storefront-.*|agent-portal)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
    },
    {
      name: 'public-mobile',
      testMatch: /(storefront-.*|agent-portal)\.spec\.ts/,
      use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } },
    },
    {
      name: 'dashboard',
      testMatch: /dashboard\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 900 },
        storageState: MERCHANT_STATE,
      },
    },
    {
      name: 'dashboard-mobile',
      testMatch: /dashboard\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 390, height: 844 },
        storageState: MERCHANT_STATE,
      },
    },
  ],

  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run start',
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
