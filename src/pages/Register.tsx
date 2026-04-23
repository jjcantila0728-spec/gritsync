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
import { Eye, EyeOff, Mail, Lock, User } from 'lucide-react'
import { isValidEmail, validatePassword } from '@/lib/utils'

export function Register() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signUp } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validation
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

    if (!email.trim()) {
      setError('Email is required')
      return
    }

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address')
      return
    }

    // Email validation will be done in signUp, but we can add a check here too
    // The actual check happens in AuthContext.signUp before attempting registration

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
      await signUp(firstName, lastName, email, password, 'client')
      showToast('Account created successfully! Welcome!', 'success')
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
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
                    placeholder="John"
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
                    placeholder="Doe"
                    className="pl-10"
                  />
                  <div className="absolute left-3 top-[38px] text-gray-400 pointer-events-none">
                    <User className="h-5 w-5" />
                  </div>
                </div>
              </div>

              <div className="relative">
                <Input
                  label="Email Address"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="john.doe@example.com"
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
                  error={error}
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
                  'Sign Up'
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
                    Already have an account?
                  </span>
                </div>
              </div>
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
          </div>
        </Card>
      </main>
      <Footer />
    </div>
  )
}
