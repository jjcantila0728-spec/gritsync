import React, { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ToastProvider } from './components/ui/Toast'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Loading } from './components/ui/Loading'
import { MaintenanceMode } from './components/MaintenanceMode'
import { SessionTimeout } from './components/SessionTimeout'
import { ScrollToTop } from './components/ScrollToTop'
import { PWAInstallPrompt } from './components/PWAInstallPrompt'
import { PWAUpdateNotification } from './components/PWAUpdateNotification'
import { getSubdomainContext, getBasename, appUrl } from './lib/routing'

// Lazy load pages for better performance and code splitting
const Home = lazy(() => import('./pages/Home').then(m => ({ default: m.Home })))
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })))
const Register = lazy(() => import('./pages/Register').then(m => ({ default: m.Register })))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword').then(m => ({ default: m.ForgotPassword })))
const ResetPassword = lazy(() => import('./pages/ResetPassword').then(m => ({ default: m.ResetPassword })))
const VerifyEmail = lazy(() => import('./pages/VerifyEmail').then(m => ({ default: m.VerifyEmail })))
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })))
const NCLEXApplication = lazy(() => import('./pages/NCLEXApplication').then(m => ({ default: m.NCLEXApplication })))
const NCLEXReview = lazy(() => import('./pages/NCLEXReview').then(m => ({ default: m.NCLEXReview })))
const Tracking = lazy(() => import('./pages/Tracking').then(m => ({ default: m.Tracking })))
const ApplicationDetail = lazy(() => import('./pages/ApplicationDetail').then(m => ({ default: m.ApplicationDetail })))
const Quote = lazy(() => import('./pages/Quote').then(m => ({ default: m.Quote })))
const NewQuotation = lazy(() => import('./pages/NewQuotation').then(m => ({ default: m.NewQuotation })))
const Payment = lazy(() => import('./pages/Payment').then(m => ({ default: m.Payment })))
const ApplicationPayment = lazy(() => import('./pages/ApplicationPayment').then(m => ({ default: m.ApplicationPayment })))
const ApplicationPayments = lazy(() => import('./pages/ApplicationPayments').then(m => ({ default: m.ApplicationPayments })))
const ApplicationCheckout = lazy(() => import('./pages/ApplicationCheckout').then(m => ({ default: m.ApplicationCheckout })))
const AdminApplicationPayments = lazy(() => import('./pages/AdminApplicationPayments').then(m => ({ default: m.AdminApplicationPayments })))
const AdminClients = lazy(() => import('./pages/AdminClients').then(m => ({ default: m.AdminClients })))
const AdminSettings = lazy(() => import('./pages/admin-settings/AdminSettings').then(m => ({ default: m.AdminSettings })))
const GeneralSettings = lazy(() => import('./pages/admin-settings/GeneralSettings').then(m => ({ default: m.GeneralSettings })))
const NotificationSettings = lazy(() => import('./pages/admin-settings/NotificationSettings').then(m => ({ default: m.NotificationSettings })))
const SecuritySettings = lazy(() => import('./pages/admin-settings/SecuritySettings').then(m => ({ default: m.SecuritySettings })))
const PaymentSettings = lazy(() => import('./pages/admin-settings/PaymentSettings').then(m => ({ default: m.PaymentSettings })))
const CurrencySettings = lazy(() => import('./pages/admin-settings/CurrencySettings').then(m => ({ default: m.CurrencySettings })))
const SystemSettings = lazy(() => import('./pages/admin-settings/SystemSettings').then(m => ({ default: m.SystemSettings })))
const MonitoringDashboard = lazy(() => import('./pages/admin-settings/MonitoringDashboard').then(m => ({ default: m.MonitoringDashboard })))
const PromoCodeSettings = lazy(() => import('./pages/admin-settings/PromoCodeSettings').then(m => ({ default: m.PromoCodeSettings })))
const ServiceSettings = lazy(() => import('./pages/admin-settings/ServiceSettings').then(m => ({ default: m.ServiceSettings })))
const NotificationManagement = lazy(() => import('./pages/admin-settings/NotificationManagement').then(m => ({ default: m.NotificationManagement })))
const AdminQuoteManagement = lazy(() => import('./pages/AdminQuoteManagement').then(m => ({ default: m.AdminQuoteManagement })))
const MyDetails = lazy(() => import('./pages/MyDetails').then(m => ({ default: m.MyDetails })))
const AccountSettings = lazy(() => import('./pages/AccountSettings').then(m => ({ default: m.AccountSettings })))
const Documents = lazy(() => import('./pages/Documents').then(m => ({ default: m.Documents })))
const TestApi = lazy(() => import('./pages/TestApi').then(m => ({ default: m.TestApi })))
const TestProofOfPaymentUpload = lazy(() => import('./pages/TestProofOfPaymentUpload').then(m => ({ default: m.TestProofOfPaymentUpload })))
const TermsOfService = lazy(() => import('./pages/TermsOfService').then(m => ({ default: m.TermsOfService })))
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy').then(m => ({ default: m.PrivacyPolicy })))
const AboutUs = lazy(() => import('./pages/AboutUs').then(m => ({ default: m.AboutUs })))
const FAQs = lazy(() => import('./pages/FAQs').then(m => ({ default: m.FAQs })))
const NCLEXSponsorship = lazy(() => import('./pages/NCLEXSponsorship').then(m => ({ default: m.NCLEXSponsorship })))
const SignaturePage = lazy(() => import('./pages/SignaturePage').then(m => ({ default: m.SignaturePage })))
const SponsorshipLanding = lazy(() => import('./pages/SponsorshipLanding').then(m => ({ default: m.SponsorshipLanding })))
const Donate = lazy(() => import('./pages/Donate').then(m => ({ default: m.Donate })))
const DonateCheckout = lazy(() => import('./pages/DonateCheckout').then(m => ({ default: m.DonateCheckout })))
const DonateSuccess = lazy(() => import('./pages/DonateSuccess').then(m => ({ default: m.DonateSuccess })))
const AdminSponsorships = lazy(() => import('./pages/AdminSponsorships').then(m => ({ default: m.AdminSponsorships })))
const AdminDonations = lazy(() => import('./pages/AdminDonations').then(m => ({ default: m.AdminDonations })))
const Career = lazy(() => import('./pages/Career').then(m => ({ default: m.Career })))
const CareerListing = lazy(() => import('./pages/CareerListing').then(m => ({ default: m.CareerListing })))
const AdminCareers = lazy(() => import('./pages/AdminCareers').then(m => ({ default: m.AdminCareers })))
const AdminPartnerAgencies = lazy(() => import('./pages/AdminPartnerAgencies').then(m => ({ default: m.AdminPartnerAgencies })))
const Notifications = lazy(() => import('./pages/Notifications').then(m => ({ default: m.Notifications })))
const AdminEmails = lazy(() => import('./pages/AdminEmails').then(m => ({ default: m.AdminEmails })))
const AdminAnalytics = lazy(() => import('./pages/AdminAnalytics').then(m => ({ default: m.AdminAnalytics })))
const AdminEmailAddresses = lazy(() => import('./pages/AdminEmailAddresses').then(m => ({ default: m.AdminEmailAddresses })))
const AdminEmailTemplates = lazy(() => import('./pages/AdminEmailTemplates').then(m => ({ default: m.default })))
const ClientEmails = lazy(() => import('./pages/ClientEmails').then(m => ({ default: m.ClientEmails })))
const EmailPreferences = lazy(() => import('./pages/EmailPreferences'))
const Unsubscribe = lazy(() => import('./pages/Unsubscribe'))
const AdminQuestionBank = lazy(() => import('./pages/AdminQuestionBank').then(m => ({ default: m.AdminQuestionBank })))
const AdminNCLEXSubscriptions = lazy(() => import('./pages/AdminNCLEXSubscriptions').then(m => ({ default: m.AdminNCLEXSubscriptions })))
const NCLEXExam = lazy(() => import('./pages/NCLEXExam').then(m => ({ default: m.NCLEXExam })))
const NCLEXVideoLibrary = lazy(() => import('./pages/NCLEXVideoLibrary').then(m => ({ default: m.NCLEXVideoLibrary })))
const NCLEXCheatSheets = lazy(() => import('./pages/NCLEXCheatSheets').then(m => ({ default: m.NCLEXCheatSheets })))
const NCLEXLiveLectures = lazy(() => import('./pages/NCLEXLiveLectures').then(m => ({ default: m.NCLEXLiveLectures })))
const NCLEXOrderHistory = lazy(() => import('./pages/NCLEXOrderHistory').then(m => ({ default: m.NCLEXOrderHistory })))
const NCLEXCheckout = lazy(() => import('./pages/NCLEXCheckout').then(m => ({ default: m.NCLEXCheckout })))
const Messages = lazy(() => import('./pages/Messages').then(m => ({ default: m.Messages })))
const AdminMessages = lazy(() => import('./pages/AdminMessages').then(m => ({ default: m.AdminMessages })))

