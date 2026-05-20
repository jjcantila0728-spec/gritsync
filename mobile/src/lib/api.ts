import axios, { AxiosError, AxiosInstance } from 'axios'
import Constants from 'expo-constants'
import { storage, StorageKeys } from './storage'

const extra = (Constants.expoConfig?.extra ?? {}) as {
  apiBaseUrl?: string
  reviewBaseUrl?: string
}

export const API_BASE_URL = extra.apiBaseUrl ?? 'https://app.gritsync.com'
export const REVIEW_BASE_URL = extra.reviewBaseUrl ?? 'https://review.gritsync.com'

let onUnauthorized: (() => void) | null = null
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn
}

export const api: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 20_000,
})

api.interceptors.request.use(async (config) => {
  const token = await storage.get(StorageKeys.accessToken)
  if (token) {
    config.headers = config.headers ?? {}
    ;(config.headers as Record<string, string>).Authorization = `Bearer ${token}`
  }
  return config
})

let refreshing: Promise<string | null> | null = null

async function tryRefresh(): Promise<string | null> {
  const refresh = await storage.get(StorageKeys.refreshToken)
  if (!refresh) return null
  try {
    const res = await axios.post(`${API_BASE_URL}/api/auth/refresh`, {
      refresh_token: refresh,
    })
    const next = res.data?.session?.access_token ?? res.data?.access_token
    if (typeof next === 'string') {
      await storage.set(StorageKeys.accessToken, next)
      return next
    }
  } catch {
    // fall through
  }
  return null
}

api.interceptors.response.use(
  (r) => r,
  async (err: AxiosError) => {
    const status = err.response?.status
    const original = err.config as (typeof err.config & { _retry?: boolean }) | undefined
    if (status === 401 && original && !original._retry) {
      original._retry = true
      refreshing = refreshing ?? tryRefresh().finally(() => { refreshing = null })
      const next = await refreshing
      if (next) {
        original.headers = original.headers ?? {}
        ;(original.headers as Record<string, string>).Authorization = `Bearer ${next}`
        return api.request(original)
      }
      onUnauthorized?.()
    }
    // Console-log every non-2xx (other than the 401 we just auto-handled) so
    // Metro shows the URL + body. Without this the only thing we get is
    // "AxiosError: Request failed with status code 500" with no clue which
    // endpoint blew up.
    if (status && status >= 400 && status !== 401) {
      const url = (original?.baseURL ?? '') + (original?.url ?? '')
      const method = (original?.method ?? 'GET').toUpperCase()
      const data = (err.response?.data as any) ?? null
      const body = typeof data === 'string' ? data.slice(0, 400) : JSON.stringify(data)?.slice(0, 400)
      // eslint-disable-next-line no-console
      console.log(`[api] ${method} ${url} → ${status}  body=${body}`)
    }
    return Promise.reject(err)
  }
)

export function errorMessage(e: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(e)) {
    const data = e.response?.data as { error?: string; message?: string } | undefined
    return data?.error ?? data?.message ?? e.message ?? fallback
  }
  if (e instanceof Error) return e.message
  return fallback
}
