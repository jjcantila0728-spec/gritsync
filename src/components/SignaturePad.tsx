import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { X, RotateCcw, Check } from 'lucide-react'

interface SignaturePadProps {
  isOpen: boolean
  onClose: () => void
  onSave: (signatureDataUrl: string) => void
  applicationId?: string
  documentName?: string
}

export function SignaturePad({ isOpen, onClose, onSave, applicationId, documentName }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

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

  // Set landscape orientation for mobile
  useEffect(() => {
    if (isOpen && isMobile) {
      // Lock orientation to landscape on mobile
      const orientation = screen.orientation as any
      if (orientation && orientation.lock) {
        orientation.lock('landscape').catch(() => {
          // Orientation lock may not be supported or allowed
          console.log('Orientation lock not available')
        })
      }
    }

    return () => {
      // Unlock orientation when component unmounts
      const orientation = screen.orientation as any
      if (orientation && orientation.unlock) {
        orientation.unlock()
      }
    }
  }, [isOpen, isMobile])

  // Initialize canvas with responsive sizing
  useEffect(() => {
    if (!isOpen || !canvasRef.current) return

    const updateCanvasSize = () => {
      const canvas = canvasRef.current
      if (!canvas) return

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Get container dimensions
      const container = canvas.parentElement
      if (!container) return

      const containerWidth = container.clientWidth
      const containerHeight = container.clientHeight

      // Set canvas size based on device and container
      const padding = isMobile ? 16 : 32 // Account for padding
      const headerFooterHeight = isMobile ? 150 : 200 // Account for header/footer
      
      if (isMobile) {
        // Mobile: Use available width, reasonable height for landscape
        const availableWidth = window.innerWidth - padding
        const availableHeight = window.innerHeight - headerFooterHeight
        const aspectRatio = 16 / 9 // Landscape aspect ratio
        
        let canvasWidth = Math.min(availableWidth, 800)
        let canvasHeight = Math.min(canvasWidth / aspectRatio, availableHeight, 400)
        
        // Ensure minimum sizes
        canvasWidth = Math.max(canvasWidth, 300)
        canvasHeight = Math.max(canvasHeight, 200)
        
        canvas.width = canvasWidth
        canvas.height = canvasHeight
      } else {
        // Desktop/Tablet: Responsive to container with aspect ratio
        const availableWidth = Math.min(containerWidth - padding, 800)
        const availableHeight = containerHeight - headerFooterHeight
        const aspectRatio = 8 / 3 // Desktop aspect ratio
        
        let canvasWidth = availableWidth
        let canvasHeight = Math.min(canvasWidth / aspectRatio, availableHeight)
        
        // Ensure minimum sizes
        canvasWidth = Math.max(canvasWidth, 400)
        canvasHeight = Math.max(canvasHeight, 250)
        
        canvas.width = canvasWidth
        canvas.height = canvasHeight
      }

      // Set drawing style
      ctx.strokeStyle = '#000000'
      ctx.lineWidth = isMobile ? 3 : 2 // Thicker line for touch
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      setHasSignature(false)
    }

    updateCanvasSize()
    
    // Update on resize
    window.addEventListener('resize', updateCanvasSize)
    return () => window.removeEventListener('resize', updateCanvasSize)
  }, [isOpen, isMobile])

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    // Prevent default to avoid scrolling on touch devices
    if ('touches' in e) {
      e.preventDefault()
    }
    
    setIsDrawing(true)
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

    ctx.beginPath()
    ctx.moveTo(clientX - rect.left, clientY - rect.top)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return

    // Prevent default to avoid scrolling on touch devices
    if ('touches' in e) {
      e.preventDefault()
    }

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

    ctx.lineTo(clientX - rect.left, clientY - rect.top)
    ctx.stroke()
    setHasSignature(true)
  }

  const stopDrawing = (e?: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (e && 'touches' in e) {
      e.preventDefault()
    }
    setIsDrawing(false)
  }

  const clearSignature = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
  }

  const handleSave = async () => {
    const canvas = canvasRef.current
    if (!canvas || !hasSignature) return

    const signatureDataUrl = canvas.toDataURL('image/png')
    await onSave(signatureDataUrl)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 p-2 sm:p-4">
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl ${
        isMobile 
          ? 'w-full h-full rounded-none' 
          : 'w-full max-w-4xl max-h-[90vh]'
      } flex flex-col`}>
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 truncate pr-2">
            {documentName ? `Sign: ${documentName}` : 'Sign Document'}
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

        {/* Canvas Container */}
        <div className="flex-1 overflow-auto p-2 sm:p-4 flex items-center justify-center bg-gray-50 dark:bg-gray-900 min-h-0">
          <div className="relative w-full max-w-full flex items-center justify-center">
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              onTouchCancel={stopDrawing}
              className="border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-white cursor-crosshair touch-none"
              style={{
                width: '100%',
                maxWidth: isMobile ? '100%' : '800px',
                height: 'auto',
                display: 'block'
              }}
            />
          </div>
        </div>

        {/* Instructions */}
        <div className="px-3 sm:px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-t border-blue-200 dark:border-blue-800">
          <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-200 text-center">
            {isMobile 
              ? 'Draw your signature in the area above using your finger or stylus'
              : 'Draw your signature in the area above using your mouse or touchpad'}
          </p>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between p-3 sm:p-4 border-t border-gray-200 dark:border-gray-700 gap-2">
          <Button
            onClick={clearSignature}
            variant="outline"
            size="sm"
            disabled={!hasSignature}
            className="flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <RotateCcw className="h-4 w-4" />
            <span className="hidden sm:inline">Clear</span>
          </Button>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              onClick={onClose}
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-initial"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              size="sm"
              disabled={!hasSignature}
              className="flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white flex-1 sm:flex-initial"
            >
              <Check className="h-4 w-4" />
              <span className="hidden sm:inline">Submit Signature</span>
              <span className="sm:hidden">Submit</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