// Loading fallback component
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
      <Loading text="Loading page..." />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Route guards
// ---------------------------------------------------------------------------

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <p className="text-gray-600 dark:text-gray-400">Loading...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (children && typeof children === 'object' && !React.isValidElement(children) && !Array.isArray(children)) {
    console.error('ProtectedRoute: Invalid children prop - received plain object', children)
    return null
  }

  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <p className="text-gray-600 dark:text-gray-400">Loading...</p>
      </div>
    )
  }

  if (user) {
    return <Navigate to={isAdmin() ? '/admin/dashboard' : '/dashboard'} replace />
  }

  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <p className="text-gray-600 dark:text-gray-400">Loading...</p>
      </div>
    )
  }

  if (!user || !isAdmin()) {
    return <Navigate to="/dashboard" replace />
  }

  if (children && typeof children === 'object' && !React.isValidElement(children) && !Array.isArray(children)) {
    console.error('AdminRoute: Invalid children prop - received plain object', children)
    return null
  }

  return <>{children}</>
}

/**
 * Used on landing & review contexts: if already logged in, send to app subdomain dashboard.
 * If not logged in, render the auth page normally.
 */
function LandingPublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin } = useAuth()

  if (loading) return <PageLoader />

  if (user) {
    // Cross-subdomain redirect — can't use navigate() here
    window.location.href = appUrl(isAdmin() ? '/admin/dashboard' : '/dashboard')
    return <PageLoader />
  }

  return <>{children}</>
}

