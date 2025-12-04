import { useEffect, useState, useMemo, useRef } from 'react'
import html2canvas from 'html2canvas'
import { useAuth } from '@/contexts/AuthContext'
import { useSearchParams, useParams, useLocation, useNavigate } from 'react-router-dom'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Loading, CardSkeleton } from '@/components/ui/Loading'
import { applicationsAPI, trackingAPI, getSignedFileUrl, getFileUrl } from '@/lib/api'
import { formatDate, paginate } from '@/lib/utils'
import { Eye, FileText, Search, CheckCircle, XCircle, Clock, Loader2, RefreshCw, Filter, X, ArrowUpDown, ArrowUp, ArrowDown, Image as ImageIcon, Shield, MapPin, GraduationCap, ExternalLink, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { Link } from 'react-router-dom'
import { subscribeToUserApplications, subscribeToAllApplications, unsubscribe } from '@/lib/realtime'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface Application {
  id: string
  grit_app_id?: string
  first_name: string
  last_name: string
  status: string
  created_at: string
  email: string
  updated_at?: string
  latest_update?: string | null
  display_name?: string
  current_progress?: string | null
  next_step?: string | null
  progress_percentage?: number
  completed_steps?: number
  total_steps?: number
  picture_url?: string | null
  picture_path?: string | null
  service_type?: string
  service_state?: string
}

type SortField = 'name' | 'date' | 'status'
type SortDirection = 'asc' | 'desc'

export function Tracking() {
  const { user, isAdmin } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const params = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const isAdminView = isAdmin() && location.pathname.startsWith('/admin/applications')
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [trackingId, setTrackingId] = useState('')
  const [trackingResult, setTrackingResult] = useState<Application | null>(null)
  const [trackingError, setTrackingError] = useState('')
  const [trackingLoading, setTrackingLoading] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [pictureUrl, setPictureUrl] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [refreshingTracking, setRefreshingTracking] = useState(false)
  const trackingResultRef = useRef<HTMLDivElement>(null)
  const autoRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null)
  
  // Enhanced filtering and sorting
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [refreshing, setRefreshing] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(10)
  const channelsRef = useRef<RealtimeChannel[]>([])

  // Track application by ID
  const handleTrackById = async (id: string) => {
    if (!id.trim()) return

    setTrackingLoading(true)
    setTrackingError('')
    setTrackingResult(null)
    setLoading(true)
    setImageError(false)

    try {
      const result = await trackingAPI.track(id.trim())
      setTrackingResult(result as Application)
      setTrackingId(id.trim())
    } catch (err: any) {
      setTrackingError(err.message || 'Application not found. Please check your tracking ID.')
      setTrackingResult(null)
    } finally {
      setTrackingLoading(false)
      setLoading(false)
    }
  }

  // Refresh tracking result to fetch latest timeline updates
  const refreshTrackingResult = async () => {
    if (!trackingId.trim() || !trackingResult) return

    setRefreshingTracking(true)
    setTrackingError('')

    try {
      // Use API to fetch latest timeline updates
      const result = await trackingAPI.track(trackingId.trim())
      setTrackingResult(result as Application)
    } catch (err: any) {
      setTrackingError(err.message || 'Failed to refresh tracking information.')
    } finally {
      setRefreshingTracking(false)
    }
  }

  // Reset image error when tracking result changes
  useEffect(() => {
    setImageError(false)
    setPictureUrl(null)
    
    // Load picture - prioritize picture_url (public URL) for public tracking
    if (trackingResult?.picture_url) {
      // Use picture_url first (should be a public URL that works for everyone)
      setPictureUrl(trackingResult.picture_url)
      setImageError(false)
    } else if (trackingResult?.picture_path) {
      // If no picture_url, try to get URL from picture_path
      // For public users, try public URL first
      try {
        const publicUrl = getFileUrl(trackingResult.picture_path)
        setPictureUrl(publicUrl)
        setImageError(false)
      } catch (publicError) {
        // Public URL failed, try signed URL (works for authenticated users)
        getSignedFileUrl(trackingResult.picture_path, 3600)
          .then(url => {
            setPictureUrl(url)
            setImageError(false)
          })
          .catch(error => {
            // All methods failed
            setImageError(true)
          })
      }
    }
  }, [trackingResult])

  // Auto-track from URL parameters
  useEffect(() => {
    const idFromQuery = searchParams.get('id')
    const idFromPath = params.id
    
    const appId = idFromQuery || idFromPath
    
    if (appId) {
      // Auto-track for both authenticated and non-authenticated users when ID is present
      setTrackingId(appId)
      handleTrackById(appId)
    } else if (user) {
      fetchApplications()
    } else {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, searchParams, params.id])

  // Auto-refresh tracking result every 30 seconds when tracking result is displayed
  useEffect(() => {
    if (trackingResult && trackingId) {
      // Clear any existing interval
      if (autoRefreshIntervalRef.current) {
        clearInterval(autoRefreshIntervalRef.current)
      }

      // Set up auto-refresh every 30 seconds
      autoRefreshIntervalRef.current = setInterval(() => {
        refreshTrackingResult()
      }, 30000) // 30 seconds

      // Cleanup on unmount or when tracking result changes
      return () => {
        if (autoRefreshIntervalRef.current) {
          clearInterval(autoRefreshIntervalRef.current)
          autoRefreshIntervalRef.current = null
        }
      }
    } else {
      // Clear interval if no tracking result
      if (autoRefreshIntervalRef.current) {
        clearInterval(autoRefreshIntervalRef.current)
        autoRefreshIntervalRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackingResult, trackingId])

  // Set up real-time subscriptions for application status changes
  useEffect(() => {
    if (!user || trackingResult) return // Don't subscribe if tracking by ID or no user

    const channels: RealtimeChannel[] = []

    // Subscribe to applications based on user role
    if (isAdminView) {
      // Admin: subscribe to all applications
      const appsChannel = subscribeToAllApplications((payload) => {
        handleApplicationUpdate(payload)
      })
      channels.push(appsChannel)
    } else {
      // Client: subscribe to user's applications
      const appsChannel = subscribeToUserApplications(user.id, (payload) => {
        handleApplicationUpdate(payload)
      })
      channels.push(appsChannel)
    }

    channelsRef.current = channels

    // Cleanup on unmount
    return () => {
      channels.forEach(channel => unsubscribe(channel))
      channelsRef.current = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isAdminView, trackingResult])

  async function fetchApplications() {
    try {
      if (user) {
        const data = await applicationsAPI.getAll()
        setApplications(data || [])
      }
    } catch (error) {
      console.error('Error fetching applications:', error)
      setApplications([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Handle real-time application updates
  function handleApplicationUpdate(payload: any) {
    try {
      const eventType = payload.eventType || payload.event
      const newRecord = payload.new
      const oldRecord = payload.old

      if (eventType === 'INSERT' && newRecord) {
        // New application added - refresh list
        fetchApplications()
      } else if (eventType === 'UPDATE' && newRecord) {
        // Application updated - update in place or refresh
        setApplications((prevApps) => {
          const index = prevApps.findIndex((app) => app.id === newRecord.id)
          if (index >= 0) {
            // Update existing application
            const updated = [...prevApps]
            updated[index] = { ...updated[index], ...newRecord }
            return updated
          } else {
            // Application not in list, might be new - refresh to be safe
            fetchApplications()
            return prevApps
          }
        })
      } else if (eventType === 'DELETE' && oldRecord) {
        // Application deleted - remove from list
        setApplications((prevApps) => prevApps.filter((app) => app.id !== oldRecord.id))
      }
    } catch (error) {
      console.error('Error handling application update:', error)
      // Fallback to full refresh on error
      fetchApplications()
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchApplications()
  }

  // Calculate status based on actual progress and timeline completion
  const getDisplayStatus = (app: Application): string => {
    // FIRST: Check the database status - this is the source of truth
    // Normalize status to lowercase for case-insensitive comparison
    const status = app.status ? String(app.status).toLowerCase().trim() : null
    
    // If database status is explicitly completed or approved, return completed
    if (status === 'completed' || status === 'approved') {
      return 'completed'
    }
    
    // If database status is explicitly rejected, return rejected
    if (status === 'rejected') {
      return 'rejected'
    }
    
    // If progress is 100%, status is completed (even if DB status isn't set)
    if (app.progress_percentage !== undefined && app.progress_percentage >= 100) {
      return 'completed'
    }
    
    // If there's an exam result (passed or failed), status is completed
    if (app.current_progress && (
      app.current_progress.includes('Passed') || 
      app.current_progress.includes('Congratulations') ||
      app.current_progress.includes('failed') ||
      app.current_progress.includes('Failed')
    )) {
      return 'completed'
    }
    
    // Map legacy statuses to new ones
    if (status === 'pending') {
      // Only return 'initiated' if progress is actually 0 or very low
      // If there's any progress, it should be 'in-progress' instead
      if (app.progress_percentage !== undefined && app.progress_percentage > 0) {
        return 'in-progress'
      }
      return 'initiated'
    }
    
    // Check if current_progress indicates a significant step has been completed
    // If current_progress shows a completed step (not just "Application Submission"), it's in-progress
    if (app.current_progress) {
      const progressLower = app.current_progress.toLowerCase()
      // If current progress is beyond initial submission, it's in-progress
      if (
        progressLower.includes('credentialing') ||
        progressLower.includes('bon application') ||
        progressLower.includes('nclex eligibility') ||
        progressLower.includes('pearson vue') ||
        progressLower.includes('att') ||
        progressLower.includes('nclex exam')
      ) {
        // These steps indicate the application is actively being processed
        return 'in-progress'
      }
    }
    
    // If progress is 0 or very low, it's initiated
    if (app.progress_percentage !== undefined && app.progress_percentage === 0) {
      return 'initiated'
    }
    
    // If progress is between 1-99%, it's in-progress
    if (app.progress_percentage !== undefined && app.progress_percentage > 0 && app.progress_percentage < 100) {
      return 'in-progress'
    }
    
    // If status is null/undefined and we have no progress info, default to initiated
    // Otherwise, return the normalized status
    return status || 'initiated'
  }

  // Format status for consistent display (title case)
  const formatStatusDisplay = (status: string): string => {
    return status
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  // Get exam result from current progress if status is completed
  const getExamResult = (app: Application): string | null => {
    if (getDisplayStatus(app) !== 'completed') {
      return null
    }
    
    if (app.current_progress) {
      if (app.current_progress.includes('Passed') || app.current_progress.includes('Congratulations')) {
        return 'Passed'
      }
      if (app.current_progress.includes('Failed') || app.current_progress.includes('failed')) {
        return 'Failed'
      }
    }
    
    return null
  }

  // Mask the middle 7 characters of GRIT APP ID
  const maskGritAppId = (id: string | undefined): string => {
    if (!id) return ''
    // If it's a UUID (contains hyphens), don't mask it
    if (id.includes('-')) return id
    // If it's shorter than 10 characters, don't mask it
    if (id.length < 10) return id
    // Mask middle 7 characters
    const start = id.slice(0, Math.floor((id.length - 7) / 2))
    const end = id.slice(start.length + 7)
    return `${start}*******${end}`
  }

  // Filter and sort applications
  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, statusFilter])

  const filteredAndSortedApplications = useMemo(() => {
    let filtered = [...applications]

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (app) => {
          const displayName = (app.display_name || `${app.first_name} ${app.last_name}`).toLowerCase()
          return (
            displayName.includes(query) ||
            app.first_name.toLowerCase().includes(query) ||
            app.last_name.toLowerCase().includes(query) ||
            app.email.toLowerCase().includes(query) ||
            app.id.toLowerCase().includes(query)
          )
        }
      )
    }

    // Apply status filter (using status from database)
    if (statusFilter !== 'all') {
      filtered = filtered.filter((app) => {
        const displayStatus = getDisplayStatus(app)
        // Map legacy statuses to new ones for filtering
        if (statusFilter === 'pending') {
          return displayStatus === 'initiated' || app.status === 'pending'
        }
        if (statusFilter === 'approved') {
          // Support both 'completed' and legacy 'approved' status
          return displayStatus === 'completed' || app.status === 'completed' || app.status === 'approved'
        }
        return displayStatus === statusFilter || app.status === statusFilter
      })
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0
      
      switch (sortField) {
        case 'name':
          const nameA = (a.display_name || `${a.first_name} ${a.last_name}`).toLowerCase()
          const nameB = (b.display_name || `${b.first_name} ${b.last_name}`).toLowerCase()
          comparison = nameA.localeCompare(nameB)
          break
        case 'date':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          break
        case 'status':
          comparison = a.status.localeCompare(b.status)
          break
      }
      
      return sortDirection === 'asc' ? comparison : -comparison
    })

    return filtered
  }, [applications, searchQuery, statusFilter, sortField, sortDirection])

  const paginatedApplications = useMemo(() => {
    return paginate(filteredAndSortedApplications, currentPage, pageSize)
  }, [filteredAndSortedApplications, currentPage, pageSize])

  // Calculate statistics based on status from database
  const stats = useMemo(() => {
    const total = applications.length
    const initiated = applications.filter((app) => getDisplayStatus(app) === 'initiated').length
    const inProgress = applications.filter((app) => getDisplayStatus(app) === 'in-progress').length
    const completed = applications.filter((app) => getDisplayStatus(app) === 'completed').length
    const rejected = applications.filter((app) => getDisplayStatus(app) === 'rejected').length
    // Legacy support - include old status values
    const pending = applications.filter((app) => app.status === 'pending').length
    const approved = applications.filter((app) => app.status === 'completed' || app.status === 'approved').length
    
    return { 
      total, 
      pending: initiated + pending, 
      approved: completed + approved, 
      rejected,
      initiated,
      inProgress,
      completed
    }
  }, [applications])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
    setCurrentPage(1) // Reset to first page on sort
  }

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!trackingId.trim()) return

    setTrackingLoading(true)
    setTrackingError('')
    setTrackingResult(null)

    try {
      const result = await trackingAPI.track(trackingId.trim())
      setTrackingResult(result as Application)
      
      // Navigate to tracking URL with ID as query parameter
      const appId = (result as Application).grit_app_id || (result as Application).id
      navigate(`/tracking?id=${appId}`)
    } catch (err: any) {
      setTrackingError(err.message || 'Application not found. Please check your tracking ID.')
      setTrackingResult(null)
    } finally {
      setTrackingLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 dark:text-green-400'
      case 'rejected':
        return 'text-red-600 dark:text-red-400'
      case 'in-progress':
        return 'text-blue-600 dark:text-blue-400'
      case 'initiated':
        return 'text-yellow-600 dark:text-yellow-400'
      case 'approved': // Legacy support
        return 'text-green-600 dark:text-green-400'
      case 'pending': // Legacy support
        return 'text-yellow-600 dark:text-yellow-400'
      default:
        return 'text-gray-600 dark:text-gray-400'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
      case 'rejected':
        return <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
      case 'in-progress':
        return <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
      case 'initiated':
        return <FileText className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
      case 'approved': // Legacy support
        return <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
      case 'pending': // Legacy support
        return <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
      default:
        return <FileText className="h-5 w-5 text-gray-600 dark:text-gray-400" />
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'approved':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
      case 'in-progress':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
      case 'initiated':
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
    }
  }

  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) {
      return 'text-green-600 dark:text-green-400'
    } else if (percentage >= 50) {
      return 'text-yellow-600 dark:text-yellow-400'
    } else if (percentage >= 25) {
      return 'text-orange-600 dark:text-orange-400'
    } else {
      return 'text-red-600 dark:text-red-400'
    }
  }

  const handleDownloadPNG = async () => {
    if (!trackingResultRef.current || !trackingResult) {
      return
    }

    setDownloading(true)
    try {
      // Wait for images to load with better error handling
      const images = trackingResultRef.current.querySelectorAll('img')
      const imagePromises = Array.from(images).map((img) => {
        if (img.complete && img.naturalWidth > 0) {
          return Promise.resolve()
        }
        return new Promise((resolve) => {
          const timeout = setTimeout(() => resolve(), 8000) // Increased timeout
          img.onload = () => {
            clearTimeout(timeout)
            resolve()
          }
          img.onerror = () => {
            clearTimeout(timeout)
            resolve() // Continue even if image fails
          }
        })
      })
      await Promise.all(imagePromises)
      
      // Additional delay to ensure images are fully rendered with object-fit
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Wait for fonts to load
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready
      }
      
      // Additional delay to ensure all CSS animations and transitions are complete
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Get bounding rect for accurate positioning
      const rect = trackingResultRef.current.getBoundingClientRect()
      
      // Enhanced html2canvas configuration for maximum quality
      const canvas = await html2canvas(trackingResultRef.current, {
        backgroundColor: null, // Use transparent to preserve gradients and actual background
        scale: 3, // Increased scale for higher quality (3x for crisp text and images)
        logging: false,
        useCORS: true,
        allowTaint: false,
        width: rect.width,
        height: rect.height,
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0,
        imageTimeout: 20000, // Increased timeout for slow images
        removeContainer: false,
        pixelRatio: window.devicePixelRatio || 1, // Use device pixel ratio for better quality
        ignoreElements: (element) => {
          // Don't ignore any elements - capture everything
          return false
        },
        onclone: (clonedDoc, element) => {
          // Ensure all styles are properly applied in the clone, especially text
          const clonedElement = element as HTMLElement
          if (clonedElement) {
            // Force reflow to ensure all styles are computed
            clonedElement.offsetHeight
            
            // Improve text rendering in header and footer
            const textElements = clonedElement.querySelectorAll('h2, h3, p, span, h1')
            textElements.forEach((el) => {
              const htmlEl = el as HTMLElement
              // Get computed styles from the cloned document
              const computed = clonedDoc.defaultView?.getComputedStyle(el) || window.getComputedStyle(el)
              
              // Ensure text rendering is optimized
              htmlEl.style.webkitFontSmoothing = 'antialiased'
              htmlEl.style.mozOsxFontSmoothing = 'grayscale'
              htmlEl.style.textRendering = 'optimizeLegibility'
              htmlEl.style.fontSmooth = 'always'
              
              // Force text to render with proper color and styles
              if (computed.color) {
                htmlEl.style.color = computed.color
              }
              if (computed.fontWeight) {
                htmlEl.style.fontWeight = computed.fontWeight
              }
              if (computed.fontSize) {
                htmlEl.style.fontSize = computed.fontSize
              }
              if (computed.fontFamily) {
                htmlEl.style.fontFamily = computed.fontFamily
              }
              if (computed.textShadow) {
                htmlEl.style.textShadow = computed.textShadow
              }
              // Ensure white text on gradients is visible
              if (computed.color === 'rgb(255, 255, 255)' || computed.color === 'white') {
                htmlEl.style.color = '#ffffff'
              }
            })
            
            // Ensure images are properly rendered with object-fit
            const images = clonedElement.querySelectorAll('img')
            images.forEach((img) => {
              const htmlImg = img as HTMLImageElement
              const computed = clonedDoc.defaultView?.getComputedStyle(img) || window.getComputedStyle(img)
              
              // Preserve object-fit and object-position for proper image adjustment
              if (computed.objectFit) {
                htmlImg.style.objectFit = computed.objectFit
              }
              if (computed.objectPosition) {
                htmlImg.style.objectPosition = computed.objectPosition
              }
              // Ensure image dimensions are preserved
              if (computed.width) {
                htmlImg.style.width = computed.width
              }
              if (computed.height) {
                htmlImg.style.height = computed.height
              }
              // Ensure image is displayed properly
              htmlImg.style.display = computed.display || 'block'
              
              // Also preserve parent container styles that affect image rendering
              const parent = htmlImg.parentElement
              if (parent) {
                const parentComputed = clonedDoc.defaultView?.getComputedStyle(parent) || window.getComputedStyle(parent)
                if (parentComputed.overflow) {
                  parent.style.overflow = parentComputed.overflow
                }
                if (parentComputed.borderRadius) {
                  parent.style.borderRadius = parentComputed.borderRadius
                }
              }
            })
            
            // Force a second reflow after style changes
            clonedElement.offsetHeight
          }
        }
      })
      
      // Create a new canvas with white background and enhanced rendering
      const finalCanvas = document.createElement('canvas')
      finalCanvas.width = canvas.width
      finalCanvas.height = canvas.height
      const ctx = finalCanvas.getContext('2d', {
        alpha: false, // No transparency for JPEG
        desynchronized: false,
        willReadFrequently: false
      })
      if (!ctx) {
        throw new Error('Failed to get canvas context')
      }
      
      // Enable high-quality image rendering
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      
      // Fill with white background
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height)
      
      // Draw the captured canvas on top with high quality
      ctx.drawImage(canvas, 0, 0)

      // Convert final canvas to blob with maximum quality
      finalCanvas.toBlob((blob) => {
        if (!blob) {
          console.error('Failed to create blob')
          setDownloading(false)
          return
        }

        // Create download link
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${trackingResult.id}_tracking_result.jpg`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
        setDownloading(false)
      }, 'image/jpeg', 0.98) // Increased quality from 0.92 to 0.98 for better image quality
    } catch (error) {
      console.error('Error downloading JPEG:', error)
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <div className="flex">
          {user && <Sidebar />}
          <main className="flex-1 p-4 md:p-8">
            <div className="mb-8">
              <div className="h-9 bg-gray-200 dark:bg-gray-700 rounded w-64 animate-pulse" />
            </div>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <div className="flex">
        {user && <Sidebar />}
        <main className="flex-1 p-4 md:p-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
              {!user ? 'Application Tracking' : isAdmin() ? 'All Applications' : 'My Applications'}
            </h1>
            <div className="flex items-center gap-3">
              {user && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={refreshing || loading}
                  className="w-full sm:w-auto"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              )}
              {user && !isAdmin() && (
                <Link to="/application/new">
                  <Button className="w-full sm:w-auto">New Application</Button>
                </Link>
              )}
            </div>
          </div>


          {/* Show tracking form and result for public users OR when tracking result exists */}
          {(!user || trackingResult || trackingId) ? (
            <div className="max-w-7xl mx-auto">
              <Card>
                <div className="p-6 md:p-8">
                  <div className="grid md:grid-cols-2 gap-8">
                    {/* Left Side - Track Application Form */}
                    <div className="border-r border-gray-200 dark:border-gray-700 pr-8">
                      <div className="flex items-center gap-3 mb-6">
                        <Search className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                          Track Your Application
                        </h2>
                      </div>
                      <p className="text-gray-600 dark:text-gray-400 mb-6">
                        Enter your application tracking ID to check the status of your NCLEX application.
                      </p>
                      <form onSubmit={handleTrack} className="space-y-4">
                        <Input
                          label="Tracking ID"
                          type="text"
                          value={trackingId}
                          onChange={(e) => setTrackingId(e.target.value)}
                          placeholder="Enter your application ID"
                          required
                        />
                        {trackingError && (
                          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-600 dark:text-red-400">
                            {trackingError}
                          </div>
                        )}
                        <Button type="submit" disabled={trackingLoading} className="w-full">
                          {trackingLoading ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Tracking...
                            </>
                          ) : (
                            <>
                              <Search className="h-4 w-4 mr-2" />
                              Track Application
                            </>
                          )}
                        </Button>
                      </form>
                    </div>

                    {/* Right Side - Tracking Result */}
                    <div className="pl-0 md:pl-8">
                      {trackingLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="h-8 w-8 animate-spin text-primary-600 dark:text-primary-400" />
                        </div>
                      ) : trackingResult ? (
                        <div className="relative">
                          {/* Download and Refresh Buttons */}
                          <div className="mb-4 flex justify-end gap-2">
                            <Button
                              onClick={refreshTrackingResult}
                              disabled={refreshingTracking || trackingLoading}
                              variant="outline"
                              size="sm"
                            >
                              {refreshingTracking ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Refreshing...
                                </>
                              ) : (
                                <>
                                  <RefreshCw className="h-4 w-4 mr-2" />
                                  Refresh
                                </>
                              )}
                            </Button>
                            <Button
                              onClick={handleDownloadPNG}
                              disabled={downloading}
                              variant="outline"
                              size="sm"
                            >
                              {downloading ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Downloading...
                                </>
                              ) : (
                                <>
                                  <Download className="h-4 w-4 mr-2" />
                                  Download
                                </>
                              )}
                            </Button>
                          </div>
                          <div ref={trackingResultRef} className="relative overflow-hidden rounded-lg shadow-xl">
                            <div className="relative">
                            {/* Header - Orange to Maroon Gradient */}
                            <div className="bg-gradient-to-br from-orange-500 via-orange-600 to-red-900 dark:from-orange-600 dark:via-orange-700 dark:to-red-950 py-2 px-4">
                              <div className="flex items-center justify-between">
                                {/* Left - Logo */}
                                <div className="flex items-center gap-1">
                                  <div className="h-16 w-16 rounded-lg flex items-center justify-center overflow-hidden">
                                    <img 
                                      src="/gritsync_logo.png" 
                                      alt="GritSync Logo" 
                                      className="h-full w-full object-contain p-2"
                                    />
                                  </div>
                                  <span className="text-3xl font-bold text-white">
                                    <span className="text-gray-500">GRIT</span>
                                    <span className="text-white">SYNC</span>
                                  </span>
                                </div>
                                {/* Right - NCLEX-RN and Tracking ID */}
                                <div className="text-right">
                                  <h2 className="text-2xl font-bold text-white">NCLEX-RN</h2>
                                  <p className="font-mono text-sm font-bold text-white/90">{maskGritAppId(trackingResult.grit_app_id || trackingResult.id)}</p>
                                </div>
                              </div>
                            </div>

                            {/* Body - White Background */}
                            <div className="bg-white dark:bg-gray-50 p-6 space-y-6">
                              {/* Main Content - Two Column Layout */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Left Column - Information */}
                                <div className="space-y-4">
                                  {/* Applicant Information */}
                                  <div className="space-y-3">
                                    <div>
                                      <p className="text-xs font-medium text-gray-600 dark:text-gray-600 mb-1">Applicant Name</p>
                                      <p className="text-xl font-bold text-gray-900 dark:text-gray-900">
                                        {trackingResult.first_name} {trackingResult.last_name},USRN
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs font-medium text-gray-600 dark:text-gray-600 mb-1">Email</p>
                                      <p className="text-sm text-gray-900 dark:text-gray-900">{trackingResult.email}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <p className="text-xs font-medium text-gray-600 dark:text-gray-600 mb-1">Submitted</p>
                                        <p className="text-xs text-gray-900 dark:text-gray-900">{formatDate(trackingResult.created_at)}</p>
                                      </div>
                                      {trackingResult.updated_at && (
                                        <div>
                                          <p className="text-xs font-medium text-gray-600 dark:text-gray-600 mb-1">Last Updated</p>
                                          <p className="text-xs text-gray-900 dark:text-gray-900">{formatDate(trackingResult.updated_at)}</p>
                                        </div>
                                      )}
                                    </div>
                                    {/* Service Type and State */}
                                    <div className="grid grid-cols-2 gap-3 mt-3">
                                      <div className="p-3 bg-gray-50 dark:bg-gray-100 rounded-lg border border-gray-200 dark:border-gray-300">
                                        <div className="flex items-center gap-2 mb-1">
                                          <Shield className="h-3.5 w-3.5 text-primary-600 dark:text-primary-600" />
                                          <p className="text-xs font-medium text-gray-500 dark:text-gray-600 uppercase tracking-wide">
                                            Service
                                          </p>
                                        </div>
                                        <p className="text-sm font-bold text-gray-900 dark:text-gray-900 mt-1">
                                          {trackingResult.service_type || 'NCLEX Processing'}
                                        </p>
                                      </div>
                                      
                                      <div className="p-3 bg-gray-50 dark:bg-gray-100 rounded-lg border border-gray-200 dark:border-gray-300">
                                        <div className="flex items-center gap-2 mb-1">
                                          <MapPin className="h-3.5 w-3.5 text-primary-600 dark:text-primary-600" />
                                          <p className="text-xs font-medium text-gray-500 dark:text-gray-600 uppercase tracking-wide">
                                            State
                                          </p>
                                        </div>
                                        <p className="text-sm font-bold text-gray-900 dark:text-gray-900 mt-1">
                                          {trackingResult.service_state || 'New York'}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Right Column - Large Picture and Status */}
                                <div className="relative flex flex-col items-center justify-center md:items-start md:justify-end">
                                  {(trackingResult.picture_path || trackingResult.picture_url) && (
                                    <div className="relative w-48 h-48 md:w-56 md:h-56 rounded-xl border-4 border-gray-200 dark:border-gray-300 overflow-hidden bg-gray-50 dark:bg-gray-100 shadow-2xl">
                                      {imageError || !pictureUrl ? (
                                        <div className="w-full h-full flex items-center justify-center">
                                          <ImageIcon className="h-16 w-16 text-gray-400" />
                                        </div>
                                      ) : (
                                        <img
                                          src={pictureUrl}
                                          alt="2x2 Picture"
                                          className="w-full h-full object-cover"
                                          onError={() => {
                                            // Silently handle image load errors
                                            setImageError(true)
                                          }}
                                          onLoad={() => {
                                            setImageError(false)
                                          }}
                                        />
                                      )}
                                    </div>
                                  )}
                                  {/* Status Text at Center Bottom (Outside Picture) */}
                                  <div className="w-full text-center mt-1">
                                    <p className={`text-2xl font-bold ${getStatusColor(getDisplayStatus(trackingResult))} flex items-center justify-center gap-0`}>
                                      {(() => {
                                        const examResult = trackingResult.current_progress && getDisplayStatus(trackingResult) === 'completed'
                                          ? (trackingResult.current_progress.includes('Passed') || trackingResult.current_progress.includes('Congratulations')
                                              ? (
                                                <>
                                                  <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                                                  <span>Passed</span>
                                                </>
                                              )
                                              : trackingResult.current_progress.includes('Failed') || trackingResult.current_progress.includes('failed')
                                              ? 'Failed'
                                              : formatStatusDisplay(getDisplayStatus(trackingResult)))
                                          : formatStatusDisplay(getDisplayStatus(trackingResult))
                                        return examResult
                                      })()}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              {/* Progress and Next Steps */}
                              {(trackingResult.current_progress || trackingResult.next_step) && (
                                <div className="pt-4 border-t border-gray-200 dark:border-gray-300">
                                  <h3 className="text-sm font-bold text-gray-900 dark:text-gray-900 mb-3 flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-primary-600 dark:text-primary-600" />
                                    Application Progress
                                  </h3>
                                  <div className="space-y-3">
                                    {trackingResult.current_progress && (
                                      <div className={`flex items-start gap-2 p-3 rounded-lg border ${
                                        trackingResult.current_progress.includes('Passed')
                                          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                                          : trackingResult.current_progress.includes('Failed')
                                          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                                          : 'bg-green-50 dark:bg-green-50 border-green-200 dark:border-green-200'
                                      }`}>
                                        {trackingResult.current_progress.startsWith('Exam Result:') ? (
                                          trackingResult.current_progress.includes('Passed') ? (
                                            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                                          ) : (
                                            <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                                          )
                                        ) : (
                                          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-600 mt-0.5 flex-shrink-0" />
                                        )}
                                        <div className="flex-1 min-w-0">
                                          <p className={`text-xs font-semibold mb-1 uppercase tracking-wide ${
                                            trackingResult.current_progress.includes('Passed')
                                              ? 'text-green-700 dark:text-green-400'
                                              : trackingResult.current_progress.includes('Failed')
                                              ? 'text-red-700 dark:text-red-400'
                                              : 'text-green-700 dark:text-green-700'
                                          }`}>
                                            {trackingResult.current_progress.startsWith('Exam Result:') ? 'Exam Result' : 'Current Progress'}
                                          </p>
                                          <p className={`text-sm font-semibold ${
                                            trackingResult.current_progress.includes('Passed')
                                              ? 'text-green-700 dark:text-green-300'
                                              : trackingResult.current_progress.includes('Failed')
                                              ? 'text-red-700 dark:text-red-300'
                                              : 'text-gray-900 dark:text-gray-900'
                                          }`}>
                                            {trackingResult.current_progress}
                                          </p>
                                        </div>
                                      </div>
                                    )}
                                    {trackingResult.next_step && (
                                      <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-50 rounded-lg border border-blue-200 dark:border-blue-200">
                                        <Clock className="h-4 w-4 text-blue-600 dark:text-blue-600 mt-0.5 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs font-semibold text-blue-700 dark:text-blue-700 mb-1 uppercase tracking-wide">
                                            Next Step
                                          </p>
                                          <p className="text-sm font-medium text-gray-900 dark:text-gray-900">
                                            {trackingResult.next_step.includes('Nursys') ? (
                                              <>
                                                {trackingResult.next_step.split('"Nursys"')[0]}
                                                <span 
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    window.open('https://www.nursys.com/LQC/LQCSearch.aspx', '_blank', 'noopener,noreferrer')
                                                  }}
                                                  className="text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
                                                >
                                                  Nursys
                                                </span>
                                                {trackingResult.next_step.split('"Nursys"')[1]}
                                              </>
                                            ) : trackingResult.next_step === 'Retake again!' ? (
                                              <span 
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  navigate('/application/new')
                                                }}
                                                className="text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
                                              >
                                                Retake again!
                                              </span>
                                            ) : (
                                              trackingResult.next_step
                                            )}
                                          </p>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Footer - Blue Gradient */}
                            <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 dark:from-blue-700 dark:via-blue-800 dark:to-blue-900 py-2">
                              <div className="text-center">
                                <h3 className="text-lg font-bold text-white tracking-widest">
                                  AMERICAN DREAM
                                </h3>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      ) : (
                        <div className="text-center py-12">
                          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Enter a tracking ID to view application status
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          ) : !user ? (
            // Public users should only see the tracking form
            <Card>
              <div className="text-center py-12">
                <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Enter your tracking ID above to view your application status
                </p>
              </div>
            </Card>
          ) : applications.length === 0 ? (
            <Card>
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  No applications found
                </p>
                {!isAdmin() && (
                  <Link to="/application/new">
                    <Button>Create New Application</Button>
                  </Link>
                )}
              </div>
            </Card>
          ) : filteredAndSortedApplications.length === 0 ? (
            <Card>
              <div className="text-center py-12">
                <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400 mb-2">
                  No applications match your filters
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
                  Try adjusting your search or filter criteria
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery('')
                    setStatusFilter('all')
                  }}
                >
                  Clear Filters
                </Button>
              </div>
            </Card>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredAndSortedApplications.length)} of {filteredAndSortedApplications.length} application{filteredAndSortedApplications.length !== 1 ? 's' : ''}
                </div>
                {paginatedApplications.totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={!paginatedApplications.hasPreviousPage}
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="text-sm text-gray-600 dark:text-gray-400 px-3">
                      Page {currentPage} of {paginatedApplications.totalPages}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(paginatedApplications.totalPages, prev + 1))}
                      disabled={!paginatedApplications.hasNextPage}
                      aria-label="Next page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="space-y-4">
                {paginatedApplications.data.map((app) => (
                  <Card 
                    key={app.id}
                    className="hover:shadow-md hover:border-primary-300 dark:hover:border-primary-700 transition-all duration-200 relative overflow-hidden cursor-pointer"
                    onClick={() => {
                      const routeId = app.grit_app_id || app.id
                      navigate(`${isAdmin() ? '/admin/applications' : '/applications'}/${routeId}/timeline`)
                    }}
                  >
                      {/* Progress Percentage - Top Right Corner */}
                      {app.progress_percentage !== undefined && app.progress_percentage !== null ? (
                        <div className="absolute top-2 right-2 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 px-3 py-1 rounded-bl-lg">
                          <span className={`text-2xl font-bold ${getProgressColor(Math.round(app.progress_percentage))}`}>
                            {Math.round(app.progress_percentage)}%
                          </span>
                        </div>
                      ) : null}
                      
                      <div className="p-4">
                      {/* Header Section - Compact */}
                      <div className="flex items-start justify-between gap-3 mb-2 pr-16">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {isAdminView ? (
                              <>
                                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
                                  {app.first_name} {app.last_name}
                                </h3>
                                <span className="text-base font-semibold text-gray-400 dark:text-gray-500">-</span>
                                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
                                  {app.service_type || 'NCLEX Processing'}
                                </h3>
                              </>
                            ) : (
                              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
                                {app.service_type || 'NCLEX Processing'}
                              </h3>
                            )}
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                              Status:
                            </span>
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(getDisplayStatus(app))}`}>
                              {(() => {
                                const examResult = getExamResult(app)
                                if (examResult === 'Passed') {
                                  return (
                                    <>
                                      <CheckCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                                      <span>Passed</span>
                                    </>
                                  )
                                }
                                return (
                                  <>
                                    {getStatusIcon(getDisplayStatus(app))}
                                    {examResult || formatStatusDisplay(getDisplayStatus(app))}
                                  </>
                                )
                              })()}
                            </span>
                          </div>
                          <span className="inline-block mb-1 px-2 py-0.5 rounded text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800">
                            {app.service_state ? `${app.service_state.toUpperCase()} STATE BOARD OF NURSING` : 'NEWYORK STATE BOARD OF NURSING'}
                          </span>
                          <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                            {app.email}
                          </p>
                        </div>
                      </div>

                      {/* Key Information - Inline Compact */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2 text-xs text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-1.5">
                          <FileText className="h-3 w-3" />
                          <span className="font-mono">{maskGritAppId(app.grit_app_id || app.id)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3" />
                          <span>Submitted: {formatDate(app.created_at)}</span>
                        </div>
                        {app.updated_at && app.updated_at !== app.created_at && (
                          <div className="flex items-center gap-1.5">
                            <RefreshCw className="h-3 w-3" />
                            <span>Updated: {formatDate(app.updated_at)}</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Current Progress and Next Step */}
                      {(app.current_progress || app.next_step) && (
                        <div className="mb-2 space-y-2">
                          {/* Current Progress */}
                          {app.current_progress ? (
                            <div className="flex items-start gap-2 px-2 py-1.5 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800/50">
                              {app.current_progress.includes('Passed') || app.current_progress.includes('Congratulations') ? (
                                <CheckCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                              ) : app.current_progress.includes('Failed') || app.current_progress.includes('failed') ? (
                                <XCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                              ) : (
                                <CheckCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                              )}
                              <div className="flex-1 min-w-0">
                                <span className="text-xs font-medium text-gray-600 dark:text-gray-400 mr-1">
                                  Current Progress:
                                </span>
                                <span className={`text-xs font-semibold ${
                                  app.current_progress.includes('Passed') || app.current_progress.includes('Congratulations')
                                    ? 'text-green-700 dark:text-green-300' 
                                    : app.current_progress.includes('Failed') || app.current_progress.includes('failed')
                                    ? 'text-red-700 dark:text-red-300'
                                    : 'text-gray-900 dark:text-gray-100'
                                }`}>
                                  {app.current_progress.replace('Exam Result: ', '').replace('Current Progress: ', '')}
                                </span>
                              </div>
                            </div>
                          ) : null}
                          
                          {/* Next Step - Show below current progress when status is completed */}
                          {app.next_step && (getDisplayStatus(app) === 'completed' || app.next_step) ? (
                            <div className="flex items-start gap-2 px-2 py-1.5 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800/50">
                              <Clock className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <span className="text-xs font-medium text-gray-600 dark:text-gray-400 mr-1">Next Step:</span>
                                <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                                  {app.next_step.includes('Nursys') ? (
                                    <>
                                      {app.next_step.split('"Nursys"')[0]}
                                      <span 
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          window.open('https://www.nursys.com/LQC/LQCSearch.aspx', '_blank', 'noopener,noreferrer')
                                        }}
                                        className="text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
                                      >
                                        Nursys
                                      </span>
                                      {app.next_step.split('"Nursys"')[1]}
                                    </>
                                  ) : app.next_step === 'Retake again!' ? (
                                    <span 
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        navigate('/application/new')
                                      }}
                                      className="text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
                                    >
                                      Retake again!
                                    </span>
                                  ) : (
                                    <span className="truncate">{app.next_step}</span>
                                  )}
                                </span>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      )}

                      {/* Action Buttons - Compact */}
                      <div 
                        className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700 justify-end"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-7 px-3 text-xs bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 border-gray-300 dark:border-gray-600 hover:from-gray-300 hover:to-gray-400 dark:hover:from-gray-600 dark:hover:to-gray-500"
                          onClick={(e) => {
                            e.stopPropagation()
                            const routeId = app.grit_app_id || app.id
                            navigate(`${isAdmin() ? '/admin/applications' : '/applications'}/${routeId}/timeline`)
                          }}
                        >
                          <Eye className="h-3 w-3 mr-1.5" />
                          View Details
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-7 px-3 text-xs bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 border-gray-300 dark:border-gray-600 hover:from-gray-300 hover:to-gray-400 dark:hover:from-gray-600 dark:hover:to-gray-500"
                          onClick={(e) => {
                            e.stopPropagation()
                            window.open(`/tracking?id=${app.grit_app_id || app.id}`, '_blank', 'noopener,noreferrer')
                          }}
                        >
                          <ExternalLink className="h-3 w-3 mr-1.5" />
                          Tracking Link
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
              {/* Pagination */}
              {paginatedApplications.totalPages > 1 && (
                <Card className="mt-6">
                  <div className="flex items-center justify-between p-4">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredAndSortedApplications.length)} of {filteredAndSortedApplications.length} application{filteredAndSortedApplications.length !== 1 ? 's' : ''}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={!paginatedApplications.hasPreviousPage}
                        aria-label="Previous page"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <div className="text-sm text-gray-600 dark:text-gray-400 px-3">
                        Page {currentPage} of {paginatedApplications.totalPages}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(paginatedApplications.totalPages, prev + 1))}
                        disabled={!paginatedApplications.hasNextPage}
                        aria-label="Next page"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}
