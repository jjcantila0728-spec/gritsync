import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { CardSkeleton } from '@/components/ui/Loading'
import { applicationsAPI, serviceRequiredDocumentsAPI, userDocumentsAPI, getSignedFileUrl, userDetailsAPI } from '@/lib/api'
import { getCachedSignedUrl } from '@/lib/image-cache'
import { cn } from '@/lib/utils'
import { FileText, Upload, CheckCircle, Image, File as FileIcon, FileCheck, Eye, Download, Trash2, GraduationCap, Briefcase } from 'lucide-react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { Modal } from '@/components/ui/Modal'

interface DocumentStatus {
  name: string
  type: string
  acceptedFormats: string[]
  required: boolean
  uploaded: boolean
  filePath?: string
  fileName?: string
  uploadedAt?: string
  id?: string
  serviceType?: string
  sortOrder?: number
}

interface ServiceDocumentRequirement {
  id: string
  service_type: string
  document_type: string
  name: string
  accepted_formats: string[]
  required: boolean
  sort_order: number
}

const DEFAULT_ACCEPTED_FORMATS = ['.pdf', '.jpg', '.jpeg', '.png']

const SERVICE_TYPE_LABELS: Record<string, string> = {
  NCLEX: 'NCLEX',
  EAD: 'EAD (I-765)',
  Additional: 'Additional',
}