function AdminRedirect({ to }: { to: string }) {
  const { user, isAdmin, loading } = useAuth()
  const { id } = useParams<{ id: string }>()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <p className="text-gray-600 dark:text-gray-400">Loading...</p>
      </div>
    )
  }

  if (!user || !isAdmin()) {
    return <Navigate to="/dashboard" replace />
  }

  const redirectPath = id ? `/admin/applications/${id}/${to}` : '/admin/applications'
  return <Navigate to={redirectPath} replace />
}

// ---------------------------------------------------------------------------
// Landing routes (gritsync.com / no prefix in dev: /)
// ---------------------------------------------------------------------------

function LandingRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Home />} />
        {/* Auth routes — available on all domains */}
        <Route path="/login" element={<LandingPublicRoute><Login /></LandingPublicRoute>} />
        <Route path="/register" element={<LandingPublicRoute><Register /></LandingPublicRoute>} />
        <Route path="/forgot-password" element={<LandingPublicRoute><ForgotPassword /></LandingPublicRoute>} />
        <Route path="/reset-password" element={<LandingPublicRoute><ResetPassword /></LandingPublicRoute>} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/about-us" element={<AboutUs />} />
        <Route path="/faqs" element={<FAQs />} />
        <Route path="/quote" element={<Quote />} />
        <Route path="/quote/:id" element={<Quote />} />
        <Route path="/quotations" element={<Quote />} />
        <Route path="/quotations/:id" element={<Quote />} />
        <Route path="/tracking" element={<Tracking />} />
        <Route path="/tracking/:id" element={<Tracking />} />
        <Route path="/applications" element={<Tracking />} />
        <Route path="/sponsorship" element={<SponsorshipLanding />} />
        <Route path="/sponsorship/apply" element={<NCLEXSponsorship />} />
        <Route path="/career" element={<CareerListing />} />
        <Route path="/career/apply" element={<Career />} />
        <Route path="/donate" element={<Donate />} />
        <Route path="/donate/checkout" element={<DonateCheckout />} />
        <Route path="/donate/success" element={<DonateSuccess />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/preferences/:token" element={<EmailPreferences />} />
        <Route path="/unsubscribe/:token" element={<Unsubscribe />} />
        <Route path="/sign" element={<SignaturePage />} />
        <Route path="/test-api" element={<TestApi />} />
        <Route path="/test-upload" element={<TestProofOfPaymentUpload />} />
        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

// ---------------------------------------------------------------------------
// App (portal) routes (app.gritsync.com / /app prefix in dev)
// ---------------------------------------------------------------------------

function AppRoutes() {
  const { isAdmin } = useAuth()
  const [isMaintenance, setIsMaintenance] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkMaintenanceMode() {
      try {
        const { generalSettings } = await import('./lib/settings')
        const maintenance = await generalSettings.isMaintenanceMode()
        setIsMaintenance(maintenance)
      } catch (error) {
        console.error('Error checking maintenance mode:', error)
        setIsMaintenance(false)
      } finally {
        setLoading(false)
      }
    }

    checkMaintenanceMode()
  }, [])

  if (loading) {
    return <PageLoader />
  }

  if (isMaintenance && !isAdmin()) {
    return <MaintenanceMode />
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Auth pages */}
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
        <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
        <Route path="/reset-password" element={<PublicRoute><ResetPassword /></PublicRoute>} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/preferences/:token" element={<EmailPreferences />} />
        <Route path="/unsubscribe/:token" element={<Unsubscribe />} />

        {/* Client protected routes */}
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/applications" element={<ProtectedRoute><Tracking /></ProtectedRoute>} />
        <Route path="/application/new" element={<ProtectedRoute><NCLEXApplication /></ProtectedRoute>} />
        <Route path="/application/new/nclex" element={<ProtectedRoute><NCLEXApplication /></ProtectedRoute>} />
        <Route path="/applications/:id" element={<Navigate to="timeline" replace />} />
        <Route path="/applications/:id/payments" element={<ProtectedRoute><ApplicationPayments /></ProtectedRoute>} />
        <Route path="/applications/:id/checkout" element={<ApplicationCheckout />} />
        <Route path="/applications/:id/details/:subTab" element={<ProtectedRoute><ApplicationDetail /></ProtectedRoute>} />
        <Route path="/applications/:id/details" element={<ProtectedRoute><Navigate to="personal" replace /></ProtectedRoute>} />
        <Route path="/applications/:id/:tab" element={<ProtectedRoute><ApplicationDetail /></ProtectedRoute>} />
        <Route path="/applications/:applicationId/payment" element={<ProtectedRoute><ApplicationPayment /></ProtectedRoute>} />
        <Route path="/quotations/new" element={<ProtectedRoute><NewQuotation /></ProtectedRoute>} />
        <Route path="/quotations/:id/pay" element={<ProtectedRoute><Payment /></ProtectedRoute>} />
        <Route path="/my-details" element={<ProtectedRoute><MyDetails /></ProtectedRoute>} />
        <Route path="/account-settings" element={<ProtectedRoute><AccountSettings /></ProtectedRoute>} />
        <Route path="/documents/:serviceType?" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />

        {/* Client messages route */}
        <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />

        {/* Client email routes */}
        <Route path="/client/emails" element={<ProtectedRoute><ClientEmails /></ProtectedRoute>} />
        <Route path="/client/emails/inbox" element={<ProtectedRoute><ClientEmails /></ProtectedRoute>} />
        <Route path="/client/emails/sent" element={<ProtectedRoute><ClientEmails /></ProtectedRoute>} />
        <Route path="/client/emails/templates" element={<ProtectedRoute><ClientEmails /></ProtectedRoute>} />

        {/* Admin routes */}
        <Route path="/admin/dashboard" element={<AdminRoute><Dashboard /></AdminRoute>} />
        <Route path="/admin/applications" element={<AdminRoute><Tracking /></AdminRoute>} />
        <Route path="/admin/applications/:id" element={<AdminRedirect to="timeline" />} />
        <Route path="/admin/applications/:id/payments" element={<AdminRoute><AdminApplicationPayments /></AdminRoute>} />
        <Route path="/admin/applications/:id/details/:subTab" element={<AdminRoute><ApplicationDetail /></AdminRoute>} />
        <Route path="/admin/applications/:id/details" element={<AdminRedirect to="personal" />} />
        <Route path="/admin/applications/:id/:tab" element={<AdminRoute><ApplicationDetail /></AdminRoute>} />
        <Route path="/admin/clients" element={<AdminRoute><AdminClients /></AdminRoute>} />
        <Route path="/admin/quotations" element={<AdminRoute><AdminQuoteManagement /></AdminRoute>} />
        <Route
          path="/admin/settings"
          element={<AdminRoute><AdminSettings /></AdminRoute>}
        >
          <Route index element={<GeneralSettings />} />
          <Route path="general" element={<GeneralSettings />} />
          <Route path="notifications" element={<NotificationSettings />} />
          <Route path="security" element={<SecuritySettings />} />
          <Route path="payment" element={<PaymentSettings />} />
          <Route path="promo-codes" element={<PromoCodeSettings />} />
          <Route path="currency" element={<CurrencySettings />} />
          <Route path="monitoring" element={<MonitoringDashboard />} />
          <Route path="system" element={<SystemSettings />} />
          <Route path="services" element={<ServiceSettings />} />
        </Route>
        <Route path="/admin/notifications" element={<AdminRoute><NotificationManagement /></AdminRoute>} />
        <Route path="/admin/sponsorships" element={<AdminRoute><AdminSponsorships /></AdminRoute>} />
        <Route path="/admin/donations" element={<AdminRoute><AdminDonations /></AdminRoute>} />
        <Route path="/admin/careers" element={<AdminRoute><AdminCareers /></AdminRoute>} />
        <Route path="/admin/partner-agencies" element={<AdminRoute><AdminPartnerAgencies /></AdminRoute>} />
        <Route path="/admin/question-bank" element={<AdminRoute><AdminQuestionBank /></AdminRoute>} />
        <Route path="/admin/nclex-subscriptions" element={<AdminRoute><AdminNCLEXSubscriptions /></AdminRoute>} />
        <Route path="/admin/emails" element={<AdminRoute><AdminEmails /></AdminRoute>} />
        <Route path="/admin/emails/inbox" element={<AdminRoute><AdminEmails /></AdminRoute>} />
        <Route path="/admin/emails/sent" element={<AdminRoute><AdminEmails /></AdminRoute>} />
        <Route path="/admin/emails/scheduled" element={<AdminRoute><AdminEmails /></AdminRoute>} />
        <Route path="/admin/emails/ab-testing" element={<AdminRoute><AdminEmails /></AdminRoute>} />
        <Route path="/admin/emails/analytics" element={<AdminRoute><AdminEmails /></AdminRoute>} />
        <Route path="/admin/emails/campaigns" element={<AdminRoute><AdminEmails /></AdminRoute>} />
        <Route path="/admin/emails/subscribers" element={<AdminRoute><AdminEmails /></AdminRoute>} />
        <Route path="/admin/emails/templates" element={<AdminRoute><AdminEmails /></AdminRoute>} />
        <Route path="/admin/email-addresses" element={<AdminRoute><AdminEmailAddresses /></AdminRoute>} />
        <Route path="/admin/email-templates" element={<AdminRoute><AdminEmailTemplates /></AdminRoute>} />
        <Route path="/admin/emails/signatures" element={<AdminRoute><AdminEmails /></AdminRoute>} />
        <Route path="/admin/emails/email-setup" element={<AdminRoute><AdminEmails /></AdminRoute>} />
        <Route path="/admin/emails/email-setup/admin" element={<AdminRoute><AdminEmails /></AdminRoute>} />
        <Route path="/admin/emails/email-setup/client" element={<AdminRoute><AdminEmails /></AdminRoute>} />
        <Route path="/admin/analytics" element={<AdminRoute><AdminAnalytics /></AdminRoute>} />

        {/* Admin messages route */}
        <Route path="/admin/messages" element={<AdminRoute><AdminMessages /></AdminRoute>} />

        {/* Root redirect: send to login if not authed, dashboard if authed */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  )
}

