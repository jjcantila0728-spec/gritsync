/**
 * End-to-end test runner.
 *
 * - Crawls all public pages
 * - Logs in as each role (admin/advisor/affiliate/client) using seeded users
 * - Tours role-specific pages
 * - For client: attempts application creation
 * - Captures: console errors, page errors, failed network requests (4xx/5xx),
 *   screenshots per page
 *
 * Run: npx tsx scripts/e2e-test.ts
 * Pre-req: dev server running (npm run dev), users seeded
 *   (npx tsx scripts/seed-e2e-users.ts)
 */

import { chromium, type Browser, type Page, type BrowserContext } from 'playwright'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const BASE = process.env.E2E_BASE || 'http://localhost:5000'
const OUT_DIR = resolve(process.cwd(), 'scripts/e2e-output')
const SCREEN_DIR = resolve(OUT_DIR, 'screenshots')
mkdirSync(SCREEN_DIR, { recursive: true })

const seedFile = JSON.parse(
  readFileSync(resolve(process.cwd(), 'scripts/e2e-test-users.json'), 'utf8')
)
const users: Record<string, { personal_email: string; password: string }> = {}
for (const u of seedFile.users) users[u.role] = u

// Curated route lists per scope. Not exhaustive — focused on the most
// impactful pages per role. Add more here as needed.
const ROUTES = {
  public: [
    '/',
    '/about-us',
    '/faqs',
    '/quote',
    '/tracking',
    '/sponsorship',
    '/sponsorship/apply',
    '/career',
    '/career/apply',
    '/donate',
    '/donate/checkout',
    '/terms',
    '/privacy',
    '/login',
    '/register',
    '/forgot-password',
  ],
  client: [
    '/client/dashboard',
    '/client/applications',
    '/client/application/new',
    '/client/quotations/new',
    '/client/my-details',
    '/client/account-settings',
    '/client/documents',
    '/client/notifications',
    '/client/messages',
    '/client/emails',
    '/client/emails/inbox',
    '/client/emails/sent',
  ],
  affiliate: [
    '/affiliate',
    '/affiliate/dashboard',
    '/affiliate/messages',
    '/affiliate/notifications',
    '/affiliate/my-details',
    '/affiliate/account-settings',
  ],
  advisor: [
    '/advisor',
    '/advisor/dashboard',
    '/advisor/applications',
    '/advisor/clients',
    '/advisor/messages',
    '/advisor/emails',
    '/advisor/emails/inbox',
    '/advisor/notifications',
    '/advisor/my-details',
    '/advisor/account-settings',
  ],
  admin: [
    '/admin/dashboard',
    '/admin/applications',
    '/admin/users',
    '/admin/quotations',
    '/admin/settings',
    '/admin/settings/general',
    '/admin/settings/security',
    '/admin/settings/payment',
    '/admin/settings/services',
    '/admin/settings/promo-codes',
    '/admin/notifications',
    '/admin/sponsorships',
    '/admin/donations',
    '/admin/careers',
    '/admin/partner-agencies',
    '/admin/question-bank',
    '/admin/nclex-subscriptions',
    '/admin/emails',
    '/admin/email-addresses',
    '/admin/email-templates',
    '/admin/analytics',
    '/admin/social',
    '/admin/ads',
    '/admin/messages',
    '/admin/my-details',
    '/admin/account-settings',
  ],
}

type PageRecord = {
  scope: string
  path: string
  status: 'ok' | 'fail'
  loadMs: number
  consoleErrors: string[]
  pageErrors: string[]
  failedRequests: Array<{ url: string; status: number; method: string }>
}

const results: PageRecord[] = []

function attachListeners(page: Page) {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  const failedRequests: Array<{ url: string; status: number; method: string }> = []

  page.on('console', msg => {
    if (msg.type() === 'error') {
      // Strip noisy known-fine errors: favicons, font preload mismatches.
      const text = msg.text()
      if (/favicon|preloaded with link preload was not used/i.test(text)) return
      consoleErrors.push(text.slice(0, 500))
    }
  })
  page.on('pageerror', err => {
    pageErrors.push(`${err.name}: ${err.message}`.slice(0, 500))
  })
  page.on('response', resp => {
    const status = resp.status()
    if (status >= 400) {
      const url = resp.url()
      // Filter noisy 404s on static assets we don't care about for QA.
      if (/\.(map|woff2?|ttf)$/i.test(url)) return
      failedRequests.push({ url: url.slice(0, 200), method: resp.request().method(), status })
    }
  })

  return { consoleErrors, pageErrors, failedRequests }
}

