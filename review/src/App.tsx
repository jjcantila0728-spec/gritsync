import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './lib/auth'
import { NclexReview } from './pages/NclexReview'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Sso } from './pages/Sso'

export const App = () => (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/register" element={<Register />} />
    <Route path="/sso" element={<Sso />} />
    <Route
      path="/nclex/review/:sessionId"
      element={
        <ProtectedRoute>
          <NclexReview />
        </ProtectedRoute>
      }
    />
    <Route
      path="/"
      element={
        <ProtectedRoute>
          <Landing />
        </ProtectedRoute>
      }
    />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
)

const Landing = () => (
  <div className="min-h-screen flex items-center justify-center text-gray-500 px-6 text-center">
    <p>
      Open a session via <code className="font-mono text-gray-700">/nclex/review/&lt;sessionId&gt;</code>
    </p>
  </div>
)
