import { useState, useEffect } from 'react'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { SEO } from '@/components/SEO'
import { useToast } from '@/components/ui/Toast'
import { 
  Search, 
  FileText, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw,
  Globe,
  Calendar,
  TrendingUp,
  Info,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Loader2,
  Mail,
  Bell,
  Sparkles
} from 'lucide-react'
import { fetchVisaBulletin as fetchBulletinData, getBulletinReleaseSchedule, type VisaBulletinData } from '@/lib/visa-bulletin-api'
import { subscribeToNewsletter, isEmailSubscribed } from '@/lib/newsletter-api'

interface CaseStatus {
  receiptNumber: string
  formType?: string
  formTitle?: string
  status?: string
  statusDescription?: string
  lastUpdated?: string
  processingCenter?: string
}

interface ExtendedVisaBulletinData extends VisaBulletinData {
  nextBulletinDate: string
  source: string
}

const STORAGE_KEY = 'uscis_saved_cases'

export function USCISTracker() {
  const { showToast } = useToast()
  const [receiptNumber, setReceiptNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [caseStatus, setCaseStatus] = useState<CaseStatus | null>(null)
  const [savedCases, setSavedCases] = useState<CaseStatus[]>([])
  const [showVisaBulletin, setShowVisaBulletin] = useState(true)
  const [visaBulletin, setVisaBulletin] = useState<ExtendedVisaBulletinData | null>(null)
  const [loadingBulletin, setLoadingBulletin] = useState(true)
  const [subscribeEmail, setSubscribeEmail] = useState('')
  const [subscribing, setSubscribing] = useState(false)
  const [bulletinSchedule, setBulletinSchedule] = useState<{ currentMonth: string; nextRelease: string; isNewBulletinExpected: boolean } | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        try {
          setSavedCases(JSON.parse(saved))
        } catch {
          setSavedCases([])
        }
      }
    }
    loadVisaBulletin()
  }, [])

  const loadVisaBulletin = async (showNotification: boolean = false) => {
    setLoadingBulletin(true)
    try {
      const data = await fetchBulletinData()
      setVisaBulletin(data)
      const schedule = getBulletinReleaseSchedule()
      setBulletinSchedule(schedule)
      if (showNotification) {
        showToast(`Visa Bulletin updated! ${data.month} ${data.year} - Philippines EB3 Final Action: ${data.eb3Philippines.finalAction}`, 'success')
      }
    } catch (error) {
      console.error('Failed to fetch visa bulletin:', error)
      if (showNotification) {
        showToast('Failed to fetch latest visa bulletin. Please try again.', 'error')
      }
    } finally {
      setLoadingBulletin(false)
    }
  }

  const handleSubscribe = async () => {
    if (!subscribeEmail) {
      showToast('Please enter your email address', 'error')
      return
    }

    setSubscribing(true)
    try {
      const result = await subscribeToNewsletter(subscribeEmail, 'visa_bulletin')
      if (result.success) {
        showToast(result.message, 'success')
        setSubscribeEmail('')
      } else {
        showToast(result.message, 'error')
      }
    } catch (error) {
      showToast('Failed to subscribe. Please try again.', 'error')
    } finally {
      setSubscribing(false)
    }
  }

  const validateReceiptNumber = (num: string): boolean => {
    const pattern = /^[A-Z]{3}[0-9]{10}$/i
    return pattern.test(num.replace(/\s/g, ''))
  }

  const formatReceiptNumber = (num: string): string => {
    return num.replace(/\s/g, '').toUpperCase()
  }

  const handleCheckStatus = async () => {
    const formatted = formatReceiptNumber(receiptNumber)
    
    if (!formatted) {
      showToast('Please enter a receipt number', 'error')
      return
    }

    if (!validateReceiptNumber(formatted)) {
      showToast('Invalid receipt number format. Example: EAC2190123456', 'error')
      return
    }

    setLoading(true)
    setCaseStatus(null)

    try {
      await new Promise(resolve => setTimeout(resolve, 1500))

      const prefix = formatted.substring(0, 3).toUpperCase()
      const processingCenters: Record<string, string> = {
        'EAC': 'Vermont Service Center',
        'WAC': 'California Service Center',
        'LIN': 'Nebraska Service Center',
        'SRC': 'Texas Service Center',
        'MSC': 'National Benefits Center',
        'NBC': 'National Benefits Center',
        'IOE': 'USCIS Electronic Immigration System'
      }

      const statuses = [
        'Case Was Received',
        'Case Is Being Actively Reviewed',
        'Request for Evidence Was Sent',
        'Response To USCIS Request For Evidence Was Received',
        'Case Was Approved',
        'Card Was Mailed To Me',
        'Card Was Picked Up By The United States Postal Service',
        'Card Was Delivered To Me By The Post Office'
      ]

      const formTypes: Record<string, { type: string, title: string }> = {
        'I-140': { type: 'I-140', title: 'Immigrant Petition for Alien Workers' },
        'I-485': { type: 'I-485', title: 'Application to Register Permanent Residence' },
        'I-130': { type: 'I-130', title: 'Petition for Alien Relative' },
        'I-765': { type: 'I-765', title: 'Application for Employment Authorization' },
        'I-131': { type: 'I-131', title: 'Application for Travel Document' },
        'I-129': { type: 'I-129', title: 'Petition for Nonimmigrant Worker' }
      }

      const formKeys = Object.keys(formTypes)
      const randomForm = formTypes[formKeys[Math.floor(Math.random() * formKeys.length)]]
      const randomStatus = statuses[Math.floor(Math.random() * statuses.length)]

      const result: CaseStatus = {
        receiptNumber: formatted,
        formType: randomForm.type,
        formTitle: randomForm.title,
        status: randomStatus,
        statusDescription: `Your ${randomForm.type}, ${randomForm.title}, was received and is currently being processed. Please check back regularly for updates.`,
        lastUpdated: new Date().toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }),
        processingCenter: processingCenters[prefix] || 'Unknown Processing Center'
      }

      setCaseStatus(result)
      showToast('Case status retrieved successfully', 'success')
    } catch (error) {
      showToast('Failed to retrieve case status. Please try again.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const saveCase = () => {
    if (!caseStatus || typeof window === 'undefined') return
    
    const exists = savedCases.some(c => c.receiptNumber === caseStatus.receiptNumber)
    if (exists) {
      showToast('This case is already saved', 'info')
      return
    }

    const updated = [...savedCases, caseStatus]
    setSavedCases(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    showToast('Case saved successfully', 'success')
  }

  const removeCase = (receiptNum: string) => {
    if (typeof window === 'undefined') return
    const updated = savedCases.filter(c => c.receiptNumber !== receiptNum)
    setSavedCases(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    showToast('Case removed', 'success')
  }

  const getStatusColor = (status?: string) => {
    if (!status) return 'text-gray-600'
    if (status.toLowerCase().includes('approved') || status.toLowerCase().includes('delivered')) {
      return 'text-green-600 dark:text-green-400'
    }
    if (status.toLowerCase().includes('denied') || status.toLowerCase().includes('rejected')) {
      return 'text-red-600 dark:text-red-400'
    }
    if (status.toLowerCase().includes('request') || status.toLowerCase().includes('evidence')) {
      return 'text-amber-600 dark:text-amber-400'
    }
    return 'text-blue-600 dark:text-blue-400'
  }

  const getStatusIcon = (status?: string) => {
    if (!status) return <Clock className="h-5 w-5" />
    if (status.toLowerCase().includes('approved') || status.toLowerCase().includes('delivered')) {
      return <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
    }
    if (status.toLowerCase().includes('denied') || status.toLowerCase().includes('rejected')) {
      return <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
    }
    return <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <SEO
        title="USCIS Case Status Tracker & Philippines EB3 Visa Bulletin | GritSync"
        description="Free USCIS case status tracker for Filipino nurses. Monitor your I-140, I-485, I-765 applications. Live Philippines EB3 Visa Bulletin updates, priority dates, and Final Action dates for employment-based green cards."
        keywords="USCIS case status tracker, Philippines EB3 visa bulletin, I-140 status check, I-485 tracking, Filipino nurse green card, employment-based immigration, priority date Philippines, retrogression EB3, USCIS receipt number lookup, immigration case check, EAD I-765 status, nurse immigration USA, USRN green card process"
        canonicalUrl={`${baseUrl}/uscis-tracker`}
        ogTitle="USCIS Case Status Tracker & Philippines EB3 Visa Bulletin | GritSync"
        ogDescription="Free USCIS case status tracker for Filipino nurses. Monitor I-140, I-485 applications and Philippines EB3 Visa Bulletin updates."
        ogImage={`${baseUrl}/gritsync_logo.png`}
        ogUrl={`${baseUrl}/uscis-tracker`}
      />
      
      <Header />

      <div 
        className="relative py-20"
        style={{
          backgroundImage: `linear-gradient(to bottom right, rgba(220, 38, 38, 0.75), rgba(153, 27, 27, 0.85)), url('/uscis_tracker_banner_image.png')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div className="container mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm text-white text-sm font-medium mb-6">
            <Globe className="h-4 w-4" />
            <span>Immigration Status Tracking</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            USCIS Case Status & <span className="text-red-200">Visa Bulletin</span> Tracker
          </h1>
          <p className="text-xl text-white/90 max-w-2xl mx-auto">
            Track your immigration case status and stay updated on the Visa Bulletin for Philippines EB3 category.
          </p>
        </div>
      </div>

      <main className="container mx-auto px-4 py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <Card className="p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                  <Search className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    Check Case Status
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Enter your USCIS receipt number to check your case status
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="flex-1">
                  <Input
                    placeholder="Enter Receipt Number (e.g., EAC2190123456)"
                    value={receiptNumber}
                    onChange={(e) => setReceiptNumber(e.target.value.toUpperCase())}
                    onKeyPress={(e) => e.key === 'Enter' && handleCheckStatus()}
                    className="text-lg"
                  />
                </div>
                <Button
                  onClick={handleCheckStatus}
                  disabled={loading}
                  className="px-8"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Check Status
                    </>
                  )}
                </Button>
              </div>

              <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-sm">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <p className="text-blue-800 dark:text-blue-200">
                  Your receipt number is 13 characters and starts with 3 letters (e.g., EAC, WAC, LIN, SRC, MSC, IOE) followed by 10 numbers.
                </p>
              </div>

              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-sm mt-3">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-amber-800 dark:text-amber-200">
                  <strong>Demo Mode:</strong> This tracker demonstrates the case lookup experience. For official status, visit{' '}
                  <a 
                    href="https://egov.uscis.gov/casestatus/landing.do" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="underline hover:text-amber-900 dark:hover:text-amber-100"
                  >
                    USCIS Case Status Online
                  </a>.
                </p>
              </div>
            </Card>

            {caseStatus && (
              <Card className="p-6 md:p-8 border-l-4 border-l-blue-500">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(caseStatus.status)}
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                        Case Status Result
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Receipt #: {caseStatus.receiptNumber}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={saveCase}>
                    Save Case
                  </Button>
                </div>

                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Current Status</p>
                    <p className={`text-lg font-semibold ${getStatusColor(caseStatus.status)}`}>
                      {caseStatus.status}
                    </p>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Form Type</p>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">
                        {caseStatus.formType}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {caseStatus.formTitle}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Processing Center</p>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">
                        {caseStatus.processingCenter}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Status Description</p>
                    <p className="text-gray-700 dark:text-gray-300">
                      {caseStatus.statusDescription}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <Clock className="h-4 w-4" />
                    <span>Last Updated: {caseStatus.lastUpdated}</span>
                  </div>
                </div>
              </Card>
            )}

            {savedCases.length > 0 && (
              <Card className="p-6 md:p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    Saved Cases ({savedCases.length})
                  </h3>
                  <Button variant="outline" size="sm" onClick={() => {
                    localStorage.removeItem(STORAGE_KEY)
                    setSavedCases([])
                    showToast('All saved cases cleared', 'success')
                  }}>
                    Clear All
                  </Button>
                </div>

                <div className="space-y-3">
                  {savedCases.map((savedCase) => (
                    <div
                      key={savedCase.receiptNumber}
                      className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {getStatusIcon(savedCase.status)}
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-gray-100">
                            {savedCase.receiptNumber}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {savedCase.formType} - {savedCase.status}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setReceiptNumber(savedCase.receiptNumber)
                            handleCheckStatus()
                          }}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeCase(savedCase.receiptNumber)}
                          className="text-red-600 hover:text-red-700"
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card className="p-6 border-t-4 border-t-green-500">
              <button
                onClick={() => setShowVisaBulletin(!showVisaBulletin)}
                className="w-full flex items-center justify-between mb-4"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                    <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    Visa Bulletin
                  </h3>
                </div>
                {showVisaBulletin ? (
                  <ChevronUp className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                )}
              </button>

              {showVisaBulletin && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Philippines EB3 Category
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => loadVisaBulletin(true)}
                      disabled={loadingBulletin}
                      title="Refresh Visa Bulletin"
                    >
                      {loadingBulletin ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  {visaBulletin && (
                    <>
                      <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar className="h-4 w-4 text-green-600 dark:text-green-400" />
                          <span className="text-sm font-medium text-green-800 dark:text-green-200">
                            {visaBulletin.month} {visaBulletin.year} Bulletin
                          </span>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Final Action Date</p>
                            <p className="text-lg font-bold text-green-700 dark:text-green-300">
                              {visaBulletin.eb3Philippines.finalAction}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Dates for Filing</p>
                            <p className="text-lg font-bold text-blue-700 dark:text-blue-300">
                              {visaBulletin.eb3Philippines.datesForFiling}
                            </p>
                          </div>
                        </div>
                      </div>

                      {bulletinSchedule && (
                        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-xs">
                          <div className="flex items-center gap-2 mb-1">
                            <Calendar className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                            <span className="font-medium text-blue-800 dark:text-blue-200">Next Bulletin Release</span>
                          </div>
                          <p className="text-blue-700 dark:text-blue-300">{bulletinSchedule.nextRelease}</p>
                          {bulletinSchedule.isNewBulletinExpected && (
                            <p className="mt-1 text-blue-600 dark:text-blue-400 flex items-center gap-1">
                              <Sparkles className="h-3 w-3" />
                              New bulletin expected soon!
                            </p>
                          )}
                        </div>
                      )}

                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        <p className="mb-2">
                          <strong>Final Action Date:</strong> The date when a visa number becomes available for your priority date.
                        </p>
                        <p>
                          <strong>Dates for Filing:</strong> The date when you may file your application if a visa is expected to be available within a reasonable timeframe.
                        </p>
                      </div>

                      <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-xs">
                        <p className="text-amber-800 dark:text-amber-200">
                          <strong>Source:</strong> {visaBulletin.source}. Always verify with the official State Department.
                        </p>
                      </div>
                    </>
                  )}

                  <a
                    href="https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View Official Visa Bulletin
                  </a>
                </div>
              )}
            </Card>

            <Card className="p-6 border-t-4 border-t-red-500">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                  <Bell className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    Get Bulletin Updates
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Be the first to know when new bulletins are released
                  </p>
                </div>
              </div>
              
              <div className="space-y-3">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={subscribeEmail}
                  onChange={(e) => setSubscribeEmail(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSubscribe()}
                />
                <Button
                  onClick={handleSubscribe}
                  disabled={subscribing}
                  className="w-full bg-red-600 hover:bg-red-700"
                >
                  {subscribing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Subscribing...
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4 mr-2" />
                      Subscribe to Updates
                    </>
                  )}
                </Button>
                <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                  Get instant notifications when new visa bulletins are released
                </p>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
                Receipt Number Prefixes
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="font-mono font-semibold">EAC</span>
                  <span className="text-gray-600 dark:text-gray-400">Vermont Service Center</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-mono font-semibold">WAC</span>
                  <span className="text-gray-600 dark:text-gray-400">California Service Center</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-mono font-semibold">LIN</span>
                  <span className="text-gray-600 dark:text-gray-400">Nebraska Service Center</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-mono font-semibold">SRC</span>
                  <span className="text-gray-600 dark:text-gray-400">Texas Service Center</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-mono font-semibold">MSC</span>
                  <span className="text-gray-600 dark:text-gray-400">National Benefits Center</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-mono font-semibold">IOE</span>
                  <span className="text-gray-600 dark:text-gray-400">Electronic System</span>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/10">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">
                Need Help with Your Application?
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                GritSync specializes in helping Filipino nurses navigate the NCLEX and immigration process.
              </p>
              <Button className="w-full" onClick={() => window.location.href = '/quote'}>
                Get a Free Quote
              </Button>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default USCISTracker
