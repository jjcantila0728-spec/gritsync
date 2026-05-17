import * as WebBrowser from 'expo-web-browser'
import { Alert, Linking } from 'react-native'
import { api, API_BASE_URL, REVIEW_BASE_URL } from './api'
import { storage, StorageKeys } from './storage'
import { palette } from '@/theme'

interface OpenOptions {
  /** Render the URL inside an in-app SFSafariViewController (iOS) /
   *  Custom Tab (Android). Falls through to the system browser if not
   *  supported. Default true. */
  preferInApp?: boolean
  /** Force-skip SSO even when the URL points at a GritSync host. */
  noSso?: boolean
}

/**
 * Open any URL with a consistent UX.
 *
 * - Defaults to the in-app browser (faster, no app switch, branded chrome).
 * - If the URL targets a GritSync subdomain (app.* or review.*), we first
 *   trade the user's bearer token for a short-lived SSO token via
 *   `/api/auth/sso/issue` and wrap the destination as
 *   `<base>/sso?token=<sso>&next=<originalPath>`. The web's existing /sso
 *   landing page (src/pages/Sso.tsx) exchanges the token, drops a session
 *   into localStorage, then redirects to `next`. The user lands on the
 *   destination already signed in.
 * - On SSO failure we silently fall back to opening the raw URL — the user
 *   will see the login screen instead, but the link still works.
 */
export async function openUrl(url: string, opts: OpenOptions = {}): Promise<void> {
  const finalUrl = opts.noSso ? url : await wrapForSso(url)
  await present(finalUrl, opts.preferInApp !== false)
}

async function present(url: string, inApp: boolean) {
  try {
    if (inApp) {
      await WebBrowser.openBrowserAsync(url, {
        controlsColor: palette.brand.red600,
        toolbarColor: '#FFFFFF',
        dismissButtonStyle: 'close',
        readerMode: false,
        enableBarCollapsing: true,
      })
      return
    }
    const ok = await Linking.canOpenURL(url)
    if (ok) await Linking.openURL(url)
    else Alert.alert('Unable to open', "Your device cannot open this link.")
  } catch {
    Alert.alert('Open failed', 'Could not open the link.')
  }
}

/**
 * If `url` points at app.gritsync.com or review.gritsync.com (or the
 * equivalent local API_BASE_URL / REVIEW_BASE_URL in dev), mint an SSO
 * token and rewrite the URL to land authenticated via `/sso?token=...`.
 * Otherwise the URL is returned unchanged.
 */
async function wrapForSso(rawUrl: string): Promise<string> {
  const targets = ssoTargetFor(rawUrl)
  if (!targets) return rawUrl
  const token = await storage.get(StorageKeys.accessToken)
  if (!token) return rawUrl
  try {
    const res = await api.post<{ sso_token?: string; token?: string }>('/auth/sso/issue', {
      target: targets.target,
    })
    const sso = res.data?.sso_token ?? res.data?.token
    if (!sso) return rawUrl
    return `${targets.base}/sso?token=${encodeURIComponent(sso)}&next=${encodeURIComponent(targets.nextPath)}`
  } catch {
    return rawUrl
  }
}

interface SsoMapping {
  base: string
  target: 'app' | 'review'
  nextPath: string
}

function ssoTargetFor(rawUrl: string): SsoMapping | null {
  try {
    const u = new URL(rawUrl)
    const path = `${u.pathname}${u.search}${u.hash}` || '/'

    // Local dev: API_BASE_URL might be http://10.0.0.x:5000 or similar — match
    // against the configured host directly.
    if (sameHost(rawUrl, API_BASE_URL)) {
      return { base: API_BASE_URL, target: 'app', nextPath: path }
    }
    if (sameHost(rawUrl, REVIEW_BASE_URL)) {
      return { base: REVIEW_BASE_URL, target: 'review', nextPath: path }
    }

    // Production subdomain detection — covers the case where API_BASE_URL
    // might point at a different host than the link being opened.
    if (u.hostname === 'app.gritsync.com' || u.hostname.endsWith('.app.gritsync.com')) {
      return { base: 'https://app.gritsync.com', target: 'app', nextPath: path }
    }
    if (u.hostname === 'review.gritsync.com' || u.hostname.endsWith('.review.gritsync.com')) {
      return { base: 'https://review.gritsync.com', target: 'review', nextPath: path }
    }
    return null
  } catch {
    return null
  }
}

function sameHost(a: string, b: string): boolean {
  try {
    return new URL(a).host === new URL(b).host
  } catch {
    return false
  }
}

/**
 * Open a private user document by its `file_path` from `user_documents`.
 *
 * Tries Supabase Storage first (where web + new-mobile uploads land), then
 * falls back to the legacy `/api/storage/file` endpoint backed by the
 * Postgres file_storage table. The fallback exists so documents uploaded
 * by older mobile builds (before the Supabase migration) still open.
 */
export async function openSignedDoc(filePath: string): Promise<void> {
  // 1. Try a Supabase signed URL via /api/storage/document-url. This is
  //    where web's getSignedFileUrl points and where new mobile uploads land.
  try {
    const { storageAPI } = await import('./services')
    const signed = await storageAPI.signedDocumentUrl(filePath)
    if (signed) {
      await openUrl(signed, { noSso: true })
      return
    }
  } catch {
    // fall through to legacy
  }
  // 2. Legacy fallback — Postgres file_storage table.
  const token = await storage.get(StorageKeys.accessToken)
  const url = `${API_BASE_URL}/api/storage/file?path=${encodeURIComponent(filePath)}&t=${encodeURIComponent(token ?? '')}`
  await openUrl(url, { noSso: true })
}
