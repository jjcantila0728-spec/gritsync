import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'
import { SEO, generateBreadcrumbSchema } from '@/components/SEO'
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { isValidEmail } from '@/lib/utils'

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const { requestPasswordReset } = useAuth()
  const { showToast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
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
      setSent(true)
      showToast('Password reset instructions sent to your email', 'success')
    } catch (error: any) {
      showToast(error.message || 'Failed to send reset email', 'error')
    } finally {
      setLoading(false)
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
        description="Reset your GritSync account password. Enter your email address to receive password reset instructions. Secure password recovery for your NCLEX application account."
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
            {!sent ? (
              <>
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 mb-4">
                    <Mail className="h-8 w-8 text-primary-600 dark:text-primary-400" />
                  </div>
                  <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-gray-100">
                    Forgot Password?
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400">
                    Enter your email address and we'll send you instructions to reset your password
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
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
                      'Send Reset Instructions'
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
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
                  <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <h1 className="text-2xl font-bold mb-2 text-gray-900 dark:text-gray-100">
                  Check Your Email
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  We've sent password reset instructions to <strong>{email}</strong>. Please check your inbox and follow the instructions.
                </p>
                <div className="space-y-3">
                  <Link to="/login">
                    <Button variant="outline" className="w-full">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back to Login
                    </Button>
                  </Link>
                  <button
                    onClick={() => {
                      setSent(false)
                      setEmail('')
                    }}
                    className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    Didn't receive the email? Try again
                  </button>
                </div>
              </div>
            )}
          </div>
        </Card>
      </main>
      <Footer />
    </div>
  )
}

