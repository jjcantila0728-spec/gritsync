// Post-deploy page sweep: loads every public route on the deployed site,
// captures console errors, page errors, and failed network requests.
// Usage: node scripts/canary-pages.cjs [baseUrl]
const { chromium } = require('playwright')

const BASE = process.argv[2] || 'https://www.gritsync.com'
const PUBLIC_ROUTES = [
  '/', '/about-us', '/faqs', '/quote', '/tracking',
  '/sponsorship', '/sponsorship/apply', '/career', '/career/apply',
  '/donate', '/donate/checkout', '/donate/success',
  '/terms', '/privacy', '/login', '/register',
  '/forgot-password', '/reset-password', '/verify-email',
  '/sign', '/download', '/facebook-data-deletion-status',
]
// Should bounce to login (or render a public shell) without console errors.
const PROTECTED_ROUTES = ['/client/dashboard', '/admin/dashboard', '/advisor', '/affiliate']

// Noise we don't fail on: third-party trackers, favicon, source maps.
const IGNORE = /googletagmanager|google-analytics|facebook|fbcdn|doubleclick|favicon|\.map$|sentry/i

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  const results = []
  let current = null

  page.on('console', (m) => {
    if (m.type() === 'error' && current && !IGNORE.test(m.text())) {
      current.consoleErrors.push(m.text().slice(0, 300))
    }
  })
  page.on('pageerror', (e) => {
    if (current) current.pageErrors.push(String(e).slice(0, 300))
  })
  page.on('response', (r) => {
    if (current && r.status() >= 400 && !IGNORE.test(r.url())) {
      current.failedRequests.push(`${r.status()} ${r.request().method()} ${r.url().slice(0, 160)}`)
    }
  })
  page.on('requestfailed', (r) => {
    if (current && !IGNORE.test(r.url())) {
      current.failedRequests.push(`FAILED ${r.method()} ${r.url().slice(0, 160)} (${r.failure()?.errorText})`)
    }
  })

  for (const route of [...PUBLIC_ROUTES, ...PROTECTED_ROUTES]) {
    current = { route, consoleErrors: [], pageErrors: [], failedRequests: [], status: null, finalUrl: null, h1: null }
    try {
      const resp = await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 45000 })
      current.status = resp ? resp.status() : null
      await page.waitForTimeout(1500) // let lazy chunks + late API calls land
      current.finalUrl = page.url().replace(BASE, '')
      current.h1 = await page.locator('h1, h2').first().textContent({ timeout: 3000 }).catch(() => null)
      current.h1 = current.h1 ? current.h1.trim().slice(0, 60) : null
    } catch (e) {
      current.pageErrors.push('NAV: ' + String(e).slice(0, 200))
    }
    results.push(current)
    const bad = current.consoleErrors.length + current.pageErrors.length + current.failedRequests.length
    console.log(`${bad === 0 ? 'OK  ' : 'WARN'} ${current.status ?? '???'} ${route} -> ${current.finalUrl ?? '?'} ${current.h1 ? JSON.stringify(current.h1) : ''}${bad ? ` [${bad} issue(s)]` : ''}`)
  }

  await browser.close()
  const problems = results.filter((r) => r.consoleErrors.length || r.pageErrors.length || r.failedRequests.length)
  console.log('\n=== DETAIL on pages with issues ===')
  for (const p of problems) {
    console.log(`\n--- ${p.route}`)
    p.pageErrors.forEach((e) => console.log('  pageerror: ' + e))
    p.consoleErrors.forEach((e) => console.log('  console:   ' + e))
    p.failedRequests.forEach((e) => console.log('  request:   ' + e))
  }
  console.log(`\nSummary: ${results.length - problems.length}/${results.length} pages clean`)
  process.exit(problems.length ? 1 : 0)
})().catch((e) => { console.error('FATAL', e); process.exit(2) })
