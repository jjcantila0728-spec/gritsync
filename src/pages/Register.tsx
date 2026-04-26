import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { SEO, generateBreadcrumbSchema } from '@/components/SEO'
import { Eye, EyeOff, Lock, User, Phone, Mail, CheckCircle, RefreshCw, KeyRound } from 'lucide-react'
import { validatePasswordSync } from '@/lib/utils'

export function Register() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [mobile, setMobile] = useState('')
  const [personalEmail, setPersonalEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [verificationSent, setVerificationSent] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState('')
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMessage, setResendMessage] = useState('')

  // OTP state
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', ''])
  const [otpLoading, setOtpLoading] = useState(false)
  const [otpError, setOtpError] = useState('')
  const [otpSuccess, setOtpSuccess] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  const { signUp } = useAuth()
  const { showToast } = useToast()

  // Cooldown countdown for resend button
  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!firstName.trim() || firstName.trim().length < 2) {
      setError('First name must be at least 2 characters')
      return
    }

    if (!lastName.trim() || lastName.trim().length < 2) {
      setError('Last name must be at least 2 characters')
      return
    }

    if (!personalEmail.trim()) {
      setError('Personal email address is required')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(personalEmail.trim())) {
      setError('Please enter a valid email address')
      return
    }

    if (personalEmail.trim().toLowerCase().endsWith('@gritsync.com')) {
      setError('Please use your personal email (Gmail, Yahoo, etc.), not a GritSync email')
      return
    }

    if (!mobile.trim()) {
      setError('Mobile number is required')
      return
    }

    if (!/^[+\d\s\-()]{7,20}$/.test(mobile.trim())) {
      setError('Please enter a valid mobile number')
      return
    }

    const passwordValidation = validatePasswordSync(password)
    if (!passwordValidation.valid) {
      setError(passwordValidation.message || 'Invalid password')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      const result = await signUp(firstName, lastName, mobile, password, 'client', personalEmail)
      if (result && (result as any).requiresVerification) {
        setRegisteredEmail((result as any).personal_email || personalEmail)
        setVerificationSent(true)
        setResendCooldown(60)
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to create account'
      setError(errorMessage)
      showToast(errorMessage, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResendLoading(true)
    setResendMessage('')
    setOtpError('')
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personal_email: registeredEmail }),
      })
      const data = await res.json()
      setResendMessage(data.message || 'Verification email sent!')
      setResendCooldown(60)
      // Clear OTP inputs
      setOtpDigits(['', '', '', '', '', ''])
      otpRefs.current[0]?.focus()
    } catch {
      setResendMessage('Failed to resend. Please try again.')
    } finally {
      setResendLoading(false)
    }
  }

  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1)
    const next = [...otpDigits]
    next[index] = digit
    setOtpDigits(next)
    setOtpError('')
    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus()
    }
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
  }

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (text.length === 6) {
      setOtpDigits(text.split(''))
      otpRefs.current[5]?.focus()
    }
    e.preventDefault()
  }

  const handleVerifyOtp = async () => {
    const otp = otpDigits.join('')
    if (otp.length < 6) {
      setOtpError('Please enter the full 6-digit code')
      return
    }

    setOtpLoading(true)
    setOtpError('')
    setOtpSuccess('')

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personal_email: registeredEmail, otp }),
      })
      const data = await res.json()

      if (!res.ok) {
        setOtpError(data.error || 'Verification failed. Please try again.')
        setOtpDigits(['', '', '', '', '', ''])
        otpRefs.current[0]?.focus()
        return
      }

      // Store session tokens and redirect
      if (data.token) {
        localStorage.setItem('gritsync_token', data.token)
        localStorage.setItem('gritsync_refresh_token', data.refresh_token || '')
        localStorage.setItem('gritsync_user', JSON.stringify(data.user))
      }

      setOtpSuccess('Email verified! Redirecting to your dashboard...')
      showToast('Account verified successfully!', 'success')
      setTimeout(() => {
        window.location.href = '/dashboard'
      }, 1200)
    } catch {
      setOtpError('Something went wrong. Please try again.')
    } finally {
      setOtpLoading(false)
    }
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const currentUrl = typeof window !== 'undefined' ? window.location.href : ''
  const breadcrumbs = [
    { name: 'Home', url: baseUrl },
    { name: 'Register', url: currentUrl },
  ]

  if (verificationSent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
        <Header />
        <main className="container mx-auto px-4 py-16 flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <Card className="w-full max-w-md border-0 shadow-xl">
            <div className="p-8">
              {/* Header */}
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
                  <Mail className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
                <h1 className="text-2xl font-bold mb-1 text-gray-900 dark:text-gray-100">
                  Check Your Email
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  We sent a code and a link to:
                </p>
                <p className="font-semibold text-primary-600 dark:text-primary-400 mt-1 break-all text-sm">
                  {registeredEmail}
                </p>
              </div>

              {/* OTP Entry */}
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-5 mb-5">
                <div className="flex items-center gap-2 mb-3">
                  <KeyRound className="h-4 w-4 text-primary-600 dark:text-primary-400 shrink-0" />
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Enter your 6-digit verification code
                  </p>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  Check your inbox for the code. It expires in <strong>15 minutes</strong>.
                </p>

                {/* OTP Boxes */}
                <div className="flex gap-2 justify-center mb-4" onPaste={handleOtpPaste}>
                  {otpDigits.map((digit, i) => (
                    <input
                      key={i}
                      ref={el => { otpRefs.current[i] = el }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={e => handleOtpChange(i, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(i, e)}
                      disabled={otpLoading || !!otpSuccess}
                      className={`w-11 h-14 text-center text-2xl font-bold rounded-lg border-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none transition-colors
                        ${otpError
                          ? 'border-red-400 dark:border-red-600'
                          : digit
                            ? 'border-primary-500 dark:border-primary-400'
                            : 'border-gray-300 dark:border-gray-600 focus:border-primary-500 dark:focus:border-primary-400'
                        }`}
                    />
                  ))}
                </div>

                {otpError && (
                  <p className="text-sm text-red-600 dark:text-red-400 text-center mb-3">{otpError}</p>
                )}
                {otpSuccess && (
                  <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400 mb-3">
                    <CheckCircle className="h-4 w-4" />
                    <p className="text-sm font-medium">{otpSuccess}</p>
                  </div>
                )}

                <Button
                  className="w-full"
                  onClick={handleVerifyOtp}
                  disabled={otpLoading || otpDigits.join('').length < 6 || !!otpSuccess}
                >
                  {otpLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Verifying...
                    </>
                  ) : (
                    'Verify Account'
                  )}
                </Button>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
                <span className="text-xs text-gray-400 dark:text-gray-500">or</span>
                <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
              </div>

              {/* Link verification info */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-5 text-center">
                <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">
                  You can also click the <strong>Verify My Email</strong> button in the same email to verify instantly.
                </p>
              </div>

              {/* Resend */}
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center mb-3">
                Didn't receive it? Check your spam folder or resend below.
              </p>
              <Button
                variant="outline"
                onClick={handleResend}
                disabled={resendLoading || resendCooldown > 0}
                className="w-full mb-3"
              >
                {resendLoading ? (
                  <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Sending...</>
                ) : resendCooldown > 0 ? (
                  <><RefreshCw className="h-4 w-4 mr-2" />Resend in {resendCooldown}s</>
                ) : (
                  <><RefreshCw className="h-4 w-4 mr-2" />Resend Code & Link</>
                )}
              </Button>
              {resendMessage && (
                <p className="text-xs text-green-600 dark:text-green-400 text-center mb-3">{resendMessage}</p>
              )}

              <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                Already verified?{' '}
                <Link to="/login" className="text-primary-600 dark:text-primary-400 font-semibold hover:underline">
                  Sign in
                </Link>
              </p>
            </div>
          </Card>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <SEO
        title="Register - Create Your GritSync Account | NCLEX Processing Agency"
        description="Create your free GritSync account to start processing your NCLEX applications. Get instant quotes, track applications, and manage documents."
        keywords="register, sign up, create account, NCLEX account, nursing application registration, GritSync registration"
        canonicalUrl={currentUrl}
        ogTitle="Register - Create Your GritSync Account | NCLEX Processing Agency"
        ogDescription="Create your free GritSync account to start processing your NCLEX applications."
        ogImage={`${baseUrl}/gritsync_logo.png`}
        ogUrl={currentUrl}
        structuredData={[
          generateBreadcrumbSchema(breadcrumbs),
          {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: 'Register',
            description: 'Create your free GritSync account to start processing NCLEX applications',
          },
        ]}
      />
      <Header />
      <main className="container mx-auto px-4 py-16 flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <Card className="w-full max-w-md border-0 shadow-xl">
          <div className="p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 mb-4">
                <User className="h-8 w-8 text-primary-600 dark:text-primary-400" />
              </div>
              <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-gray-100">
                Create Account
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Sign up to get started with GritSync
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <Input
                    label="First Name"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    placeholder="Juan"
                    className="pl-10"
                  />
                  <div className="absolute left-3 top-[38px] text-gray-400 pointer-events-none">
                    <User className="h-5 w-5" />
                  </div>
                </div>
                <div className="relative">
                  <Input
                    label="Last Name"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    placeholder="Dela Cruz"
                    className="pl-10"
                  />
                  <div className="absolute left-3 top-[38px] text-gray-400 pointer-events-none">
                    <User className="h-5 w-5" />
                  </div>
                </div>
              </div>

              <div className="relative">
                <Input
                  label="Personal Email"
                  type="email"
                  value={personalEmail}
                  onChange={(e) => setPersonalEmail(e.target.value)}
                  required
                  placeholder="you@gmail.com"
                  className="pl-10"
                />
                <div className="absolute left-3 top-[38px] text-gray-400 pointer-events-none">
                  <Mail className="h-5 w-5" />
                </div>
              </div>

              <div className="relative">
                <Input
                  label="Mobile Number"
                  type="tel"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  required
                  placeholder="+63 917 123 4567"
                  className="pl-10"
                />
                <div className="absolute left-3 top-[38px] text-gray-400 pointer-events-none">
                  <Phone className="h-5 w-5" />
                </div>
              </div>

              <div className="relative">
                <Input
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="pl-10"
                  rightIcon={showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  onRightIconClick={() => setShowPassword(!showPassword)}
                />
                <div className="absolute left-3 top-[38px] text-gray-400 pointer-events-none">
                  <Lock className="h-5 w-5" />
                </div>
              </div>

              <div className="relative">
                <Input
                  label="Confirm Password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="pl-10"
                  rightIcon={showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  onRightIconClick={() => setShowConfirmPassword(!showConfirmPassword)}
                />
                <div className="absolute left-3 top-[38px] text-gray-400 pointer-events-none">
                  <Lock className="h-5 w-5" />
                </div>
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              <div className="flex items-start">
                <input
                  type="checkbox"
                  id="terms"
                  className="mt-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  required
                />
                <label htmlFor="terms" className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                  I agree to the{' '}
                  <Link to="/terms" className="text-primary-600 dark:text-primary-400 hover:underline">
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link to="/privacy" className="text-primary-600 dark:text-primary-400 hover:underline">
                    Privacy Policy
                  </Link>
                </label>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating account...
                  </>
                ) : (
                  'Create Account'
                )}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-500 dark:hover:text-primary-300 transition-colors"
              >
                Sign in
              </Link>
            </p>
          </div>
        </Card>
      </main>
      <Footer />
    </div>
  )
}
