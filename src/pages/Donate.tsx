import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Elements } from '@stripe/react-stripe-js'
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
import { stripePromise } from '@/lib/stripe'
import { StripePaymentForm } from '@/components/StripePaymentForm'
import { Modal } from '@/components/ui/Modal'
import { SEO, generateBreadcrumbSchema, generateServiceSchema } from '@/components/SEO'
import { Heart, DollarSign, Users, CheckCircle } from 'lucide-react'

export function Donate() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null)
  const [donationId, setDonationId] = useState<string | null>(null)

  // Form fields
  const [amount, setAmount] = useState('')
  const [donorName, setDonorName] = useState('')
  const [donorEmail, setDonorEmail] = useState('')
  const [donorPhone, setDonorPhone] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [message, setMessage] = useState('')
  const [sponsorshipId, setSponsorshipId] = useState<string | null>(null)

  // Predefined amounts
  const presetAmounts = [25, 50, 100, 250, 500, 1000]

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
      setDonationId(donation.id)

      // Create payment intent
      const paymentData = await donationsAPI.createPaymentIntent(donation.id, parseFloat(amount))
      setClientSecret(paymentData.client_secret)
      setPaymentIntentId(paymentData.payment_intent_id)
      setShowPaymentModal(true)
    } catch (error: any) {
      console.error('Error creating donation:', error)
      showToast(error.message || 'Failed to create donation', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handlePaymentSuccess = async (paymentIntentId: string) => {
    if (!donationId) return

    try {
      // Update donation status
      await donationsAPI.updateStatus(donationId, 'completed')
      showToast('Thank you for your donation! Your contribution helps nurses achieve their USRN dreams.', 'success')
      setShowPaymentModal(false)
      
      // Reset form
      setAmount('')
      setDonorName('')
      setDonorEmail(user?.email || '')
      setDonorPhone('')
      setIsAnonymous(false)
      setMessage('')
      setDonationId(null)
      setClientSecret(null)
      setPaymentIntentId(null)
    } catch (error: any) {
      showToast('Payment succeeded but failed to update donation record', 'error')
    }
  }

  const handlePaymentError = (error: string) => {
    showToast(error, 'error')
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
        {/* Banner Section */}
        <section className="relative overflow-hidden bg-gradient-to-br from-primary-50 via-white to-primary-50 dark:from-gray-900 dark:via-gray-900 dark:to-primary-900/20">
          <div className="container mx-auto px-4 py-12 md:py-16">
            <div className="max-w-4xl mx-auto text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full mb-6">
                <Heart className="h-8 w-8 text-primary-600 dark:text-primary-400" />
              </div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-sm font-medium mb-6">
                <Heart className="h-4 w-4" />
                <span>Make a Difference</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900 dark:text-gray-100">
                Support Nurses' USRN Dreams
              </h1>
              <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto">
                Your donation helps nurses overcome financial barriers and achieve their goal of becoming a USRN. 
                Every contribution makes a difference in someone's journey.
              </p>
            </div>
          </div>
        </section>

        {/* Content Section */}
        <div className="p-6 md:p-8 lg:p-10 max-w-4xl mx-auto">

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card className="p-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-4">
              <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">Help Nurses</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Support aspiring nurses in their journey to become USRNs
            </p>
          </Card>
          <Card className="p-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full mb-4">
              <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">Make an Impact</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Your contribution directly funds NCLEX exam fees and processing costs
            </p>
          </Card>
          <Card className="p-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full mb-4">
              <CheckCircle className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">Secure & Safe</h3>
            <p className="text-gray-600 dark:text-gray-400">
              All donations are processed securely through Stripe
            </p>
          </Card>
        </div>

        <Card>
          <div className="p-6">
            <h2 className="text-2xl font-semibold mb-6 text-gray-900 dark:text-gray-100">Make a Donation</h2>
            
            <div className="space-y-6">
              {/* Amount */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Donation Amount (USD) <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-3">
                  {presetAmounts.map((preset) => (
                    <Button
                      key={preset}
                      type="button"
                      variant={amount === preset.toString() ? 'default' : 'outline'}
                      onClick={() => handlePresetAmount(preset)}
                      className="w-full"
                    >
                      ${preset}
                    </Button>
                  ))}
                </div>
                <Input
                  type="number"
                  min="1"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter custom amount"
                />
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
              <Button
                type="button"
                onClick={handleCreateDonation}
                disabled={loading || !amount || parseFloat(amount) <= 0}
                className="w-full"
                size="lg"
              >
                {loading ? 'Processing...' : `Donate ${amount ? formatCurrency(parseFloat(amount)) : ''}`}
              </Button>
            </div>
          </div>
        </Card>

        {/* Payment Modal */}
        {showPaymentModal && clientSecret && stripePromise && (
          <Modal
            isOpen={showPaymentModal}
            onClose={() => {
              setShowPaymentModal(false)
              setClientSecret(null)
              setPaymentIntentId(null)
            }}
            title={`Complete Donation - ${formatCurrency(parseFloat(amount))}`}
            size="lg"
          >
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <StripePaymentForm
                paymentIntentId={paymentIntentId || undefined}
                amount={parseFloat(amount)}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
              />
            </Elements>
          </Modal>
        )}
        </div>
      </main>
      <Footer />
    </div>
  )
}

