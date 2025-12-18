import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useToast } from '@/components/ui/Toast'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { CheckCircle, Home, Heart, Sparkles, Share2, Download, ArrowRight, Gift, TrendingUp } from 'lucide-react'
import { donationsAPI } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { sendDonationReceipt } from '@/lib/email-service'

export function DonateSuccess() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [donationId, setDonationId] = useState<string | null>(null)
  const [donationAmount, setDonationAmount] = useState<number | null>(null)
  const [donationDetails, setDonationDetails] = useState<any>(null)

  useEffect(() => {
    const sessionId = searchParams.get('session_id')
    const donationIdParam = searchParams.get('donation_id')

    // session_id is optional - payment intent ID works too
    if (!donationIdParam) {
      showToast('Invalid donation session', 'error')
      navigate('/donate')
      return
    }

    setDonationId(donationIdParam)

    // Try to get donation details (works for anonymous users via service role in edge function)
    const loadDonation = async () => {
      try {
        let donation: any = null
        
        // Try to get donation details - if it fails (anonymous), that's okay
        try {
          donation = await donationsAPI.getById(donationIdParam)
          if (donation) {
            setDonationAmount(donation.amount)
            setDonationDetails(donation)
          }
        } catch {
          // If getById fails (anonymous user), try to get amount from URL or just show success
          const amountParam = searchParams.get('amount')
          if (amountParam) {
            setDonationAmount(parseFloat(amountParam))
          }
        }

        // Update donation status to completed (this might fail for anonymous, that's okay)
        try {
          await donationsAPI.updateStatus(donationIdParam, 'completed')
        } catch (updateError) {
          console.error('Error updating donation status:', updateError)
          // Don't fail - payment was successful
        }

        // Send donation receipt email if email is available
        if (donation?.donor_email && !donation?.is_anonymous) {
          try {
            await sendDonationReceipt(donation.donor_email, {
              donorName: donation.donor_name,
              donationId: donationIdParam,
              amount: donation.amount,
              donationDate: donation.created_at || new Date().toISOString(),
              isAnonymous: donation.is_anonymous,
              message: donation.message,
            })
          } catch (emailError) {
            console.error('Error sending donation receipt email:', emailError)
            // Don't fail - email is optional
          }
        }
      } catch (error: any) {
        console.error('Error loading donation:', error)
        // Don't show error to user - payment was successful
      } finally {
        setLoading(false)
      }
    }

    loadDonation()
  }, [searchParams, navigate, showToast])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
        <Header />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full mb-4 animate-pulse">
              <Heart className="h-8 w-8 text-primary-600 dark:text-primary-400" />
            </div>
            <p className="text-gray-600 dark:text-gray-400">Processing your donation...</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <Header />
      <main className="flex-1">
        {/* Success Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-br from-green-50 via-emerald-50 to-green-100 dark:from-green-900/20 dark:via-emerald-900/20 dark:to-green-800/20">
          <div className="absolute inset-0 bg-grid-green/[0.05] bg-[size:20px_20px]"></div>
          <div className="container mx-auto px-4 py-12 md:py-16 relative z-10">
            <div className="max-w-3xl mx-auto text-center">
              <div className="inline-flex items-center justify-center w-24 h-24 bg-green-600 rounded-full mb-6 shadow-2xl animate-bounce">
                <CheckCircle className="h-12 w-12 text-white" strokeWidth={3} />
              </div>
              
              <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-sm font-medium mb-6 border border-green-200 dark:border-green-800">
                <Sparkles className="h-4 w-4" />
                <span>Donation Successful!</span>
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-gray-900 dark:text-gray-100">
                Thank You for Your
                <span className="block text-green-600 dark:text-green-400 mt-2">Generous Donation!</span>
              </h1>
              
              {donationAmount && (
                <div className="inline-block px-6 py-3 bg-white dark:bg-gray-800 rounded-xl shadow-lg mb-6 border-2 border-green-200 dark:border-green-800">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Your Donation</p>
                  <p className="text-3xl md:text-4xl font-bold text-green-600 dark:text-green-400">
                    {formatCurrency(donationAmount)}
                  </p>
                </div>
              )}

              <p className="text-xl md:text-2xl text-gray-700 dark:text-gray-300 mb-8 max-w-2xl mx-auto leading-relaxed">
                Your contribution is making a real difference. You're helping nurses achieve their USRN dreams and transform their careers.
              </p>
            </div>
          </div>
        </section>

        {/* Content Section */}
        <div className="container mx-auto px-4 py-8 md:py-12 max-w-6xl">
          <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">
            {/* Main Success Card */}
            <div className="lg:col-span-2">
              <Card className="p-6 md:p-8 border-2 border-green-200 dark:border-green-800 shadow-xl">
                <div className="text-center mb-8">
                  <div className="flex items-center justify-center gap-3 mb-4">
                    <Heart className="h-6 w-6 text-green-600 dark:text-green-400" fill="currentColor" />
                    <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      Payment Processed Successfully
                    </span>
                  </div>
                  
                  {donationId && (
                    <div className="inline-block px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg mb-4">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Donation ID</p>
                      <p className="text-sm font-mono text-gray-900 dark:text-gray-100">{donationId.substring(0, 8)}...</p>
                    </div>
                  )}

                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    A confirmation email has been sent to your email address. 
                    Please keep this page for your records.
                  </p>
                </div>

                {/* Impact Message */}
                <div className="bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 rounded-xl p-6 mb-6 border border-primary-200 dark:border-primary-800">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-primary-600 rounded-lg flex-shrink-0">
                      <TrendingUp className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100 mb-2">
                        Your Impact
                      </h3>
                      <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                        Your donation directly funds NCLEX exam fees and processing costs, removing financial barriers for aspiring nurses. 
                        Every dollar brings someone closer to achieving their USRN certification and starting their dream career.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                  <Button
                    onClick={() => navigate('/donate')}
                    className="w-full h-12 text-base font-semibold"
                    size="lg"
                  >
                    <Gift className="h-5 w-5 mr-2" />
                    Make Another Donation
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Button>
                  <Button
                    onClick={() => navigate('/')}
                    variant="outline"
                    className="w-full h-12 text-base"
                    size="lg"
                  >
                    <Home className="h-5 w-5 mr-2" />
                    Return to Home
                  </Button>
                </div>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1 space-y-6">
              {/* What Happens Next */}
              <Card className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-2 border-blue-200 dark:border-blue-800">
                <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  What Happens Next?
                </h3>
                <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 flex-shrink-0"></div>
                    <span>Your donation is processed instantly</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 flex-shrink-0"></div>
                    <span>Funds go directly to supporting nurses</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 flex-shrink-0"></div>
                    <span>You'll receive a confirmation email</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 flex-shrink-0"></div>
                    <span>Your donation may be tax-deductible</span>
                  </div>
                </div>
              </Card>

              {/* Share Card */}
              <Card className="p-6 border-2 border-gray-200 dark:border-gray-700">
                <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                  <Share2 className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                  Spread the Word
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Help more nurses by sharing your donation experience!
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    const text = `I just donated to help nurses achieve their USRN dreams! Join me in making a difference: ${window.location.origin}/donate`
                    if (navigator.share) {
                      navigator.share({ text, url: `${window.location.origin}/donate` })
                    } else {
                      navigator.clipboard.writeText(text)
                      showToast('Link copied to clipboard!', 'success')
                    }
                  }}
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Share Your Impact
                </Button>
              </Card>

              {/* Support Card */}
              <Card className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-2 border-purple-200 dark:border-purple-800">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-600 rounded-full mb-3">
                    <Heart className="h-6 w-6 text-white" fill="currentColor" />
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-2">
                    Thank You Again!
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Your generosity is changing lives. We're grateful for your support.
                  </p>
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

