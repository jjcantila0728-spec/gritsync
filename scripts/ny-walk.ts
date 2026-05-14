// Walk the NYSED RN application past Personal Information using dummy data,
// dumping each successive page so we can map the real selectors for the
// agent. Anonymous — no NY.gov login required.
//
// Run: npx tsx scripts/ny-walk.ts
//
// Writes scripts/ny-walk-out/NN-<step>.{png,html} and elements.json with the
// full list of visible interactive elements on each page.

import { chromium, type Page } from 'playwright'
import { promises as fs } from 'fs'
import path from 'path'

const START_URL = 'https://eservices.nysed.gov/professions/before/022'
const OUT = path.resolve(process.cwd(), 'scripts/ny-walk-out')

const DUMP_JS = `(function () {
  var out = [];
  var all = document.querySelectorAll('a, button, input, select, textarea, [role="button"], [role="radio"], [role="checkbox"], fieldset > legend, h1, h2, h3, h4, label');
  for (var i = 0; i < all.length; i++) {
    var el = all[i];
    var tag = el.tagName.toLowerCase();
    var r = el.getBoundingClientRect();
    var visible = r.width > 0 && r.height > 0;
    var e = { tag: tag, visible: visible };
    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      e.type = el.type;
      e.name = el.name || undefined;
      e.id = el.id || undefined;
      e.placeholder = el.placeholder || el.getAttribute('placeholder') || undefined;
      e.value = el.value || undefined;
      // Capture label text via for= or wrapping label
      var labelText = '';
      if (el.id) {
        var lbl = document.querySelector('label[for="' + el.id.replace(/"/g, '\\"') + '"]');
        if (lbl) labelText = (lbl.innerText || '').trim();
      }
      if (!labelText) {
        var parent = el.closest('label');
        if (parent) labelText = (parent.innerText || '').trim();
      }
      if (labelText) e.label = labelText.slice(0, 120);
    } else {
      e.text = (el.innerText || '').trim().slice(0, 180) || undefined;
      e.href = el.href || undefined;
      e.id = el.id || undefined;
    }
    e.ariaLabel = el.getAttribute('aria-label') || undefined;
    if (el.id) e.selector = '#' + (window.CSS && CSS.escape ? CSS.escape(el.id) : el.id);
    else if (el.name) e.selector = tag + '[name="' + el.name + '"]';
    out.push(e);
  }
  return out;
})()`

async function dump(page: Page, label: string): Promise<any[]> {
  // Race-tolerant: if a navigation is in flight, wait for it then retry once.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => { /* */ })
      await fs.writeFile(path.join(OUT, `${label}.html`), await page.content(), 'utf8')
      await page.screenshot({ path: path.join(OUT, `${label}.png`), fullPage: true }).catch(() => { /* */ })
      const els = await page.evaluate(DUMP_JS) as any[]
      return els
    } catch (err: any) {
      if (/Execution context was destroyed|navigating/.test(err?.message || '')) {
        await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => { /* */ })
        continue
      }
      throw err
    }
  }
  return []
}

async function safeFill(page: Page, sel: string, value: string): Promise<boolean> {
  const loc = page.locator(sel).first()
  if (await loc.count() === 0) return false
  try { await loc.fill(value); return true } catch { return false }
}

async function safeCheck(page: Page, sel: string): Promise<boolean> {
  const loc = page.locator(sel).first()
  if (await loc.count() === 0) return false
  try { await loc.check({ force: true }); return true } catch { return false }
}

async function safeSelect(page: Page, sel: string, value: string): Promise<boolean> {
  const loc = page.locator(sel).first()
  if (await loc.count() === 0) return false
  try { await loc.selectOption(value); return true } catch {
    try { await loc.selectOption({ label: value }); return true } catch { return false }
  }
}

async function clickAndWait(page: Page, sel: string): Promise<void> {
  await page.locator(sel).first().click()
  await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => { /* */ })
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => { /* */ })
}

