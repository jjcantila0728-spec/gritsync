import { useState, FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { BookOpen, Eye, EyeOff } from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://gritsync.com/api'

export const Register = () => {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next') || '/'

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [mobile, setMobile] = useState('')
  const [personalEmail, setPersonalEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setVerifyMsg(null)

    if (!firstName.trim() || !lastName.trim() || !mobile.trim() || !personalEmail.trim() || !password) {
      setError('All fields are required.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const { data } = await axios.post(`${API_BASE}/auth/register`, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        mobile: mobile.trim(),
        personal_email: personalEmail.trim(),
        password,
      })

      if (data?.requiresVerification) {
        setVerifyMsg(`We sent a verification link to ${data.personal_email || personalEmail}. Confirm to activate your account, then sign in.`)
        return
      }

      const token = data?.session?.access_token
      if (token) {
        localStorage.setItem('gritsync_token', token)
        if (data?.user) localStorage.setItem('gritsync_user', JSON.stringify(data.user))
        navigate(next.startsWith('/') ? next : '/', { replace: true })
      } else {
        navigate(`/login${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`, { replace: true })
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Registration failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-50 to-white">
      <header className="bg-[#0c1e3c] h-14 flex items-center px-4 lg:px-6 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 bg-blue-500/30 rounded-lg flex items-center justify-center">
            <BookOpen className="h-4 w-4 text-blue-300" />
          </div>
          <span className="font-bold text-white text-sm">
            GritSync <span className="text-blue-400">NCLEX-RN</span> Review
          </span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Create your account</h1>
          <p className="text-sm text-gray-500 mb-6">Start practicing for the NCLEX-RN.</p>

          {verifyMsg ? (
            <div className="text-sm text-blue-800 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="font-semibold mb-1">Check your email</p>
              <p>{verifyMsg}</p>
              <Link to="/login" className="inline-block mt-3 text-blue-600 hover:text-blue-700 font-medium text-sm">Go to sign in →</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">First name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Last name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Mobile number</label>
                <input
                  type="tel"
                  value={mobile}
                  onChange={e => setMobile(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="+63 9XX XXX XXXX"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Personal email</label>
                <input
                  type="email"
                  autoComplete="email"
                  value={personalEmail}
                  onChange={e => setPersonalEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="you@example.com"
                />
                <p className="text-[11px] text-gray-400 mt-1">Use Gmail/Yahoo/etc — not a @gritsync.com address.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full px-3 pr-9 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">At least 8 characters.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Confirm password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
              >
                {loading ? 'Creating account…' : 'Create account'}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link to={`/login${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`} className="text-blue-600 hover:text-blue-700 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
