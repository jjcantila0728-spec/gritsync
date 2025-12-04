import { useState, useEffect } from 'react'
import { Image as ImageIcon } from 'lucide-react'
import { getSignedFileUrl } from '../../lib/supabase-api'

interface DocumentImagePreviewProps {
  filePath: string
  alt: string
  className?: string
}

export function DocumentImagePreview({ filePath, alt, className }: DocumentImagePreviewProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setError(false)
    setImageSrc(null)
    
    // Validate filePath is a string
    if (!filePath || typeof filePath !== 'string' || filePath.trim() === '') {
      setError(true)
      setLoading(false)
      return
    }

    // Handle legacy HTTP URLs
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      setImageSrc(filePath)
      setLoading(false)
      return
    }

    // For Supabase Storage, get signed URL
    getSignedFileUrl(filePath, 3600)
      .then(url => {
        if (typeof url === 'string' && url.trim() !== '') {
          setImageSrc(url)
          setError(false)
          setLoading(false)
        } else {
          setError(true)
          setLoading(false)
        }
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }, [filePath])

  if (error) {
    return (
      <div className={`${className || 'w-full h-full'} flex items-center justify-center bg-gray-100 dark:bg-gray-700`}>
        <ImageIcon className="h-12 w-12 text-gray-400" />
      </div>
    )
  }

  if (loading || !imageSrc) {
    return (
      <div className={`${className || 'w-full h-full'} flex items-center justify-center bg-gray-100 dark:bg-gray-700`}>
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    )
  }

  return (
    <img
      src={imageSrc}
      alt={alt}
      className={className || 'w-full h-full object-cover transition-opacity group-hover:opacity-90'}
      style={{ display: 'block', minHeight: '192px' }}
      onError={() => setError(true)}
    />
  )
}