// ---------------------------------------------------------------------------
// Review routes (review.gritsync.com / /review prefix in dev)
// ---------------------------------------------------------------------------

function ReviewRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<NCLEXReview />} />
        <Route path="/exam/:id" element={<NCLEXExam />} />
        <Route path="/video-library" element={<NCLEXVideoLibrary />} />
        <Route path="/cheat-sheets" element={<NCLEXCheatSheets />} />
        <Route path="/live-lectures" element={<NCLEXLiveLectures />} />
        <Route path="/order-history" element={<NCLEXOrderHistory />} />
        <Route path="/checkout" element={<NCLEXCheckout />} />
        {/* Auth routes — available on all domains */}
        <Route path="/login" element={<LandingPublicRoute><Login /></LandingPublicRoute>} />
        <Route path="/register" element={<LandingPublicRoute><Register /></LandingPublicRoute>} />
        <Route path="/forgot-password" element={<LandingPublicRoute><ForgotPassword /></LandingPublicRoute>} />
        <Route path="/reset-password" element={<LandingPublicRoute><ResetPassword /></LandingPublicRoute>} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

// ---------------------------------------------------------------------------
// Root router — picks the right route tree based on subdomain context
// ---------------------------------------------------------------------------

function RootRoutes() {
  const context = getSubdomainContext()

  if (context === 'app') return <AppRoutes />
  if (context === 'review') return <ReviewRoutes />
  return <LandingRoutes />
}

function App() {
  const basename = getBasename()

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <SessionTimeout>
            <ToastProvider>
              <BrowserRouter
                basename={basename}
                future={{
                  v7_startTransition: true,
                  v7_relativeSplatPath: true,
                }}
              >
                <ScrollToTop />
                <RootRoutes />
                <PWAInstallPrompt />
                <PWAUpdateNotification />
              </BrowserRouter>
            </ToastProvider>
          </SessionTimeout>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
