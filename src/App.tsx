import React, { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ToastProvider } from './components/ui/Toast'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Loading } from './components/ui/Loading'
import { MaintenanceMode } from './components/MaintenanceMode'
import { SessionTimeout } from './components/SessionTimeout'

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
const AdminApplicationPayments = lazy(() => import('./pages/AdminApplicationPayments').then(m => ({ default: m.AdminApplicationPayments })))
const AdyenReturn = lazy(() => import('./pages/AdyenReturn').then(m => ({ default: m.AdyenReturn })))
const AdminClients = lazy(() => import('./pages/AdminClients').then(m => ({ default: m.AdminClients })))
const AdminSettings = lazy(() => import('./pages/admin-settings/AdminSettings').then(m => ({ default: m.AdminSettings })))
const GeneralSettings = lazy(() => import('./pages/admin-settings/GeneralSettings').then(m => ({ default: m.GeneralSettings })))
const NotificationSettings = lazy(() => import('./pages/admin-settings/NotificationSettings').then(m => ({ default: m.NotificationSettings })))
const SecuritySettings = lazy(() => import('./pages/admin-settings/SecuritySettings').then(m => ({ default: m.SecuritySettings })))
const PaymentSettings = lazy(() => import('./pages/admin-settings/PaymentSettings').then(m => ({ default: m.PaymentSettings })))
const CurrencySettings = lazy(() => import('./pages/admin-settings/CurrencySettings').then(m => ({ default: m.CurrencySettings })))
const SystemSettings = lazy(() => import('./pages/admin-settings/SystemSettings').then(m => ({ default: m.SystemSettings })))
const NotificationManagement = lazy(() => import('./pages/admin-settings/NotificationManagement').then(m => ({ default: m.NotificationManagement })))
const AdminQuoteManagement = lazy(() => import('./pages/AdminQuoteManagement').then(m => ({ default: m.AdminQuoteManagement })))
const MyDetails = lazy(() => import('./pages/MyDetails').then(m => ({ default: m.MyDetails })))
const AccountSettings = lazy(() => import('./pages/AccountSettings').then(m => ({ default: m.AccountSettings })))
const Documents = lazy(() => import('./pages/Documents').then(m => ({ default: m.Documents })))
const TestSupabase = lazy(() => import('./pages/TestSupabase').then(m => ({ default: m.TestSupabase })))

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
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
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
        path="/payment/adyen/return"
        element={
          <ProtectedRoute>
            <AdyenReturn />
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
        <Route path="security" element={<SecuritySettings />} />
        <Route path="payment" element={<PaymentSettings />} />
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

