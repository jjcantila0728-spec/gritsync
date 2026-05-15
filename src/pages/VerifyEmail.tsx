import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { CheckCircle, XCircle, Loader2, Mail } from 'lucide-react'
import { SEO } from '@/components/SEO'

export function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [gritsyncEmail, setGritsyncEmail] = useState('')
  const [gritId, setGritId] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('No verification token found. Please use the link from your email.')
      return
    }

    const verify = async () => {
      try {
        const res = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
        const data = await res.json()

        if (!res.ok) {
          setStatus('error')
          setMessage(data.error || 'Verification failed')
          return
        }

        // Store session in localStorage so auth context picks it up
        if (data.session?.access_token) {
          localStorage.setItem('gritsync_token', data.session.access_token)
          localStorage.setItem('gritsync_refresh_token', data.session.refresh_token || '')
          localStorage.setItem('gritsync_user', JSON.stringify(data.session.user))
        }

        setGritsyncEmail(data.user?.gritsync_email || '')
        setGritId(data.user?.grit_id || '')
        setStatus('success')
        setMessage(data.message || 'Email verified successfully!')
      } catch {
        setStatus('error')
        setMessage('An error occurred during verification. Please try again.')
      }
    }

    verify()
  }, [token])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <SEO
        title="Verify Email — GritSync"
        description="Email verification page for new GritSync accounts."
        noindex
        nofollow
      />
      <Header />
      <main className="container mx-auto px-4 py-12 sm:py-16 flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <Card className="w-full max-w-md border-0 shadow-xl">
          <div className="p-8 text-center">
            {status === 'loading' && (
              <>
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-6">
                  <Loader2 className="h-10 w-10 text-blue-600 dark:text-blue-400 animate-spin" />
                </div>
                <h1 className="text-2xl font-bold mb-3 text-gray-900 dark:text-gray-100">
                  Verifying your email...
                </h1>
                <p className="text-gray-500 dark:text-gray-400">Please wait a moment.</p>
              </>
            )}

            {status === 'success' && (
              <>
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 mb-6">
                  <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
                <h1 className="text-2xl font-bold mb-3 text-gray-900 dark:text-gray-100">
                  Email Verified!
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Your account is now active. Welcome to GritSync!
                </p>

                {(gritsyncEmail || gritId) && (
                  <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl p-5 mb-6 text-left border border-primary-100 dark:border-primary-800">
                    <div className="flex items-center gap-2 mb-3">
                      <Mail className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                      <p className="font-semibold text-primary-700 dark:text-primary-300 text-sm">
                        Your GritSync Account Details
                      </p>
                    </div>
                    {gritId && (
                      <div className="mb-2">
                        <p className="text-xs text-gray-500 dark:text-gray-400">GRIT ID</p>
                        <p className="font-mono font-bold text-gray-900 dark:text-gray-100">{gritId}</p>
                      </div>
                    )}
                    {gritsyncEmail && (
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Business Email (for NCLEX processing)</p>
                        <p className="font-mono font-semibold text-primary-600 dark:text-primary-400 break-all">{gritsyncEmail}</p>
                      </div>
                    )}
                  </div>
                )}

                <Link to="/dashboard">
                  <Button className="w-full" size="lg">
                    Go to Dashboard
                  </Button>
                </Link>
              </>
            )}

            {status === 'error' && (
              <>
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 mb-6">
                  <XCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
                </div>
                <h1 className="text-2xl font-bold mb-3 text-gray-900 dark:text-gray-100">
                  Verification Failed
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mb-6">{message}</p>
                <div className="flex flex-col gap-3">
                  <Link to="/register">
                    <Button className="w-full">Register Again</Button>
                  </Link>
                  <Link to="/login">
                    <Button variant="outline" className="w-full">Sign In</Button>
                  </Link>
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
