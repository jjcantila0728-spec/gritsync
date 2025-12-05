import { useEffect, useState, useRef, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { securitySettings } from '@/lib/settings'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { AlertTriangle, Clock } from 'lucide-react'

interface SessionTimeoutProps {
  children: React.ReactNode
}

export function SessionTimeout({ children }: SessionTimeoutProps) {
  const { user, signOut } = useAuth()
  const [showWarning, setShowWarning] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [timeoutMinutes, setTimeoutMinutes] = useState(30)
  const [isEnabled, setIsEnabled] = useState(true)
  
  const lastActivityRef = useRef<number>(Date.now())
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null)
  const logoutTimerRef = useRef<NodeJS.Timeout | null>(null)
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Load session timeout settings
  useEffect(() => {
    async function loadSettings() {
      try {
        const timeout = await securitySettings.getSessionTimeout()
        setTimeoutMinutes(timeout)
        setIsEnabled(timeout > 0) // Disable if timeout is 0 or negative
      } catch (error) {
        console.error('Error loading session timeout settings:', error)
        // Default to 30 minutes if settings can't be loaded
        setTimeoutMinutes(30)
      }
    }
    loadSettings()
  }, [])

  // Handle automatic logout
  const handleLogout = useCallback(async () => {
    // Clear all timers
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current)
      warningTimerRef.current = null
    }
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current)
      logoutTimerRef.current = null
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
      countdownIntervalRef.current = null
    }
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current)
      checkIntervalRef.current = null
    }
    
    setShowWarning(false)
    await signOut()
    // Redirect will be handled by auth state change
  }, [signOut])

  // Set up warning and logout timers
  const setupTimers = useCallback(() => {
    const timeoutMs = timeoutMinutes * 60 * 1000
    const warningTimeMs = timeoutMs - (60 * 1000) // Show warning 1 minute before timeout
    
    // Clear any existing timers
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current)
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current)
    
    // Set warning timer (1 minute before timeout)
    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true)
      setTimeRemaining(60) // Start countdown at 60 seconds
      
      // Start countdown
      countdownIntervalRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current)
              countdownIntervalRef.current = null
            }
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }, warningTimeMs)
    
    // Set logout timer
    logoutTimerRef.current = setTimeout(() => {
      handleLogout()
    }, timeoutMs)
  }, [timeoutMinutes, handleLogout])

  // Reset activity timestamp on user activity
  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now()
    
    // Clear existing timers
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current)
      warningTimerRef.current = null
    }
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current)
      logoutTimerRef.current = null
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
      countdownIntervalRef.current = null
    }
    
    // Hide warning if shown
    setShowWarning((prev) => {
      if (prev) {
        setTimeRemaining(0)
        return false
      }
      return prev
    })
    
    // Set up new timers if user is logged in and timeout is enabled
    if (user && isEnabled && timeoutMinutes > 0) {
      setupTimers()
    }
  }, [user, isEnabled, timeoutMinutes, setupTimers])

  // Handle user choosing to stay logged in
  const handleStayLoggedIn = useCallback(() => {
    resetActivity()
  }, [resetActivity])

  // Set up activity listeners
  useEffect(() => {
    if (!user || !isEnabled || timeoutMinutes <= 0) {
      // Clean up if user logs out or timeout is disabled
      if (warningTimerRef.current) {
        clearTimeout(warningTimerRef.current)
        warningTimerRef.current = null
      }
      if (logoutTimerRef.current) {
        clearTimeout(logoutTimerRef.current)
        logoutTimerRef.current = null
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
        countdownIntervalRef.current = null
      }
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current)
        checkIntervalRef.current = null
      }
      setShowWarning(false)
      return
    }

    // Initial setup
    resetActivity()

    // Listen for user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    events.forEach((event) => {
      document.addEventListener(event, resetActivity, true)
    })

    // Periodic check to handle tab/window focus changes
    checkIntervalRef.current = setInterval(() => {
      const now = Date.now()
      const inactiveTime = now - lastActivityRef.current
      const timeoutMs = timeoutMinutes * 60 * 1000
      const warningTimeMs = timeoutMs - (60 * 1000)
      
      // If inactive time exceeds warning time, show warning
      if (inactiveTime >= warningTimeMs) {
        setShowWarning((prev) => {
          if (!prev) {
            const remainingSeconds = Math.floor((timeoutMs - inactiveTime) / 1000)
            setTimeRemaining(Math.max(0, remainingSeconds))
            
            // Start countdown if not already started
            if (!countdownIntervalRef.current) {
              countdownIntervalRef.current = setInterval(() => {
                setTimeRemaining((prevTime) => {
                  if (prevTime <= 1) {
                    if (countdownIntervalRef.current) {
                      clearInterval(countdownIntervalRef.current)
                      countdownIntervalRef.current = null
                    }
                    return 0
                  }
                  return prevTime - 1
                })
              }, 1000)
            }
            return true
          }
          return prev
        })
      }
      
      // If inactive time exceeds timeout, logout
      if (inactiveTime >= timeoutMs) {
        handleLogout()
      }
    }, 10000) // Check every 10 seconds

    return () => {
      // Cleanup event listeners
      events.forEach((event) => {
        document.removeEventListener(event, resetActivity, true)
      })
      
      // Cleanup timers
      if (warningTimerRef.current) {
        clearTimeout(warningTimerRef.current)
        warningTimerRef.current = null
      }
      if (logoutTimerRef.current) {
        clearTimeout(logoutTimerRef.current)
        logoutTimerRef.current = null
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
        countdownIntervalRef.current = null
      }
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current)
        checkIntervalRef.current = null
      }
    }
  }, [user, isEnabled, timeoutMinutes, resetActivity, handleLogout])

  // Auto-logout when countdown reaches 0
  useEffect(() => {
    if (showWarning && timeRemaining <= 0) {
      handleLogout()
    }
  }, [timeRemaining, showWarning])

  return (
    <>
      {children}
      
      <Modal
        isOpen={showWarning}
        onClose={handleStayLoggedIn}
        title="Session Timeout Warning"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex-shrink-0">
              <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Your session is about to expire
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                You've been inactive for a while. Your session will expire in:
              </p>
              <div className="flex items-center gap-2 mb-4">
                <Clock className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                Click "Stay Logged In" to continue your session.
              </p>
            </div>
          </div>
          
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={handleLogout}
            >
              Log Out Now
            </Button>
            <Button
              variant="default"
              onClick={handleStayLoggedIn}
            >
              Stay Logged In
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}

