import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/Button'
import { X, QrCode, Smartphone } from 'lucide-react'
import { SignaturePad } from './SignaturePad'
import { SignatureSuccessAnimation } from './SignatureSuccessAnimation'
import { supabase } from '@/lib/supabase'

interface SignatureModalProps {
  isOpen: boolean
  onClose: () => void
  onSignatureComplete: (signatureDataUrl: string) => void
  applicationId?: string
  documentName?: string
  isAlreadySigned?: boolean
}

export function SignatureModal({ isOpen, onClose, onSignatureComplete, applicationId, documentName, isAlreadySigned = false }: SignatureModalProps) {
  const [showQRCode, setShowQRCode] = useState(false)
  const [showSignaturePad, setShowSignaturePad] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('')
  const [signatureUrl, setSignatureUrl] = useState<string>('')
  const [isLocalhost, setIsLocalhost] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [signatureSessionId] = useState(() => `sign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)
  const checkForSignatureRef = useRef<(() => Promise<boolean>) | null>(null)

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase())
      const isSmallScreen = window.innerWidth < 768
      setIsMobile(isMobileDevice || isSmallScreen)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Generate QR code URL when modal opens on desktop
  useEffect(() => {
    if (!isOpen) {
      // Reset state when modal closes
      setShowQRCode(false)
      setShowSignaturePad(false)
      return
    }

    if (!isMobile) {
      // Desktop: Generate QR code
      // Determine the base URL for the QR code
      let baseUrl = import.meta.env.VITE_FRONTEND_URL || import.meta.env.VITE_PUBLIC_URL
      
      // Check if we're on localhost
      const isLocalhostDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      setIsLocalhost(isLocalhostDev)
      
      // If no env variable and we're on localhost, use localhost (will show warning)
      if (!baseUrl && isLocalhostDev) {
        // In development, localhost won't work from phone
        // Use localhost for now, but show a warning message
        baseUrl = window.location.origin
      } else if (!baseUrl) {
        // Fallback to current origin (should work in production)
        baseUrl = window.location.origin
      }
      
      const url = `${baseUrl}/sign?session=${signatureSessionId}&app=${applicationId || ''}&doc=${encodeURIComponent(documentName || 'document')}&timestamp=${Date.now()}`
      setSignatureUrl(url)
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`
      setQrCodeUrl(qrUrl)
      setShowQRCode(true)
      setShowSignaturePad(false)

      // Store session info in localStorage for persistence
      localStorage.setItem(`signature_session_${signatureSessionId}`, JSON.stringify({
        sessionId: signatureSessionId,
        applicationId,
        documentName,
        createdAt: Date.now()
      }))

      // Function to check for signature and handle completion
      const checkForSignature = async () => {
        // First, check Supabase for cross-device signatures
        try {
          const { data: supabaseSignature, error } = await supabase
            .from('temporary_signatures')
            .select('*')
            .eq('session_id', signatureSessionId)
            .eq('is_consumed', false)
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          
          if (!error && supabaseSignature) {
            console.log('Signature found in Supabase:', signatureSessionId)
            // Mark as consumed
            const { error: updateError } = await supabase
              .from('temporary_signatures')
              .update({ 
                is_consumed: true,
                consumed_at: new Date().toISOString()
              })
              .eq('id', supabaseSignature.id)
            
            if (updateError) {
              console.error('Error marking signature as consumed:', updateError)
              // Continue anyway - signature is still valid
            }
            
            onSignatureComplete(supabaseSignature.signature_data_url)
            onClose()
            return true
          }
        } catch (error) {
          console.warn('Error checking Supabase:', error)
        }
        
        // Check sessionStorage first (primary) - exact match
        const storedSignature = sessionStorage.getItem(`signature_${signatureSessionId}`)
        if (storedSignature) {
          console.log('Signature found in sessionStorage (exact match):', signatureSessionId)
          sessionStorage.removeItem(`signature_${signatureSessionId}`)
          localStorage.removeItem(`signature_session_${signatureSessionId}`)
          onSignatureComplete(storedSignature)
          onClose()
          return true
        }

        // Also check localStorage - exact match
        const localStorageKey = `signature_${signatureSessionId}`
        const localStorageSignature = localStorage.getItem(localStorageKey)
        if (localStorageSignature) {
          console.log('Signature found in localStorage (exact match):', signatureSessionId)
          localStorage.removeItem(localStorageKey)
          localStorage.removeItem(`signature_session_${signatureSessionId}`)
          onSignatureComplete(localStorageSignature)
          onClose()
          return true
        }
        
        // Check all signature keys in localStorage for any match (cross-device fallback)
        // Look for keys that start with 'signature_' but not 'signature_session_'
        const allSignatureKeys: string[] = []
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key && key.startsWith('signature_') && !key.startsWith('signature_session_')) {
            allSignatureKeys.push(key)
          }
        }
        
        // Also check sessionStorage
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i)
          if (key && key.startsWith('signature_') && !key.startsWith('signature_session_')) {
            allSignatureKeys.push(key)
          }
        }
        
        if (allSignatureKeys.length > 0) {
          console.log('Found signature keys:', allSignatureKeys)
          console.log('Current session ID:', signatureSessionId)
          
          // Try to find a signature that matches our application/document
          // Check session info to see if any signature belongs to this session
          for (const key of allSignatureKeys) {
            // Extract session ID from key (format: signature_<sessionId>)
            const keySessionId = key.replace('signature_', '')
            
            // Check if there's a session info for this signature
            const sessionInfoKey = `signature_session_${keySessionId}`
            const sessionInfo = localStorage.getItem(sessionInfoKey)
            
            if (sessionInfo) {
              try {
                const sessionData = JSON.parse(sessionInfo)
                // Check if this session matches our application/document
                if (sessionData.applicationId === applicationId && 
                    (sessionData.documentName === documentName || !documentName || !sessionData.documentName)) {
                  console.log('Found matching signature for this application/document:', key)
                  const signature = localStorage.getItem(key) || sessionStorage.getItem(key)
                  if (signature) {
                    // Clean up
                    localStorage.removeItem(key)
                    sessionStorage.removeItem(key)
                    localStorage.removeItem(sessionInfoKey)
                    onSignatureComplete(signature)
                    onClose()
                    return true
                  }
                }
              } catch (e) {
                console.warn('Error parsing session info:', e)
              }
            }
          }
          
          // If no exact match found, try the most recent signature (last in list)
          // This is a fallback for when session info doesn't match
          const lastKey = allSignatureKeys[allSignatureKeys.length - 1]
          console.log('Trying last signature key as fallback:', lastKey)
          const fallbackSignature = localStorage.getItem(lastKey) || sessionStorage.getItem(lastKey)
          if (fallbackSignature) {
            console.log('Using fallback signature')
            localStorage.removeItem(lastKey)
            sessionStorage.removeItem(lastKey)
            onSignatureComplete(fallbackSignature)
            onClose()
            return true
          }
        }
        
        return false
      }
      
      // Store function in ref so button can access it
      checkForSignatureRef.current = checkForSignature

      // Listen for signature completion from mobile device
      // Check both Supabase and localStorage for persistence
      const checkSignatureStatus = setInterval(async () => {
        await checkForSignature()
      }, 1000) // Check every second

      // Also listen for storage events (works across tabs on same browser)
      const handleStorageChange = async (e: StorageEvent) => {
        // Check if the changed key is our signature key
        if (e.key === `signature_${signatureSessionId}` && e.newValue) {
          // Signature was added, check for it
          if (await checkForSignature()) {
            window.removeEventListener('storage', handleStorageChange)
          }
        }
      }
      window.addEventListener('storage', handleStorageChange)

      // Cleanup old sessions (older than 1 hour)
      const oneHourAgo = Date.now() - 3600000
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('signature_session_')) {
          try {
            const sessionData = JSON.parse(localStorage.getItem(key) || '{}')
            if (sessionData.createdAt && sessionData.createdAt < oneHourAgo) {
              localStorage.removeItem(key)
              localStorage.removeItem(`signature_${sessionData.sessionId}`)
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      })

      return () => {
        clearInterval(checkSignatureStatus)
        window.removeEventListener('storage', handleStorageChange)
      }
    } else {
      // On mobile, directly show signature pad
      setShowQRCode(false)
      setShowSignaturePad(true)
    }
  }, [isOpen, isMobile, signatureSessionId, applicationId, documentName, onSignatureComplete, onClose])

  // Handle signature URL on mobile (when QR code is scanned)
  useEffect(() => {
    if (isMobile) {
      const urlParams = new URLSearchParams(window.location.search)
      const session = urlParams.get('session')
      const app = urlParams.get('app')
      const doc = urlParams.get('doc')
      
      if (session && window.location.pathname === '/sign') {
        // This is a signature session from QR code
        setShowSignaturePad(true)
        // Store session info for later
        sessionStorage.setItem('signature_session', session)
        sessionStorage.setItem('signature_app', app || '')
        sessionStorage.setItem('signature_doc', doc || 'document')
      }
    }
  }, [isMobile])

  const handleSignatureSave = async (signatureDataUrl: string) => {
    setIsProcessing(true)
    
    try {
      if (isMobile) {
        // Get session from URL or sessionStorage
        const urlParams = new URLSearchParams(window.location.search)
        const session = urlParams.get('session') || sessionStorage.getItem('signature_session') || signatureSessionId
        
        // Store signature in both sessionStorage and localStorage for persistence
        sessionStorage.setItem(`signature_${session}`, signatureDataUrl)
        localStorage.setItem(`signature_${session}`, signatureDataUrl)
        
        // Also store session info
        if (session) {
          sessionStorage.setItem('signature_session', session)
        }
        
        // Show success animation
        setShowSuccess(true)
      } else {
        // Desktop: store signature and show success animation
        sessionStorage.setItem(`signature_${signatureSessionId}`, signatureDataUrl)
        localStorage.setItem(`signature_${signatureSessionId}`, signatureDataUrl)
        setShowSuccess(true)
      }
    } catch (error) {
      console.error('Error saving signature:', error)
      alert('Failed to save signature. Please try again.')
      setIsProcessing(false)
    }
  }

  const handleSuccessComplete = () => {
    if (isMobile) {
      // Try to go back, or redirect to home
      if (window.history.length > 1) {
        window.history.back()
      } else {
        window.location.href = '/'
      }
    } else {
      // Desktop: call the completion handler
      const signatureDataUrl = sessionStorage.getItem(`signature_${signatureSessionId}`) || localStorage.getItem(`signature_${signatureSessionId}`)
      if (signatureDataUrl) {
        onSignatureComplete(signatureDataUrl)
      }
      onClose()
    }
  }

  if (!isOpen) return null

  // Show success animation if already signed or just signed
  if (isAlreadySigned || showSuccess) {
    return (
      <SignatureSuccessAnimation
        onComplete={() => {
          if (isAlreadySigned) {
            onClose()
          } else {
            handleSuccessComplete()
          }
        }}
        message={isAlreadySigned 
          ? "This document has already been signed." 
          : (isMobile ? "Signature submitted successfully! You can close this page." : "Signature saved successfully!")
        }
      />
    )
  }

  // Show signature pad if requested (mobile or desktop fallback)
  if (showSignaturePad) {
    return (
      <SignaturePad
        isOpen={true}
        onClose={() => {
          setShowSignaturePad(false)
          if (isMobile && window.location.pathname === '/sign') {
            window.history.back()
          } else {
            onClose()
          }
        }}
        onSave={handleSignatureSave}
        applicationId={applicationId}
        documentName={documentName}
      />
    )
  }

  // Desktop: Show QR code
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 p-2 sm:p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">
            Sign Document
          </h2>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex-shrink-0"
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        </div>

        {/* QR Code Section */}
        {showQRCode && (
          <div className="text-center">
            <div className="mb-3 sm:mb-4">
              <QrCode className="h-10 w-10 sm:h-12 sm:w-12 text-primary-600 dark:text-primary-400 mx-auto mb-2" />
              <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-gray-100 mb-1 sm:mb-2">
                Scan with Your Phone
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 px-2">
                Scan this QR code with your phone to sign the document
              </p>
            </div>
            
            <div className="bg-white p-3 sm:p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 inline-block mb-3 sm:mb-4">
              {qrCodeUrl && (
                <img 
                  src={qrCodeUrl} 
                  alt="QR Code for Signature" 
                  className="w-48 h-48 sm:w-64 sm:h-64"
                />
              )}
            </div>

            {isLocalhost && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 sm:p-4 mb-3 sm:mb-4">
                <div className="flex items-start gap-2 sm:gap-3">
                  <div className="flex-1">
                    <p className="text-xs sm:text-sm font-medium text-yellow-900 dark:text-yellow-100 mb-2">
                      ⚠️ Development Mode Detected
                    </p>
                    <p className="text-xs text-yellow-800 dark:text-yellow-200 mb-2">
                      The QR code uses localhost which won't work from your phone. Use one of these options:
                    </p>
                    <ol className="text-xs text-yellow-800 dark:text-yellow-200 space-y-1 list-decimal list-inside mb-2">
                      <li>Set <code className="bg-yellow-100 dark:bg-yellow-900/30 px-1 rounded">VITE_FRONTEND_URL</code> in your .env file to your computer's IP (e.g., http://192.168.1.100:5000)</li>
                      <li>Or manually type this URL on your phone:</li>
                    </ol>
                    <div className="bg-yellow-100 dark:bg-yellow-900/30 rounded p-2 mb-2">
                      <code className="text-xs break-all text-yellow-900 dark:text-yellow-100">{signatureUrl}</code>
                    </div>
                    <p className="text-xs text-yellow-800 dark:text-yellow-200">
                      Replace <code className="bg-yellow-100 dark:bg-yellow-900/30 px-1 rounded">localhost</code> with your computer's local IP address.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 sm:p-4 mb-3 sm:mb-4">
              <div className="flex items-start gap-2 sm:gap-3">
                <Smartphone className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-left flex-1">
                  <p className="text-xs sm:text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                    Instructions:
                  </p>
                  <ol className="text-xs text-blue-800 dark:text-blue-200 space-y-1 list-decimal list-inside">
                    <li>Open your phone's camera app</li>
                    <li>Point it at the QR code above</li>
                    <li>Tap the notification to open the signature page</li>
                    <li>Sign the document on your phone</li>
                    <li>Your signature will appear here automatically</li>
                  </ol>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Waiting for signature...
              </p>
              <Button
                onClick={async () => {
                  // Manually check for signature using the ref function
                  if (checkForSignatureRef.current) {
                    const found = await checkForSignatureRef.current()
                    if (!found) {
                      // Show message that signature not found
                      alert('Signature not found. Please make sure you have signed on your phone and try again. If you just signed, wait a moment and try again.')
                    }
                  } else {
                    // Fallback: direct check
                    const storedSignature = sessionStorage.getItem(`signature_${signatureSessionId}`) || localStorage.getItem(`signature_${signatureSessionId}`)
                    if (storedSignature) {
                      sessionStorage.removeItem(`signature_${signatureSessionId}`)
                      localStorage.removeItem(`signature_${signatureSessionId}`)
                      localStorage.removeItem(`signature_session_${signatureSessionId}`)
                      onSignatureComplete(storedSignature)
                      onClose()
                    } else {
                      alert('Signature not found. Please make sure you have signed on your phone and try again.')
                    }
                  }
                }}
                variant="outline"
                size="sm"
                className="w-full text-xs"
              >
                Check for Signature
              </Button>
              <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                Session ID: {signatureSessionId.substring(0, 8)}...
              </p>
            </div>
          </div>
        )}

        {/* Alternative: Direct signature on desktop (fallback) */}
        <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            onClick={() => {
              setShowQRCode(false)
              setShowSignaturePad(true)
            }}
            variant="outline"
            className="w-full text-sm sm:text-base"
          >
            Sign on This Device Instead
          </Button>
        </div>
      </div>
    </div>
  )
}

// Show signature pad directly on desktop if user chooses
export function SignaturePadDirect({ isOpen, onClose, onSave, applicationId, documentName }: {
  isOpen: boolean
  onClose: () => void
  onSave: (signatureDataUrl: string) => void
  applicationId?: string
  documentName?: string
}) {
  return (
    <SignaturePad
      isOpen={isOpen}
      onClose={onClose}
      onSave={onSave}
      applicationId={applicationId}
      documentName={documentName}
    />
  )
}

