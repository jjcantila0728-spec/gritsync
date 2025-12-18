import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { X, Download, Check } from 'lucide-react'

interface PDFReviewModalProps {
  isOpen: boolean
  onClose: () => void
  onReviewComplete: () => void
  pdfBlob: Blob | null
  documentName?: string
}

export function PDFReviewModal({ isOpen, onClose, onReviewComplete, pdfBlob, documentName }: PDFReviewModalProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [_hasReviewed, setHasReviewed] = useState(false)

  useEffect(() => {
    if (isOpen && pdfBlob) {
      const url = URL.createObjectURL(pdfBlob)
      setPdfUrl(url)
      setHasReviewed(false)
    }

    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl)
      }
    }
  }, [isOpen, pdfBlob])

  const handleDownload = () => {
    if (!pdfBlob) return
    
    const url = URL.createObjectURL(pdfBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${documentName || 'document'}_${new Date().toISOString().split('T')[0]}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleReviewComplete = () => {
    setHasReviewed(true)
    onReviewComplete()
  }

  if (!isOpen || !pdfUrl) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 p-2 sm:p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">
            Review Completed Files
          </h2>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleDownload}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Download</span>
            </Button>
            <Button
              onClick={onClose}
              variant="ghost"
              size="sm"
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </div>
        </div>

        {/* PDF Viewer */}
        <div className="flex-1 overflow-auto p-2 sm:p-4 bg-gray-50 dark:bg-gray-900">
          <iframe
            src={pdfUrl}
            className="w-full h-full min-h-[500px] border border-gray-300 dark:border-gray-600 rounded-lg"
            title="PDF Review"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-t border-gray-200 dark:border-gray-700 gap-2">
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
            Please review all documents before proceeding to sign.
          </p>
          <div className="flex gap-2">
            <Button
              onClick={onClose}
              variant="outline"
              size="sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleReviewComplete}
              size="sm"
              className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white"
            >
              <Check className="h-4 w-4" />
              I've Reviewed - Proceed to Sign
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}