async function visit(page: Page, scope: string, path: string) {
  const { consoleErrors, pageErrors, failedRequests } = attachListeners(page)
  const start = Date.now()
  let status: 'ok' | 'fail' = 'ok'
  try {
    // domcontentloaded (not networkidle): the app polls settings continuously,
    // so networkidle never fires.
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await page.waitForTimeout(1500) // let React render + lazy fetches settle
  } catch (e: any) {
    status = 'fail'
    pageErrors.push(`navigation: ${e.message}`.slice(0, 500))
  }
  const loadMs = Date.now() - start

  const safe = `${scope}_${path.replace(/[^a-z0-9]+/gi, '_')}`.slice(0, 80)
  try {
    await page.screenshot({ path: resolve(SCREEN_DIR, `${safe}.png`), fullPage: false })
  } catch {}

  const rec: PageRecord = { scope, path, status, loadMs, consoleErrors, pageErrors, failedRequests }
  results.push(rec)

  const symbol = status === 'ok' && consoleErrors.length === 0 && pageErrors.length === 0 && failedRequests.length === 0
    ? '✓'
    : '✗'
  console.log(`  ${symbol} [${scope}] ${path} (${loadMs}ms, ${consoleErrors.length}ce, ${pageErrors.length}pe, ${failedRequests.length}net)`)

  // Detach so the next page doesn't accumulate listeners
  page.removeAllListeners('console')
  page.removeAllListeners('pageerror')
  page.removeAllListeners('response')
}

async function loginAs(page: Page, role: string) {
  const u = users[role]
  if (!u) throw new Error(`No seeded user for role ${role}`)

  let lastErr: any
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 20000 })
      await page.waitForTimeout(1500)
      const emailInput = page.locator('input[placeholder*="email" i]').first()
      const passwordInput = page.locator('input[type="password"]').first()
      await emailInput.waitFor({ timeout: 10000 })
      await emailInput.fill(u.personal_email)
      await passwordInput.fill(u.password)
      const submit = page.locator('button:has-text("Sign In"), button[type="submit"]').first()
      // Wait for both the click AND the resulting POST to /api/auth/login
      await Promise.all([
        page.waitForResponse(r => r.url().includes('/api/auth/login') && r.request().method() === 'POST', { timeout: 20000 }).catch(() => null),
        submit.click(),
      ])
      await page.waitForURL(url => !url.pathname.endsWith('/login'), { timeout: 20000 })
      return // success
    } catch (e: any) {
      lastErr = e
      console.log(`  [${role}] login attempt ${attempt} failed: ${e.message.slice(0, 100)} — retrying...`)
      await page.waitForTimeout(2000)
    }
  }
  await page.screenshot({ path: resolve(SCREEN_DIR, `login_fail_${role}.png`), fullPage: true }).catch(() => {})
  const errText = await page.locator('text=/error|invalid|incorrect|wrong/i').first().textContent().catch(() => '')
  throw new Error(`Login as ${role} failed after 2 attempts. Last: "${lastErr?.message?.slice(0, 200)}". On-screen: "${errText}"`)
}

