import { test, expect, TEST_EMAIL, TEST_PASSWORD } from './fixtures'

/**
 * Sanity tests — these run unauthenticated, so they're cheap and don't
 * depend on test-account credentials being populated.
 */

test.describe('Mobile-shaped: login page', () => {
  test('/login renders and has the brand mark', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveTitle(/GritSync/i)
    // The brand wordmark "Grit" + "Sync" is rendered as two adjacent text nodes.
    await expect(page.getByText(/grit/i).first()).toBeVisible()
    await expect(page.getByText(/sync/i).first()).toBeVisible()
  })

  test('/login surfaces the Forgot password link', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('link', { name: /forgot/i }).first()).toBeVisible()
  })

  test('Submitting empty credentials shows an error', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: /sign in|log in/i }).click()
    // We expect either a toast or inline error — either way, "required" /
    // "invalid" / "missing" text shows up somewhere in the DOM.
    await expect(
      page.getByText(/required|invalid|missing|enter.*email|enter.*password/i).first(),
    ).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('Mobile-shaped: marketing routes', () => {
  test('/download serves the install page', async ({ page }) => {
    await page.goto('https://gritsync.com/download')
    await expect(page.getByText(/GritSync on your phone/i)).toBeVisible()
    // At least one install CTA should be present (App Store / Play / APK).
    await expect(
      page.getByText(/google play|app store|apk|testflight/i).first(),
    ).toBeVisible()
  })

  test('/account/delete redirects to canonical app subdomain URL', async ({ page }) => {
    await page.goto('https://gritsync.com/account/delete')
    // The page does a window.location.replace to the app subdomain.
    await page.waitForURL(/account-settings\/delete/, { timeout: 15_000 })
    await expect(page.getByText(/delete your gritsync account/i)).toBeVisible()
  })
})

test.describe('Mobile-shaped: signed-in flows', () => {
  test('Sign in lands on a client route', async ({ page }) => {
    test.skip(
      !TEST_PASSWORD,
      'Set GRITSYNC_TEST_PASSWORD (from scripts/create-playstore-reviewer-account.cjs) to run signed-in tests',
    )
    await page.goto('/login')
    await page.getByPlaceholder(/you@example|email|grit/i).first().fill(TEST_EMAIL)
    await page.locator('input[type=password]').first().fill(TEST_PASSWORD)
    await page.getByRole('button', { name: /sign in|log in/i }).click()
    await page.waitForURL((url) => /\/client\/|\/dashboard/.test(url.pathname), {
      timeout: 30_000,
    })
    expect(page.url()).toMatch(/\/client\/|\/dashboard/)
  })

  test('Account Settings exposes the Delete-account modal', async ({ page }) => {
    test.skip(!TEST_PASSWORD, 'Needs GRITSYNC_TEST_PASSWORD')
    // Sign in inline (this test doesn't need the fixture's auto-wait).
    await page.goto('/login')
    await page.getByPlaceholder(/you@example|email|grit/i).first().fill(TEST_EMAIL)
    await page.locator('input[type=password]').first().fill(TEST_PASSWORD)
    await page.getByRole('button', { name: /sign in|log in/i }).click()
    await page.waitForURL((url) => /\/client\/|\/dashboard/.test(url.pathname))

    await page.goto('/client/account-settings')
    // Sessions tab is where the Danger Zone lives.
    const sessionsTab = page.getByRole('button', { name: /sessions/i }).first()
    if (await sessionsTab.isVisible().catch(() => false)) {
      await sessionsTab.click()
    }
    // The button text is exactly "Delete my account".
    const deleteBtn = page.getByRole('button', { name: /delete my account/i })
    await expect(deleteBtn).toBeVisible({ timeout: 15_000 })
    await deleteBtn.click()

    // Modal opens — must require typing DELETE to confirm.
    await expect(page.getByText(/type.*delete.*confirm/i)).toBeVisible()
    await expect(
      page.getByRole('button', { name: /permanently delete account/i }),
    ).toBeDisabled()

    // Cancel out so the test is non-destructive.
    await page.getByRole('button', { name: /^cancel$/i }).click()
  })
})
