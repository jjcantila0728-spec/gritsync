import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://gritsync.com/api'

export const Sso = () => {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ssoToken = params.get('token')
    const next = params.get('next') || '/'
    if (!ssoToken) {
      navigate('/login', { replace: true })
      return
    }

    axios
      .post(`${API_BASE}/auth/sso/exchange`, { sso_token: ssoToken })
      .then(({ data }) => {
        const accessToken = data?.session?.access_token
        if (!accessToken) throw new Error('No access token returned')
        localStorage.setItem('gritsync_token', accessToken)
        const user = data?.session?.user
        if (user) localStorage.setItem('gritsync_user', JSON.stringify(user))
        const safeNext = next.startsWith('/') ? next : '/'
        navigate(safeNext, { replace: true })
      })
      .catch((err) => {
        const msg = err?.response?.data?.error || err?.message || 'Sign-in link expired.'
        setError(msg)
      })
  }, [navigate, params])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">{error}</p>
          <button
            onClick={() => navigate('/login', { replace: true })}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Go to sign in →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
    </div>
  )
}
