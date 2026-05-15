/**
 * Comprehensive human-style test harness for POST /api/emails/send-quote.
 *
 * Strategy: mount the route on a throwaway Express app, stub global fetch so
 * the handler "sends" without hitting Resend, capture the HTML payload, then
 * run assertions on structure + totals math. Saves the rendered HTML for each
 * scenario to scripts/test-output/ for human visual inspection.
 *
 * Run: npx tsx scripts/test-quote-email.ts
 */

// Env must be set BEFORE the router module is loaded (static imports run
// before top-of-file statements in ESM). We use a dynamic import below.
process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || 'test_key_for_harness'
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://harness.invalid'
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'harness_service_role'
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'harness_anon'

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(__dirname, 'test-output')
mkdirSync(OUT_DIR, { recursive: true })

type CapturedSend = { to: string; subject: string; html: string; from: string }
let captured: CapturedSend | null = null

const realFetch = globalThis.fetch
globalThis.fetch = (async (url: any, init: any) => {
  if (String(url).includes('api.resend.com/emails')) {
    const body = JSON.parse(init.body as string)
    captured = { to: body.to, subject: body.subject, html: body.html, from: body.from }
    return new Response(JSON.stringify({ id: 'fake-id-12345' }), { status: 200 })
  }
  return realFetch(url, init)
}) as any

type Scenario = {
  name: string
  body: any
  expect: {
    httpStatus?: number
    hasStep1Header?: boolean
    hasStep2Header?: boolean
    hasInitiateCallout?: boolean
    hasNoLineItems?: boolean
    step1Total?: number
    step2Total?: number
    grandTotal?: number
    legacyTotal?: number
    validUntilShown?: boolean
  }
}

const baseClient = {
  quoteNumber: 'GQ-TEST-0001',
  quoteId: 'test-uuid-0001',
  clientName: 'Maria Dela Cruz',
  email: 'test@example.com',
  mobileNumber: '+639171234567',
  service: 'NCLEX Application Processing',
  state: 'California',
  validUntil: new Date('2026-06-15').toISOString(),
  quoteUrl: 'https://gritsync.com/quote/GQ-TEST-0001',
}

const step1ItemsSample = [
  { description: 'Processing Fee (Step 1)', quantity: 1, unitPrice: 15000, total: 15000, taxable: true, payLater: false },
  { description: 'CGFNS Credential Evaluation', quantity: 1, unitPrice: 35000, total: 35000, taxable: false, payLater: false },
]
const step2ItemsSample = [
  { description: 'NCLEX Examination Fee', quantity: 1, unitPrice: 12000, total: 12000, taxable: false, payLater: true },
  { description: 'State Board Application (Step 2)', quantity: 1, unitPrice: 8500, total: 8500, taxable: true, payLater: true },
]

const TAX = 0.12
const itemWithTax = (i: any) => i.total + (i.taxable ? i.total * TAX : 0)
const sumWithTax = (items: any[]) => items.reduce((s, i) => s + itemWithTax(i), 0)

const expectedStep1 = sumWithTax(step1ItemsSample)
const expectedStep2 = sumWithTax(step2ItemsSample)
const expectedGrand = expectedStep1 + expectedStep2

