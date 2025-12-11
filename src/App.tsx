import React, { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ToastProvider } from './components/ui/Toast'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Loading } from './components/ui/Loading'
import { MaintenanceMode } from './components/MaintenanceMode'
import { SessionTimeout } from './components/SessionTimeout'
import { ScrollToTop } from './components/ScrollToTop'

// Lazy load pages for better performance and code splitting
const Home = lazy(() => import('./pages/Home').then(m => ({ default: m.Home })))
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })))
const Register = lazy(() => import('./pages/Register').then(m => ({ default: m.Register })))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword').then(m => ({ default: m.ForgotPassword })))
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
const EmailTemplatePreview = lazy(() => import('./pages/admin-settings/EmailTemplatePreview').then(m => ({ default: m.EmailTemplatePreview })))
const SecuritySettings = lazy(() => import('./pages/admin-settings/SecuritySettings').then(m => ({ default: m.SecuritySettings })))
const PaymentSettings = lazy(() => import('./pages/admin-settings/PaymentSettings').then(m => ({ default: m.PaymentSettings })))
const CurrencySettings = lazy(() => import('./pages/admin-settings/CurrencySettings').then(m => ({ default: m.CurrencySettings })))
const SystemSettings = lazy(() => import('./pages/admin-settings/SystemSettings').then(m => ({ default: m.SystemSettings })))
const PromoCodeSettings = lazy(() => import('./pages/admin-settings/PromoCodeSettings').then(m => ({ default: m.PromoCodeSettings })))
const NotificationManagement = lazy(() => import('./pages/admin-settings/NotificationManagement').then(m => ({ default: m.NotificationManagement })))
const AdminQuoteManagement = lazy(() => import('./pages/AdminQuoteManagement').then(m => ({ default: m.AdminQuoteManagement })))
const MyDetails = lazy(() => import('./pages/MyDetails').then(m => ({ default: m.MyDetails })))
const AccountSettings = lazy(() => import('./pages/AccountSettings').then(m => ({ default: m.AccountSettings })))
const Documents = lazy(() => import('./pages/Documents').then(m => ({ default: m.Documents })))
const TestSupabase = lazy(() => import('./pages/TestSupabase').then(m => ({ default: m.TestSupabase })))
const TermsOfService = lazy(() => import('./pages/TermsOfService').then(m => ({ default: m.TermsOfService })))
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy').then(m => ({ default: m.PrivacyPolicy })))
const AboutUs = lazy(() => import('./pages/AboutUs').then(m => ({ default: m.AboutUs })))
const NCLEXSponsorship = lazy(() => import('./pages/NCLEXSponsorship').then(m => ({ default: m.NCLEXSponsorship })))
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
const AdminEmailAddresses = lazy(() => import('./pages/AdminEmailAddresses').then(m => ({ default: m.AdminEmailAddresses })))
const AdminEmailTemplates = lazy(() => import('./pages/AdminEmailTemplates').then(m => ({ default: m.default })))
const AdminEmailSignatures = lazy(() => import('./pages/AdminEmailSignatures').then(m => ({ default: m.default })))
const ClientEmails = lazy(() => import('./pages/ClientEmails').then(m => ({ default: m.ClientEmails })))

