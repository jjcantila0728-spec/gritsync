#!/usr/bin/env node
/**
 * Download the latest EAS-built GritSync APK and re-host it on Supabase Storage.
 *
 * Why? EAS artifact URLs are stable but live on Expo's CDN. Clients see a
 * non-branded URL and the artifact can be rotated by Expo retention policies.
 * Mirroring to our own Supabase Storage bucket gives us:
 *   - a stable, branded URL (https://<project>.supabase.co/storage/v1/object/public/downloads/gritsync.apk)
 *   - long-term retention under our control
 *   - one canonical link the marketing site references
 *
 * Usage:
 *   # 1. Run an EAS Android build first and copy the .apk URL:
 *   cd mobile && npm run build:preview      # outputs an Android URL
 *
 *   # 2. Hand it to this script:
 *   node scripts/upload-apk-to-supabase.cjs https://expo.dev/artifacts/eas/xxxxxxxx.apk
 *
 * Output: a public URL you can paste into src/pages/Download.tsx → MOBILE_APP_LINKS.apk
 *
 * Requirements:
 *   - .env has NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *   - A public bucket named `downloads` exists in Supabase Storage
 *     (creates it if missing — needs service-role key)
 */
require('dotenv').config()
const fs = require('fs')
const path = require('path')
const os = require('os')
const { createClient } = require('@supabase/supabase-js')

const BUCKET = 'downloads'
const REMOTE_KEY = 'gritsync.apk'

;(async () => {
  const url = process.argv[2]
  if (!url) {
    console.error('Usage: node scripts/upload-apk-to-supabase.cjs <APK_URL_FROM_EAS>')
    process.exit(2)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env')
    process.exit(2)
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 1. Make sure the bucket exists (idempotent).
  const { data: buckets } = await supabase.storage.listBuckets()
  if (!buckets?.find((b) => b.name === BUCKET)) {
    console.log(`[apk] creating bucket "${BUCKET}"…`)
    const { error: bErr } = await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 200 * 1024 * 1024, // 200 MB cap — APKs run ~60-100 MB
      allowedMimeTypes: ['application/vnd.android.package-archive', 'application/octet-stream'],
    })
    if (bErr) {
      console.error('[apk] bucket create failed:', bErr.message)
      process.exit(1)
    }
  }

  // 2. Download the APK from EAS to a temp file.
  const tmpPath = path.join(os.tmpdir(), `gritsync-${Date.now()}.apk`)
  console.log(`[apk] downloading from ${url}`)
  const fileRes = await fetch(url)
  if (!fileRes.ok) {
    console.error(`[apk] download failed: HTTP ${fileRes.status}`)
    process.exit(1)
  }
  const buf = Buffer.from(await fileRes.arrayBuffer())
  fs.writeFileSync(tmpPath, buf)
  console.log(`[apk] saved ${(buf.length / 1024 / 1024).toFixed(1)} MB to ${tmpPath}`)

  // 3. Upload to Supabase Storage, replacing any existing file.
  console.log(`[apk] uploading to ${BUCKET}/${REMOTE_KEY}…`)
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(REMOTE_KEY, buf, {
      contentType: 'application/vnd.android.package-archive',
      upsert: true,
      cacheControl: '3600',
    })
  if (upErr) {
    console.error('[apk] upload failed:', upErr.message)
    process.exit(1)
  }

  // 4. Also stash a versioned copy so old links don't break when we overwrite.
  // Use a date stamp + short hash of the file size as a rough version.
  const stamp = new Date().toISOString().slice(0, 10)
  const versionedKey = `archive/gritsync-${stamp}.apk`
  await supabase.storage
    .from(BUCKET)
    .upload(versionedKey, buf, {
      contentType: 'application/vnd.android.package-archive',
      upsert: true,
      cacheControl: '86400',
    })
    .catch(() => null)

  // 5. Print the public URL.
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(REMOTE_KEY)
  console.log('')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('✔ APK is now hosted on Supabase Storage')
  console.log('')
  console.log('  Stable URL (paste into Download.tsx):')
  console.log('    ' + pub.publicUrl)
  console.log('')
  console.log('  Archived copy:')
  console.log(`    ${pub.publicUrl.replace(REMOTE_KEY, versionedKey)}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  try { fs.unlinkSync(tmpPath) } catch {}
})().catch((err) => {
  console.error('[apk] fatal:', err)
  process.exit(1)
})