async function attemptClientApplicationFlow(page: Page) {
  console.log('\n[client-flow] Attempting application creation...')
  const start = Date.now()
  const { consoleErrors, pageErrors, failedRequests } = attachListeners(page)
  try {
    await page.goto(`${BASE}/client/application/new`, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await page.waitForTimeout(2500)

    // Best-effort: fill every visible text/select input with fake data.
    const fillable = await page.locator('input:visible, textarea:visible').all()
    for (const el of fillable) {
      const type = (await el.getAttribute('type')) || 'text'
      const name = (await el.getAttribute('name')) || ''
      const placeholder = (await el.getAttribute('placeholder')) || ''
      if (type === 'hidden' || type === 'file' || type === 'checkbox' || type === 'radio') continue
      const lower = (name + ' ' + placeholder).toLowerCase()
      let value = 'Test Value'
      if (type === 'email' || lower.includes('email')) value = 'app-test@example.test'
      else if (type === 'tel' || lower.includes('mobile') || lower.includes('phone')) value = '+639170000000'
      else if (type === 'date' || lower.includes('date') || lower.includes('birth')) value = '1990-01-01'
      else if (type === 'number') value = '1'
      else if (lower.includes('first')) value = 'TestFirst'
      else if (lower.includes('last')) value = 'TestLast'
      else if (lower.includes('middle')) value = 'M'
      else if (lower.includes('address') || lower.includes('street')) value = '123 Test St'
      else if (lower.includes('city')) value = 'Manila'
      else if (lower.includes('zip') || lower.includes('postal')) value = '1000'
      else if (lower.includes('passport')) value = 'P1234567'
      try { await el.fill(value, { timeout: 1500 }) } catch {}
    }
    // Selects: pick the first non-empty option
    const selects = await page.locator('select:visible').all()
    for (const sel of selects) {
      const options = await sel.locator('option').all()
      for (const opt of options) {
        const v = await opt.getAttribute('value')
        if (v && v.trim() !== '') {
          try { await sel.selectOption(v, { timeout: 1500 }); break } catch {}
        }
      }
    }
    // Click first available "Next" or "Continue" button
    const next = page.locator('button:has-text("Next"), button:has-text("Continue"), button:has-text("Save"), button:has-text("Submit")').first()
    if (await next.isVisible().catch(() => false)) {
      await next.click().catch(() => {})
      await page.waitForTimeout(1500)
    }

    await page.screenshot({ path: resolve(SCREEN_DIR, 'client_application_filled.png'), fullPage: true })
  } catch (e: any) {
    pageErrors.push(`application-flow: ${e.message}`)
  }
  results.push({
    scope: 'client-flow',
    path: '/client/application/new (filled)',
    status: pageErrors.length === 0 ? 'ok' : 'fail',
    loadMs: Date.now() - start,
    consoleErrors,
    pageErrors,
    failedRequests,
  })
}

async function tourScope(browser: Browser, role: string | null, paths: string[]) {
  const ctx: BrowserContext = await browser.newContext({
    viewport: { width: 1366, height: 850 },
    ignoreHTTPSErrors: true,
  })
  const page = await ctx.newPage()
  if (role) {
    try {
      await loginAs(page, role)
      console.log(`\n[${role}] logged in. Touring ${paths.length} pages...`)
    } catch (e: any) {
      console.error(`[${role}] login failed: ${e.message}`)
      results.push({
        scope: role,
        path: '__login__',
        status: 'fail',
        loadMs: 0,
        consoleErrors: [],
        pageErrors: [e.message],
        failedRequests: [],
      })
      await ctx.close()
      return
    }
  } else {
    console.log(`\n[public] Touring ${paths.length} pages...`)
  }
  for (const p of paths) {
    await visit(page, role || 'public', p)
  }
  if (role === 'client') {
    await attemptClientApplicationFlow(page)
  }
  await ctx.close()
}

async function main() {
  console.log(`E2E suite starting against ${BASE}`)
  console.log(`Seeded users: ${Object.keys(users).join(', ')}`)

  const browser = await chromium.launch({ headless: true })
  try {
    await tourScope(browser, null, ROUTES.public)
    await tourScope(browser, 'client', ROUTES.client)
    await tourScope(browser, 'affiliate', ROUTES.affiliate)
    await tourScope(browser, 'advisor', ROUTES.advisor)
    await tourScope(browser, 'admin', ROUTES.admin)
  } finally {
    await browser.close()
  }

  // Aggregate
  const totals = {
    pagesVisited: results.length,
    pagesWithConsoleErrors: results.filter(r => r.consoleErrors.length > 0).length,
    pagesWithPageErrors: results.filter(r => r.pageErrors.length > 0).length,
    pagesWithFailedRequests: results.filter(r => r.failedRequests.length > 0).length,
    pagesFailed: results.filter(r => r.status === 'fail').length,
  }

  writeFileSync(
    resolve(OUT_DIR, 'report.json'),
    JSON.stringify({ base: BASE, totals, results }, null, 2),
    'utf8'
  )

  // Human-readable summary
  const lines: string[] = []
  lines.push('='.repeat(80))
  lines.push(`E2E REPORT — ${BASE} — ${new Date().toISOString()}`)
  lines.push('='.repeat(80))
  lines.push(`Pages visited:           ${totals.pagesVisited}`)
  lines.push(`Pages failed to load:    ${totals.pagesFailed}`)
  lines.push(`Pages w/ console errors: ${totals.pagesWithConsoleErrors}`)
  lines.push(`Pages w/ page errors:    ${totals.pagesWithPageErrors}`)
  lines.push(`Pages w/ failed nets:    ${totals.pagesWithFailedRequests}`)
  lines.push('='.repeat(80))
  lines.push('')
  for (const r of results) {
    if (r.consoleErrors.length === 0 && r.pageErrors.length === 0 && r.failedRequests.length === 0 && r.status === 'ok') continue
    lines.push(`[${r.scope}] ${r.path}  (${r.status}, ${r.loadMs}ms)`)
    for (const ce of r.consoleErrors) lines.push(`  console: ${ce}`)
    for (const pe of r.pageErrors) lines.push(`  page:    ${pe}`)
    for (const fr of r.failedRequests) lines.push(`  net ${fr.status} ${fr.method}: ${fr.url}`)
    lines.push('')
  }
  const summary = lines.join('\n')
  writeFileSync(resolve(OUT_DIR, 'report.txt'), summary, 'utf8')
  console.log('\n' + summary)
  console.log(`\nReports: ${resolve(OUT_DIR, 'report.json')}\n         ${resolve(OUT_DIR, 'report.txt')}`)
  console.log(`Screenshots: ${SCREEN_DIR}`)
}

main().catch(err => {
  console.error('E2E suite crashed:', err)
  process.exit(2)
})