const scenarios: Scenario[] = [
  {
    name: '01_first_time_taker_full_payment',
    body: {
      ...baseClient,
      paymentType: 'full',
      lineItems: [...step1ItemsSample, ...step2ItemsSample.map(i => ({ ...i, payLater: false }))],
      subtotal: 70500,
      tax: (15000 + 8500) * TAX,
      total: 70500 + (15000 + 8500) * TAX,
    },
    expect: {
      httpStatus: 200,
      hasStep1Header: false,
      hasStep2Header: false,
      hasInitiateCallout: false,
      legacyTotal: 70500 + (15000 + 8500) * TAX,
      validUntilShown: true,
    },
  },
  {
    name: '02_first_time_taker_staggered',
    body: {
      ...baseClient,
      paymentType: 'staggered',
      lineItems: [...step1ItemsSample, ...step2ItemsSample],
      subtotal: 50000,
      tax: 15000 * TAX,
      total: 50000 + 15000 * TAX,
    },
    expect: {
      httpStatus: 200,
      hasStep1Header: true,
      hasStep2Header: true,
      hasInitiateCallout: true,
      step1Total: expectedStep1,
      step2Total: expectedStep2,
      grandTotal: expectedGrand,
      validUntilShown: true,
    },
  },
  {
    name: '03_retaker_full_payment',
    body: {
      ...baseClient,
      paymentType: 'full',
      lineItems: step2ItemsSample.map(i => ({ ...i, payLater: false })),
      subtotal: 20500,
      tax: 8500 * TAX,
      total: 20500 + 8500 * TAX,
    },
    expect: {
      httpStatus: 200,
      hasStep1Header: false,
      hasStep2Header: false,
      hasInitiateCallout: false,
      legacyTotal: 20500 + 8500 * TAX,
    },
  },
  {
    name: '04_staggered_only_step1_items',
    body: {
      ...baseClient,
      paymentType: 'staggered',
      lineItems: step1ItemsSample,
      subtotal: 50000,
      tax: 15000 * TAX,
      total: 50000 + 15000 * TAX,
    },
    expect: {
      httpStatus: 200,
      hasStep1Header: true,
      hasStep2Header: false,
      hasInitiateCallout: true,
      step1Total: expectedStep1,
      step2Total: 0,
      grandTotal: expectedStep1,
    },
  },
  {
    name: '05_staggered_only_step2_items',
    body: {
      ...baseClient,
      paymentType: 'staggered',
      lineItems: step2ItemsSample,
      subtotal: 0,
      tax: 0,
      total: 0,
    },
    expect: {
      httpStatus: 200,
      hasStep1Header: false,
      hasStep2Header: true,
      hasInitiateCallout: false,
      step1Total: 0,
      step2Total: expectedStep2,
      grandTotal: expectedStep2,
    },
  },
  {
    name: '06_empty_line_items',
    body: { ...baseClient, paymentType: 'full', lineItems: [], subtotal: 0, tax: 0, total: 0 },
    expect: { httpStatus: 200, hasNoLineItems: true, hasInitiateCallout: false, legacyTotal: 0 },
  },
  {
    name: '07_decimal_precision_edge',
    body: {
      ...baseClient,
      paymentType: 'staggered',
      lineItems: [
        { description: 'Odd amount A', quantity: 1, unitPrice: 1234.56, total: 1234.56, taxable: true, payLater: false },
        { description: 'Odd amount B', quantity: 1, unitPrice: 999.99, total: 999.99, taxable: false, payLater: true },
      ],
    },
    expect: {
      httpStatus: 200,
      hasStep1Header: true,
      hasStep2Header: true,
      step1Total: 1234.56 * 1.12,
      step2Total: 999.99,
      grandTotal: 1234.56 * 1.12 + 999.99,
    },
  },
  {
    name: '08_missing_payLater_field',
    body: {
      ...baseClient,
      paymentType: 'staggered',
      lineItems: [
        { description: 'Item without payLater', quantity: 1, unitPrice: 5000, total: 5000, taxable: false },
        { description: 'Another', quantity: 1, unitPrice: 3000, total: 3000, taxable: false },
      ],
    },
    expect: {
      httpStatus: 200,
      hasStep1Header: true,
      hasStep2Header: false,
      step1Total: 8000,
      step2Total: 0,
      grandTotal: 8000,
    },
  },
  {
    name: '09_special_chars_in_description',
    body: {
      ...baseClient,
      clientName: '<img src=x onerror=alert(1)>',
      lineItems: [
        { description: '<script>alert("xss")</script> & "quoted"', quantity: 1, unitPrice: 1000, total: 1000, taxable: false, payLater: false },
      ],
      paymentType: 'full',
      quoteUrl: 'https://gritsync.com/quote/x"><script>alert(2)</script>',
    },
    expect: { httpStatus: 200, legacyTotal: 1000 },
  },
  {
    name: '10_null_paymentType',
    body: {
      ...baseClient,
      paymentType: null,
      lineItems: step1ItemsSample,
      subtotal: 50000,
      tax: 15000 * TAX,
      total: 50000 + 15000 * TAX,
    },
    expect: {
      httpStatus: 200,
      hasStep1Header: false,
      hasStep2Header: false,
      hasInitiateCallout: false,
      legacyTotal: 50000 + 15000 * TAX,
    },
  },
  {
    name: '11_null_validUntil',
    body: { ...baseClient, validUntil: null, paymentType: 'full', lineItems: step1ItemsSample },
    expect: { httpStatus: 200, validUntilShown: false },
  },
  {
    name: '12_missing_email_400',
    body: { ...baseClient, email: undefined, paymentType: 'full', lineItems: [] },
    expect: { httpStatus: 400 },
  },
]

