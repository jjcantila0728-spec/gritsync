import { useState, useEffect } from 'react'
import { Image as ImageIcon } from 'lucide-react'
import { getSignedFileUrl, getFileUrl } from '../../lib/supabase-api'

interface DocumentImagePreviewProps {
  filePath: string
  alt: string
  className?: string
}

export function DocumentImagePreview({ filePath, alt, className }: DocumentImagePreviewProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [triedPublicUrl, setTriedPublicUrl] = useState(false)

  useEffect(() => {
    console.log('DocumentImagePreview: useEffect triggered with filePath:', filePath, 'type:', typeof filePath)
    setLoading(true)
    setError(false)
    setImageSrc(null)
    setTriedPublicUrl(false)
    
    // Validate filePath is a string
    if (!filePath || typeof filePath !== 'string' || filePath.trim() === '') {
      console.warn('DocumentImagePreview: Invalid filePath', { filePath, type: typeof filePath, trimmed: filePath?.trim() })
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

    // Check if this is a picture file (for public access)
    const isPictureFile = /picture.*\.(jpg|jpeg|png|JPG|JPEG|PNG)$/i.test(filePath) || 
                          filePath.toLowerCase().includes('picture')

    // For picture files, try both signed URL and public URL
    // Signed URLs work if policy allows anon access (which it does for pictures)
    // Public URLs only work if bucket is public, but we'll try both
    if (isPictureFile) {
      console.log('DocumentImagePreview: Detected picture file, trying signed URL first:', filePath)
      getSignedFileUrl(filePath, 3600)
        .then(url => {
          if (typeof url === 'string' && url.trim() !== '') {
            console.log('DocumentImagePreview: Successfully got signed URL for picture:', filePath, 'URL:', url.substring(0, 100) + '...')
            setImageSrc(url)
            setError(false)
            setLoading(false)
          } else {
            console.error('DocumentImagePreview: Empty or invalid signed URL returned for', filePath)
            // Try public URL as fallback
            try {
              const publicUrl = getFileUrl(filePath)
              console.log('DocumentImagePreview: Trying public URL as fallback:', publicUrl.substring(0, 100) + '...')
              setTriedPublicUrl(true)
              setImageSrc(publicUrl)
              setLoading(false)
            } catch (publicError) {
              console.error('DocumentImagePreview: Public URL fallback also failed:', publicError)
              setError(true)
              setLoading(false)
            }
          }
        })
        .catch((err) => {
          console.error('DocumentImagePreview: Failed to get signed URL for picture:', filePath, 'Error:', err)
          // If signed URL fails, try public URL as fallback (in case bucket is public)
          try {
            const publicUrl = getFileUrl(filePath)
            console.log('DocumentImagePreview: Signed URL failed, trying public URL as fallback:', publicUrl.substring(0, 100) + '...')
            setTriedPublicUrl(true)
            setImageSrc(publicUrl)
            setLoading(false)
          } catch (publicError) {
            console.error('DocumentImagePreview: Both signed and public URL failed. Error details:', {
              signedUrlError: err,
              publicUrlError: publicError,
              filePath
            })
            setError(true)
            setLoading(false)
          }
        })
    } else {
      // For non-picture files, use signed URL (requires authentication)
      getSignedFileUrl(filePath, 3600)
        .then(url => {
          if (typeof url === 'string' && url.trim() !== '') {
            console.log('DocumentImagePreview: Successfully got signed URL for', filePath)
            setImageSrc(url)
            setError(false)
            setLoading(false)
          } else {
            console.error('DocumentImagePreview: Empty or invalid signed URL returned for', filePath)
            setError(true)
            setLoading(false)
          }
        })
        .catch((err) => {
          console.error('DocumentImagePreview: Failed to get signed URL for', filePath, err)
          setError(true)
          setLoading(false)
        })
    }
  }, [filePath])

  // Handle image load error - if signed URL failed and we tried public URL, try signed URL
  const handleImageError = () => {
    if (triedPublicUrl && imageSrc && !imageSrc.includes('token=')) {
      // Public URL failed, try signed URL as fallback
      console.log('DocumentImagePreview: Public URL failed, trying signed URL as fallback')
      getSignedFileUrl(filePath, 3600)
        .then(url => {
          if (typeof url === 'string' && url.trim() !== '') {
            console.log('DocumentImagePreview: Successfully got signed URL fallback for', filePath)
            setImageSrc(url)
            setError(false)
            setTriedPublicUrl(false) // Reset so we don't loop
          } else {
            console.error('DocumentImagePreview: Empty or invalid signed URL returned for', filePath)
            setError(true)
          }
        })
        .catch((err) => {
          console.error('DocumentImagePreview: Failed to get signed URL fallback for', filePath, err)
          setError(true)
        })
    } else if (!triedPublicUrl && imageSrc && imageSrc.includes('token=')) {
      // Signed URL failed, try public URL as fallback (in case bucket is public)
      console.log('DocumentImagePreview: Signed URL failed, trying public URL as fallback')
      try {
        const publicUrl = getFileUrl(filePath)
        setTriedPublicUrl(true)
        setImageSrc(publicUrl)
      } catch (publicError) {
        console.error('DocumentImagePreview: Public URL fallback also failed:', publicError)
        setError(true)
      }
    } else {
      // Already tried both or not applicable, show error
      setError(true)
    }
  }

  if (error) {
    console.log('DocumentImagePreview: Rendering error state for filePath:', filePath)
    return (
      <div className={`${className || 'w-full h-full'} flex items-center justify-center bg-gray-100 dark:bg-gray-700`}>
        <ImageIcon className="h-12 w-12 text-gray-400" />
      </div>
    )
  }

  if (loading || !imageSrc) {
    console.log('DocumentImagePreview: Rendering loading state', { loading, imageSrc, filePath })
    return (
      <div className={`${className || 'w-full h-full'} flex items-center justify-center bg-gray-100 dark:bg-gray-700`}>
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    )
  }

  console.log('DocumentImagePreview: Rendering image with src:', imageSrc?.substring(0, 100) + '...')

  return (
    <img
      src={imageSrc}
      alt={alt}
      className={className || 'w-full h-full object-cover transition-opacity group-hover:opacity-90'}
      style={{ display: 'block', minHeight: '192px' }}
      onError={handleImageError}
    />
  )
}

