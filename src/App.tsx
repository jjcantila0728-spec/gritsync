import React, { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { PermissionsProvider, usePermissions } from './contexts/PermissionsContext'
import { homePathForRole, permissionForPath, rolePanelPrefix } from './lib/permissions'
import { ToastProvider } from './components/ui/Toast'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Loading } from './components/ui/Loading'
import { MaintenanceMode } from './components/MaintenanceMode'
import { SessionTimeout } from './components/SessionTimeout'
import { ScrollToTop } from './components/ScrollToTop'
import { PWAInstallPrompt } from './components/PWAInstallPrompt'
import { PWAUpdateNotification } from './components/PWAUpdateNotification'
import { getSubdomainContext, getBasename, appUrl } from './lib/routing'
import { Toaster } from 'react-hot-toast'

// Lazy load pages for better performance and code splitting
const Home = lazy(() => import('./pages/Home').then(m => ({ default: m.Home })))
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })))
const Register = lazy(() => import('./pages/Register').then(m => ({ default: m.Register })))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword').then(m => ({ default: m.ForgotPassword })))
const ResetPassword = lazy(() => import('./pages/ResetPassword').then(m => ({ default: m.ResetPassword })))
const VerifyEmail = lazy(() => import('./pages/VerifyEmail').then(m => ({ default: m.VerifyEmail })))
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })))
const NCLEXApplication = lazy(() => import('./pages/NCLEXApplication').then(m => ({ default: m.NCLEXApplication })))
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
const ReferralSettings = lazy(() => import('./pages/admin-settings/ReferralSettings').then(m => ({ default: m.ReferralSettings })))
const RolePermissions = lazy(() => import('./pages/admin-settings/RolePermissions').then(m => ({ default: m.RolePermissions })))
const NotificationManagement = lazy(() => import('./pages/admin-settings/NotificationManagement').then(m => ({ default: m.NotificationManagement })))
const AffiliatePanel = lazy(() => import('./pages/AffiliatePanel').then(m => ({ default: m.AffiliatePanel })))
const AdvisorPanel = lazy(() => import('./pages/AdvisorPanel').then(m => ({ default: m.AdvisorPanel })))
const AdvisorApplications = lazy(() => import('./pages/AdvisorApplications').then(m => ({ default: m.AdvisorApplications })))
const AdvisorClientList = lazy(() => import('./pages/AdvisorClientList').then(m => ({ default: m.AdvisorClientList })))
const AdminQuoteManagement = lazy(() => import('./pages/AdminQuoteManagement').then(m => ({ default: m.AdminQuoteManagement })))
const MyDetails = lazy(() => import('./pages/MyDetails').then(m => ({ default: m.MyDetails })))
const AccountSettings = lazy(() => import('./pages/AccountSettings').then(m => ({ default: m.AccountSettings })))
const Documents = lazy(() => import('./pages/Documents').then(m => ({ default: m.Documents })))
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
const Career = lazy(() => import('./pages/Career').then(m => ({ default: m.Career })))
const CareerListing = lazy(() => import('./pages/CareerListing').then(m => ({ default: m.CareerListing })))
const AdminCareers = lazy(() => import('./pages/AdminCareers').then(m => ({ default: m.AdminCareers })))
const Notifications = lazy(() => import('./pages/Notifications').then(m => ({ default: m.Notifications })))
const AdminEmails = lazy(() => import('./pages/AdminEmails').then(m => ({ default: m.AdminEmails })))
const AdminAnalytics = lazy(() => import('./pages/AdminAnalytics').then(m => ({ default: m.AdminAnalytics })))
const AdminEmailAddresses = lazy(() => import('./pages/AdminEmailAddresses').then(m => ({ default: m.AdminEmailAddresses })))
const AdminEmailTemplates = lazy(() => import('./pages/AdminEmailTemplates').then(m => ({ default: m.default })))
const ClientEmails = lazy(() => import('./pages/ClientEmails').then(m => ({ default: m.ClientEmails })))
const EmailPreferences = lazy(() => import('./pages/EmailPreferences'))
const Unsubscribe = lazy(() => import('./pages/Unsubscribe'))
const AdminNclex = lazy(() => import('./pages/AdminNclex').then(m => ({ default: m.AdminNclex })))
const NCLEXExam = lazy(() => import('./pages/NCLEXExam').then(m => ({ default: m.NCLEXExam })))
const NCLEXCheckout = lazy(() => import('./pages/NCLEXCheckout').then(m => ({ default: m.NCLEXCheckout })))
const NclexHome = lazy(() => import('./pages/nclex/NclexHome').then(m => ({ default: m.NclexHome })))
const NclexExam = lazy(() => import('./pages/nclex/NclexExam').then(m => ({ default: m.NclexExam })))
const NclexResults = lazy(() => import('./pages/nclex/NclexResults').then(m => ({ default: m.NclexResults })))
const NclexReviewPage = lazy(() => import('./pages/nclex/NclexReview').then(m => ({ default: m.NclexReview })))
const Messages = lazy(() => import('./pages/Messages').then(m => ({ default: m.Messages })))
const AdminSocial = lazy(() => import('./pages/AdminSocial').then(m => ({ default: m.AdminSocial })))
const Sso = lazy(() => import('./pages/Sso').then(m => ({ default: m.Sso })))
const Download = lazy(() => import('./pages/Download').then(m => ({ default: m.Download })))
const AccountDelete = lazy(() => import('./pages/AccountDelete').then(m => ({ default: m.AccountDelete })))
const PearsonVueExam = lazy(() => import('./pages/pearsonvue/PearsonVueExam').then(m => ({ default: m.PearsonVueExam })))
const PearsonVueHome = lazy(() => import('./pages/pearsonvue/PearsonVueHome').then(m => ({ default: m.PearsonVueHome })))

