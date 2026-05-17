#!/usr/bin/env node
/**
 * Autonomous EAS build monitor for the GritSync mobile APK.
 *
 * - Polls the EAS API for the given build id every 90s.
 * - Emits one line per state change so the Claude Code Monitor tool can
 *   surface them as notifications.
 * - On FINISHED, downloads the APK and re-hosts it on Supabase Storage
 *   at downloads/gritsync.apk (the URL the website's /download page
 *   already references). Emits one terminal line on success.
 * - On ERRORED, emits the error message and the build URL so the
 *   waker-up agent can fetch logs + decide whether to retry.
 *
 * Designed to run in the foreground via the Monitor tool — its only
 * stdout output is the structured event lines, everything else goes
 * to stderr.
 *
 * Required env:
 *   EXPO_TOKEN
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional env:
 *   GRITSYNC_BUILD_ID                  override build id from CLI arg
 *   GRITSYNC_BUILD_POLL_INTERVAL_MS    default 90000
 */
require('dotenv').config()
const fs = require('fs')
const os = require('os')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')
const { spawn } = require('child_process')

const BUILD_ID = process.argv[2] || process.env.GRITSYNC_BUILD_ID
const POLL_MS = parseInt(process.env.GRITSYNC_BUILD_POLL_INTERVAL_MS || '90000', 10)

if (!BUILD_ID) {
  emit('ERROR no-build-id')
  process.exit(2)
}
if (!process.env.EXPO_TOKEN) {
  emit('ERROR no-expo-token')
  process.exit(2)
}

const BUCKET = 'downloads'
const REMOTE_KEY = 'gritsync.apk'

function emit(line) {
  // Single-line, deliberately terse — these become individual chat events.
  process.stdout.write(`[eas] ${line}\n`)
}

function log(...args) {
  process.stderr.write('[eas-internal] ' + args.join(' ') + '\n')
}

function runEas(args) {
  return new Promise((resolve, reject) => {
    const bin = path.join(__dirname, '..', 'mobile', 'node_modules', '.bin', process.platform === 'win32' ? 'eas.cmd' : 'eas')
    const child = spawn(bin, args, {
      env: { ...process.env },
      cwd: path.join(__dirname, '..', 'mobile'),
      shell: process.platform === 'win32',
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (c) => (stdout += c.toString()))
    child.stderr.on('data', (c) => (stderr += c.toString()))
    child.on('exit', (code) => {
      if (code === 0) resolve(stdout)
      else reject(new Error(`eas ${args.join(' ')} exit ${code}: ${stderr || stdout}`))
    })
  })
}

async function checkBuild() {
  const out = await runEas(['build:view', BUILD_ID, '--json'])
  // CLI prints some preamble; the JSON object is whatever survives parse.
  const m = out.match(/\{[\s\S]*\}/)
  if (!m) throw new Error('Could not find JSON in eas output')
  return JSON.parse(m[0])
}

async function downloadToTmp(url) {
  const file = path.join(os.tmpdir(), `gritsync-${Date.now()}.apk`)
  log(`downloading ${url}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  fs.writeFileSync(file, buf)
  log(`saved ${(buf.length / 1024 / 1024).toFixed(1)} MB`)
  return { file, buf }
}

async function uploadToSupabase(buf) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  )
  // Make sure bucket exists.
  const { data: buckets } = await supabase.storage.listBuckets()
  if (!buckets?.find((b) => b.name === BUCKET)) {
    await supabase.storage.createBucket(BUCKET, { public: true })
  }
  log('uploading to supabase')
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(REMOTE_KEY, buf, {
      contentType: 'application/vnd.android.package-archive',
      upsert: true,
      cacheControl: '3600',
    })
  if (error) throw new Error('Supabase upload: ' + error.message)
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
  return pub.publicUrl
}

;(async () => {
  emit(`STARTED build=${BUILD_ID} poll=${POLL_MS}ms`)
  let lastStatus = null
  while (true) {
    let info
    try {
      info = await checkBuild()
    } catch (err) {
      emit(`CHECK_FAILED ${String(err.message).split('\n')[0].slice(0, 200)}`)
      await sleep(POLL_MS)
      continue
    }
    const status = info.status
    if (status !== lastStatus) {
      emit(`STATUS ${status}`)
      lastStatus = status
    }
    if (status === 'FINISHED') {
      const url = info.artifacts?.buildUrl
      if (!url) {
        emit('ERRORED no-artifact-url')
        process.exit(1)
      }
      emit(`ARTIFACT_URL ${url}`)
      // AABs go straight to the Play Store — there's nothing useful on the
      // public website pointing at an AAB. Skip the Supabase mirror.
      const isAab = /\.aab(\?|$)/i.test(url)
      if (isAab) {
        emit('SKIP_MIRROR aab — destined for Play Store')
        emit('DONE')
        process.exit(0)
      }
      try {
        const { buf } = await downloadToTmp(url)
        const publicUrl = await uploadToSupabase(buf)
        emit(`SUPABASE_URL ${publicUrl}`)
        emit('DONE')
        process.exit(0)
      } catch (err) {
        emit(`UPLOAD_FAILED ${String(err.message).split('\n')[0].slice(0, 200)}`)
        process.exit(1)
      }
    }
    if (status === 'ERRORED' || status === 'CANCELED') {
      const msg = info.error?.message || `Build ${status}`
      emit(`ERRORED ${String(msg).split('\n')[0].slice(0, 300)}`)
      emit(`BUILD_LOG https://expo.dev/accounts/cantilaholdings/projects/gritsync/builds/${BUILD_ID}`)
      process.exit(1)
    }
    await sleep(POLL_MS)
  }
})().catch((err) => {
  emit(`FATAL ${String(err.message).split('\n')[0].slice(0, 300)}`)
  process.exit(1)
})

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}
