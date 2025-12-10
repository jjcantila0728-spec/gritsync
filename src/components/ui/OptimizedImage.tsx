import { useState, useEffect, useRef, ImgHTMLAttributes } from 'react'
import { Image as ImageIcon } from 'lucide-react'

interface OptimizedImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'loading'> {
  src: string
  alt: string
  className?: string
  lazy?: boolean
  placeholder?: string
  fallback?: string
  sizes?: string
  srcSet?: string
}

/**
 * OptimizedImage component with lazy loading, error handling, and responsive image support
 * 
 * Features:
 * - Native lazy loading with Intersection Observer fallback
 * - Responsive images with srcset and sizes
 * - Error handling with fallback
 * - Loading placeholder
 * - Accessibility improvements
 */
export function OptimizedImage({
  src,
  alt,
  className = '',
  lazy = true,
  placeholder,
  fallback,
  sizes,
  srcSet,
  ...props
}: OptimizedImageProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(lazy ? null : src)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [isInView, setIsInView] = useState(!lazy)
  const imgRef = useRef<HTMLImageElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!lazy || isInView) return

    const img = imgRef.current
    if (!img) return

    // Check if IntersectionObserver is supported
    if ('IntersectionObserver' in window) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setIsInView(true)
              setImageSrc(src)
              if (observerRef.current && img) {
                observerRef.current.unobserve(img)
              }
            }
          })
        },
        {
          rootMargin: '50px', // Start loading 50px before image enters viewport
        }
      )

      observerRef.current.observe(img)
    } else {
      // Fallback for browsers without IntersectionObserver
      setIsInView(true)
      setImageSrc(src)
    }

    return () => {
      if (observerRef.current && img) {
        observerRef.current.unobserve(img)
      }
    }
  }, [lazy, src, isInView])

  // Handle image load
  const handleLoad = () => {
    setIsLoading(false)
    setHasError(false)
  }

  // Handle image error
  const handleError = () => {
    setIsLoading(false)
    if (fallback && imageSrc !== fallback) {
      setImageSrc(fallback)
      setHasError(false)
    } else {
      setHasError(true)
    }
  }

  // Show error state
  if (hasError) {
    return (
      <div
        className={`${className} flex items-center justify-center bg-gray-100 dark:bg-gray-700`}
        role="img"
        aria-label={alt}
      >
        <ImageIcon className="h-12 w-12 text-gray-400" aria-hidden="true" />
      </div>
    )
  }

  // Show loading placeholder
  if (isLoading && (placeholder || !isInView)) {
    return (
      <div
        className={`${className} flex items-center justify-center bg-gray-100 dark:bg-gray-700 animate-pulse`}
        role="img"
        aria-label={`Loading ${alt}`}
      >
        {placeholder ? (
          <img
            src={placeholder}
            alt=""
            className="w-full h-full object-cover opacity-50"
            aria-hidden="true"
          />
        ) : (
          <div className="text-gray-400 text-sm">Loading...</div>
        )}
      </div>
    )
  }

  return (
    <img
      ref={imgRef}
      src={imageSrc || src}
      alt={alt}
      className={`${className} transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
      loading={lazy && isInView ? 'lazy' : 'eager'}
      sizes={sizes}
      srcSet={srcSet}
      onLoad={handleLoad}
      onError={handleError}
      decoding="async"
      {...props}
    />
  )
}