async function main() {
  await fs.mkdir(OUT, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  })
  const page = await ctx.newPage()
  const trail: Array<{ step: string; url: string; title: string; elements: any[] }> = []

  async function record(step: string): Promise<void> {
    const els = await dump(page, step)
    trail.push({ step, url: page.url(), title: await page.title(), elements: els })
    console.log(`[${step}] ${page.url()}  — ${await page.title()}  (${els.filter(e => e.visible).length} visible)`)
    // Write trail incrementally so a crash mid-walk still leaves data behind.
    await fs.writeFile(path.join(OUT, 'trail.json'), JSON.stringify(trail, null, 2))
  }

  console.log(`Loading ${START_URL}`)
  await page.goto(START_URL, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => { /* */ })
  await record('01-landing')

  await safeCheck(page, '#option-input-LICENSE')
  await page.waitForTimeout(800)
  await record('02-after-license-radio')

  await clickAndWait(page, 'input[type="submit"][value="Begin Application"]')
  await record('03-personal-information')

  // Fill the Personal Info / prerequisites combined page.
  await safeCheck(page, '#has-license-no')           // Do you hold a NY license? No
  await safeCheck(page, '#hideSsn')                  // Do you have an SSN? No
  await safeFill(page,  '#dob-input', '01/15/1990')  // DOB
  // NYS DMV ID intentionally left blank
  await safeSelect(page, '#country-input', 'PH')     // Philippines

  // Wait for any conditional fields (non-US state, etc.) to render.
  await page.waitForTimeout(1200)
  await record('04-after-country-philippines')

  await safeFill(page, '#firstName',  'Krizza')
  await safeFill(page, '#middleName', 'Mae')
  await safeFill(page, '#lastName',   'Cantila')
  await safeFill(page, '#address-input',      '123 Sample St')
  await safeFill(page, '#city-input',         'Manila')
  // Non-US State: select "Outside USA/Canada" by label (its value="" so we
  // can't pick by value).
  await page.locator('#foreign-state-input').selectOption({ label: 'Outside USA/Canada' }).catch(() => { /* */ })
  await safeFill(page, '#foreignPostalCode-input', '1000')
  await safeFill(page, '#person-note',        '123 Sample St, Manila, Metro Manila 1000, Philippines')
  await safeCheck(page, '[id="addresses0.locationType.id2"]')  // Personal
  await safeFill(page, '#phone-input', '9171234567')
  await safeCheck(page, '[id="phones0.locationType.id2"]')     // Personal
  await safeFill(page, '#email-input',        'recon@example.com')
  await safeCheck(page, '[id="emails0.locationType.id2"]')     // Personal
  await safeFill(page, '#emailVerification',  'recon@example.com')

  await record('05-personal-info-filled')

  // Click via JS to bypass Playwright's enabled-state check — the button
  // disables itself the instant submit fires, racing with the actionability
  // wait. Then wait for the navigation that the click triggered.
  await Promise.all([
    page.waitForURL(/\/professions\//, { timeout: 30000 }).catch(() => { /* */ }),
    page.evaluate(`document.getElementById('personalInformationFormButton')?.click()`),
  ])
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => { /* */ })
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => { /* */ })
  await record('06-after-personal-submit')

  // Loop: answer every visible yes/no radio group as "No", fill any text
  // inputs/textareas with a generic value, then submit and capture the next
  // page. Continues until no progress is being made.
  for (let i = 0; i < 8; i++) {
    const beforeUrl = page.url()
    const beforeTitle = await page.title().catch(() => '')

    // 1. Answer every visible radio group: pick the radio whose label is "No",
    //    falling back to the second option.
    const answered = await page.evaluate(`(function () {
      var radios = Array.from(document.querySelectorAll('input[type="radio"]'));
      var groups = {};
      for (var i = 0; i < radios.length; i++) {
        var r = radios[i];
        var rect = r.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) continue;
        if (!r.name) continue;
        if (!groups[r.name]) groups[r.name] = [];
        groups[r.name].push(r);
      }
      var count = 0;
      Object.keys(groups).forEach(function (n) {
        var opts = groups[n];
        if (opts.some(function (o) { return o.checked; })) return;
        var pick = opts.find(function (o) {
          var lbl = (o.labels && o.labels[0] && o.labels[0].innerText) ||
                    (o.parentElement && o.parentElement.innerText) || '';
          return /^\\s*no\\s*$/i.test(lbl.trim());
        }) || opts[opts.length - 1];
        if (pick) {
          pick.click();
          count++;
        }
      });
      return count;
    })()`)
    console.log(`  → answered ${answered} yes/no group(s) as "No"`)

    // 2. Fill any visible empty text inputs with dummy values so a possible
    //    education page (school name/city/etc.) doesn't block the submit.
    await page.evaluate(`(function () {
      var inputs = Array.from(document.querySelectorAll('input[type="text"], input[type="tel"], input[type="email"], textarea'));
      for (var i = 0; i < inputs.length; i++) {
        var el = inputs[i];
        var r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) continue;
        if (el.value) continue;
        var ph = (el.placeholder || el.name || '').toLowerCase();
        var v = 'Sample';
        if (/year/.test(ph)) v = '4';
        else if (/mm.?\\/?yyyy/i.test(el.placeholder || '')) v = '06/2010';
        else if (/email/.test(ph)) v = 'recon@example.com';
        else if (/phone/.test(ph)) v = '9171234567';
        else if (/city/.test(ph)) v = 'Manila';
        else if (/state|province/.test(ph)) v = 'Metro Manila';
        else if (/postal|zip/.test(ph)) v = '1000';
        else if (/address/.test(ph)) v = '123 Sample St';
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    })()`)

    // 3. Find any kind of forward-progress button (Continue, Next, Submit, Save).
    const submitSel = await page.evaluate(`(function () {
      var btns = Array.from(document.querySelectorAll('input[type="submit"], button[type="submit"], button'));
      for (var i = 0; i < btns.length; i++) {
        var b = btns[i];
        var r = b.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) continue;
        var v = (b.value || b.innerText || '').trim().toLowerCase();
        if (v.indexOf('continue') !== -1 || v.indexOf('next') !== -1 || v.indexOf('save') !== -1 || v.indexOf('submit') !== -1) {
          if (b.id) return '#' + (window.CSS && CSS.escape ? CSS.escape(b.id) : b.id);
          if (b.name) return b.tagName.toLowerCase() + '[name="' + b.name + '"]';
          // Last resort: tag a unique attribute so we can find it again.
          b.setAttribute('data-walk-submit', '1');
          return '[data-walk-submit="1"]';
        }
      }
      return null;
    })()`) as string | null

    if (!submitSel) {
      console.log(`  No forward button on page ${i + 7}; stopping.`)
      await record(String(i + 7).padStart(2, '0') + '-no-button')
      break
    }

    try {
      await Promise.all([
        page.waitForURL((u) => u.toString() !== beforeUrl, { timeout: 8000 }).catch(() => { /* */ }),
        page.evaluate(`(function () { var el = document.querySelector(${JSON.stringify(submitSel)}); if (el) el.click(); })()`),
      ])
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => { /* */ })
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => { /* */ })
    } catch (err: any) {
      console.log(`  Click ${submitSel} failed: ${err?.message || err}`)
      break
    }

    await record(String(i + 7).padStart(2, '0') + '-after-submit')

    const afterUrl = page.url()
    const afterTitle = await page.title().catch(() => '')
    if (afterUrl === beforeUrl && afterTitle === beforeTitle) {
      console.log(`  No progress after ${submitSel} (validation blocked); stopping.`)
      break
    }
  }

  await fs.writeFile(path.join(OUT, 'trail.json'), JSON.stringify(trail, null, 2))
  await browser.close()
  console.log(`Done. Output in ${OUT}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
