import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './lib/auth'
import { NclexHome } from './pages/nclex/NclexHome'
import { NclexExam } from './pages/nclex/NclexExam'
import { NclexResults } from './pages/nclex/NclexResults'
import { NclexReview } from './pages/nclex/NclexReview'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Sso } from './pages/Sso'

export const App = () => (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/register" element={<Register />} />
    <Route path="/sso" element={<Sso />} />

    <Route
      path="/"
      element={
        <ProtectedRoute>
          <NclexHome />
        </ProtectedRoute>
      }
    />
    <Route
      path="/nclex"
      element={
        <ProtectedRoute>
          <NclexHome />
        </ProtectedRoute>
      }
    />
    <Route
      path="/nclex/exam/:sessionId"
      element={
        <ProtectedRoute>
          <NclexExam />
        </ProtectedRoute>
      }
    />
    <Route
      path="/nclex/results/:sessionId"
      element={
        <ProtectedRoute>
          <NclexResults />
        </ProtectedRoute>
      }
    />
    <Route
      path="/nclex/review/:sessionId"
      element={
        <ProtectedRoute>
          <NclexReview />
        </ProtectedRoute>
      }
    />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
)