/**
 * Cross-subdomain navigation helper. <Navigate> only handles in-router
 * transitions; for hops from gritsync.com → app.gritsync.com we need a
 * real window.location swap so the new subdomain's routes take over.
 */
function CrossDomainRedirect({ to }: { to: string }) {
  useEffect(() => {
    window.location.replace(to)
  }, [to])
  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
      <p className="text-gray-600 dark:text-gray-400">Redirecting…</p>
    </div>
  )
}

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
  const { can, loading: permsLoading } = usePermissions()
  const location = useLocation()

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

  // Panel-mismatch: a user who lands on another panel's URL (e.g. an affiliate
  // hitting /client/dashboard) is sent back to their own panel's home.
  const panelMatch = location.pathname.match(/^\/(client|affiliate|advisor|admin)(?=\/|$)/)
  if (panelMatch && panelMatch[1] !== user.role) {
    return <Navigate to={homePathForRole(user.role)} replace />
  }

  // Permission-gated routes: bounce a user who lacks access back to their own
  // home. Admins always pass; the seeded defaults cover the first render before
  // stored overrides arrive.
  if (user.role !== 'admin') {
    const required = permissionForPath(location.pathname)
    if (required && !permsLoading && !can(required)) {
      return <Navigate to={homePathForRole(user.role)} replace />
    }
  }

  if (children && typeof children === 'object' && !React.isValidElement(children) && !Array.isArray(children)) {
    console.error('ProtectedRoute: Invalid children prop - received plain object', children)
    return null
  }

  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <p className="text-gray-600 dark:text-gray-400">Loading...</p>
      </div>
    )
  }

  if (user) {
    return <Navigate to={homePathForRole(user.role)} replace />
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
    return <Navigate to={homePathForRole(user?.role)} replace />
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
  const { user, loading } = useAuth()

  if (loading) return <PageLoader />

  if (user) {
    // Cross-subdomain redirect — can't use navigate() here
    window.location.href = appUrl(homePathForRole(user.role))
    return <PageLoader />
  }

  return <>{children}</>
}

/**
 * Backwards-compat redirect for legacy unprefixed paths. Sends the current user
 * to the same path under their role's panel prefix (e.g. `/messages` becomes
 * `/client/messages` for a client, `/admin/messages` for an admin). Preserves
 * query string and hash. Falls through to /login if unauthenticated.
 */
