#!/usr/bin/env node
/**
 * Generate the Play Console graphics from the GritSync source logo.
 *
 * Outputs (written to mobile/playstore/):
 *   icon-512.png        — required 512×512 store icon
 *   feature-1024x500.png — required feature graphic (above the fold on listing)
 *
 * Re-run any time the source logo at public/gritsync_logo.png changes.
 */
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const SRC_LOGO = path.join(__dirname, '..', 'public', 'gritsync_logo.png')
const OUT_DIR = path.join(__dirname, '..', 'mobile', 'playstore')

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

;(async () => {
  // ── 512×512 store icon ─────────────────────────────────────────────────
  await sharp(SRC_LOGO)
    .resize(512, 512, { fit: 'contain', background: { r: 220, g: 38, b: 38, alpha: 1 } })
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT_DIR, 'icon-512.png'))
  console.log('✔ icon-512.png')

  // ── 1024×500 feature graphic ───────────────────────────────────────────
  // Brand gradient + logo + tagline. SVG composited over the gradient base.
  const W = 1024, H = 500
  const grad = await sharp({
    create: { width: W, height: H, channels: 4, background: { r: 220, g: 38, b: 38, alpha: 1 } },
  }).png().toBuffer()

  // Generate a logo at 280px to sit on the left side
  const logo = await sharp(SRC_LOGO)
    .resize(280, 280, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()

  const svg = Buffer.from(`
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#B91C1C"/>
      <stop offset="55%" stop-color="#DC2626"/>
      <stop offset="100%" stop-color="#EF4444"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.18)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <circle cx="220" cy="250" r="220" fill="url(#glow)"/>
  <text x="400" y="180" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="rgba(255,255,255,0.85)" letter-spacing="3">NCLEX PROCESSING</text>
  <text x="400" y="270" font-family="Arial, sans-serif" font-size="64" font-weight="800" fill="#FFFFFF">GritSync</text>
  <text x="400" y="330" font-family="Arial, sans-serif" font-size="26" font-weight="500" fill="rgba(255,255,255,0.92)">Your nursing license, simplified.</text>
  <text x="400" y="400" font-family="Arial, sans-serif" font-size="17" font-weight="400" fill="rgba(255,255,255,0.85)">Application tracker · Q-Banks · Advisor chat</text>
</svg>`)

  await sharp(grad)
    .composite([
      { input: logo, top: 110, left: 80 },
      { input: svg, top: 0, left: 0 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT_DIR, 'feature-1024x500.png'))
  console.log('✔ feature-1024x500.png')

  // ── Rasterize the SVG mockups in mobile/playstore/ ─────────────────────
  // The repo already has screenshot-NN-*.svg mockups from an earlier
  // session. Convert them to 1080×1920 PNGs at Play Console-compatible
  // dimensions so they can be uploaded as phone screenshots immediately.
  // Real device captures are still better — replace these post-launch.
  const svgs = fs
    .readdirSync(OUT_DIR)
    .filter((f) => /^screenshot-\d+.*\.svg$/.test(f))
    .sort()
  for (const svgFile of svgs) {
    const pngName = svgFile.replace(/\.svg$/, '.png')
    await sharp(path.join(OUT_DIR, svgFile))
      .resize(1080, 1920, { fit: 'cover', background: { r: 11, g: 11, b: 14, alpha: 1 } })
      .png({ compressionLevel: 9 })
      .toFile(path.join(OUT_DIR, pngName))
    console.log(`✔ ${pngName}`)
  }

  // ── Phone screenshot placeholder (1080×1920) — branded fallback ───────
  const phoneSvg = Buffer.from(`
<svg width="1080" height="1920" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#B91C1C"/>
      <stop offset="100%" stop-color="#EF4444"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1920" fill="url(#g)"/>
  <text x="540" y="900" text-anchor="middle" font-family="Arial, sans-serif" font-size="64" font-weight="800" fill="#FFFFFF">GritSync</text>
  <text x="540" y="980" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" font-weight="500" fill="rgba(255,255,255,0.85)">Your NCLEX journey, simplified.</text>
</svg>`)
  await sharp(phoneSvg).png().toFile(path.join(OUT_DIR, 'phone-placeholder-1080x1920.png'))
  console.log('✔ phone-placeholder-1080x1920.png')

  console.log('')
  console.log('Output files:')
  console.log('  ' + path.join(OUT_DIR, 'icon-512.png'))
  console.log('  ' + path.join(OUT_DIR, 'feature-1024x500.png'))
  console.log('  ' + path.join(OUT_DIR, 'phone-placeholder-1080x1920.png'))
})().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
