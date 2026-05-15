import { ReactNode, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const location = useLocation()
  const [ok, setOk] = useState<boolean | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('gritsync_token')
    if (!token) {
      const next = encodeURIComponent(location.pathname + location.search)
      window.location.replace(`/login?next=${next}`)
      return
    }
    setOk(true)
  }, [location.pathname, location.search])

  if (ok === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
      </div>
    )
  }
  return <>{children}</>
}