function RoleRedirect() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <PageLoader />
  if (!user) return <Navigate to="/login" replace />

  const prefix = rolePanelPrefix(user.role)
  // Already under the user's prefix? Just send them home — shouldn't normally happen.
  if (location.pathname === prefix || location.pathname.startsWith(prefix + '/')) {
    return <Navigate to={homePathForRole(user.role)} replace state={location.state} />
  }
  const target = `${prefix}${location.pathname}${location.search}${location.hash}`
  return <Navigate to={target} replace state={location.state} />
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
    return <Navigate to={homePathForRole(user?.role)} replace />
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
        <Route path="/download" element={<Download />} />
        {/* Legacy public account-deletion URL — the canonical page now
            lives at /client/account-settings/delete on the app subdomain.
            Bounce any old shares (Play Console, email signatures, etc.). */}
        <Route path="/account/delete" element={<CrossDomainRedirect to={appUrl('/client/account-settings/delete')} />} />
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
        {/* SSO landing — for cross-subdomain hops */}
        <Route path="/sso" element={<Sso />} />
        {/* Auth pages */}
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
        <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
        <Route path="/reset-password" element={<PublicRoute><ResetPassword /></PublicRoute>} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/preferences/:token" element={<EmailPreferences />} />
        <Route path="/unsubscribe/:token" element={<Unsubscribe />} />
        {/* Public account-deletion landing — declared OUTSIDE the
            ProtectedRoute wrappers below so signed-out users (including
            Google Play Console reviewers) can reach it. This is the URL
            published on the Play Console "Data safety" form. */}
        <Route path="/client/account-settings/delete" element={<AccountDelete />} />

        {/* ────────────────────────────────────────────────────────────────
           Panel routes — every authenticated page lives under its role's
           prefix (/client/*, /affiliate/*, /advisor/*, /admin/*). Legacy
           unprefixed paths fall through to <RoleRedirect /> below, which
           sends users to the same path under their own panel.
           ──────────────────────────────────────────────────────────────── */}

        {/* ───── CLIENT panel ───── */}
        <Route path="/client/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/client/applications" element={<ProtectedRoute><Tracking /></ProtectedRoute>} />
        <Route path="/client/application/new" element={<ProtectedRoute><NCLEXApplication /></ProtectedRoute>} />
        <Route path="/client/application/new/nclex" element={<ProtectedRoute><NCLEXApplication /></ProtectedRoute>} />
        <Route path="/client/applications/:id" element={<Navigate to="timeline" replace />} />
        <Route path="/client/applications/:id/payments" element={<ProtectedRoute><ApplicationPayments /></ProtectedRoute>} />
        <Route path="/client/applications/:id/checkout" element={<ApplicationCheckout />} />
        <Route path="/client/applications/:id/details/:subTab" element={<ProtectedRoute><ApplicationDetail /></ProtectedRoute>} />
        <Route path="/client/applications/:id/details" element={<ProtectedRoute><Navigate to="personal" replace /></ProtectedRoute>} />
        <Route path="/client/applications/:id/:tab" element={<ProtectedRoute><ApplicationDetail /></ProtectedRoute>} />
        <Route path="/client/applications/:applicationId/payment" element={<ProtectedRoute><ApplicationPayment /></ProtectedRoute>} />
        <Route path="/client/quotations/new" element={<ProtectedRoute><NewQuotation /></ProtectedRoute>} />
        <Route path="/client/quotations/:id/pay" element={<ProtectedRoute><Payment /></ProtectedRoute>} />
        <Route path="/client/my-details" element={<ProtectedRoute><MyDetails /></ProtectedRoute>} />
        <Route path="/client/account-settings" element={<ProtectedRoute><AccountSettings /></ProtectedRoute>} />
        <Route path="/client/documents/:serviceType?" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
        <Route path="/client/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
        <Route path="/client/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
        <Route path="/client/emails" element={<ProtectedRoute><ClientEmails /></ProtectedRoute>} />
        <Route path="/client/emails/inbox" element={<ProtectedRoute><ClientEmails /></ProtectedRoute>} />
        <Route path="/client/emails/sent" element={<ProtectedRoute><ClientEmails /></ProtectedRoute>} />
        <Route path="/client/emails/templates" element={<ProtectedRoute><ClientEmails /></ProtectedRoute>} />

        {/* ───── AFFILIATE panel ───── */}
        <Route path="/affiliate" element={<ProtectedRoute><AffiliatePanel /></ProtectedRoute>} />
        <Route path="/affiliate/dashboard" element={<ProtectedRoute><AffiliatePanel /></ProtectedRoute>} />
        <Route path="/affiliate/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
        <Route path="/affiliate/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
        <Route path="/affiliate/my-details" element={<ProtectedRoute><MyDetails /></ProtectedRoute>} />
        <Route path="/affiliate/account-settings" element={<ProtectedRoute><AccountSettings /></ProtectedRoute>} />

        {/* ───── ADVISOR panel ───── */}
        <Route path="/advisor" element={<ProtectedRoute><AdvisorPanel /></ProtectedRoute>} />
        <Route path="/advisor/dashboard" element={<ProtectedRoute><AdvisorPanel /></ProtectedRoute>} />
        <Route path="/advisor/applications" element={<ProtectedRoute><AdvisorApplications /></ProtectedRoute>} />
        <Route path="/advisor/clients" element={<ProtectedRoute><AdvisorClientList /></ProtectedRoute>} />
        <Route path="/advisor/clients/:clientId" element={<ProtectedRoute><AdvisorPanel /></ProtectedRoute>} />
        <Route path="/advisor/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
        <Route path="/advisor/emails" element={<ProtectedRoute><ClientEmails /></ProtectedRoute>} />
        <Route path="/advisor/emails/inbox" element={<ProtectedRoute><ClientEmails /></ProtectedRoute>} />
        <Route path="/advisor/emails/sent" element={<ProtectedRoute><ClientEmails /></ProtectedRoute>} />
        <Route path="/advisor/emails/templates" element={<ProtectedRoute><ClientEmails /></ProtectedRoute>} />
        {/* Singular alias — forgiving for bookmarks / sidebars that still use /email */}
        <Route path="/advisor/email" element={<Navigate to="/advisor/emails" replace />} />
        <Route path="/advisor/email/:rest" element={<Navigate to="/advisor/emails" replace />} />
        <Route path="/advisor/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
        <Route path="/advisor/my-details" element={<ProtectedRoute><MyDetails /></ProtectedRoute>} />
        <Route path="/advisor/account-settings" element={<ProtectedRoute><AccountSettings /></ProtectedRoute>} />

        {/* ───── Legacy redirects ─────
           Send anyone hitting an unprefixed path to the same path under their
           own panel (e.g. /messages → /client/messages or /admin/messages). */}
        <Route path="/dashboard" element={<RoleRedirect />} />
        <Route path="/applications" element={<RoleRedirect />} />
        <Route path="/applications/*" element={<RoleRedirect />} />
        <Route path="/application" element={<RoleRedirect />} />
        <Route path="/application/*" element={<RoleRedirect />} />
        <Route path="/quotations/new" element={<RoleRedirect />} />
        <Route path="/quotations/:id/pay" element={<RoleRedirect />} />
        <Route path="/documents" element={<RoleRedirect />} />
        <Route path="/documents/*" element={<RoleRedirect />} />
        <Route path="/messages" element={<RoleRedirect />} />
        <Route path="/notifications" element={<RoleRedirect />} />
        <Route path="/my-details" element={<RoleRedirect />} />
        <Route path="/account-settings" element={<RoleRedirect />} />

        {/* Admin routes */}
        <Route path="/admin/dashboard" element={<AdminRoute><Dashboard /></AdminRoute>} />
        <Route path="/admin/applications" element={<AdminRoute><Tracking /></AdminRoute>} />
        <Route path="/admin/applications/:id" element={<AdminRedirect to="timeline" />} />
        <Route path="/admin/applications/:id/payments" element={<AdminRoute><AdminApplicationPayments /></AdminRoute>} />
        <Route path="/admin/applications/:id/details/:subTab" element={<AdminRoute><ApplicationDetail /></AdminRoute>} />
        <Route path="/admin/applications/:id/details" element={<AdminRedirect to="personal" />} />
        <Route path="/admin/applications/:id/gs-method/:subTab" element={<AdminRoute><ApplicationDetail /></AdminRoute>} />
        <Route path="/admin/applications/:id/gs-method" element={<AdminRedirect to="gs-method/mandatory-course" />} />
        <Route path="/admin/applications/:id/:tab" element={<AdminRoute><ApplicationDetail /></AdminRoute>} />
        <Route path="/admin/users" element={<AdminRoute><AdminClients /></AdminRoute>} />
        <Route path="/admin/clients" element={<Navigate to="/admin/users" replace />} />
        <Route path="/admin/quotations" element={<AdminRoute><AdminQuoteManagement /></AdminRoute>} />
        <Route
          path="/admin/settings"
          element={<AdminRoute><AdminSettings /></AdminRoute>}
        >
          <Route index element={<GeneralSettings />} />
          <Route path="general" element={<GeneralSettings />} />
          <Route path="notifications" element={<NotificationSettings />} />
          <Route path="security" element={<SecuritySettings />} />
          <Route path="permissions" element={<RolePermissions />} />
          <Route path="payment" element={<PaymentSettings />} />
          <Route path="referrals" element={<ReferralSettings />} />
          <Route path="promo-codes" element={<PromoCodeSettings />} />
          <Route path="currency" element={<CurrencySettings />} />
          <Route path="monitoring" element={<MonitoringDashboard />} />
          <Route path="system" element={<SystemSettings />} />
          <Route path="services" element={<ServiceSettings />} />
        </Route>
        <Route path="/admin/notifications" element={<AdminRoute><NotificationManagement /></AdminRoute>} />
        <Route path="/admin/sponsorships" element={<AdminRoute><AdminSponsorships /></AdminRoute>} />
        <Route path="/admin/donations" element={<Navigate to="/admin/sponsorships?tab=donations" replace />} />
        <Route path="/admin/careers" element={<AdminRoute><AdminCareers /></AdminRoute>} />
        <Route path="/admin/partner-agencies" element={<Navigate to="/admin/careers?tab=agencies" replace />} />
        <Route path="/admin/nclex" element={<AdminRoute><AdminNclex /></AdminRoute>} />
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
        <Route path="/admin/social" element={<AdminRoute><AdminSocial /></AdminRoute>} />
        <Route path="/admin/ads" element={<Navigate to="/admin/social?tab=ads" replace />} />

        {/* Admin messages route — same unified Messages experience as clients & partners */}
        <Route path="/admin/messages" element={<AdminRoute><Messages /></AdminRoute>} />

        {/* Admin profile pages — same components every panel uses */}
        <Route path="/admin/my-details" element={<AdminRoute><MyDetails /></AdminRoute>} />
        <Route path="/admin/account-settings" element={<AdminRoute><AccountSettings /></AdminRoute>} />

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
        {/* SSO landing — exchanges a cross-subdomain hop token for a normal session */}
        <Route path="/sso" element={<Sso />} />
        {/* Root now lands on the new NclexHome dashboard (Q-Banks > Statistics).
            The /exam, /video-library, /cheat-sheets, /live-lectures, /order-history,
            /checkout legacy paths below are kept as redirects so old bookmarks /
            emails still resolve to the right section of the new NclexHome. */}
        <Route path="/" element={<ProtectedRoute><Navigate to="/nclex/qbanks/statistics" replace /></ProtectedRoute>} />
        <Route path="/exam/:id" element={<NCLEXExam />} />
        <Route path="/video-library" element={<Navigate to="/nclex/videos" replace />} />
        <Route path="/cheat-sheets" element={<Navigate to="/nclex/cheatsheets" replace />} />
        <Route path="/live-lectures" element={<Navigate to="/nclex/live" replace />} />
        <Route path="/order-history" element={<Navigate to="/nclex/orders" replace />} />
        <Route path="/checkout" element={<NCLEXCheckout />} />
        {/* NCLEX Review (imported from grit) — qbanks dashboard, exam, results, review */}
        <Route path="/nclex" element={<ProtectedRoute><Navigate to="/nclex/qbanks/statistics" replace /></ProtectedRoute>} />
        <Route path="/nclex/qbanks" element={<ProtectedRoute><Navigate to="/nclex/qbanks/statistics" replace /></ProtectedRoute>} />
        <Route path="/nclex/qbanks/:qbanksTab" element={<ProtectedRoute><NclexHome /></ProtectedRoute>} />
        <Route path="/nclex/exam/:sessionId" element={<ProtectedRoute><NclexExam /></ProtectedRoute>} />
        <Route path="/nclex/results/:sessionId" element={<ProtectedRoute><NclexResults /></ProtectedRoute>} />
        <Route path="/nclex/review/:sessionId" element={<ProtectedRoute><NclexReviewPage /></ProtectedRoute>} />
        <Route path="/nclex/:section" element={<ProtectedRoute><NclexHome /></ProtectedRoute>} />
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
// PearsonVUE subdomain — mimics the real Pearson VUE NCLEX testing UI so
// learners practice in the exact environment they'll see on test day.
// pearsonvue.gritsync.com/        → PearsonVueHome (proctor-style start screen)
// pearsonvue.gritsync.com/exam/:id → PearsonVueExam (the test surface)
// Reuses the same /api/nclex/sessions endpoints as review.gritsync.com.
// ---------------------------------------------------------------------------

function PearsonVueRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/sso" element={<Sso />} />
        <Route path="/" element={<ProtectedRoute><PearsonVueHome /></ProtectedRoute>} />
        <Route path="/exam/:sessionId" element={<ProtectedRoute><PearsonVueExam /></ProtectedRoute>} />
        {/* Auth fallback */}
        <Route path="/login" element={<LandingPublicRoute><Login /></LandingPublicRoute>} />
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
  if (context === 'pearsonvue') return <PearsonVueRoutes />
  return <LandingRoutes />
}

function App() {
  const basename = getBasename()

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <PermissionsProvider>
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
                  <Toaster position="top-right" />
                </BrowserRouter>
              </ToastProvider>
            </SessionTimeout>
          </PermissionsProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
