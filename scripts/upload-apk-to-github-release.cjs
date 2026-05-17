#!/usr/bin/env node
/**
 * Mirror an EAS-built APK onto a GitHub Release.
 *
 * Why GitHub Releases instead of Supabase: the free Supabase tier caps
 * uploads below the typical Expo APK size, but a GitHub Release attaches
 * binaries up to 2 GB each at no cost and the URL never expires.
 *
 * Strategy:
 *   1. Download the APK from the EAS artifact URL.
 *   2. Create (or reuse) a release tagged `mobile-android-v<versionCode>`
 *      in the GitHub repo backing this checkout.
 *   3. Upload the APK as an asset on that release (replaces if exists).
 *   4. Print the public download URL — paste into Download.tsx →
 *      MOBILE_APP_LINKS.apk.
 *
 * Required env:
 *   GITHUB_TOKEN — personal access token (repo scope) so we can create
 *                  releases + upload assets. The token is *not* logged.
 *
 * Optional env / args:
 *   GITHUB_REPO  — owner/repo, defaults to parsing `git remote get-url
 *                  origin` so the script "just works" in this repo.
 *   GITHUB_TAG   — release tag, defaults to `mobile-android-latest`.
 *
 * Usage:
 *   GITHUB_TOKEN=ghp_… node scripts/upload-apk-to-github-release.cjs <APK_URL>
 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execSync } = require('child_process')

const APK_URL = process.argv[2]
if (!APK_URL) {
  console.error('Usage: node scripts/upload-apk-to-github-release.cjs <EAS_APK_URL>')
  process.exit(2)
}
const TOKEN = process.env.GITHUB_TOKEN
if (!TOKEN) {
  console.error('GITHUB_TOKEN env var required (mint a repo-scope PAT at https://github.com/settings/tokens)')
  process.exit(2)
}

const REPO = (() => {
  if (process.env.GITHUB_REPO) return process.env.GITHUB_REPO
  try {
    const url = execSync('git remote get-url origin', { encoding: 'utf8' }).trim()
    const m = url.match(/github\.com[:/]([^/]+)\/([^/.]+)/)
    if (!m) throw new Error('not a github remote: ' + url)
    return `${m[1]}/${m[2]}`
  } catch (e) {
    console.error('Could not infer GITHUB_REPO — pass via env. ' + e.message)
    process.exit(2)
  }
})()
const TAG = process.env.GITHUB_TAG || 'mobile-android-latest'
const RELEASE_NAME = process.env.GITHUB_RELEASE_NAME || 'GritSync Android (beta)'
const ASSET_NAME = process.env.GITHUB_ASSET_NAME || 'gritsync.apk'

const GH_API = `https://api.github.com/repos/${REPO}`
const headers = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'gritsync-release-uploader',
}

function emit(msg) { console.log(`[gh] ${msg}`) }

async function ghJson(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { ...headers, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch {}
  if (!res.ok) {
    const reason = json?.message || text.slice(0, 200)
    throw new Error(`${method} ${url} -> HTTP ${res.status}: ${reason}`)
  }
  return json
}

async function getOrCreateRelease() {
  // GitHub returns 404 if the release doesn't exist for the tag.
  const url = `${GH_API}/releases/tags/${encodeURIComponent(TAG)}`
  const res = await fetch(url, { headers })
  if (res.status === 200) {
    const r = await res.json()
    emit(`existing release id=${r.id} tag=${r.tag_name}`)
    return r
  }
  emit(`creating release tag=${TAG}`)
  return ghJson('POST', `${GH_API}/releases`, {
    tag_name: TAG,
    name: RELEASE_NAME,
    body: `Latest internal beta APK for the GritSync Android client. Updated on every EAS preview build.\n\nUploaded: ${new Date().toISOString()}\nEAS source: ${APK_URL}`,
    draft: false,
    prerelease: true,
    target_commitish: 'main',
  })
}

async function removeExistingAsset(releaseId, assetName) {
  // Releases reject duplicate asset names — delete the old one first.
  const assets = await ghJson('GET', `${GH_API}/releases/${releaseId}/assets`)
  for (const a of assets) {
    if (a.name === assetName) {
      emit(`removing previous asset ${a.id}`)
      await fetch(`${GH_API}/releases/assets/${a.id}`, { method: 'DELETE', headers })
    }
  }
}

async function uploadAsset(release, buffer, assetName) {
  const uploadUrl = release.upload_url.replace(/\{\?.*\}$/, '') +
    `?name=${encodeURIComponent(assetName)}`
  emit(`uploading ${(buffer.length / 1024 / 1024).toFixed(1)} MB → ${assetName}`)
  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Length': String(buffer.length),
    },
    body: buffer,
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Asset upload HTTP ${res.status}: ${t.slice(0, 200)}`)
  }
  return await res.json()
}

;(async () => {
  emit(`repo=${REPO} tag=${TAG} asset=${ASSET_NAME}`)

  emit(`downloading ${APK_URL}`)
  const dl = await fetch(APK_URL)
  if (!dl.ok) throw new Error(`Download HTTP ${dl.status}`)
  const buf = Buffer.from(await dl.arrayBuffer())
  emit(`downloaded ${(buf.length / 1024 / 1024).toFixed(1)} MB`)

  const release = await getOrCreateRelease()
  await removeExistingAsset(release.id, ASSET_NAME)
  const asset = await uploadAsset(release, buf, ASSET_NAME)

  emit('')
  emit('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  emit('✔ APK is now hosted on GitHub Releases')
  emit('')
  emit(`  Direct download URL:`)
  emit(`    ${asset.browser_download_url}`)
  emit('')
  emit('  Release page:')
  emit(`    ${release.html_url}`)
  emit('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
})().catch((err) => {
  console.error('[gh] FAILED:', err.message)
  process.exit(1)
})
