#!/usr/bin/env node
/**
 * Recovery: raise the downloads bucket file-size limit, then re-host the APK.
 *
 * The default Supabase bucket caps at the project's global file-size limit
 * (50 MB on free tier). Modern Expo APKs are 80-120 MB so the original
 * upload bounced. supabase-js `updateBucket` lets the service role lift
 * the per-bucket cap independent of the project default.
 *
 * If the update succeeds and the upload still fails (because the project-
 * wide hard cap is binding), the script bails with a clear FALLBACK
 * message so the agent can switch to GitHub Releases hosting.
 */
require('dotenv').config()
const fs = require('fs')
const os = require('os')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const APK_URL = process.argv[2] || 'https://expo.dev/artifacts/eas/6gTq2s1SPcXLJxidaAmBsL.apk'
const BUCKET = 'downloads'
const REMOTE_KEY = 'gritsync.apk'
const TARGET_LIMIT_BYTES = 500 * 1024 * 1024 // 500 MB

function emit(line) {
  process.stdout.write(`[recover] ${line}\n`)
}

;(async () => {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  )

  // 1. Lift bucket file_size_limit.
  emit(`raising ${BUCKET} fileSizeLimit to ${TARGET_LIMIT_BYTES}`)
  const { error: updErr } = await supabase.storage.updateBucket(BUCKET, {
    public: true,
    fileSizeLimit: TARGET_LIMIT_BYTES,
  })
  if (updErr) {
    emit(`UPDATE_FAILED ${updErr.message}`)
    process.exit(2)
  }
  emit('bucket limit lifted')

  // 2. Download APK fresh.
  emit(`downloading ${APK_URL}`)
  const res = await fetch(APK_URL)
  if (!res.ok) {
    emit(`DOWNLOAD_FAILED HTTP ${res.status}`)
    process.exit(2)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  const mb = (buf.length / 1024 / 1024).toFixed(1)
  emit(`downloaded ${mb} MB`)

  // 3. Retry upload.
  emit('uploading…')
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(REMOTE_KEY, buf, {
      contentType: 'application/vnd.android.package-archive',
      upsert: true,
      cacheControl: '3600',
    })
  if (upErr) {
    emit(`UPLOAD_FAILED ${upErr.message}`)
    emit('FALLBACK switch to GitHub Releases or another host')
    process.exit(3)
  }

  // 4. Archived copy.
  const stamp = new Date().toISOString().slice(0, 10)
  await supabase.storage
    .from(BUCKET)
    .upload(`archive/gritsync-${stamp}.apk`, buf, {
      contentType: 'application/vnd.android.package-archive',
      upsert: true,
      cacheControl: '86400',
    })
    .catch(() => null)

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(REMOTE_KEY)
  emit(`SUPABASE_URL ${pub.publicUrl}`)
  emit(`SIZE ${mb}MB`)
  emit('DONE')
})().catch((err) => {
  emit(`FATAL ${String(err.message).split('\n')[0]}`)
  process.exit(1)
})
