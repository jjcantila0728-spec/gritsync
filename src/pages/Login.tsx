import { useState, useEffect } from 'react'
import { useNavigate, Link, Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { Header } from '@/components/Header'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Eye, EyeOff, Mail, Lock } from 'lucide-react'
import { isValidEmail } from '@/lib/utils'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null)
  const [accountLocked, setAccountLocked] = useState(false)
  const [lockedUntil, setLockedUntil] = useState<string | null>(null)
  const [minutesRemaining, setMinutesRemaining] = useState<number | null>(null)
  const { signIn, isAdmin, user, loading: authLoading } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      navigate(isAdmin() ? '/admin/dashboard' : '/dashboard', { replace: true })
    }
  }, [user, authLoading, isAdmin, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    // Validation
    if (!email.trim()) {
      setError('Email is required')
      return
    }

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address')
      return
    }

    if (!password) {
      setError('Password is required')
      return
    }

    setLoading(true)
    setError('')
    setRemainingAttempts(null)
    setAccountLocked(false)
    setLockedUntil(null)
    setMinutesRemaining(null)

    try {
      await signIn(email, password)
      showToast('Welcome back!', 'success')
      // The useEffect will handle the redirect when user state updates via onAuthStateChange
      // No need to navigate here - the useEffect will catch the user state change
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to sign in'
      
      // Check if error response contains lockout information
      if (err.response?.data || err.data) {
        const errorData = err.response?.data || err.data
        
        // Check for account lockout
        if (errorData.lockedUntil) {
          setAccountLocked(true)
          setLockedUntil(errorData.lockedUntil)
          setMinutesRemaining(errorData.minutesRemaining || null)
          setError('Account is temporarily locked due to too many failed login attempts.')
        } else if (errorData.remainingAttempts !== undefined) {
          // Show remaining attempts
          setRemainingAttempts(errorData.remainingAttempts)
          setError(errorMessage)
          
          if (errorData.remainingAttempts > 0) {
            showToast(`${errorMessage} (${errorData.remainingAttempts} attempt${errorData.remainingAttempts !== 1 ? 's' : ''} remaining)`, 'error')
          } else {
            showToast(errorMessage, 'error')
          }
        } else {
          setError(errorMessage)
          showToast(errorMessage, 'error')
        }
      } else {
        setError(errorMessage)
        showToast(errorMessage, 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  // Show loading while checking auth state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
        <Header />
        <main className="container mx-auto px-4 py-16 flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading...</p>
          </div>
        </main>
      </div>
    )
  }

  // Redirect if already logged in
  if (user) {
    return <Navigate to={isAdmin() ? '/admin/dashboard' : '/dashboard'} replace />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <Header />
      <main className="container mx-auto px-4 py-16 flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <Card className="w-full max-w-md border-0 shadow-xl">
          <div className="p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 mb-4">
                <Lock className="h-8 w-8 text-primary-600 dark:text-primary-400" />
              </div>
              <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-gray-100">
                Welcome Back
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Sign in to your account to continue
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 space-y-2">
                  <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>
                  {accountLocked && minutesRemaining !== null && (
                    <p className="text-xs text-red-500 dark:text-red-400">
                      Account will be unlocked in {minutesRemaining} minute{minutesRemaining !== 1 ? 's' : ''}. 
                      Please contact support if you need immediate access.
                    </p>
                  )}
                  {!accountLocked && remainingAttempts !== null && remainingAttempts > 0 && (
                    <p className="text-xs text-red-500 dark:text-red-400">
                      {remainingAttempts} attempt{remainingAttempts !== 1 ? 's' : ''} remaining before account lockout.
                    </p>
                  )}
                  {!accountLocked && remainingAttempts === 0 && (
                    <p className="text-xs text-red-500 dark:text-red-400">
                      Account will be locked after the next failed attempt.
                    </p>
                  )}
                </div>
              )}

              <div className="relative">
                <Input
                  label="Email Address"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="pl-10"
                />
                <div className="absolute left-3 top-[38px] text-gray-400 pointer-events-none">
                  <Mail className="h-5 w-5" />
                </div>
              </div>

              <div className="relative">
                <Input
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="pl-10"
                  rightIcon={showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  onRightIconClick={() => setShowPassword(!showPassword)}
                />
                <div className="absolute left-3 top-[38px] text-gray-400 pointer-events-none">
                  <Lock className="h-5 w-5" />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                    Remember me
                  </span>
                </label>
                <Link
                  to="/forgot-password"
                  className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300 dark:border-gray-700"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                    New to GritSync?
                  </span>
                </div>
              </div>
              <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
                Don't have an account?{' '}
                <Link
                  to="/register"
                  className="font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-500 dark:hover:text-primary-300 transition-colors"
                >
                  Create an account
                </Link>
              </p>
            </div>
          </div>
        </Card>
      </main>
    </div>
  )
}

