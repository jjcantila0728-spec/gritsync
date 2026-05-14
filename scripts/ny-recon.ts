// One-shot recon against the NYSED Office of the Professions site.
// Anonymous (no NY.gov login) — captures what's reachable on the landing
// page so we can verify the "Begin Application" selector and see what the
// login wall looks like.
//
// Run: npx tsx scripts/ny-recon.ts
//
// Outputs land in scripts/ny-recon-out/:
//   01-before.png + 01-before.html  (landing page)
//   02-after-click.png + 02-after-click.html  (whatever loads after the click)
//   elements.json  (every visible <a>, <button>, <input>, <select> with selectors)

import { chromium } from 'playwright'
import { promises as fs } from 'fs'
import path from 'path'

const START_URL = 'https://eservices.nysed.gov/professions/before/022'
const OUT = path.resolve(process.cwd(), 'scripts/ny-recon-out')

interface Element {
  tag: string
  type?: string
  name?: string
  id?: string
  text?: string
  placeholder?: string
  value?: string
  href?: string
  ariaLabel?: string
  selector: string  // a best-effort selector for the agent to use
}

async function dump(page: import('playwright').Page, label: string): Promise<Element[]> {
  await fs.writeFile(path.join(OUT, `${label}.html`), await page.content(), 'utf8')
  await page.screenshot({ path: path.join(OUT, `${label}.png`), fullPage: true })

  // Function source as string — bypasses tsx's keepNames instrumentation
  // that breaks when the callback is a TS arrow inside an outer .ts file.
  const elements: Element[] = await page.evaluate(`(function () {
    var out = [];
    var all = document.querySelectorAll('a, button, input, select, textarea, [role="button"]');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      var tag = el.tagName.toLowerCase();
      var r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      var e = { tag: tag };
      if (tag === 'input' || tag === 'textarea' || tag === 'select') {
        e.type = el.type;
        e.name = el.name || undefined;
        e.id = el.id || undefined;
        e.placeholder = el.placeholder || el.getAttribute('placeholder') || undefined;
        e.value = el.value || undefined;
      } else {
        e.text = (el.innerText || '').trim().slice(0, 120) || undefined;
        e.href = el.href || undefined;
        e.id = el.id || undefined;
      }
      e.ariaLabel = el.getAttribute('aria-label') || undefined;
      if (el.id) e.selector = '#' + (window.CSS && CSS.escape ? CSS.escape(el.id) : el.id);
      else if (el.name) e.selector = tag + '[name="' + el.name + '"]';
      else if (e.text) e.selector = tag + ':has-text(' + JSON.stringify(e.text.slice(0, 40)) + ')';
      else e.selector = tag;
      out.push(e);
    }
    return out;
  })()`)

  return elements
}

async function main() {
  await fs.mkdir(OUT, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  })
  const page = await ctx.newPage()

  console.log(`Loading ${START_URL} ...`)
  await page.goto(START_URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => { /* */ })

  const elementsBefore = await dump(page, '01-before')
  console.log(`Landing page: ${elementsBefore.length} interactive elements.`)
  console.log(`  Title: ${await page.title()}`)
  console.log(`  URL: ${page.url()}`)

  // Find "Begin Application" candidates.
  const beginCandidates = elementsBefore.filter((e) =>
    (e.text || '').toLowerCase().includes('begin') ||
    (e.ariaLabel || '').toLowerCase().includes('begin') ||
    (e.href || '').toLowerCase().includes('begin')
  )
  console.log(`Begin-Application candidates: ${beginCandidates.length}`)
  beginCandidates.forEach((c) => console.log(`  ${c.tag} text="${c.text}" href=${c.href} selector=${c.selector}`))

  // The landing page presents a License-or-Renew radio. Pick LICENSE and
  // wait for whatever reveals — likely a Begin/Continue button.
  let afterRadioElements: Element[] = []
  let afterClickElements: Element[] = []
  const licenseRadio = page.locator('#option-input-LICENSE')
  if (await licenseRadio.count() > 0) {
    console.log('Selecting LICENSE radio...')
    await licenseRadio.check({ force: true })
    await page.waitForTimeout(1500)
    afterRadioElements = await dump(page, '02-after-radio')
    console.log(`After radio: ${afterRadioElements.length} interactive elements.`)

    const newCandidates = afterRadioElements.filter((e) =>
      ['begin'].some((kw) =>
        (e.text || '').toLowerCase().includes(kw) ||
        (e.ariaLabel || '').toLowerCase().includes(kw) ||
        (e.value || '').toLowerCase().includes(kw)
      )
    )
    console.log(`Begin/Continue candidates after radio: ${newCandidates.length}`)
    newCandidates.forEach((c) => console.log(`  ${c.tag} text="${c.text}" href=${c.href} selector=${c.selector}`))

    // Always try the canonical Begin Application input selector — more
    // reliable than the text-based first candidate.
    const beginSel = 'input[type="submit"][value="Begin Application"]'
    if (await page.locator(beginSel).count() > 0) {
      console.log(`Clicking: ${beginSel}`)
      try {
        const before = page.url()
        await page.locator(beginSel).first().click({ timeout: 5000 })
        await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => { /* */ })
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => { /* */ })
        const after = page.url()
        console.log(`URL: ${before}  →  ${after}`)
        afterClickElements = await dump(page, '03-after-click')
        console.log(`Post-click page: ${afterClickElements.length} interactive elements.`)
        console.log(`  Title: ${await page.title()}`)
      } catch (err: any) {
        console.log(`Click failed: ${err?.message || err}`)
      }
    }
  }

  await fs.writeFile(path.join(OUT, 'elements.json'), JSON.stringify({
    landing: { url: START_URL, elements: elementsBefore },
    afterRadio: { elements: afterRadioElements },
    afterClick: { url: page.url(), elements: afterClickElements },
  }, null, 2))

  await browser.close()
  console.log(`Done. Output in ${OUT}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
