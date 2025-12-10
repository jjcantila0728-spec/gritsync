import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { donationsAPI } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { SEO, generateBreadcrumbSchema, generateServiceSchema } from '@/components/SEO'
import { Heart, DollarSign, Users, CheckCircle, Shield, Lock, TrendingUp, Sparkles, Star, ArrowRight, Gift, Loader2 } from 'lucide-react'
import { AppError, ErrorType } from '@/lib/error-handler'

export function Donate() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)

  // Form fields
  const [amount, setAmount] = useState('')
  const [donorName, setDonorName] = useState('')
  const [donorEmail, setDonorEmail] = useState('')
  const [donorPhone, setDonorPhone] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [message, setMessage] = useState('')
  const [sponsorshipId, setSponsorshipId] = useState<string | null>(null)
  const [publicStats, setPublicStats] = useState<{ total: number; count: number } | null>(null)

  // Predefined amounts
  const presetAmounts = [25, 50, 100, 250, 500, 1000]

  // Load public donation statistics
  useEffect(() => {
    const loadStats = async () => {
      try {
        const stats = await donationsAPI.getPublicStats()
        setPublicStats(stats)
      } catch (error) {
        console.error('Error loading donation stats:', error)
        // Don't show error - stats are optional
      }
    }
    loadStats()
  }, [])

  // Check if checkout was canceled
  useEffect(() => {
    const canceled = searchParams.get('canceled')
    if (canceled === 'true') {
      showToast('Donation was canceled. You can try again anytime.', 'info')
      // Clean up URL
      navigate('/donate', { replace: true })
    }
  }, [searchParams, navigate, showToast])

  // Load user info if logged in
  useEffect(() => {
    if (user) {
      setDonorEmail(user.email || '')
      // Try to load user details
      const loadUserDetails = async () => {
        try {
          const { data } = await (await import('@/lib/supabase')).supabase
            .from('users')
            .select('first_name, last_name')
            .eq('id', user.id)
            .single()
          
          if (data) {
            const fullName = [data.first_name, data.last_name].filter(Boolean).join(' ')
            if (fullName) setDonorName(fullName)
          }
        } catch (error) {
          // Ignore errors
        }
      }
      loadUserDetails()
    }
  }, [user])

  const validateForm = (): boolean => {
    if (!amount || parseFloat(amount) <= 0) {
      showToast('Please enter a valid donation amount', 'error')
      return false
    }
    if (!isAnonymous) {
      if (!donorName.trim()) {
        showToast('Please enter your name', 'error')
        return false
      }
      if (!donorEmail.trim()) {
        showToast('Please enter your email', 'error')
        return false
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(donorEmail)) {
        showToast('Please enter a valid email address', 'error')
        return false
      }
    }
    return true
  }

  const handlePresetAmount = (preset: number) => {
    setAmount(preset.toString())
  }

  const handleCreateDonation = async () => {
    if (!validateForm()) return

    setLoading(true)
    let createdDonationId: string | null = null
    
    try {
      // Create donation record
      const donationData = {
        donor_name: isAnonymous ? null : donorName.trim(),
        donor_email: isAnonymous ? null : donorEmail.trim(),
        donor_phone: isAnonymous ? null : donorPhone.trim() || null,
        is_anonymous: isAnonymous,
        amount: parseFloat(amount),
        currency: 'USD',
        status: 'pending' as const,
        message: message.trim() || null,
        sponsorship_id: sponsorshipId || null,
      }

      const donation = await donationsAPI.create(donationData)
      createdDonationId = donation.id

      // Navigate to checkout page
      navigate(`/donate/checkout?donation_id=${donation.id}&amount=${parseFloat(amount)}`)
    } catch (error: any) {
      console.error('Error creating donation:', error)
      
      // Determine user-friendly error message
      let errorMessage = 'Failed to create donation. Please try again.'
      
      // Handle AppError instances with better context
      if (error instanceof AppError) {
        const errorMsg = error.message.toLowerCase()
        
        // Use error type to determine message
        switch (error.type) {
          case ErrorType.NETWORK:
            errorMessage = 'Connection error. Please check your internet connection and try again.'
            break
          case ErrorType.TIMEOUT:
            errorMessage = 'Request timed out. Please try again.'
            break
          case ErrorType.VALIDATION:
            errorMessage = error.message || 'Please check your donation details and try again.'
            break
          case ErrorType.SERVER:
            errorMessage = 'Server error. Please try again in a moment.'
            break
          case ErrorType.AUTHENTICATION:
          case ErrorType.AUTHORIZATION:
            errorMessage = 'Authentication error. Please refresh the page and try again.'
            break
          case ErrorType.RATE_LIMIT:
            errorMessage = 'Too many requests. Please wait a moment and try again.'
            break
          default:
            // Use the error message if it's user-friendly
            if (error.message && error.message.length < 150 && !error.message.includes('at ')) {
              errorMessage = error.message
            }
        }
      } else if (error?.message) {
        const errorMsg = error.message.toLowerCase()
        
        // Network errors
        if (errorMsg.includes('network') || errorMsg.includes('fetch') || errorMsg.includes('connection')) {
          errorMessage = 'Connection error. Please check your internet connection and try again.'
        }
        // Timeout errors
        else if (errorMsg.includes('timeout')) {
          errorMessage = 'Request timed out. Please try again.'
        }
        // Validation errors
        else if (errorMsg.includes('invalid') || errorMsg.includes('validation') || errorMsg.includes('required')) {
          errorMessage = error.message || 'Please check your donation details and try again.'
        }
        // Amount errors
        else if (errorMsg.includes('amount') || errorMsg.includes('minimum')) {
          errorMessage = error.message || 'Please enter a valid donation amount (minimum $0.50).'
        }
        // Server errors
        else if (errorMsg.includes('server') || errorMsg.includes('500') || errorMsg.includes('503')) {
          errorMessage = 'Server error. Please try again in a moment.'
        }
        // Stripe/checkout errors
        else if (errorMsg.includes('stripe') || errorMsg.includes('checkout') || errorMsg.includes('payment')) {
          errorMessage = 'Payment processing error. Please try again or contact support if the issue persists.'
        }
        // Use the error message if it's user-friendly
        else if (error.message.length < 150 && !error.message.includes('Error:') && !error.message.includes('at ')) {
          errorMessage = error.message
        }
      }
      
      // If donation was created but checkout failed, we could optionally clean it up
      // For now, we'll leave it as 'pending' so it can be retried
      
      showToast(errorMessage, 'error')
      setLoading(false)
    }
  }


  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const currentUrl = typeof window !== 'undefined' ? window.location.href : ''
  const breadcrumbs = [
    { name: 'Home', url: baseUrl },
    { name: 'Donate', url: currentUrl },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <SEO
        title="Donate - Support NCLEX Sponsorships | GritSync"
        description="Support aspiring nurses by donating to NCLEX sponsorships. Help nurses achieve their dreams of becoming licensed nurses in the United States. Secure donations with multiple payment options."
        keywords="donate, NCLEX sponsorship, nursing support, healthcare donation, nursing education, NCLEX funding"
        canonicalUrl={currentUrl}
        ogTitle="Donate - Support NCLEX Sponsorships | GritSync"
        ogDescription="Support aspiring nurses by donating to NCLEX sponsorships. Help nurses achieve their dreams of becoming licensed nurses in the United States."
        ogImage={`${baseUrl}/gritsync_logo.png`}
        ogUrl={currentUrl}
        structuredData={[
          generateBreadcrumbSchema(breadcrumbs),
          generateServiceSchema('NCLEX Sponsorship Donation', 'Support aspiring nurses by donating to NCLEX sponsorships through GritSync'),
          {
            '@context': 'https://schema.org',
            '@type': 'DonateAction',
            target: {
              '@type': 'Organization',
              name: 'GritSync',
            },
            object: {
              '@type': 'Service',
              name: 'NCLEX Sponsorship',
            },
          },
        ]}
      />
      <Header />
      <main className="flex-1">
        {/* Hero Banner Section */}
        <section className="relative overflow-hidden bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 dark:from-primary-800 dark:via-primary-900 dark:to-primary-950 text-white">
          <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-primary-900/50 to-transparent"></div>
          <div className="container mx-auto px-4 py-16 md:py-24 relative z-10">
            <div className="max-w-4xl mx-auto text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full mb-6 animate-pulse">
                <Heart className="h-10 w-10 text-white" fill="currentColor" />
              </div>
              <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/20 backdrop-blur-sm text-white text-sm font-medium mb-6 border border-white/30">
                <Sparkles className="h-4 w-4" />
                <span>Transform Lives Today</span>
              </div>
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
                Help Nurses Achieve Their
                <span className="block text-yellow-300 mt-2">USRN Dreams</span>
              </h1>
              <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-3xl mx-auto leading-relaxed">
                Your donation removes financial barriers and opens doors for aspiring nurses. 
                <span className="block mt-2 font-semibold">Every dollar brings someone closer to their dream career.</span>
              </p>
              
              {/* Impact Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mt-12 max-w-3xl mx-auto">
                {publicStats && publicStats.total > 0 && (
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                    <div className="text-2xl md:text-3xl font-bold text-yellow-300 mb-1">
                      {formatCurrency(publicStats.total)}
                    </div>
                    <div className="text-xs md:text-sm text-white/80">Total Raised</div>
                  </div>
                )}
                {publicStats && publicStats.count > 0 && (
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                    <div className="text-2xl md:text-3xl font-bold text-yellow-300 mb-1">
                      {publicStats.count.toLocaleString()}
                    </div>
                    <div className="text-xs md:text-sm text-white/80">Donations</div>
                  </div>
                )}
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                  <div className="text-2xl md:text-3xl font-bold text-yellow-300 mb-1">100%</div>
                  <div className="text-xs md:text-sm text-white/80">Direct Impact</div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                  <div className="text-2xl md:text-3xl font-bold text-yellow-300 mb-1">$0</div>
                  <div className="text-xs md:text-sm text-white/80">Hidden Fees</div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                  <div className="text-2xl md:text-3xl font-bold text-yellow-300 mb-1">Secure</div>
                  <div className="text-xs md:text-sm text-white/80">Stripe Protected</div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                  <div className="text-2xl md:text-3xl font-bold text-yellow-300 mb-1">Fast</div>
                  <div className="text-xs md:text-sm text-white/80">Instant Processing</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Content Section */}
        <div className="p-4 sm:p-6 md:p-8 lg:p-10 max-w-7xl mx-auto">
          
          {/* Trust & Benefits Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-10">
            <Card className="p-5 text-center border-2 border-primary-200 dark:border-primary-800 hover:shadow-lg transition-shadow">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/20 rounded-full mb-4">
                <Users className="h-7 w-7 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-bold mb-2 text-gray-900 dark:text-gray-100">Direct Impact</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                100% of your donation goes directly to helping nurses
              </p>
            </Card>
            <Card className="p-5 text-center border-2 border-green-200 dark:border-green-800 hover:shadow-lg transition-shadow">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/30 dark:to-green-800/20 rounded-full mb-4">
                <TrendingUp className="h-7 w-7 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-bold mb-2 text-gray-900 dark:text-gray-100">Life Changing</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Transform careers and futures with your contribution
              </p>
            </Card>
            <Card className="p-5 text-center border-2 border-purple-200 dark:border-purple-800 hover:shadow-lg transition-shadow">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/30 dark:to-purple-800/20 rounded-full mb-4">
                <Shield className="h-7 w-7 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-lg font-bold mb-2 text-gray-900 dark:text-gray-100">Secure & Safe</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Bank-level encryption via Stripe payment processing
              </p>
            </Card>
            <Card className="p-5 text-center border-2 border-yellow-200 dark:border-yellow-800 hover:shadow-lg transition-shadow">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-yellow-100 to-yellow-200 dark:from-yellow-900/30 dark:to-yellow-800/20 rounded-full mb-4">
                <Gift className="h-7 w-7 text-yellow-600 dark:text-yellow-400" />
              </div>
              <h3 className="text-lg font-bold mb-2 text-gray-900 dark:text-gray-100">Tax Deductible</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Your donation may be eligible for tax deductions
              </p>
            </Card>
          </div>

          {/* Two Column Layout: Form + Social Proof */}
          <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">
            {/* Donation Form - Takes 2 columns */}
            <div className="lg:col-span-2">
              <Card className="border-2 border-primary-200 dark:border-primary-800 shadow-xl">
                <div className="p-6 md:p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/30 dark:to-primary-800/20 rounded-xl">
                      <Heart className="h-6 w-6 text-primary-600 dark:text-primary-400" fill="currentColor" />
                    </div>
                    <div>
                      <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
                        Make Your Donation
                      </h2>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Quick, secure, and impactful
                      </p>
                    </div>
                  </div>

                  <div className="space-y-6">
              {/* Amount */}
              <div>
                <label className="block text-base font-semibold mb-3 text-gray-900 dark:text-gray-100">
                  Choose Your Donation Amount <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
                  {presetAmounts.map((preset) => (
                    <Button
                      key={preset}
                      type="button"
                      variant={amount === preset.toString() ? 'default' : 'outline'}
                      onClick={() => handlePresetAmount(preset)}
                      className={`w-full h-12 font-semibold transition-all ${
                        amount === preset.toString() 
                          ? 'scale-105 shadow-lg' 
                          : 'hover:scale-105 hover:border-primary-400'
                      }`}
                    >
                      ${preset}
                    </Button>
                  ))}
                </div>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 font-semibold">
                    $
                  </div>
                  <Input
                    type="number"
                    min="0.50"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Or enter custom amount"
                    className="pl-8 h-12 text-lg"
                  />
                </div>
                {amount && parseFloat(amount) > 0 && (
                  <div className="mt-3 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Your donation:</span>
                      <span className="text-xl font-bold text-primary-600 dark:text-primary-400">
                        {formatCurrency(parseFloat(amount))}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Anonymous toggle */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="anonymous"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                />
                <label htmlFor="anonymous" className="text-sm text-gray-700 dark:text-gray-300">
                  Donate anonymously
                </label>
              </div>

              {/* Donor Information (if not anonymous) */}
              {!isAnonymous && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={donorName}
                      onChange={(e) => setDonorName(e.target.value)}
                      placeholder="Enter your name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="email"
                      value={donorEmail}
                      onChange={(e) => setDonorEmail(e.target.value)}
                      placeholder="Enter your email"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      Phone (Optional)
                    </label>
                    <Input
                      type="tel"
                      value={donorPhone}
                      onChange={(e) => setDonorPhone(e.target.value)}
                      placeholder="Enter your phone number"
                    />
                  </div>
                </>
              )}

              {/* Message */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Message (Optional)
                </label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Leave a message of encouragement..."
                  rows={4}
                />
              </div>

              {/* Submit Button */}
              <div className="space-y-4">
                <Button
                  type="button"
                  onClick={handleCreateDonation}
                  disabled={loading || !amount || parseFloat(amount) <= 0}
                  className="w-full h-14 text-lg font-bold relative overflow-hidden group shadow-lg hover:shadow-xl transition-all"
                  size="lg"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-primary-600 to-primary-700 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="relative flex items-center justify-center gap-3">
                    {loading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Processing...</span>
                      </>
                    ) : (
                      <>
                        <Heart className="h-5 w-5" fill="currentColor" />
                        <span>Continue to Secure Payment</span>
                        {amount && parseFloat(amount) > 0 && (
                          <span className="ml-2 px-3 py-1 bg-white/20 rounded-full font-bold">
                            {formatCurrency(parseFloat(amount))}
                          </span>
                        )}
                        <ArrowRight className="h-5 w-5" />
                      </>
                    )}
                  </div>
                </Button>
                
                {/* Trust Indicators */}
                <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-gray-600 dark:text-gray-400 pt-2">
                  <div className="flex items-center gap-1.5">
                    <Lock className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <span>SSL Secured</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Shield className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                    <span>Stripe Protected</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <span>No Hidden Fees</span>
                  </div>
                </div>
              </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Sidebar - Social Proof & Impact */}
            <div className="lg:col-span-1 space-y-6">
              {/* Impact Card */}
              <Card className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-2 border-green-200 dark:border-green-800">
                <div className="text-center mb-4">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-green-600 rounded-full mb-3 shadow-lg">
                    <Sparkles className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                    Your Impact
                  </h3>
                </div>
                <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                    <span>Funds NCLEX exam fees directly</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                    <span>Removes financial barriers</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                    <span>Opens career opportunities</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                    <span>Changes lives forever</span>
                  </div>
                </div>
              </Card>

              {/* Testimonial/Trust Card */}
              <Card className="p-6 bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 border-2 border-primary-200 dark:border-primary-800">
                <div className="flex items-center gap-2 mb-3">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 text-yellow-500 fill-current" />
                  ))}
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 italic mb-4">
                  "Every donation makes a real difference. You're not just giving money - you're giving someone their dream career."
                </p>
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-primary-200 dark:bg-primary-800 flex items-center justify-center">
                    <Users className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">GritSync Community</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Trusted by donors</div>
                  </div>
                </div>
              </Card>

              {/* Quick Facts */}
              <Card className="p-6 border-2 border-gray-200 dark:border-gray-700">
                <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                  Why Donate?
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary-600 mt-1.5 flex-shrink-0"></div>
                    <span className="text-gray-700 dark:text-gray-300">100% of funds go directly to nurses</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary-600 mt-1.5 flex-shrink-0"></div>
                    <span className="text-gray-700 dark:text-gray-300">No administrative fees</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary-600 mt-1.5 flex-shrink-0"></div>
                    <span className="text-gray-700 dark:text-gray-300">Secure payment processing</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary-600 mt-1.5 flex-shrink-0"></div>
                    <span className="text-gray-700 dark:text-gray-300">Instant confirmation</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

