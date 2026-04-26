import { useState, useRef, KeyboardEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'
import { SEO, generateBreadcrumbSchema } from '@/components/SEO'
import { Mail, ArrowLeft, ShieldCheck, RefreshCw } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { isValidEmail } from '@/lib/utils'

type Step = 'email' | 'otp'

export function ForgotPassword() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [resending, setResending] = useState(false)
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])
  const { requestPasswordReset } = useAuth()
  const { showToast } = useToast()

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email.trim()) {
      showToast('Please enter your email address', 'error')
      return
    }

    if (!isValidEmail(email)) {
      showToast('Please enter a valid email address', 'error')
      return
    }

    setLoading(true)
    try {
      await requestPasswordReset(email)
      setStep('otp')
      showToast('Reset instructions sent! Check your inbox.', 'success')
    } catch (error: any) {
      showToast(error.message || 'Failed to send reset email', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleOtpChange = (index: number, value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(-1)
    const next = [...otp]
    next[index] = cleaned
    setOtp(next)
    if (cleaned && index < 5) {
      otpRefs.current[index + 1]?.focus()
    }
  }

  const handleOtpKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
    if (e.key === 'ArrowLeft' && index > 0) otpRefs.current[index - 1]?.focus()
    if (e.key === 'ArrowRight' && index < 5) otpRefs.current[index + 1]?.focus()
  }

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length > 0) {
      const next = [...otp]
      pasted.split('').forEach((ch, i) => { if (i < 6) next[i] = ch })
      setOtp(next)
      const focusIdx = Math.min(pasted.length, 5)
      otpRefs.current[focusIdx]?.focus()
    }
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = otp.join('')
    if (code.length < 6) {
      showToast('Please enter all 6 digits', 'error')
      return
    }

    setVerifying(true)
    try {
      const res = await fetch('/api/auth/verify-reset-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: code }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Invalid code')
      showToast('Code verified! Set your new password.', 'success')
      navigate(`/reset-password?token=${data.token}`)
    } catch (error: any) {
      showToast(error.message || 'Invalid or expired code', 'error')
      setOtp(['', '', '', '', '', ''])
      otpRefs.current[0]?.focus()
    } finally {
      setVerifying(false)
    }
  }

  const handleResend = async () => {
    setResending(true)
    try {
      await requestPasswordReset(email)
      setOtp(['', '', '', '', '', ''])
      otpRefs.current[0]?.focus()
      showToast('New code sent! Check your inbox.', 'success')
    } catch (error: any) {
      showToast(error.message || 'Failed to resend', 'error')
    } finally {
      setResending(false)
    }
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const currentUrl = typeof window !== 'undefined' ? window.location.href : ''
  const breadcrumbs = [
    { name: 'Home', url: baseUrl },
    { name: 'Forgot Password', url: currentUrl },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <SEO
        title="Forgot Password - Reset Your GritSync Account | NCLEX Processing Agency"
        description="Reset your GritSync account password. Enter your email address to receive password reset instructions."
        keywords="forgot password, password reset, account recovery, GritSync password, NCLEX account recovery"
        canonicalUrl={currentUrl}
        ogTitle="Forgot Password - Reset Your GritSync Account"
        ogDescription="Reset your GritSync account password. Enter your email to receive password reset instructions."
        ogImage={`${baseUrl}/gritsync_logo.png`}
        ogUrl={currentUrl}
        noindex={true}
        structuredData={[generateBreadcrumbSchema(breadcrumbs)]}
      />
      <Header />
      <main className="container mx-auto px-4 py-16 flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <Card className="w-full max-w-md border-0 shadow-xl">
          <div className="p-8">
            {step === 'email' ? (
              <>
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 mb-4">
                    <Mail className="h-8 w-8 text-primary-600 dark:text-primary-400" />
                  </div>
                  <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-gray-100">
                    Forgot Password?
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400">
                    Enter your email and we'll send a 6-digit reset code to your inbox
                  </p>
                </div>

                <form onSubmit={handleEmailSubmit} className="space-y-5">
                  <div className="relative">
                    <Input
                      label="Email Address"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your personal or GritSync email"
                      required
                      className="pl-10"
                    />
                    <div className="absolute left-3 top-[38px] text-gray-400 pointer-events-none">
                      <Mail className="h-5 w-5" />
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Sending...
                      </>
                    ) : (
                      'Send Reset Code'
                    )}
                  </Button>
                </form>

                <div className="mt-6">
                  <Link
                    to="/login"
                    className="flex items-center justify-center gap-2 text-sm text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Login
                  </Link>
                </div>
              </>
            ) : (
              <>
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 mb-4">
                    <ShieldCheck className="h-8 w-8 text-primary-600 dark:text-primary-400" />
                  </div>
                  <h1 className="text-2xl font-bold mb-2 text-gray-900 dark:text-gray-100">
                    Enter Reset Code
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    We sent a 6-digit code to <strong className="text-gray-800 dark:text-gray-200">{email}</strong>.<br />
                    Check your inbox and enter it below.
                  </p>
                </div>

                <form onSubmit={handleVerifyOtp} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 text-center">
                      6-Digit Reset Code
                    </label>
                    <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
                      {otp.map((digit, i) => (
                        <input
                          key={i}
                          ref={(el) => { otpRefs.current[i] = el }}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpChange(i, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(i, e)}
                          className="w-11 h-14 text-center text-xl font-bold border-2 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:border-primary-500 dark:focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-colors"
                        />
                      ))}
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={verifying || otp.join('').length < 6}>
                    {verifying ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Verifying...
                      </>
                    ) : (
                      'Verify Code'
                    )}
                  </Button>
                </form>

                <div className="mt-5 flex flex-col items-center gap-3">
                  <button
                    onClick={handleResend}
                    disabled={resending}
                    className="flex items-center gap-2 text-sm text-primary-600 dark:text-primary-400 hover:underline disabled:opacity-60"
                  >
                    {resending ? (
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Resend code
                  </button>
                  <button
                    onClick={() => { setStep('email'); setOtp(['', '', '', '', '', '']) }}
                    className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:underline"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Change email
                  </button>
                </div>
              </>
            )}
          </div>
        </Card>
      </main>
      <Footer />
    </div>
  )
}
