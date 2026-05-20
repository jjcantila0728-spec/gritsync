import * as Updates from 'expo-updates'
import Constants from 'expo-constants'

/**
 * Wrapper around `expo-updates` that:
 *   1. Returns a typed result instead of mixing throws + status fields
 *   2. Notifies subscribers (banner UI, settings screen) when a new bundle
 *      has been fetched and is ready to apply on next launch
 *   3. Is safe to call in dev / Expo Go (where `Updates.isEnabled` is false)
 *
 * The actual *application* of the bundle is deferred to `applyUpdate()` —
 * we never force a mid-session reload, and the user opts in via the banner
 * or the manual "Check for updates" row in Settings.
 */

export type UpdateCheckResult =
  | { status: 'disabled' }              // dev / Expo Go / updates.isEnabled === false
  | { status: 'up-to-date' }
  | { status: 'available'; manifestId?: string | null }
  | { status: 'error'; message: string }

type Listener = (state: UpdateState) => void

export interface UpdateState {
  ready: boolean                        // A fetched update is sitting in cache
  checking: boolean                     // checkForUpdateAsync is in flight
  lastCheckedAt: number | null          // epoch ms
  lastResult: UpdateCheckResult | null
}

let state: UpdateState = {
  ready: false,
  checking: false,
  lastCheckedAt: null,
  lastResult: null,
}
const listeners = new Set<Listener>()

function emit() {
  for (const l of listeners) l(state)
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn)
  fn(state)
  return () => {
    listeners.delete(fn)
  }
}

export function getState(): UpdateState {
  return state
}

/**
 * Ask EAS Update whether a newer bundle is available, and if so, download it
 * so the next call to `applyUpdate()` (or the next cold start) picks it up.
 *
 * `silent: true` is used by the cold-start / foreground probes — never throws,
 * never surfaces "no update" feedback. `silent: false` is for the manual
 * "Check for updates" tap in Settings, where we want the result back to
 * surface an Alert.
 */
export async function checkForUpdates(opts: { silent?: boolean } = {}): Promise<UpdateCheckResult> {
  if (!Updates.isEnabled) {
    const r: UpdateCheckResult = { status: 'disabled' }
    state = { ...state, lastResult: r, lastCheckedAt: Date.now() }
    emit()
    return r
  }
  state = { ...state, checking: true }
  emit()
  try {
    const check = await Updates.checkForUpdateAsync()
    if (!check.isAvailable) {
      const r: UpdateCheckResult = { status: 'up-to-date' }
      state = { ...state, checking: false, lastResult: r, lastCheckedAt: Date.now() }
      emit()
      return r
    }
    // A new bundle exists — download it into cache so applyUpdate can swap.
    const fetched = await Updates.fetchUpdateAsync()
    const r: UpdateCheckResult = {
      status: 'available',
      manifestId: (fetched.manifest as { id?: string } | null)?.id ?? null,
    }
    state = {
      ...state,
      checking: false,
      ready: true,
      lastResult: r,
      lastCheckedAt: Date.now(),
    }
    emit()
    return r
  } catch (err: any) {
    const r: UpdateCheckResult = {
      status: 'error',
      message: err?.message || 'Update check failed',
    }
    state = { ...state, checking: false, lastResult: r, lastCheckedAt: Date.now() }
    emit()
    if (opts.silent) return r
    throw err
  }
}

/**
 * Hard-reload into the newly fetched bundle. Only call this when the user
 * has explicitly opted in — mid-session reloads are jarring.
 *
 * After this resolves, the app process is gone. There's nothing to clean up.
 */
export async function applyUpdate(): Promise<void> {
  if (!Updates.isEnabled) return
  await Updates.reloadAsync()
}

/**
 * Human-readable summary used by the Settings screen. Keeps the build's
 * versions / channel / runtime version visible so support can pin down which
 * bundle a user is on.
 */
export interface UpdateMeta {
  appVersion: string
  runtimeVersion: string | null
  channel: string | null
  updateId: string | null
  createdAt: string | null
  isEmbeddedLaunch: boolean
}

export function getUpdateMeta(): UpdateMeta {
  return {
    appVersion: Constants.expoConfig?.version ?? '1.0.0',
    runtimeVersion: typeof Updates.runtimeVersion === 'string' ? Updates.runtimeVersion : null,
    channel: typeof Updates.channel === 'string' ? Updates.channel : null,
    updateId: Updates.updateId ?? null,
    createdAt: Updates.createdAt ? Updates.createdAt.toISOString() : null,
    // True if the bundle running is the one shipped with the binary (no OTA
    // applied yet). False once an EAS update has been applied.
    isEmbeddedLaunch: Updates.isEmbeddedLaunch,
  }
}
