import { test, expect } from './fixtures'

/**
 * Admin /admin/social?tab=accounts — auditing the social connections UI
 * end-to-end. The historical failure mode is "Connect Facebook redirects
 * back to localhost:5173" because PUBLIC_BASE_URL isn't set on Vercel. We
 * now derive the redirect_uri from the incoming request, so even when the
 * env var is missing the OAuth flow uses the real public host.
 *
 * These tests need:
 *   GRITSYNC_ADMIN_EMAIL    — admin user's email
 *   GRITSYNC_ADMIN_PASSWORD — admin user's password
 *
 * They auto-skip otherwise so the unauthenticated suite stays runnable.
 */

const ADMIN_EMAIL = process.env.GRITSYNC_ADMIN_EMAIL ?? ''
const ADMIN_PASSWORD = process.env.GRITSYNC_ADMIN_PASSWORD ?? ''

test.describe('Admin · /admin/social?tab=accounts connections', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !ADMIN_EMAIL || !ADMIN_PASSWORD,
      'GRITSYNC_ADMIN_EMAIL / GRITSYNC_ADMIN_PASSWORD must be set to run admin tests',
    )
    await page.goto('/login')
    await page.getByPlaceholder(/you@example|email|grit/i).first().fill(ADMIN_EMAIL)
    await page.locator('input[type=password]').first().fill(ADMIN_PASSWORD)
    await page.getByRole('button', { name: /sign in|log in/i }).click()
    await page.waitForURL((url) => /\/admin\/|\/client\/|\/dashboard/.test(url.pathname), {
      timeout: 30_000,
    })
  })

  test('Accounts tab renders Meta connection card', async ({ page }) => {
    await page.goto('/admin/social?tab=accounts')
    // The Meta connection card is the first thing under the Drive card.
    await expect(page.getByRole('heading', { name: /meta \(facebook \+ instagram\)|meta —/i })).toBeVisible({
      timeout: 15_000,
    })
  })

  test('Connect Meta builds a redirect_uri matching the live host (not localhost)', async ({ page, baseURL }) => {
    await page.goto('/admin/social?tab=accounts')

    // The Connect button calls /api/social/oauth/facebook/start which
    // returns the Meta authorize URL. We don't need to actually launch
    // the popup — we just need to verify the redirect_uri parameter is
    // built correctly. Capture the API response instead of opening the
    // OAuth popup.
    const responsePromise = page.waitForResponse(
      (r) => r.url().endsWith('/api/social/oauth/facebook/start') && r.request().method() === 'GET',
      { timeout: 15_000 },
    )

    // The Meta card's primary CTA — "Connect Meta" when not connected, or
    // "Reconnect" when already connected. Either path hits /oauth/facebook/start.
    const connectBtn = page.getByRole('button', { name: /connect meta|reconnect/i }).first()
    await connectBtn.click()

    const res = await responsePromise
    expect(res.ok()).toBe(true)
    const body = await res.json()
    const authUrl: string = body?.data?.url || body?.url || ''
    expect(authUrl, 'oauth/start should return a URL').toContain('facebook.com/v')

    const u = new URL(authUrl)
    const redirectUri = u.searchParams.get('redirect_uri') || ''
    expect(redirectUri, 'redirect_uri should be present').not.toBe('')

    // The redirect_uri MUST resolve against the same host we're running
    // the test on — anything pointing at localhost when running against
    // prod is the bug we just shipped a fix for.
    const expectedHost = new URL(baseURL!).host
    expect(
      redirectUri,
      `redirect_uri should match the test host (${expectedHost}), got ${redirectUri}`,
    ).toContain(expectedHost)
    expect(redirectUri).toContain('/api/social/oauth/facebook/callback')
    expect(redirectUri, 'redirect_uri must NOT be localhost in prod').not.toContain('localhost:5173')
  })

  test('Threads connect URL also uses the live host', async ({ page, baseURL }) => {
    await page.goto('/admin/social?tab=accounts')

    const responsePromise = page.waitForResponse(
      (r) => r.url().endsWith('/api/social/oauth/threads/start') && r.request().method() === 'GET',
      { timeout: 15_000 },
    )

    // The Threads platform tile in the grid — find the card with label
    // "Threads" and click its primary connect button.
    const threadsCard = page.getByText('Threads', { exact: true }).first()
    await threadsCard.scrollIntoViewIfNeeded()
    // The connect button is inside the same card as the "Threads" label.
    const card = threadsCard.locator('xpath=ancestor::div[contains(@class, "rounded-lg")][1]')
    await card.getByRole('button', { name: /connect|manual/i }).first().click()

    const res = await responsePromise
    if (!res.ok()) {
      // If THREADS_APP_ID isn't set on the server yet, /oauth/threads/start
      // returns a 400 with a clear message — assert that instead of failing
      // the test, since the redirect_uri bug isn't reachable in that case.
      const body = await res.json().catch(() => ({}))
      expect(body.error).toMatch(/THREADS_APP_ID|not configured/i)
      return
    }
    const body = await res.json()
    const authUrl: string = body?.data?.url || body?.url || ''
    expect(authUrl).toContain('threads.net/oauth/authorize')

    const u = new URL(authUrl)
    const redirectUri = u.searchParams.get('redirect_uri') || ''
    const expectedHost = new URL(baseURL!).host
    expect(redirectUri).toContain(expectedHost)
    expect(redirectUri).toContain('/api/social/oauth/threads/callback')
    expect(redirectUri).not.toContain('localhost:5173')
  })

  test('OAuth status endpoint reports configured platforms', async ({ page }) => {
    // /api/social/accounts/oauth-status returns which platforms have
    // server-side credentials. After setting FACEBOOK_APP_ID/SECRET and
    // (optionally) THREADS_APP_ID/SECRET in Vercel, both should be
    // oauth_ready=true.
    await page.goto('/admin/social?tab=accounts')
    const res = await page.request.get('/api/social/accounts/oauth-status', {
      headers: {
        Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem('gritsync_token'))}`,
      },
    })
    expect(res.ok()).toBe(true)
    const body = await res.json()
    const status = body?.data || {}
    expect(status).toHaveProperty('facebook')
    expect(status).toHaveProperty('threads')
    // If these fail, the FACEBOOK_APP_ID / THREADS_APP_ID env vars are
    // missing on the server.
    expect(status.facebook?.oauth_ready, 'FACEBOOK_APP_ID + FACEBOOK_APP_SECRET should be set on the server').toBe(true)
  })
})
