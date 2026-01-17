import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { SEO, generateBreadcrumbSchema } from '@/components/SEO'
import { Eye, EyeOff, Lock, User, Phone, CheckCircle } from 'lucide-react'
import { validatePassword } from '@/lib/utils'

export function Register() {
  const [firstName, setFirstName] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [lastName, setLastName] = useState('')
  const [mobile, setMobile] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<{ gritId: string; gritsyncEmail: string } | null>(null)
  const { signUp } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!firstName.trim()) {
      setError('First name is required')
      return
    }

    if (firstName.trim().length < 2) {
      setError('First name must be at least 2 characters')
      return
    }

    if (!lastName.trim()) {
      setError('Last name is required')
      return
    }

    if (lastName.trim().length < 2) {
      setError('Last name must be at least 2 characters')
      return
    }

    if (!mobile.trim()) {
      setError('Mobile number is required')
      return
    }

    const mobileClean = mobile.replace(/\s+/g, '').replace(/[^0-9+]/g, '')
    if (mobileClean.length < 10) {
      setError('Please enter a valid mobile number')
      return
    }

    const passwordValidation = await validatePassword(password)
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
      await signUp({
        first_name: firstName.trim(),
        middle_name: middleName.trim() || null,
        last_name: lastName.trim(),
        mobile: mobileClean,
        password,
        role: 'client',
      })
      showToast('Account created successfully!', 'success')
      navigate('/dashboard')
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to create account'
      setError(errorMessage)
      showToast(errorMessage, 'error')
    } finally {
      setLoading(false)
    }
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const currentUrl = typeof window !== 'undefined' ? window.location.href : ''
  const breadcrumbs = [
    { name: 'Home', url: baseUrl },
    { name: 'Register', url: currentUrl },
  ]

  return (
    <div 
      className="min-h-screen relative"
      style={{
        background: `
          radial-gradient(circle at 80% 80%, rgba(185, 28, 28, 0.15) 0%, transparent 50%),
          radial-gradient(circle at 20% 20%, rgba(220, 38, 38, 0.1) 0%, transparent 50%),
          radial-gradient(circle at 60% 60%, rgba(239, 68, 68, 0.08) 0%, transparent 40%),
          linear-gradient(135deg, #fef2f2 0%, #fee2e2 25%, #fecaca 50%, #fca5a5 75%, #f87171 100%)
        `
      }}
    >
      <SEO
        title="Register - Create Your GritSync Account | NCLEX Processing Agency"
        description="Create your free GritSync account to start processing your NCLEX applications. Get instant quotes, track applications, and manage documents. No credit card required."
        keywords="register, sign up, create account, NCLEX account, nursing application registration, GritSync registration"
        canonicalUrl={currentUrl}
        ogTitle="Register - Create Your GritSync Account | NCLEX Processing Agency"
        ogDescription="Create your free GritSync account to start processing your NCLEX applications. No credit card required."
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
      <main className="container mx-auto px-3 sm:px-4 py-6 sm:py-12 flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <Card className="w-full max-w-sm sm:max-w-md border-0 shadow-xl">
          <div className="p-4 sm:p-6">
            <div className="text-center mb-4 sm:mb-6">
              <div className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 mb-3">
                <User className="h-5 w-5 sm:h-6 sm:w-6 text-primary-600 dark:text-primary-400" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold mb-1 text-gray-900 dark:text-gray-100">
                Create Account
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Sign up with your mobile number
              </p>
            </div>

            {error && (
              <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:gap-4">
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
                  label="Middle Name (Optional)"
                  type="text"
                  value={middleName}
                  onChange={(e) => setMiddleName(e.target.value)}
                  placeholder="Santos"
                  className="pl-10"
                />
                <div className="absolute left-3 top-[38px] text-gray-400 pointer-events-none">
                  <User className="h-5 w-5" />
                </div>
              </div>

              <div className="relative">
                <Input
                  label="Mobile Number"
                  type="tel"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  required
                  autoComplete="tel"
                  placeholder="09171234567"
                  className="pl-10"
                />
                <div className="absolute left-3 top-[38px] text-gray-400 pointer-events-none">
                  <Phone className="h-5 w-5" />
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  <strong>Note:</strong> Your GritSync ID and GritSync email will be automatically generated after registration.
                </p>
              </div>

              <div className="relative">
                <Input
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="Min. 8 characters"
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
                  autoComplete="new-password"
                  placeholder="Re-enter password"
                  className="pl-10"
                  rightIcon={showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  onRightIconClick={() => setShowConfirmPassword(!showConfirmPassword)}
                />
                <div className="absolute left-3 top-[38px] text-gray-400 pointer-events-none">
                  <Lock className="h-5 w-5" />
                </div>
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

            <div className="mt-4 sm:mt-5">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300 dark:border-gray-700"></div>
                </div>
                <div className="relative flex justify-center text-xs sm:text-sm">
                  <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                    Already have an account?
                  </span>
                </div>
              </div>
              <p className="mt-4 text-center text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                <Link
                  to="/login"
                  className="font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-500 dark:hover:text-primary-300 transition-colors"
                >
                  Sign in instead
                </Link>
              </p>
            </div>
          </div>
        </Card>
      </main>
      <Footer />
    </div>
  )
}