// Loading fallback component
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
      <Loading text="Loading page..." />
    </div>
  )
}

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

  // Ensure children is not a plain object (which React can't render)
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

  // If user is logged in, redirect to dashboard
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

  // Ensure children is not a plain object (which React can't render)
  if (children && typeof children === 'object' && !React.isValidElement(children) && !Array.isArray(children)) {
    console.error('AdminRoute: Invalid children prop - received plain object', children)
    return null
  }

  return <>{children}</>
}

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

  // Show maintenance mode to non-admins only
  if (isMaintenance && !isAdmin()) {
    return <MaintenanceMode />
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route 
          path="/" 
          element={
            <PublicRoute>
              <Home />
            </PublicRoute>
          } 
        />
        <Route 
          path="/login" 
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          } 
        />
        <Route 
          path="/register" 
          element={
            <PublicRoute>
              <Register />
            </PublicRoute>
          } 
        />
        <Route 
          path="/forgot-password" 
          element={
            <PublicRoute>
              <ForgotPassword />
            </PublicRoute>
          } 
        />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/about-us" element={<AboutUs />} />
        <Route path="/donate" element={<Donate />} />
        <Route path="/donate/checkout" element={<DonateCheckout />} />
        <Route path="/donate/success" element={<DonateSuccess />} />
        <Route path="/career/apply" element={<Career />} />
        <Route path="/career" element={<CareerListing />} />
        <Route path="/test-supabase" element={<TestSupabase />} />
      
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/application/new"
        element={
          <ProtectedRoute>
            <NCLEXApplication />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sponsorship/apply"
        element={<NCLEXSponsorship />}
      />
      <Route
        path="/sponsorship"
        element={<SponsorshipLanding />}
      />
      <Route
        path="/tracking"
        element={<Tracking />}
      />
      <Route
        path="/tracking/:id"
        element={<Tracking />}
      />
      <Route
        path="/applications"
        element={<Tracking />}
      />
      <Route
        path="/applications/:id"
        element={<Navigate to="timeline" replace />}
      />
      <Route
        path="/applications/:id/payments"
        element={
          <ProtectedRoute>
            <ApplicationPayments />
          </ProtectedRoute>
        }
      />
      <Route
        path="/applications/:id/checkout"
        element={<ApplicationCheckout />}
      />
      <Route
        path="/applications/:id/:tab"
        element={
          <ProtectedRoute>
            <ApplicationDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/applications/:applicationId/payment"
        element={
          <ProtectedRoute>
            <ApplicationPayment />
          </ProtectedRoute>
        }
      />
      <Route
        path="/quote"
        element={<Quote />}
      />
      <Route
        path="/quote/:id"
        element={<Quote />}
      />
      <Route
        path="/quotations"
        element={<Quote />}
      />
      <Route
        path="/quotations/:id"
        element={<Quote />}
      />
      <Route
        path="/quotations/new"
        element={
          <ProtectedRoute>
            <NewQuotation />
          </ProtectedRoute>
        }
      />
      <Route
        path="/quotations/:id/pay"
        element={
          <ProtectedRoute>
            <Payment />
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-details"
        element={
          <ProtectedRoute>
            <MyDetails />
          </ProtectedRoute>
        }
      />
      <Route
        path="/account-settings"
        element={
          <ProtectedRoute>
            <AccountSettings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/documents"
        element={
          <ProtectedRoute>
            <Documents />
          </ProtectedRoute>
        }
      />
      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <Notifications />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/dashboard"
        element={
          <AdminRoute>
            <Dashboard />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/applications"
        element={
          <AdminRoute>
            <Tracking />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/applications/:id"
        element={<Navigate to="timeline" replace />}
      />
      <Route
        path="/admin/applications/:id/payments"
        element={
          <AdminRoute>
            <AdminApplicationPayments />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/applications/:id/:tab"
        element={
          <AdminRoute>
            <ApplicationDetail />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/clients"
        element={
          <AdminRoute>
            <AdminClients />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/quotations"
        element={
          <AdminRoute>
            <AdminQuoteManagement />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/settings"
        element={
          <AdminRoute>
            <AdminSettings />
          </AdminRoute>
        }
      >
        <Route index element={<GeneralSettings />} />
        <Route path="general" element={<GeneralSettings />} />
        <Route path="notifications" element={<NotificationSettings />} />
        <Route path="email-templates" element={<EmailTemplatePreview />} />
        <Route path="security" element={<SecuritySettings />} />
        <Route path="payment" element={<PaymentSettings />} />
        <Route path="promo-codes" element={<PromoCodeSettings />} />
        <Route path="currency" element={<CurrencySettings />} />
        <Route path="system" element={<SystemSettings />} />
      </Route>
      <Route
        path="/admin/notifications"
        element={
          <AdminRoute>
            <NotificationManagement />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/sponsorships"
        element={
          <AdminRoute>
            <AdminSponsorships />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/donations"
        element={
          <AdminRoute>
            <AdminDonations />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/careers"
        element={
          <AdminRoute>
            <AdminCareers />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/partner-agencies"
        element={
          <AdminRoute>
            <AdminPartnerAgencies />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/emails"
        element={
          <AdminRoute>
            <AdminEmails />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/emails/inbox"
        element={
          <AdminRoute>
            <AdminEmails />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/emails/sent"
        element={
          <AdminRoute>
            <AdminEmails />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/emails/templates"
        element={
          <AdminRoute>
            <AdminEmails />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/email-addresses"
        element={
          <AdminRoute>
            <AdminEmailAddresses />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/email-templates"
        element={
          <AdminRoute>
            <AdminEmailTemplates />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/emails/signatures"
        element={
          <AdminRoute>
            <AdminEmails />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/emails/email-setup"
        element={
          <AdminRoute>
            <AdminEmails />
          </AdminRoute>
        }
      />
      
      {/* Client Email Routes */}
      <Route
        path="/client/emails"
        element={
          <ProtectedRoute>
            <ClientEmails />
          </ProtectedRoute>
        }
      />
      <Route
        path="/client/emails/inbox"
        element={
          <ProtectedRoute>
            <ClientEmails />
          </ProtectedRoute>
        }
      />
      <Route
        path="/client/emails/sent"
        element={
          <ProtectedRoute>
            <ClientEmails />
          </ProtectedRoute>
        }
      />
      <Route
        path="/client/emails/templates"
        element={
          <ProtectedRoute>
            <ClientEmails />
          </ProtectedRoute>
        }
      />
      </Routes>
    </Suspense>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <SessionTimeout>
            <ToastProvider>
              <BrowserRouter
                future={{
                  v7_startTransition: true,
                  v7_relativeSplatPath: true,
                }}
              >
                <ScrollToTop />
                <AppRoutes />
              </BrowserRouter>
            </ToastProvider>
          </SessionTimeout>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App

