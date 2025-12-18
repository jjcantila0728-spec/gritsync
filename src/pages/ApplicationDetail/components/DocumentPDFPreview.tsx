import { useEffect, useState } from 'react'
import { getSignedFileUrl } from '@/lib/api'
import { FileText } from 'lucide-react'

interface DocumentPDFPreviewProps {
  filePath: string
  alt: string
  className?: string
}

export function DocumentPDFPreview({ filePath, alt, className }: DocumentPDFPreviewProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!filePath) {
      setError(true)
      return
    }

    // Handle legacy HTTP URLs
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      setPdfUrl(filePath)
      return
    }

    // For Supabase Storage, get signed URL
    getSignedFileUrl(filePath, 3600)
      .then(url => {
        setPdfUrl(url)
      })
      .catch(() => {
        setError(true)
      })
  }, [filePath])

  if (error) {
    return (
      <div className={`${className} flex items-center justify-center bg-red-50 dark:bg-red-900/20`}>
        <FileText className="h-12 w-12 text-red-400" />
      </div>
    )
  }

  if (!pdfUrl) {
    return (
      <div className={`${className} flex items-center justify-center bg-gray-100 dark:bg-gray-700`}>
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    )
  }

  return (
    <iframe
      src={`${pdfUrl}#page=1&zoom=50`}
      className={className}
      title={alt}
      onError={() => setError(true)}
    />
  )
}







