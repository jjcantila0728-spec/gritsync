import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { adoptSession } from '@/lib/api-client'

/**
 * Cross-subdomain SSO landing page.
 *
 * Receives a short-lived SSO token in `?token=...`, exchanges it for a normal
 * access/refresh pair via /api/auth/sso/exchange, installs the session into
 * this subdomain's localStorage, then redirects to `next` (default: /).
 *
 * On failure (token expired, user disabled, etc.) the user is bounced to
 * /login with a flash message.
 */
export function Sso() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const ran = useRef(false)
  const [status, setStatus] = useState<'pending' | 'error'>('pending')
  const [errorMsg, setErrorMsg] = useState<string>('')

  useEffect(() => {
    // StrictMode fires effects twice in dev — guard so we don't double-exchange
    // a single-use SSO token.
    if (ran.current) return
    ran.current = true

    const token = params.get('token')
    const next = params.get('next') || '/'

    if (!token) {
      navigate('/login', { replace: true })
      return
    }

    (async () => {
      try {
        const res = await fetch('/api/auth/sso/exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sso_token: token }),
        })
        const body = await res.json().catch(() => ({}))
        if (!res.ok || !body?.session) {
          throw new Error(body?.error || `SSO exchange failed (HTTP ${res.status})`)
        }
        adoptSession(body.session)
        // Hard navigation so AuthContext bootstraps fresh from the new session.
        window.location.replace(next)
      } catch (e: any) {
        setErrorMsg(e?.message || 'Sign-in link could not be verified.')
        setStatus('error')
      }
    })()
  }, [params, navigate])

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50 dark:bg-gray-950">
        <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 text-center">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Sign-in link expired</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{errorMsg}</p>
          <button
            type="button"
            onClick={() => navigate('/login', { replace: true })}
            className="mt-4 inline-flex items-center px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"
          >
            Go to login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">Signing you in…</p>
      </div>
    </div>
  )
}

export default Sso
