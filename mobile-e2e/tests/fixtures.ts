import { test as base, expect } from '@playwright/test'

/**
 * Shared Playwright fixtures + helpers used across the mobile-shaped E2E
 * suite.
 *
 * Test account: `playstore-reviewer@gritsync.com` — created by
 * scripts/create-playstore-reviewer-account.cjs. The password is rotated
 * each time that script runs; set GRITSYNC_TEST_PASSWORD in CI / locally
 * to keep tests passing.
 */

export const TEST_EMAIL =
  process.env.GRITSYNC_TEST_EMAIL ?? 'playstore-reviewer@gritsync.com'
export const TEST_PASSWORD = process.env.GRITSYNC_TEST_PASSWORD ?? ''

interface Fixtures {
  /** Logged-in user — navigates to /login and submits credentials. */
  signedIn: void
}

export const test = base.extend<Fixtures>({
  signedIn: [
    async ({ page }, use) => {
      if (!TEST_PASSWORD) {
        test.skip(
          true,
          'GRITSYNC_TEST_PASSWORD is not set. Re-run `node scripts/create-playstore-reviewer-account.cjs` and export the printed password.',
        )
      }
      await page.goto('/login')
      await page
        .getByPlaceholder(/you@example|email|grit/i)
        .first()
        .fill(TEST_EMAIL)
      // Web login page uses a password field — name varies by layout, so
      // we hit the first input[type=password] on the page.
      await page.locator('input[type=password]').first().fill(TEST_PASSWORD)
      await page.getByRole('button', { name: /sign in|log in/i }).click()
      // After login, we should land somewhere under /client/ (or /dashboard
      // depending on role). Wait for the URL to settle.
      await page.waitForURL((url) => /\/client\/|\/dashboard/.test(url.pathname), {
        timeout: 30_000,
      })
      await use()
    },
    { auto: false },
  ],
})

export { expect }
