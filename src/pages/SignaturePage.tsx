import { useEffect, useState } from 'react'
import { SignaturePad } from '@/components/SignaturePad'
import { SignatureSuccessAnimation } from '@/components/SignatureSuccessAnimation'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { db } from '@/lib/api-client'
import { SEO } from '@/components/SEO'

export function SignaturePage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [sessionId, setSessionId] = useState<string>('')
  const [applicationId, setApplicationId] = useState<string>('')
  const [documentName, setDocumentName] = useState<string>('')
  const [showSuccess, setShowSuccess] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    const session = searchParams.get('session')
    const app = searchParams.get('app')
    const doc = searchParams.get('doc')

    if (session) {
      setSessionId(session)
      setApplicationId(app || '')
      setDocumentName(decodeURIComponent(doc || 'document'))
      
      // Store session info
      sessionStorage.setItem('signature_session', session)
      sessionStorage.setItem('signature_app', app || '')
      sessionStorage.setItem('signature_doc', doc || 'document')
    } else {
      // If no session, try to get from sessionStorage (in case of direct navigation)
      const storedSession = sessionStorage.getItem('signature_session')
      const storedApp = sessionStorage.getItem('signature_app')
      const storedDoc = sessionStorage.getItem('signature_doc')
      
      if (storedSession) {
        setSessionId(storedSession)
        setApplicationId(storedApp || '')
        setDocumentName(storedDoc || 'document')
      } else {
        // No session found, redirect back
        navigate(-1)
      }
    }
  }, [searchParams, navigate])

  const handleSignatureSave = async (signatureDataUrl: string) => {
    setIsProcessing(true)
    
    try {
      // Store signature in Supabase for cross-device access
      const { error: supabaseError } = await db
        .from('temporary_signatures')
        .insert({
          session_id: sessionId,
          application_id: applicationId || null,
          document_name: documentName || null,
          signature_data_url: signatureDataUrl,
          is_consumed: false,
          expires_at: new Date(Date.now() + 3600000).toISOString() // 1 hour from now
        })
      
      if (supabaseError) {
        console.error('Error saving signature to Supabase:', supabaseError)
        // Fallback to localStorage if Supabase fails
        sessionStorage.setItem(`signature_${sessionId}`, signatureDataUrl)
        localStorage.setItem(`signature_${sessionId}`, signatureDataUrl)
        sessionStorage.setItem('signature_session', sessionId)
      } else {
        console.log('Signature saved to Supabase successfully')
      }
      
      // Also store in localStorage/sessionStorage as backup
      sessionStorage.setItem(`signature_${sessionId}`, signatureDataUrl)
      localStorage.setItem(`signature_${sessionId}`, signatureDataUrl)
      sessionStorage.setItem('signature_session', sessionId)
      
      // Show success animation
      setShowSuccess(true)
    } catch (error) {
      console.error('Error saving signature:', error)
      // Fallback to localStorage
      try {
        sessionStorage.setItem(`signature_${sessionId}`, signatureDataUrl)
        localStorage.setItem(`signature_${sessionId}`, signatureDataUrl)
        sessionStorage.setItem('signature_session', sessionId)
        setShowSuccess(true)
      } catch (fallbackError) {
        console.error('Fallback save also failed:', fallbackError)
        alert('Failed to save signature. Please try again.')
        setIsProcessing(false)
      }
    }
  }

  const handleSuccessComplete = () => {
    // Close the page after success animation
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/')
    }
  }

  const handleClose = () => {
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/')
    }
  }

  if (showSuccess) {
    return (
      <SignatureSuccessAnimation
        onComplete={handleSuccessComplete}
        message="Signature submitted successfully! You can close this page."
      />
    )
  }

  if (!sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="text-center">
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Loading signature page...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <SEO title="Sign Document — GritSync" description="Secure document signing page." noindex nofollow />
      <SignaturePad
        isOpen={true}
        onClose={handleClose}
        onSave={handleSignatureSave}
        applicationId={applicationId}
        documentName={documentName}
      />
      {isProcessing && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 dark:bg-black/70">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Processing signature...</p>
          </div>
        </div>
      )}
    </>
  )
}