async function run() {
  const { default: express } = await import('express')
  const emailsModule = await import('../server/routes/emails')
  const emailsRouter = (emailsModule as any).default

  const app = express()
  app.use(express.json())
  app.use('/api/emails', emailsRouter)
  const server = app.listen(0)
  const port = (server.address() as any).port
  const BASE = `http://127.0.0.1:${port}/api/emails/send-quote`

  type AssertResult = { name: string; ok: boolean; details: string[] }
  const results: AssertResult[] = []

  const peso = /₱[\d,]+\.\d{2}/g
  const extractPesos = (html: string): number[] => {
    const matches = html.match(peso) || []
    return matches.map(m => Number(m.replace(/[₱,]/g, '')))
  }
  const within = (a: number, b: number, eps = 0.01) => Math.abs(a - b) < eps

  for (const sc of scenarios) {
    captured = null
    const fail: string[] = []
    let httpStatus = 0
    let body: any = null
    try {
      const r = await fetch(BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sc.body),
      })
      httpStatus = r.status
      body = await r.json().catch(() => null)
    } catch (e: any) {
      fail.push(`network error: ${e.message}`)
    }

    if (sc.expect.httpStatus && httpStatus !== sc.expect.httpStatus) {
      fail.push(`status: expected ${sc.expect.httpStatus}, got ${httpStatus} (body: ${JSON.stringify(body)})`)
    }

    if (sc.expect.httpStatus === 200 || !sc.expect.httpStatus) {
      if (!captured) {
        fail.push('no email payload was captured (handler did not call fetch)')
      } else {
        const html = captured.html
        writeFileSync(resolve(OUT_DIR, `${sc.name}.html`), html, 'utf8')

        if (sc.expect.hasStep1Header !== undefined) {
          const present = /Step 1 — Pay Now to Initiate/.test(html)
          if (present !== sc.expect.hasStep1Header) fail.push(`Step 1 header: expected ${sc.expect.hasStep1Header}, got ${present}`)
        }
        if (sc.expect.hasStep2Header !== undefined) {
          const present = /Step 2 — Pay Later/.test(html)
          if (present !== sc.expect.hasStep2Header) fail.push(`Step 2 header: expected ${sc.expect.hasStep2Header}, got ${present}`)
        }
        if (sc.expect.hasInitiateCallout !== undefined) {
          const present = /To initiate the process, you only need to pay the Step 1 fee/.test(html)
          if (present !== sc.expect.hasInitiateCallout) fail.push(`initiate callout: expected ${sc.expect.hasInitiateCallout}, got ${present}`)
        }
        if (sc.expect.hasNoLineItems) {
          if (!/No line items/.test(html)) fail.push('expected "No line items" placeholder, missing')
        }
        if (sc.expect.validUntilShown !== undefined) {
          const present = /Valid until/.test(html)
          if (present !== sc.expect.validUntilShown) fail.push(`Valid until: expected ${sc.expect.validUntilShown}, got ${present}`)
        }

        const allPesos = extractPesos(html)
        const checkPresent = (label: string, expected: number) => {
          if (!allPesos.some(p => within(p, expected))) {
            fail.push(`${label} ${expected.toFixed(2)} not found in rendered pesos: [${allPesos.slice(0, 10).join(', ')}]`)
          }
        }
        if (sc.expect.step1Total !== undefined) checkPresent('step1Total', sc.expect.step1Total)
        if (sc.expect.step2Total !== undefined && sc.expect.step2Total > 0) checkPresent('step2Total', sc.expect.step2Total)
        if (sc.expect.grandTotal !== undefined) checkPresent('grandTotal', sc.expect.grandTotal)
        if (sc.expect.legacyTotal !== undefined) checkPresent('legacyTotal', sc.expect.legacyTotal)

        if (sc.name === '09_special_chars_in_description') {
          if (/<script>alert\("xss"\)<\/script>/.test(html)) {
            fail.push('SECURITY: <script> in item.description rendered verbatim')
          }
          if (/<img src=x onerror=alert\(1\)>/.test(html)) {
            fail.push('SECURITY: <img onerror> in clientName rendered verbatim')
          }
          if (/x"><script>alert\(2\)<\/script>/.test(html)) {
            fail.push('SECURITY: quote-breakout in quoteUrl href rendered verbatim')
          }
          // Positive check: escaped form should be present
          if (!/&lt;script&gt;alert\(&quot;xss&quot;\)&lt;\/script&gt;/.test(html)) {
            fail.push('expected escaped <script> entity not found')
          }
        }
      }
    }

    results.push({ name: sc.name, ok: fail.length === 0, details: fail })
  }

  server.close()

  console.log('\n' + '='.repeat(72))
  console.log(' COMPREHENSIVE TEST RESULTS — POST /api/emails/send-quote')
  console.log('='.repeat(72))
  let passCount = 0
  for (const r of results) {
    const icon = r.ok ? '[PASS]' : '[FAIL]'
    console.log(`${icon} ${r.name}`)
    for (const d of r.details) console.log(`         - ${d}`)
    if (r.ok) passCount++
  }
  console.log('='.repeat(72))
  console.log(` ${passCount}/${results.length} passed`)
  console.log(` Rendered HTML saved to: ${OUT_DIR}`)
  console.log('='.repeat(72))

  process.exit(passCount === results.length ? 0 : 1)
}

run().catch(err => {
  console.error('Harness crashed:', err)
  process.exit(2)
})