const FALLBACK_DOC_REQUIREMENTS: ServiceDocumentRequirement[] = [
  {
    id: 'fallback-nclex-picture',
    service_type: 'NCLEX',
    document_type: 'picture',
    name: '2x2 Picture',
    accepted_formats: ['image/*'],
    required: true,
    sort_order: 0,
  },
  {
    id: 'fallback-nclex-diploma',
    service_type: 'NCLEX',
    document_type: 'diploma',
    name: 'Nursing Diploma',
    accepted_formats: DEFAULT_ACCEPTED_FORMATS,
    required: true,
    sort_order: 1,
  },
  {
    id: 'fallback-nclex-passport',
    service_type: 'NCLEX',
    document_type: 'passport',
    name: 'Passport',
    accepted_formats: DEFAULT_ACCEPTED_FORMATS,
    required: true,
    sort_order: 2,
  },
  {
    id: 'fallback-ead-photos',
    service_type: 'EAD',
    document_type: 'ead_photos',
    name: 'Two passport-sized photographs (2x2 inches) meeting USCIS requirements (attached in a small envelope and labeled with your name)',
    accepted_formats: ['image/*'],
    required: true,
    sort_order: 0,
  },
  {
    id: 'fallback-ead-passport',
    service_type: 'EAD',
    document_type: 'ead_passport',
    name: 'Clear Copy of your passport biographical page',
    accepted_formats: DEFAULT_ACCEPTED_FORMATS,
    required: true,
    sort_order: 1,
  },
  {
    id: 'fallback-ead-h4',
    service_type: 'EAD',
    document_type: 'ead_h4_visa',
    name: 'Copy of your H-4 visa stamp',
    accepted_formats: DEFAULT_ACCEPTED_FORMATS,
    required: true,
    sort_order: 2,
  },
  {
    id: 'fallback-ead-i94',
    service_type: 'EAD',
    document_type: 'ead_i94',
    name: 'Copy of your most recent I-94 Arrival/Departure Record',
    accepted_formats: DEFAULT_ACCEPTED_FORMATS,
    required: true,
    sort_order: 3,
  },
  {
    id: 'fallback-ead-marriage',
    service_type: 'EAD',
    document_type: 'ead_marriage_certificate',
    name: 'Copy of your marriage certificate to establish your relationship with the H-1B principal beneficiary',
    accepted_formats: DEFAULT_ACCEPTED_FORMATS,
    required: true,
    sort_order: 4,
  },
  {
    id: 'fallback-ead-spouse-i797',
    service_type: 'EAD',
    document_type: 'ead_spouse_i797',
    name: "Copy of your spouse's H-1B approval notice (Form I-797)",
    accepted_formats: DEFAULT_ACCEPTED_FORMATS,
    required: true,
    sort_order: 5,
  },
  {
    id: 'fallback-ead-spouse-i140',
    service_type: 'EAD',
    document_type: 'ead_spouse_i140',
    name: "Copy of your spouse's approved Form I-140, Immigrant Petition for Alien Worker",
    accepted_formats: DEFAULT_ACCEPTED_FORMATS,
    required: true,
    sort_order: 6,
  },
  {
    id: 'fallback-ead-employer-letter',
    service_type: 'EAD',
    document_type: 'ead_employer_letter',
    name: "Copy of your spouse's employer verification letter",
    accepted_formats: DEFAULT_ACCEPTED_FORMATS,
    required: true,
    sort_order: 7,
  },
  {
    id: 'fallback-ead-paystub',
    service_type: 'EAD',
    document_type: 'ead_paystub',
    name: 'Recent paystub',
    accepted_formats: DEFAULT_ACCEPTED_FORMATS,
    required: true,
    sort_order: 8,
  },
]
export function Documents() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const { serviceType: routeServiceType } = useParams<{ serviceType?: string }>()
  const navigate = useNavigate()
  const [uploading, setUploading] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [documents, setDocuments] = useState<DocumentStatus[]>([])
  const [viewingFile, setViewingFile] = useState<{ url: string, fileName: string, isImage: boolean, documentId?: string, documentType?: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [uploadPreview, setUploadPreview] = useState<{ file: File, documentType: string, previewUrl: string } | null>(null)
  const [userFirstName, setUserFirstName] = useState<string>('')
  const [userLastName, setUserLastName] = useState<string>('')
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({})
  const [serviceDocRequirements, setServiceDocRequirements] = useState<ServiceDocumentRequirement[]>([])
  const [serviceTypes, setServiceTypes] = useState<string[]>([])
  const [serviceTypesLoaded, setServiceTypesLoaded] = useState(false)
  const [docConfigLoading, setDocConfigLoading] = useState(true)
  const [docConfigError, setDocConfigError] = useState<string | null>(null)

  // Helper function to get display name for document types
  const getDocumentDisplayName = (type: string): string => {
    // Handle mandatory course documents
    if (type === 'mandatory_course_infection_control') {
      return 'Infection Control Course'
    }
    if (type === 'mandatory_course_child_abuse') {
      return 'Child Abuse Course'
    }
    if (type.startsWith('mandatory_course_')) {
      // For any other mandatory course types, format them nicely
      const courseName = type.replace('mandatory_course_', '').replace(/_/g, ' ')
      return courseName.split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ') + ' Course'
    }
    
    // Handle additional document types (EAD forms)
    if (type === 'additional_g1145') {
      return 'Form G-1145'
    }
    if (type === 'additional_i765') {
      return 'Form I-765'
    }
    if (type === 'additional_cover_letter') {
      return 'Cover Letter'
    }
    if (type === 'additional' || type.startsWith('additional_')) {
      // For generic additional or other additional_ types, format them nicely
      const docName = type.replace('additional_', '').replace(/_/g, ' ')
      return docName.split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ') || 'Additional Document'
    }
    
    // Handle regular document types
    switch (type) {
      case 'picture':
        return '2x2 Picture'
      case 'diploma':
        return 'Nursing Diploma'
      case 'passport':
        return 'Passport'
      default:
        // For other types, capitalize first letter and replace underscores with spaces
        return type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ')
    }
  }

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    fetchUserDetails()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  useEffect(() => {
    if (!user) {
      setServiceTypes([])
      setServiceTypesLoaded(false)
      return
    }

    let isMounted = true
    setServiceTypesLoaded(false)

    const loadServiceTypes = async () => {
      try {
        const types = await applicationsAPI.getServiceTypes()
        if (!isMounted) return
        setServiceTypes(types)
      } catch (error: any) {
        if (!isMounted) return
        setServiceTypes([])
        showToast('Failed to determine your services. Defaulting to NCLEX documents.', 'error')
      } finally {
        if (!isMounted) return
        setServiceTypesLoaded(true)
      }
    }

    loadServiceTypes()
    return () => {
      isMounted = false
    }
  }, [user, showToast])

  const loadDocumentRequirements = useCallback(() => {
    if (!user || !serviceTypesLoaded) {
      return
    }

    setDocConfigLoading(true)
    setDocConfigError(null)
    const normalizedTypes = serviceTypes.length > 0 ? serviceTypes : ['NCLEX']

    serviceRequiredDocumentsAPI.getByServiceTypes(normalizedTypes)
      .then((docs) => {
        // Filter out any error objects and ensure proper typing
        const validDocs = (docs || []).filter((doc: any) => doc && typeof doc === 'object' && 'id' in doc) as unknown as ServiceDocumentRequirement[]
        setServiceDocRequirements(validDocs)
      })
      .catch((error: any) => {
        setServiceDocRequirements([])
        setDocConfigError('Failed to load required documents. Showing defaults.')
        console.error('Error loading document requirements:', error)
      })
      .finally(() => {
        setDocConfigLoading(false)
      })
  }, [user, serviceTypesLoaded, serviceTypes])

  useEffect(() => {
    if (!user || !serviceTypesLoaded) {
      return
    }

    loadDocumentRequirements()

    // Listen for document requirements updates (e.g., when admin changes them)
    const handleDocumentRequirementsUpdate = () => {
      loadDocumentRequirements()
    }

    window.addEventListener('documentRequirementsUpdated', handleDocumentRequirementsUpdate)

    // Refresh when window regains focus (in case changes were made in another tab)
    const handleFocus = () => {
      loadDocumentRequirements()
    }
    window.addEventListener('focus', handleFocus)

    return () => {
      window.removeEventListener('documentRequirementsUpdated', handleDocumentRequirementsUpdate)
      window.removeEventListener('focus', handleFocus)
    }
  }, [user, serviceTypesLoaded, loadDocumentRequirements])

  const documentRequirementSource = useMemo(() => {
    if (serviceDocRequirements.length > 0) {
      return serviceDocRequirements
    }
    const fallbackServiceTypes = serviceTypes.length > 0 ? serviceTypes : ['NCLEX']
    return FALLBACK_DOC_REQUIREMENTS.filter((doc) => fallbackServiceTypes.includes(doc.service_type))
  }, [serviceDocRequirements, serviceTypes])

  const requiredDocuments = useMemo(() => {
    return documentRequirementSource
      .map((doc) => ({
        name: doc.name,
        type: doc.document_type,
        acceptedFormats: doc.accepted_formats.length > 0 ? doc.accepted_formats : DEFAULT_ACCEPTED_FORMATS,
        required: doc.required,
        uploaded: false,
        serviceType: doc.service_type,
        sortOrder: doc.sort_order ?? 0,
      }))
      .sort((a, b) => {
        if (a.serviceType !== b.serviceType) {
          return (a.serviceType || '').localeCompare(b.serviceType || '')
        }
        return (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
      })
  }, [documentRequirementSource])

  const requiredDocumentMap = useMemo(() => {
    const map = new Map<string, DocumentStatus>()
    requiredDocuments.forEach((doc) => {
      map.set(doc.type, doc)
    })
    return map
  }, [requiredDocuments])

  async function fetchUserDetails() {
    try {
      const details = await userDetailsAPI.get()
      const typedDetails = details as { first_name?: string; last_name?: string } | null
      if (typedDetails) {
        setUserFirstName(typedDetails.first_name || '')
        setUserLastName(typedDetails.last_name || '')
      } else {
        // Fallback to parsing email
        setUserFirstName(user?.email?.split('@')[0] || '')
        setUserLastName('')
      }
    } catch (error) {
      // Fallback to parsing email if fetch fails
      setUserFirstName(user?.email?.split('@')[0] || '')
      setUserLastName('')
    }
  }

  const fetchDocuments = useCallback(async () => {
    setLoading(true)
    try {
      const uploadedDocs = await userDocumentsAPI.getAll()
      
      if (!Array.isArray(uploadedDocs)) {
        setDocuments(requiredDocuments)
        return
      }
      
      const docsMap = new Map(uploadedDocs.map((doc: any) => [doc.document_type, doc]))
      
      const updatedRequiredDocs = requiredDocuments.map((doc) => {
        const uploaded = docsMap.get(doc.type)
        const filePath = uploaded?.file_path
        return {
          ...doc,
          uploaded: !!uploaded,
          filePath: typeof filePath === 'string' ? filePath : undefined,
          fileName: uploaded?.file_name,
          uploadedAt: uploaded?.uploaded_at,
          id: uploaded?.id,
        }
      })

      const additionalDocs: DocumentStatus[] = uploadedDocs
        .filter((doc: any) => !requiredDocuments.some((req) => req.type === doc.document_type))
        .map((doc: any) => ({
          name: getDocumentDisplayName(doc.document_type),
          type: doc.document_type,
          acceptedFormats: DEFAULT_ACCEPTED_FORMATS,
          required: false,
          uploaded: true,
          filePath: doc.file_path,
          fileName: doc.file_name,
          uploadedAt: doc.uploaded_at,
          id: doc.id,
          serviceType: 'Additional',
        }))

      setDocuments([...updatedRequiredDocs, ...additionalDocs])
    } catch (error: any) {
      setDocuments(requiredDocuments)
      showToast(error.message || 'Failed to load documents', 'error')
    } finally {
      setLoading(false)
    }
  }, [requiredDocuments, showToast])

  useEffect(() => {
    if (!user || docConfigLoading) {
      return
    }
    fetchDocuments()
  }, [user, docConfigLoading, fetchDocuments])

  // Handle route-based navigation and redirects
  useEffect(() => {
    if (!docConfigLoading && documents.length > 0) {
      // Group documents to determine available service types
      const documentsByService = documents.reduce((acc, doc) => {
        const serviceType = doc.serviceType || 'Additional'
        if (!acc[serviceType]) {
          acc[serviceType] = []
        }
        acc[serviceType].push(doc)
        return acc
      }, {} as Record<string, DocumentStatus[]>)

      const availableServiceTypes = Object.keys(documentsByService).sort()
      
      // Map route parameter to service type
      const routeToServiceTypeMap: Record<string, string> = {
        'nclex': 'NCLEX',
        'ead': 'EAD',
        'additional': 'Additional',
      }
      
      const normalizedRouteServiceType = routeServiceType 
        ? routeToServiceTypeMap[routeServiceType.toLowerCase()] 
        : null

      // If route parameter is invalid, redirect to base /documents
      if (routeServiceType && (!normalizedRouteServiceType || !availableServiceTypes.includes(normalizedRouteServiceType))) {
        navigate('/documents', { replace: true })
        return
      }

      // If no route parameter and multiple service types exist, redirect to first tab
      if (!routeServiceType && availableServiceTypes.length > 1) {
        const firstServiceType = availableServiceTypes[0]
        const serviceTypeToRouteMap: Record<string, string> = {
          'NCLEX': '/documents/nclex',
          'EAD': '/documents/ead',
          'Additional': '/documents/additional',
        }
        const firstRoute = serviceTypeToRouteMap[firstServiceType]
        if (firstRoute) {
          navigate(firstRoute, { replace: true })
        }
      }
    }
  }, [docConfigLoading, documents, routeServiceType, navigate])

  // Removed unused _handleFileUpload function

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, documentType: string) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024 // 10MB
      if (file.size > maxSize) {
        showToast('File size must be less than 10MB', 'error')
        e.target.value = ''
        return
      }

      // Validate file type
      const doc = requiredDocumentMap.get(documentType)
      const acceptedFormats = doc?.acceptedFormats.length ? doc.acceptedFormats : DEFAULT_ACCEPTED_FORMATS
      const isValidType = acceptedFormats.some((format) => {
        if (format === 'image/*') {
          return file.type.startsWith('image/')
        }
        return file.name.toLowerCase().endsWith(format.toLowerCase())
      })
      if (!isValidType) {
        showToast(`Invalid file type. Accepted formats: ${acceptedFormats.join(', ')}`, 'error')
        e.target.value = ''
        return
      }

      // Create preview URL for images
      const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : ''
      
      // Show preview modal
      setUploadPreview({
        file,
        documentType,
        previewUrl
      })
    }
    // Reset input
    e.target.value = ''
  }

  const handleUploadSubmit = async () => {
    if (!uploadPreview || !user) return

    const { file, documentType } = uploadPreview
    setUploading(documentType)
    
    try {
      const docSlug = documentType
        ?.replace(/[^a-z0-9]+/gi, '_')
        .replace(/^_+|_+$/g, '')
        .toLowerCase() || 'document'

      const firstName = userFirstName.toLowerCase().replace(/\s+/g, '')
      const lastName = userLastName.toLowerCase().replace(/\s+/g, '')
      const fileExt = file.name.split('.').pop() || ''
      const newFileName = `${docSlug}_${firstName}_${lastName}.${fileExt}`

      const renamedFile = new File([file], newFileName, { type: file.type })

      await userDocumentsAPI.upload(documentType, renamedFile)
      const docName = requiredDocumentMap.get(documentType)?.name || getDocumentDisplayName(documentType)
      showToast(`${docName} uploaded successfully!`, 'success')

      if (uploadPreview.previewUrl) {
        URL.revokeObjectURL(uploadPreview.previewUrl)
      }

      setUploadPreview(null)
      await fetchDocuments()
      window.dispatchEvent(new Event('documentsUpdated'))
    } catch (error: any) {
      const docName = requiredDocumentMap.get(documentType)?.name || getDocumentDisplayName(documentType)
      showToast(error.message || `Failed to upload ${docName}`, 'error')
    } finally {
      setUploading(null)
    }
  }

  const handleUploadCancel = () => {
    if (uploadPreview?.previewUrl) {
      URL.revokeObjectURL(uploadPreview.previewUrl)
    }
    setUploadPreview(null)
  }

  const getDocumentIcon = (type: string) => {
    switch (type) {
      case 'picture':
        return <Image className="h-5 w-5" />
      case 'diploma':
        return <FileCheck className="h-5 w-5" />
      case 'passport':
        return <FileIcon className="h-5 w-5" />
      default:
        return <FileText className="h-5 w-5" />
    }
  }

  // Component to display authenticated images from Supabase Storage
  const AuthenticatedImage = ({ src, alt, className }: { src: string, alt: string, className?: string }) => {
    const [imageSrc, setImageSrc] = useState<string | null>(null)
    const [error, setError] = useState(false)
    const imgRef = useRef<HTMLImageElement>(null)

    useEffect(() => {
      // Validate src is a string
      if (!src || typeof src !== 'string') {
        setError(true)
        return
      }

      // If src is already a URL (legacy), use it directly
      if (src.startsWith('http://') || src.startsWith('https://')) {
        setImageSrc(src)
        return
      }

      // For Supabase Storage paths, get cached signed URL
      getCachedSignedUrl(
        src,
        (path) => getSignedFileUrl(path, 3600),
        3600000 // Cache for 1 hour
      )
        .then(url => {
          if (typeof url === 'string') {
            setImageSrc(url)
          } else {
            setError(true)
          }
        })
        .catch(() => {
          setError(true)
        })
    }, [src])

    if (error) {
      return (
        <div className={`${className} flex items-center justify-center bg-gray-100 dark:bg-gray-700`}>
          <Image className="h-12 w-12 text-gray-400" />
        </div>
      )
    }

    if (!imageSrc) {
      return (
        <div className={`${className} flex items-center justify-center bg-gray-100 dark:bg-gray-700`}>
          <div className="animate-pulse text-gray-400">Loading...</div>
        </div>
      )
    }

    return (
      <img
        ref={imgRef}
        src={imageSrc}
        alt={alt}
        className={className}
        onError={() => setError(true)}
      />
    )
  }

  // Component for document image preview (uses file path directly)
  const DocumentImagePreview = ({ filePath, alt, className }: { filePath: string, alt: string, className?: string }) => {
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
        <div className="w-full h-full flex items-center justify-center bg-red-50 dark:bg-red-900/20 rounded-lg border-2 border-red-200 dark:border-red-800">
          <div className="text-center">
            <Image className="h-12 w-12 text-red-400 mx-auto mb-2" />
            <p className="text-xs text-red-600 dark:text-red-400">Failed to load</p>
          </div>
        </div>
      )
    }

    if (loading || !imageSrc) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-blue-50 dark:bg-blue-900/20 rounded-lg border-2 border-blue-200 dark:border-blue-800">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-2"></div>
            <p className="text-xs text-blue-600 dark:text-blue-400">Loading image...</p>
          </div>
        </div>
      )
    }

    return (
      <img
        src={imageSrc}
        alt={alt}
        className={className || 'w-full h-full object-cover'}
        style={{ display: 'block', minHeight: '192px' }}
        onError={() => {
          setError(true)
          setLoading(false)
        }}
        onLoad={() => {
          setLoading(false)
        }}
      />
    )
  }

  // Component for PDF preview (shows PDF in iframe)
  const DocumentPDFPreview = ({ filePath, alt, className }: { filePath: string, alt: string, className?: string }) => {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-4 md:p-8">
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-2 text-gray-900 dark:text-gray-100">
              Documents
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Upload and manage the documents required for the services you applied for (NCLEX, EAD, etc.).
            </p>
          </div>

          <div className="space-y-6">
            {/* Info Card */}
            <Card className="border-0 shadow-md bg-blue-50/50 dark:bg-blue-900/10">
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                    Your Documents
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    View and manage all your uploaded documents. Required documents are marked with an asterisk (*).
                  </p>
                </div>
              </div>
            </Card>

            {docConfigError && (
              <Card className="border-0 shadow-md bg-yellow-50 dark:bg-yellow-900/10">
                <p className="text-xs text-yellow-700 dark:text-yellow-200">
                  {docConfigError}
                </p>
              </Card>
            )}

            {/* Documents List with Tabs */}
            {loading ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
              </div>
            ) : (() => {
              // Group documents by service type
              const documentsByService = documents.reduce((acc, doc) => {
                const serviceType = doc.serviceType || 'Additional'
                if (!acc[serviceType]) {
                  acc[serviceType] = []
                }
                acc[serviceType].push(doc)
                return acc
              }, {} as Record<string, typeof documents>)

              // Create tabs based on available service types
              const serviceTypesInDocuments = Object.keys(documentsByService).sort()
              
              // Map route parameter to service type ID (normalize case)
              const routeToServiceTypeMap: Record<string, string> = {
                'nclex': 'NCLEX',
                'ead': 'EAD',
                'additional': 'Additional',
              }
              
              // Normalize route service type (if provided)
              const normalizedRouteServiceType = routeServiceType 
                ? routeToServiceTypeMap[routeServiceType.toLowerCase()] 
                : null

              // Determine which tabs to show based on what documents exist
              const availableTabs: Array<{ id: string; label: string; icon?: React.ComponentType<{ className?: string }>, routePath: string }> = []
              
              if (serviceTypesInDocuments.includes('NCLEX')) {
                availableTabs.push({ id: 'NCLEX', label: 'NCLEX', icon: GraduationCap, routePath: '/documents/nclex' })
              }
              if (serviceTypesInDocuments.includes('EAD')) {
                availableTabs.push({ id: 'EAD', label: 'EAD (I-765)', icon: Briefcase, routePath: '/documents/ead' })
              }
              if (serviceTypesInDocuments.includes('Additional')) {
                availableTabs.push({ id: 'Additional', label: 'Additional', icon: FileText, routePath: '/documents/additional' })
              }

              // Determine which service type to display based on route
              // If route parameter is invalid or doesn't exist, show all or redirect to first tab
              let activeServiceType: string | null = null
              if (normalizedRouteServiceType && serviceTypesInDocuments.includes(normalizedRouteServiceType)) {
                activeServiceType = normalizedRouteServiceType
              } else if (routeServiceType) {
                // Invalid route parameter - redirect to base documents page
                setTimeout(() => navigate('/documents', { replace: true }), 0)
                activeServiceType = null
              } else {
                // No route parameter - show all documents or first available tab
                activeServiceType = null
              }

              // Helper function to render a document card (defined inline to capture closures)
              const renderCard = (doc: DocumentStatus) => (
                <Card
                  key={doc.id || `${doc.serviceType || 'custom'}-${doc.type}`}
                  className={`border-0 shadow-md transition-all hover:shadow-lg ${
                  doc.uploaded ? 'border-green-200 dark:border-green-800 border-2' : ''
                }`}>
                  <div className="flex flex-col h-full">
                    {/* Document Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className={`p-3 rounded-lg ${
                        doc.uploaded 
                          ? 'bg-green-100 dark:bg-green-900/30' 
                          : 'bg-gray-100 dark:bg-gray-800'
                      }`}>
                        <div className={`${
                          doc.uploaded 
                            ? 'text-green-600 dark:text-green-400' 
                            : 'text-gray-600 dark:text-gray-400'
                        }`}>
                          {getDocumentIcon(doc.type)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {doc.required && (
                          <span className="text-xs text-red-600 dark:text-red-400 font-semibold">*</span>
                        )}
                        {doc.uploaded && (
                          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                        )}
                      </div>
                    </div>

                    {/* Document Info */}
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        {doc.serviceType && (
                          <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                            {SERVICE_TYPE_LABELS[doc.serviceType] || doc.serviceType}
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100 mb-2 break-words" title={doc.name}>
                        {doc.name}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                        Accepted: {doc.acceptedFormats.join(', ')}
                      </p>

                      {/* Uploaded File Card */}
                      {doc.uploaded ? (
                        doc.filePath ? (
                          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 mb-4 border border-gray-200 dark:border-gray-700">
                            {/* File Preview */}
                            {(() => {
                              // For Supabase Storage, filePath is already in format: userId/filename
                              const filePath = typeof doc.filePath === 'string' ? doc.filePath : ''
                              const isImage = doc.fileName?.match(/\.(jpg|jpeg|png|gif|webp)$/i) || doc.type === 'picture'
                              
                              const handleFileClick = async () => {
                                try {
                                  // Get signed URL for viewing
                                  const signedUrl = await getSignedFileUrl(filePath, 3600)
                                  setViewingFile({
                                    url: signedUrl,
                                    fileName: doc.fileName || 'Uploaded file',
                                    isImage: !!isImage,
                                    documentId: doc.id,
                                    documentType: doc.type,
                                  })
                                } catch (error) {
                                  showToast('Failed to load file', 'error')
                                }
                              }

                              const handleDownload = async (e: React.MouseEvent) => {
                                e.stopPropagation()
                                try {
                                  // Get signed URL for download
                                  const signedUrl = await getSignedFileUrl(filePath, 3600)
                                  const response = await fetch(signedUrl)
                                  if (!response.ok) throw new Error('Failed to download file')
                                  
                                  const blob = await response.blob()
                                  const downloadUrl = URL.createObjectURL(blob)
                                  const link = document.createElement('a')
                                  link.href = downloadUrl
                                  link.download = doc.fileName || 'file'
                                  document.body.appendChild(link)
                                  link.click()
                                  document.body.removeChild(link)
                                  URL.revokeObjectURL(downloadUrl)
                                  showToast('File downloaded successfully', 'success')
                                } catch (error) {
                                  showToast('Failed to download file', 'error')
                                }
                              }
                              
                              const isPDF = doc.fileName?.toLowerCase().endsWith('.pdf') || false
                              
                              // If it's a picture type, always try to show it as an image
                              const shouldShowAsImage = isImage || doc.type === 'picture'
                              
                              return (
                                <>
                                  {shouldShowAsImage && filePath ? (
                                    <div className="mb-3 relative group cursor-pointer w-full" onClick={handleFileClick}>
                                      <div className="w-full h-48 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-100 dark:bg-gray-700">
                                        <DocumentImagePreview
                                          filePath={filePath}
                                          alt={doc.fileName || 'Uploaded file'}
                                          className="w-full h-full object-cover transition-opacity group-hover:opacity-90"
                                        />
                                      </div>
                                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-lg transition-colors flex items-center justify-center pointer-events-none">
                                        <Eye className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                      </div>
                                    </div>
                                  ) : shouldShowAsImage && !filePath ? (
                                    <div className="mb-3 w-full h-48 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-700">
                                      <div className="text-center">
                                        <Image className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                                        <p className="text-xs text-gray-500 dark:text-gray-400">No file path available</p>
                                      </div>
                                    </div>
                                  ) : isPDF && filePath ? (
                                    <div className="mb-3 relative group cursor-pointer" onClick={handleFileClick}>
                                      <DocumentPDFPreview
                                        filePath={filePath}
                                        alt={doc.fileName || 'Uploaded file'}
                                        className="w-full h-48 rounded-lg border border-gray-200 dark:border-gray-700"
                                      />
                                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-lg transition-colors flex items-center justify-center">
                                        <Eye className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                      </div>
                                    </div>
                                  ) : isImage && !filePath ? (
                                    <div 
                                      className="mb-3 w-full h-48 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-700"
                                    >
                                      <Image className="h-12 w-12 text-gray-400" />
                                    </div>
                                  ) : (
                                    <div 
                                      className="mb-3 w-full h-48 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors group"
                                      onClick={handleFileClick}
                                    >
                                      <FileIcon className="h-12 w-12 text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors" />
                                    </div>
                                  )}
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-start gap-2 flex-1 min-w-0">
                                      <FileIcon className="h-4 w-4 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
                                          {doc.fileName || 'Uploaded file'}
                                        </p>
                                        {doc.uploadedAt && (
                                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                            {new Date(doc.uploadedAt).toLocaleDateString()}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    <button
                                      onClick={handleDownload}
                                      className="flex-shrink-0 p-1.5 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded transition-colors"
                                      title="Download file"
                                    >
                                      <Download className="h-4 w-4" />
                                    </button>
                                  </div>
                                </>
                              )
                            })()}
                          </div>
                        ) : (
                          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 mb-4 border border-green-200 dark:border-green-800 text-center">
                            <p className="text-xs text-green-700 dark:text-green-300">
                              File uploaded (processing...)
                            </p>
                          </div>
                        )
                      ) : (
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 mb-4 border border-dashed border-gray-300 dark:border-gray-700 text-center">
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            No file uploaded
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    {/* Hide Replace button for mandatory course files (permanent files uploaded by admin) */}
                    {!doc.type.startsWith('mandatory_course') && (
                      <div className="flex items-center gap-2 mt-auto">
                        <label className="flex-1 cursor-pointer">
                          <input
                            ref={(el) => { fileInputRefs.current[doc.type] = el }}
                            type="file"
                            accept={doc.acceptedFormats.join(',')}
                            onChange={(e) => {
                              handleFileChange(e, doc.type)
                              e.target.value = ''
                            }}
                            disabled={uploading === doc.type}
                            className="hidden"
                          />
                          <Button
                            type="button"
                            variant={doc.uploaded ? "outline" : "default"}
                            size="sm"
                            disabled={uploading === doc.type}
                            className="w-full"
                            onClick={(e) => {
                              e.preventDefault()
                              fileInputRefs.current[doc.type]?.click()
                            }}
                          >
                            {uploading === doc.type ? (
                              <>
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Uploading...
                              </>
                            ) : doc.uploaded ? (
                              <>
                                <Upload className="h-4 w-4 mr-2" />
                                Replace
                              </>
                            ) : (
                              <>
                                <Upload className="h-4 w-4 mr-2" />
                                Upload
                              </>
                            )}
                          </Button>
                        </label>
                      </div>
                    )}
                  </div>
                </Card>
              )

              // If filtering by a specific service type from route
              if (activeServiceType) {
                const filteredDocs = documentsByService[activeServiceType] || []
                // Still show tabs if multiple service types exist
                if (availableTabs.length > 1) {
                  return (
                    <div>
                      {/* Custom tab headers that navigate to routes */}
                      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
                        <nav className="flex space-x-1" aria-label="Tabs">
                          {availableTabs.map((tab) => {
                            const Icon = tab.icon
                            const isActive = activeServiceType === tab.id
                            return (
                              <Link
                                key={tab.id}
                                to={tab.routePath}
                                className={cn(
                                  'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                                  isActive
                                    ? 'border-primary-600 text-primary-600 dark:text-primary-400 dark:border-primary-400'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-600'
                                )}
                                aria-current={isActive ? 'page' : undefined}
                              >
                                {Icon && <Icon className="h-4 w-4" />}
                                {tab.label}
                              </Link>
                            )
                          })}
                        </nav>
                      </div>
                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredDocs.map(renderCard)}
                      </div>
                    </div>
                  )
                } else {
                  // Only one service type, no tabs needed
                  return (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredDocs.map(renderCard)}
                    </div>
                  )
                }
              }

              // No route parameter - redirect to first tab if multiple tabs exist
              if (availableTabs.length > 1) {
                // Redirect to first tab's route
                setTimeout(() => navigate(availableTabs[0].routePath, { replace: true }), 0)
                // Show first tab's content while redirecting
                return (
                  <div>
                    <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
                      <nav className="flex space-x-1" aria-label="Tabs">
                        {availableTabs.map((tab, index) => {
                          const Icon = tab.icon
                          const isActive = index === 0
                          return (
                            <Link
                              key={tab.id}
                              to={tab.routePath}
                              className={cn(
                                'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                                isActive
                                  ? 'border-primary-600 text-primary-600 dark:text-primary-400 dark:border-primary-400'
                                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-600'
                              )}
                              aria-current={isActive ? 'page' : undefined}
                            >
                              {Icon && <Icon className="h-4 w-4" />}
                              {tab.label}
                            </Link>
                          )
                        })}
                      </nav>
                    </div>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {(documentsByService[availableTabs[0]?.id] || []).map(renderCard)}
                    </div>
                  </div>
                )
              }

              // Single tab or no tabs - show documents normally
              const docsToRender = availableTabs.length === 1 
                ? documentsByService[availableTabs[0].id] || []
                : documents
              
              return (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {docsToRender.map(renderCard)}
                </div>
              )
            })()}

            {/* Quick Actions */}
            <Card className="border-0 shadow-md bg-primary-50/50 dark:bg-primary-900/10">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                    Ready to submit your application?
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Once all documents are uploaded, you can proceed with your NCLEX application.
                  </p>
                </div>
                <Link to="/application/new">
                  <Button>
                    Start Application
                  </Button>
                </Link>
              </div>
            </Card>
          </div>
        </main>
      </div>

      {/* Upload Preview Modal */}
      <Modal
        isOpen={!!uploadPreview}
        onClose={handleUploadCancel}
        title={`Upload ${requiredDocumentMap.get(uploadPreview?.documentType || '')?.name || getDocumentDisplayName(uploadPreview?.documentType || '')}`}
        size="lg"
      >
        {uploadPreview && (
          <div className="space-y-4">
            {/* File Preview */}
            {uploadPreview.previewUrl ? (
              <div className="flex justify-center bg-gray-100 dark:bg-gray-900 p-4 rounded-lg">
                <img
                  src={uploadPreview.previewUrl}
                  alt="Preview"
                  className="max-w-full max-h-96 object-contain rounded-lg"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center min-h-[200px] space-y-4 bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <FileIcon className="h-16 w-16 text-gray-400" />
                <p className="text-gray-600 dark:text-gray-400">File: {uploadPreview.file.name}</p>
              </div>
            )}
            
            {/* File Info */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Original Name:</span>
                <span className="text-sm text-gray-900 dark:text-gray-100 truncate ml-4">{uploadPreview.file.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">New Name:</span>
                <span className="text-sm text-primary-600 dark:text-primary-400 truncate ml-4">
                  {(() => {
                    const docTypeName = uploadPreview.documentType === 'picture' ? '2x2picture' : 
                                       uploadPreview.documentType === 'diploma' ? 'nursing_diploma' : 
                                       uploadPreview.documentType === 'passport' ? 'passport' : uploadPreview.documentType
                    const firstName = userFirstName.toLowerCase().replace(/\s+/g, '')
                    const lastName = userLastName.toLowerCase().replace(/\s+/g, '')
                    const fileExt = uploadPreview.file.name.split('.').pop() || ''
                    return `${docTypeName}_${firstName}_${lastName}.${fileExt}`
                  })()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Size:</span>
                <span className="text-sm text-gray-900 dark:text-gray-100">
                  {(uploadPreview.file.size / 1024 / 1024).toFixed(2)} MB
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                variant="outline"
                onClick={handleUploadCancel}
                disabled={!!uploading}
              >
                Cancel
              </Button>
              <Button
                variant="default"
                onClick={handleUploadSubmit}
                disabled={!!uploading}
              >
                {uploading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Submit
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* File View Modal */}
      <Modal
        isOpen={!!viewingFile}
        onClose={() => setViewingFile(null)}
        title={viewingFile?.fileName}
        size="xl"
      >
        {viewingFile && (
          <div className="space-y-4 -mx-4 -mt-4">
            {viewingFile.isImage ? (
              <div className="flex justify-center bg-gray-100 dark:bg-gray-900 p-4">
                <AuthenticatedImage
                  src={viewingFile.url}
                  alt={viewingFile.fileName}
                  className="max-w-full max-h-[70vh] object-contain rounded-lg"
                />
              </div>
            ) : viewingFile.fileName?.toLowerCase().endsWith('.pdf') ? (
              <div className="flex justify-center bg-gray-100 dark:bg-gray-900 p-4">
                <iframe
                  src={`${viewingFile.url}#page=1&zoom=75`}
                  className="w-full h-[70vh] rounded-lg border border-gray-200 dark:border-gray-700"
                  title={viewingFile.fileName}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4 bg-gray-50 dark:bg-gray-900">
                <FileIcon className="h-24 w-24 text-gray-400" />
                <p className="text-gray-600 dark:text-gray-400">Preview not available for this file type</p>
                <a
                  href={viewingFile.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 dark:text-primary-400 hover:underline inline-flex items-center gap-2"
                >
                  <Eye className="h-4 w-4" />
                  Open in new tab
                </a>
              </div>
            )}
            <div className="flex justify-between items-center pt-4 px-4 border-t border-gray-200 dark:border-gray-700">
              <div>
              {viewingFile.documentId && (
                  <Button
                    variant="outline"
                    onClick={async () => {
                      if (!viewingFile.documentId) return
                      if (!confirm('Are you sure you want to delete this document? You will need to upload it again.')) {
                        return
                      }
                      setDeleting(true)
                      try {
                        await userDocumentsAPI.delete(viewingFile.documentId)
                        showToast('Document deleted successfully', 'success')
                        setViewingFile(null)
                        await fetchDocuments() // Refresh the list
                        // Notify sidebar to update cache
                        window.dispatchEvent(new Event('documentsUpdated'))
                      } catch (error: any) {
                        showToast(error.message || 'Failed to delete document', 'error')
                      } finally {
                        setDeleting(false)
                      }
                    }}
                    disabled={deleting}
                    className="text-red-600 dark:text-red-400 border-red-300 dark:border-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {deleting ? 'Deleting...' : 'Delete'}
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={async () => {
                    if (!viewingFile) return
                    try {
                      // viewingFile.url is already a signed URL, no auth needed
                      const response = await fetch(viewingFile.url)
                      if (!response.ok) throw new Error('Failed to download file')
                      
                      const blob = await response.blob()
                      const downloadUrl = URL.createObjectURL(blob)
                      const link = document.createElement('a')
                      link.href = downloadUrl
                      link.download = viewingFile.fileName
                      document.body.appendChild(link)
                      link.click()
                      document.body.removeChild(link)
                      URL.revokeObjectURL(downloadUrl)
                      showToast('File downloaded successfully', 'success')
                    } catch (error) {
                      showToast('Failed to download file', 'error')
                    }
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button
                  variant="default"
                  onClick={() => setViewingFile(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

