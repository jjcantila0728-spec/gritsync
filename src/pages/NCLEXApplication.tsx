import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { applicationsAPI, userDetailsAPI, userDocumentsAPI, getSignedFileUrl, applicationPaymentsAPI, servicesAPI } from '@/lib/api'
import { CardSkeleton } from '@/components/ui/Loading'
import { X, Info, CheckCircle, Eye, ArrowLeft, Download, Image, File as FileIcon, ChevronRight, ChevronLeft, AlertCircle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { formatCurrency, cn } from '@/lib/utils'

// Helper function to format MM/YYYY input
const formatMMYYYY = (value: string): string => {
  const digits = value.replace(/\D/g, '')
  const limited = digits.slice(0, 6)
  
  if (limited.length <= 2) {
    return limited
  } else if (limited.length <= 6) {
    return `${limited.slice(0, 2)}/${limited.slice(2)}`
  }
  
  return `${limited.slice(0, 2)}/${limited.slice(2, 6)}`
}

// Helper function to format MM/DD/YYYY input
const formatMMDDYYYY = (value: string): string => {
  // Remove all non-digits
  const digits = value.replace(/\D/g, '')
  
  // Limit to 8 digits (MMDDYYYY)
  const limited = digits.slice(0, 8)
  
  // Format as MM/DD/YYYY
  if (limited.length <= 2) {
    return limited
  } else if (limited.length <= 4) {
    return `${limited.slice(0, 2)}/${limited.slice(2)}`
  } else {
    return `${limited.slice(0, 2)}/${limited.slice(2, 4)}/${limited.slice(4)}`
  }
}

// Helper function to validate MM/DD/YYYY format
const isValidMMDDYYYY = (value: string): boolean => {
  const pattern = /^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}$/
  if (!pattern.test(value)) return false
  
  const [month, day, year] = value.split('/').map(Number)
  
  // Validate month
  if (month < 1 || month > 12) return false
  
  // Validate year
  if (year < 1900 || year > 2100) return false
  
  // Validate day based on month
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  // Check for leap year
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0)
  if (isLeapYear) daysInMonth[1] = 29
  
  if (day < 1 || day > daysInMonth[month - 1]) return false
  
  return true
}

// Convert MM/DD/YYYY to YYYY-MM-DD for database storage
const convertToDatabaseFormat = (mmddyyyy: string): string => {
  if (!mmddyyyy || !isValidMMDDYYYY(mmddyyyy)) return ''
  
  const [month, day, year] = mmddyyyy.split('/')
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

// Convert from database format (YYYY-MM-DD or other) to MM/DD/YYYY
const convertFromDatabaseFormat = (dateStr: string | null | undefined): string => {
  if (!dateStr) return ''
  
  // If already in MM/DD/YYYY format, return as is
  if (/^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}$/.test(dateStr)) {
    return dateStr
  }
  
  // If in YYYY-MM-DD format (from database)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split('-')
    return `${month}/${day}/${year}`
  }
  
  // If in MM/YYYY format (old format), convert to MM/01/YYYY
  if (/^(0[1-9]|1[0-2])\/\d{4}$/.test(dateStr)) {
    const [month, year] = dateStr.split('/')
    return `${month}/01/${year}`
  }
  
  // Try to parse other formats
  const date = new Date(dateStr)
  if (!isNaN(date.getTime())) {
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const year = date.getFullYear()
    return `${month}/${day}/${year}`
  }
  
  return dateStr
}

// Convert YYYY-MM to MM/YYYY (for education dates)
const convertToMMYYYY = (dateStr: string | null | undefined): string => {
  if (!dateStr) return ''
  if (/^(0[1-9]|1[0-2])\/\d{4}$/.test(dateStr)) return dateStr
  if (/^\d{4}-\d{2}$/.test(dateStr)) {
    const [year, month] = dateStr.split('-')
    return `${month}/${year}`
  }
  return dateStr
}

// Convert MM/YYYY to YYYY-MM for database storage (for education dates)
const convertMMYYYYToDatabase = (mmyyyy: string): string => {
  if (!mmyyyy || !/^(0[1-9]|1[0-2])\/\d{4}$/.test(mmyyyy)) return ''
  const [month, year] = mmyyyy.split('/')
  return `${year}-${month.padStart(2, '0')}`
}

// Removed unused _PAYMENT_CONFIG

export function NCLEXApplication() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadingDetails, setLoadingDetails] = useState(true)
  const [error, setError] = useState('')
  const [autoFilled, setAutoFilled] = useState(false)
  const [uploadedDocuments, setUploadedDocuments] = useState<{
    picture?: { file_path: string; file_name: string }
    diploma?: { file_path: string; file_name: string }
    passport?: { file_path: string; file_name: string }
  }>({})
  const [useUploadedDocs, setUseUploadedDocs] = useState<{
    picture: boolean
    diploma: boolean
    passport: boolean
  }>({
    picture: false,
    diploma: false,
    passport: false,
  })
  const [viewingFile, setViewingFile] = useState<{ url: string, fileName: string, isImage: boolean } | null>(null)
  const [currentStep, setCurrentStep] = useState(1)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({})

  // Personal Information
  const [firstName, setFirstName] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [lastName, setLastName] = useState('')
  const [mobileNumber, setMobileNumber] = useState('')
  const [email, setEmail] = useState('')
  const [gender, setGender] = useState('')
  const [maritalStatus, setMaritalStatus] = useState('')
  const [singleFullName, setSingleFullName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [birthPlace, setBirthPlace] = useState('')

  // Address
  const [houseNumber, setHouseNumber] = useState('')
  const [streetName, setStreetName] = useState('')
  const [city, setCity] = useState('')
  const [province, setProvince] = useState('')
  const [country, setCountry] = useState('')
  const [zipcode, setZipcode] = useState('')

  // Education - Elementary
  const [elementarySchool, setElementarySchool] = useState('')
  const [elementaryCity, setElementaryCity] = useState('')
  const [elementaryProvince, setElementaryProvince] = useState('')
  const [elementaryCountry, setElementaryCountry] = useState('')
  const [elementaryYearsAttended, setElementaryYearsAttended] = useState('')
  const [elementaryStartDate, setElementaryStartDate] = useState('')
  const [elementaryEndDate, setElementaryEndDate] = useState('')

  // Education - High School
  const [highSchool, setHighSchool] = useState('')
  const [highSchoolCity, setHighSchoolCity] = useState('')
  const [highSchoolProvince, setHighSchoolProvince] = useState('')
  const [highSchoolCountry, setHighSchoolCountry] = useState('')
  const [highSchoolYearsAttended, setHighSchoolYearsAttended] = useState('')
  const [highSchoolStartDate, setHighSchoolStartDate] = useState('')
  const [highSchoolEndDate, setHighSchoolEndDate] = useState('')

  // Education - Nursing School
  const [nursingSchool, setNursingSchool] = useState('')
  const [nursingSchoolCity, setNursingSchoolCity] = useState('')
  const [nursingSchoolProvince, setNursingSchoolProvince] = useState('')
  const [nursingSchoolCountry, setNursingSchoolCountry] = useState('')
  const [nursingSchoolYearsAttended, setNursingSchoolYearsAttended] = useState('')
  const [nursingSchoolStartDate, setNursingSchoolStartDate] = useState('')
  const [nursingSchoolEndDate, setNursingSchoolEndDate] = useState('')
  const [nursingSchoolMajor, setNursingSchoolMajor] = useState('')
  const [nursingSchoolDiplomaDate, setNursingSchoolDiplomaDate] = useState('')

  // Documents
  const [picture, setPicture] = useState<File | null>(null)
  const [diploma, setDiploma] = useState<File | null>(null)
  const [passport, setPassport] = useState<File | null>(null)

  // Review & Signature
  const [signature, setSignature] = useState('')

  // Payment
  const [paymentCategory, setPaymentCategory] = useState<'firstTake' | 'retake' | ''>('')
  const [paymentType, setPaymentType] = useState<'full' | 'step1' | 'retake' | ''>('')
  const [isRetaker, setIsRetaker] = useState(false)
  const [checkingRetaker, setCheckingRetaker] = useState(false)
  const [firstTakeService, setFirstTakeService] = useState<any>(null)
  const [retakeService, setRetakeService] = useState<any>(null)
  const [loadingServices, setLoadingServices] = useState(true)

  // Validation functions
  const validateEmail = (email: string): string => {
    if (!email) return 'Email is required'
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return 'Please enter a valid email address'
    }
    return ''
  }

  const validatePhone = (phone: string): string => {
    if (!phone) return 'Mobile number is required'
    const phoneRegex = /^[\d\s\-\+\(\)]+$/
    if (!phoneRegex.test(phone) || phone.replace(/\D/g, '').length < 7) {
      return 'Please enter a valid phone number (at least 7 digits)'
    }
    return ''
  }

  const validateDate = (date: string, fieldName: string): string => {
    if (!date) return `${fieldName} is required`
    if (!isValidMMDDYYYY(date)) {
      return `Please enter a valid ${fieldName} in MM/DD/YYYY format`
    }
    const [month, day, year] = date.split('/').map(Number)
    const dateObj = new Date(year, month - 1, day)
    if (dateObj > new Date()) {
      return `${fieldName} cannot be in the future`
    }
    return ''
  }

  const validateMMYYYY = (date: string, fieldName: string): string => {
    if (!date) return ''
    if (!/^(0[1-9]|1[0-2])\/\d{4}$/.test(date)) {
      return `Please enter a valid ${fieldName} in MM/YYYY format`
    }
    const [month, year] = date.split('/').map(Number)
    if (month < 1 || month > 12) {
      return 'Please enter a valid month (01-12)'
    }
    if (year < 1900 || year > new Date().getFullYear() + 1) {
      return 'Please enter a valid year'
    }
    return ''
  }

  const validateYearsAttended = (years: string): string => {
    if (!years) return ''
    const num = parseInt(years)
    if (isNaN(num) || num < 1 || num > 20) {
      return 'Please enter a valid number of years (1-20)'
    }
    return ''
  }

  const validateZipcode = (zipcode: string): string => {
    if (!zipcode) return ''
    const zipRegex = /^\d{4,10}$/
    if (!zipRegex.test(zipcode)) {
      return 'Please enter a valid zipcode (4-10 digits)'
    }
    return ''
  }

  // Handle field blur for validation
  const handleFieldBlur = (fieldName: string) => {
    setTouchedFields(prev => ({ ...prev, [fieldName]: true }))
    const errors: Record<string, string> = { ...validationErrors }

    switch (fieldName) {
      case 'firstName':
        if (!firstName.trim()) {
          errors.firstName = 'First name is required'
        } else {
          delete errors.firstName
        }
        break
      case 'lastName':
        if (!lastName.trim()) {
          errors.lastName = 'Last name is required'
        } else {
          delete errors.lastName
        }
        break
      case 'email':
        errors.email = validateEmail(email)
        if (!errors.email) delete errors.email
        break
      case 'mobileNumber':
        errors.mobileNumber = validatePhone(mobileNumber)
        if (!errors.mobileNumber) delete errors.mobileNumber
        break
      case 'dateOfBirth':
        errors.dateOfBirth = validateDate(dateOfBirth, 'Date of Birth')
        if (!errors.dateOfBirth) delete errors.dateOfBirth
        break
      case 'zipcode':
        if (zipcode) {
          errors.zipcode = validateZipcode(zipcode)
          if (!errors.zipcode) delete errors.zipcode
        } else {
          delete errors.zipcode
        }
        break
      case 'singleFullName':
        if (maritalStatus === 'single' && !singleFullName.trim()) {
          errors.singleFullName = 'Full name when single is required'
        } else {
          delete errors.singleFullName
        }
        break
      case 'elementaryYearsAttended':
        if (elementaryYearsAttended) {
          errors.elementaryYearsAttended = validateYearsAttended(elementaryYearsAttended)
          if (!errors.elementaryYearsAttended) delete errors.elementaryYearsAttended
        } else {
          delete errors.elementaryYearsAttended
        }
        break
      case 'elementaryStartDate':
        if (elementaryStartDate) {
          errors.elementaryStartDate = validateMMYYYY(elementaryStartDate, 'Start Date')
          if (!errors.elementaryStartDate) delete errors.elementaryStartDate
        } else {
          delete errors.elementaryStartDate
        }
        break
      case 'elementaryEndDate':
        if (elementaryEndDate) {
          errors.elementaryEndDate = validateMMYYYY(elementaryEndDate, 'End Date')
          if (!errors.elementaryEndDate) delete errors.elementaryEndDate
        } else {
          delete errors.elementaryEndDate
        }
        break
      case 'highSchoolYearsAttended':
        if (highSchoolYearsAttended) {
          errors.highSchoolYearsAttended = validateYearsAttended(highSchoolYearsAttended)
          if (!errors.highSchoolYearsAttended) delete errors.highSchoolYearsAttended
        } else {
          delete errors.highSchoolYearsAttended
        }
        break
      case 'highSchoolStartDate':
        if (highSchoolStartDate) {
          errors.highSchoolStartDate = validateMMYYYY(highSchoolStartDate, 'Start Date')
          if (!errors.highSchoolStartDate) delete errors.highSchoolStartDate
        } else {
          delete errors.highSchoolStartDate
        }
        break
      case 'highSchoolEndDate':
        if (highSchoolEndDate) {
          errors.highSchoolEndDate = validateMMYYYY(highSchoolEndDate, 'End Date')
          if (!errors.highSchoolEndDate) delete errors.highSchoolEndDate
        } else {
          delete errors.highSchoolEndDate
        }
        break
      case 'nursingSchoolYearsAttended':
        if (nursingSchoolYearsAttended) {
          errors.nursingSchoolYearsAttended = validateYearsAttended(nursingSchoolYearsAttended)
          if (!errors.nursingSchoolYearsAttended) delete errors.nursingSchoolYearsAttended
        } else {
          delete errors.nursingSchoolYearsAttended
        }
        break
      case 'nursingSchoolStartDate':
        if (nursingSchoolStartDate) {
          errors.nursingSchoolStartDate = validateMMYYYY(nursingSchoolStartDate, 'Start Date')
          if (!errors.nursingSchoolStartDate) delete errors.nursingSchoolStartDate
        } else {
          delete errors.nursingSchoolStartDate
        }
        break
      case 'nursingSchoolEndDate':
        if (nursingSchoolEndDate) {
          errors.nursingSchoolEndDate = validateMMYYYY(nursingSchoolEndDate, 'End Date')
          if (!errors.nursingSchoolEndDate) delete errors.nursingSchoolEndDate
        } else {
          delete errors.nursingSchoolEndDate
        }
        break
      case 'nursingSchoolDiplomaDate':
        if (nursingSchoolDiplomaDate) {
          errors.nursingSchoolDiplomaDate = validateDate(nursingSchoolDiplomaDate, 'Diploma Date')
          if (!errors.nursingSchoolDiplomaDate) delete errors.nursingSchoolDiplomaDate
        } else {
          delete errors.nursingSchoolDiplomaDate
        }
        break
    }

    setValidationErrors(errors)
  }

  // Get field validation status
  const getFieldStatus = (fieldName: string, value: string) => {
    const isTouched = touchedFields[fieldName]
    const hasError = validationErrors[fieldName]
    const hasValue = value && value.trim() !== ''
    
    if (!isTouched && !hasValue) return 'default'
    if (hasError) return 'error'
    if (hasValue && !hasError) return 'success'
    return 'default'
  }

  // Load saved details and documents on mount
  useEffect(() => {
    if (user) {
      loadSavedDetails()
      loadUploadedDocuments()
      checkRetakerStatus()
      loadServices()
    } else {
      setLoadingDetails(false)
    }
  }, [user])

  // Refresh uploaded documents when user reaches step 6 (documents step)
  useEffect(() => {
    if (user && currentStep === 6) {
      loadUploadedDocuments()
    }
  }, [user, currentStep])

  // Load services from admin quote service config
  async function loadServices() {
    try {
      setLoadingServices(true)
      // Fetch services for NCLEX Processing in New York
      const services = await servicesAPI.getAllByServiceAndState('NCLEX Processing', 'New York')
      
      // Find full payment service for first take
      const firstTakeFull = services.find((s: any) => s.payment_type === 'full')
      // Find staggered payment service for first take
      const firstTakeStaggered = services.find((s: any) => s.payment_type === 'staggered')
      
      // For retake, we'll use the full payment service (or create a combined service)
      // Check if there's a specific retake service, otherwise use full payment
      const retakeServiceData = firstTakeFull || services[0]
      
      // Combine full and staggered for first take display
      if (firstTakeFull && firstTakeStaggered) {
        setFirstTakeService({
          full: firstTakeFull,
          staggered: firstTakeStaggered,
        })
      } else if (firstTakeFull) {
        // If only full payment exists, use it for both
        setFirstTakeService({
          full: firstTakeFull,
          staggered: firstTakeFull,
        })
      }
      
      setRetakeService(retakeServiceData)
    } catch (error) {
      console.error('Error loading services:', error)
      // Fallback to hardcoded config if service fetch fails
    } finally {
      setLoadingServices(false)
    }
  }

  // Calculate tax for a single item (12% tax rate)
  const calculateItemTax = (item: any): number => {
    const TAX_RATE = 0.12
    return item.taxable ? (item.amount || 0) * TAX_RATE : 0
  }

  // Calculate item total (amount + tax)
  const calculateItemTotal = (item: any): number => {
    return (item.amount || 0) + calculateItemTax(item)
  }

  async function checkRetakerStatus() {
    try {
      setCheckingRetaker(true)
      const result = await applicationPaymentsAPI.checkRetaker()
      setIsRetaker(result.isRetaker)
      // Auto-select payment category based on retaker status
      if (result.isRetaker) {
        setPaymentCategory('retake')
        setPaymentType('retake')
      } else {
        setPaymentCategory('firstTake')
      }
    } catch (error) {
      console.error('Error checking retaker status:', error)
    } finally {
      setCheckingRetaker(false)
    }
  }

  // Handle payment category change
  function handlePaymentCategoryChange(value: string) {
    setPaymentCategory(value as 'firstTake' | 'retake' | '')
    if (value === 'retake') {
      setPaymentType('retake')
    } else if (value === 'firstTake') {
      // Reset to step1 for first take
      setPaymentType('step1')
    } else {
      setPaymentType('')
    }
  }


  async function loadSavedDetails() {
    try {
      const details = await userDetailsAPI.get()
      const typedDetails = details as {
        first_name?: string
        middle_name?: string
        last_name?: string
        mobile_number?: string
        email?: string
        gender?: string
        marital_status?: string
        single_full_name?: string
        date_of_birth?: string
        birth_place?: string
        house_number?: string
        street_name?: string
        city?: string
        province?: string
        country?: string
        zipcode?: string
        elementary_school?: string
        elementary_city?: string
        elementary_province?: string
        elementary_country?: string
        elementary_years_attended?: string | number
        elementary_start_date?: string
        elementary_end_date?: string
        high_school?: string
        high_school_city?: string
        high_school_province?: string
        high_school_country?: string
        high_school_years_attended?: string | number
        high_school_start_date?: string
        high_school_end_date?: string
        nursing_school?: string
        nursing_school_city?: string
        nursing_school_province?: string
        nursing_school_country?: string
        nursing_school_years_attended?: string | number
        nursing_school_start_date?: string
        nursing_school_end_date?: string
        nursing_school_major?: string
        nursing_school_diploma_date?: string
      } | null
      if (typedDetails) {
        // Auto-populate all fields from saved details
        setFirstName(typedDetails.first_name || '')
        setMiddleName(typedDetails.middle_name || '')
        setLastName(typedDetails.last_name || '')
        setMobileNumber(typedDetails.mobile_number || '')
        setEmail(typedDetails.email || user?.email || '')
        setGender(typedDetails.gender || '')
        setMaritalStatus(typedDetails.marital_status || '')
        setSingleFullName(typedDetails.single_full_name || '')
        setDateOfBirth(convertFromDatabaseFormat(typedDetails.date_of_birth))
        setBirthPlace(typedDetails.birth_place || '')
        setHouseNumber(typedDetails.house_number || '')
        setStreetName(typedDetails.street_name || '')
        setCity(typedDetails.city || '')
        setProvince(typedDetails.province || '')
        setCountry(typedDetails.country || '')
        setZipcode(typedDetails.zipcode || '')
        setElementarySchool(typedDetails.elementary_school || '')
        setElementaryCity(typedDetails.elementary_city || '')
        setElementaryProvince(typedDetails.elementary_province || '')
        setElementaryCountry(typedDetails.elementary_country || '')
        setElementaryYearsAttended(typedDetails.elementary_years_attended != null ? String(typedDetails.elementary_years_attended) : '')
        setElementaryStartDate(convertToMMYYYY(typedDetails.elementary_start_date))
        setElementaryEndDate(convertToMMYYYY(typedDetails.elementary_end_date))
        setHighSchool(typedDetails.high_school || '')
        setHighSchoolCity(typedDetails.high_school_city || '')
        setHighSchoolProvince(typedDetails.high_school_province || '')
        setHighSchoolCountry(typedDetails.high_school_country || '')
        setHighSchoolYearsAttended(typedDetails.high_school_years_attended != null ? String(typedDetails.high_school_years_attended) : '')
        setHighSchoolStartDate(convertToMMYYYY(typedDetails.high_school_start_date))
        setHighSchoolEndDate(convertToMMYYYY(typedDetails.high_school_end_date))
        setNursingSchool(typedDetails.nursing_school || '')
        setNursingSchoolCity(typedDetails.nursing_school_city || '')
        setNursingSchoolProvince(typedDetails.nursing_school_province || '')
        setNursingSchoolCountry(typedDetails.nursing_school_country || '')
        setNursingSchoolYearsAttended(typedDetails.nursing_school_years_attended != null ? String(typedDetails.nursing_school_years_attended) : '')
        setNursingSchoolStartDate(convertToMMYYYY(typedDetails.nursing_school_start_date))
        setNursingSchoolEndDate(convertToMMYYYY(typedDetails.nursing_school_end_date))
        setNursingSchoolMajor(typedDetails.nursing_school_major || '')
        setNursingSchoolDiplomaDate(convertFromDatabaseFormat(typedDetails.nursing_school_diploma_date))
        setAutoFilled(true)
      }
    } catch (error) {
      // No saved details, that's okay
    } finally {
      setLoadingDetails(false)
    }
  }

  async function loadUploadedDocuments() {
    try {
      const docs = await userDocumentsAPI.getAll()
      const docsMap: any = {}
      docs.forEach((doc: any) => {
        docsMap[doc.document_type] = {
          file_path: doc.file_path,
          file_name: doc.file_name,
        }
      })
      setUploadedDocuments(docsMap)
      
      // Automatically use uploaded documents if they exist
      // Clear manually uploaded files when using uploaded documents
      const newUseUploadedDocs = {
        picture: !!docsMap.picture,
        diploma: !!docsMap.diploma,
        passport: !!docsMap.passport,
      }
      setUseUploadedDocs(newUseUploadedDocs)
      
      // Clear manually uploaded files if we're using uploaded documents
      if (newUseUploadedDocs.picture) setPicture(null)
      if (newUseUploadedDocs.diploma) setDiploma(null)
      if (newUseUploadedDocs.passport) setPassport(null)
    } catch (error) {
      // No uploaded documents found
    }
  }

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (file: File | null) => void
  ) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB')
        return
      }
      setter(file)
    }
  }

  // Component for document image preview (uses file path directly)
  const DocumentImagePreview = ({ filePath, alt, className }: { filePath: string, alt: string, className?: string }) => {
    const [imageSrc, setImageSrc] = useState<string | null>(null)
    const [error, setError] = useState(false)

    useEffect(() => {
      // Validate filePath is a string
      if (!filePath || typeof filePath !== 'string') {
        setError(true)
        return
      }

      getSignedFileUrl(filePath, 3600)
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
    }, [filePath])

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
        src={imageSrc}
        alt={alt}
        className={className}
        onError={() => setError(true)}
      />
    )
  }

  // Component to display authenticated images
  const AuthenticatedImage = ({ src, alt, className }: { src: string, alt: string, className?: string }) => {
    const [imageSrc, setImageSrc] = useState<string | null>(null)
    const [error, setError] = useState(false)

    useEffect(() => {
      const token = localStorage.getItem('token')
      if (!token) {
        setError(true)
        return
      }

      let currentBlobUrl: string | null = null

      fetch(src, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
        .then(res => {
          if (!res.ok) throw new Error('Failed to load image')
          return res.blob()
        })
        .then(blob => {
          const url = URL.createObjectURL(blob)
          currentBlobUrl = url
          setImageSrc(url)
        })
        .catch(() => {
          setError(true)
        })

      return () => {
        if (currentBlobUrl) {
          URL.revokeObjectURL(currentBlobUrl)
        }
      }
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
        src={imageSrc}
        alt={alt}
        className={className}
        onError={() => setError(true)}
      />
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Check if documents are provided (either uploaded files or using uploaded documents)
    const hasPicture = picture || (useUploadedDocs.picture && uploadedDocuments.picture)
    const hasDiploma = diploma || (useUploadedDocs.diploma && uploadedDocuments.diploma)
    const hasPassport = passport || (useUploadedDocs.passport && uploadedDocuments.passport)
    
    if (!user || !hasPicture || !hasDiploma || !hasPassport) {
      setError('All documents are required')
      return
    }

    // Validate date of birth format
    if (!isValidMMDDYYYY(dateOfBirth)) {
      setError('Invalid date of birth format. Please use MM/DD/YYYY (e.g., 01/15/1990)')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Upload files to Supabase Storage first
      let picturePath = ''
      let diplomaPath = ''
      let passportPath = ''

      // Handle picture
      if (useUploadedDocs.picture && uploadedDocuments.picture) {
        // Use existing uploaded document path
        const picDoc = uploadedDocuments.picture as { file_path?: string }
        picturePath = picDoc.file_path || ''
      } else if (picture) {
        // Upload new picture to Supabase Storage
        const uploadedDoc = await userDocumentsAPI.upload('picture', picture)
        const typedDoc = uploadedDoc as { file_path?: string } | null
        if (typedDoc?.file_path) {
          picturePath = typedDoc.file_path
        }
      }

      // Handle diploma
      if (useUploadedDocs.diploma && uploadedDocuments.diploma) {
        const dipDoc = uploadedDocuments.diploma as { file_path?: string }
        diplomaPath = dipDoc.file_path || ''
      } else if (diploma) {
        const uploadedDoc = await userDocumentsAPI.upload('diploma', diploma)
        const typedDoc = uploadedDoc as { file_path?: string } | null
        if (typedDoc?.file_path) {
          diplomaPath = typedDoc.file_path
        }
      }

      // Handle passport
      if (useUploadedDocs.passport && uploadedDocuments.passport) {
        const passDoc = uploadedDocuments.passport as { file_path?: string }
        passportPath = passDoc.file_path || ''
      } else if (passport) {
        const uploadedDoc = await userDocumentsAPI.upload('passport', passport)
        const typedDoc = uploadedDoc as { file_path?: string } | null
        if (typedDoc?.file_path) {
          passportPath = typedDoc.file_path
        }
      }

      // Convert MM/DD/YYYY to YYYY-MM-DD for database
      const dbDate = convertToDatabaseFormat(dateOfBirth)
      if (!dbDate && dateOfBirth) {
        setError('Invalid date format. Please use MM/DD/YYYY')
        setLoading(false)
        return
      }

      // Create application data object (not FormData)
      const applicationData = {
        first_name: firstName,
        middle_name: middleName || null,
        last_name: lastName,
        mobile_number: mobileNumber,
        email: email,
        gender: gender,
        marital_status: maritalStatus,
        single_full_name: maritalStatus === 'single' ? singleFullName : null,
        date_of_birth: dbDate || dateOfBirth,
        birth_place: birthPlace,
        country_of_birth: country, // Assuming country is country_of_birth
        house_number: houseNumber,
        street_name: streetName,
        city: city,
        province: province,
        country: country,
        zipcode: zipcode,
        elementary_school: elementarySchool,
        elementary_city: elementaryCity,
        elementary_province: elementaryProvince || null,
        elementary_country: elementaryCountry || null,
        elementary_years_attended: elementaryYearsAttended,
        elementary_start_date: elementaryStartDate,
        elementary_end_date: elementaryEndDate,
        high_school: highSchool,
        high_school_city: highSchoolCity,
        high_school_province: highSchoolProvince || null,
        high_school_country: highSchoolCountry || null,
        high_school_years_attended: highSchoolYearsAttended,
        high_school_start_date: highSchoolStartDate,
        high_school_end_date: highSchoolEndDate,
        nursing_school: nursingSchool,
        nursing_school_city: nursingSchoolCity,
        nursing_school_province: nursingSchoolProvince || null,
        nursing_school_country: nursingSchoolCountry || null,
        nursing_school_years_attended: nursingSchoolYearsAttended,
        nursing_school_start_date: nursingSchoolStartDate,
        nursing_school_end_date: nursingSchoolEndDate,
        nursing_school_major: nursingSchoolMajor || null,
        nursing_school_diploma_date: nursingSchoolDiplomaDate || null,
        signature: signature || null,
        payment_type: paymentType || null,
        picture_path: picturePath,
        diploma_path: diplomaPath,
        passport_path: passportPath,
      }

      const result = await applicationsAPI.create(applicationData)
      showToast('Application submitted successfully! Redirecting to payment...', 'success')
      
      // Determine payment type for redirect
      let paymentTypeParam = paymentType
      if (paymentType === 'retake') {
        paymentTypeParam = 'full' // Retake uses 'full' payment type in the backend
      }
      
      const typedResult = result as { grit_app_id?: string; id?: string }
      navigate(`/applications/${typedResult.grit_app_id || typedResult.id}/payment?type=${paymentTypeParam}`)
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to submit application'
      setError(errorMessage)
      showToast(errorMessage, 'error')
    } finally {
      setLoading(false)
    }
  }

  // Check form completion for progress indicator
  const isPersonalInfoComplete = firstName && lastName && email && mobileNumber && gender && maritalStatus && dateOfBirth && isValidMMDDYYYY(dateOfBirth) && birthPlace
  const isAddressComplete = houseNumber && streetName && city && province && country && zipcode
  const isElementaryComplete = elementarySchool && elementaryCity && elementaryProvince && elementaryCountry && elementaryStartDate && elementaryEndDate
  const isHighSchoolComplete = highSchool && highSchoolCity && highSchoolProvince && highSchoolCountry && highSchoolStartDate && highSchoolEndDate
  const isNursingSchoolComplete = nursingSchool && nursingSchoolCity && nursingSchoolProvince && nursingSchoolCountry && nursingSchoolStartDate && nursingSchoolEndDate
  const isDocumentsComplete = (picture || (useUploadedDocs.picture && uploadedDocuments.picture)) && 
                              (diploma || (useUploadedDocs.diploma && uploadedDocuments.diploma)) && 
                              (passport || (useUploadedDocs.passport && uploadedDocuments.passport))
  const isReviewComplete = signature.trim().length > 0
  const isPaymentComplete = paymentCategory !== '' && paymentType !== ''

  const completedSteps = [
    isPersonalInfoComplete,
    isAddressComplete,
    isElementaryComplete,
    isHighSchoolComplete,
    isNursingSchoolComplete,
    isDocumentsComplete,
    isReviewComplete,
    isPaymentComplete
  ].filter(Boolean).length

  const totalSteps = 8
  const stepTitles = [
    'Personal Information',
    'Address',
    'Elementary School',
    'High School',
    'Nursing School',
    'Required Documents',
    'Review & Signature',
    'Payment Selection'
  ]

  const canProceedToNext = () => {
    switch (currentStep) {
      case 1:
        return isPersonalInfoComplete
      case 2:
        return isAddressComplete
      case 3:
        return isElementaryComplete
      case 4:
        return isHighSchoolComplete
      case 5:
        return isNursingSchoolComplete
      case 6:
        return isDocumentsComplete
      case 7:
        return isReviewComplete
      case 8:
        return isPaymentComplete
      default:
        return false
    }
  }

  const saveCurrentStep = async () => {
    try {
      setSaving(true)
      
      // Helper function to safely trim and convert to null if empty
      const safeTrim = (value: string | undefined | null): string | null => {
        if (!value) return null
        const trimmed = value.trim()
        return trimmed === '' ? null : trimmed
      }
      
      // Fetch existing details first to preserve data that isn't being updated
      const existingDetails = await userDetailsAPI.get()
      
      // Prepare new data with current form values
      const newData: any = {
        first_name: safeTrim(firstName),
        middle_name: safeTrim(middleName),
        last_name: safeTrim(lastName),
        mobile_number: safeTrim(mobileNumber),
        email: safeTrim(email) || user?.email || null,
        gender: gender || null,
        marital_status: maritalStatus || null,
        single_full_name: maritalStatus === 'single' ? safeTrim(singleFullName) : null,
        date_of_birth: convertToDatabaseFormat(dateOfBirth) || null,
        birth_place: safeTrim(birthPlace),
        house_number: safeTrim(houseNumber),
        street_name: safeTrim(streetName),
        city: safeTrim(city),
        province: safeTrim(province),
        country: safeTrim(country),
        zipcode: safeTrim(zipcode),
        elementary_school: safeTrim(elementarySchool),
        elementary_city: safeTrim(elementaryCity),
        elementary_province: safeTrim(elementaryProvince),
        elementary_country: safeTrim(elementaryCountry),
        elementary_years_attended: safeTrim(elementaryYearsAttended),
        elementary_start_date: convertMMYYYYToDatabase(elementaryStartDate) || null,
        elementary_end_date: convertMMYYYYToDatabase(elementaryEndDate) || null,
        high_school: safeTrim(highSchool),
        high_school_city: safeTrim(highSchoolCity),
        high_school_province: safeTrim(highSchoolProvince),
        high_school_country: safeTrim(highSchoolCountry),
        high_school_years_attended: safeTrim(highSchoolYearsAttended),
        high_school_start_date: convertMMYYYYToDatabase(highSchoolStartDate) || null,
        high_school_end_date: convertMMYYYYToDatabase(highSchoolEndDate) || null,
        nursing_school: safeTrim(nursingSchool),
        nursing_school_city: safeTrim(nursingSchoolCity),
        nursing_school_province: safeTrim(nursingSchoolProvince),
        nursing_school_country: safeTrim(nursingSchoolCountry),
        nursing_school_years_attended: safeTrim(nursingSchoolYearsAttended),
        nursing_school_start_date: convertMMYYYYToDatabase(nursingSchoolStartDate) || null,
        nursing_school_end_date: convertMMYYYYToDatabase(nursingSchoolEndDate) || null,
        nursing_school_major: safeTrim(nursingSchoolMajor),
        nursing_school_diploma_date: convertToDatabaseFormat(nursingSchoolDiplomaDate) || null,
      }
      
      // Merge with existing details - preserve existing values when new value is null/empty
      const mergedData: any = existingDetails && typeof existingDetails === 'object' && !Array.isArray(existingDetails) 
        ? { ...(existingDetails as Record<string, any>) } 
        : {}
      
      const existing = existingDetails && typeof existingDetails === 'object' && !Array.isArray(existingDetails) 
        ? existingDetails as Record<string, any> 
        : null
      
      // Update with new values, but preserve existing non-null values when new value is null/empty
      for (const [key, value] of Object.entries(newData)) {
        if (value !== null && value !== undefined && value !== '') {
          // New value has content, use it
          mergedData[key] = value
        } else if (existing && (existing[key] !== null && existing[key] !== undefined && existing[key] !== '')) {
          // New value is empty but existing has data, preserve existing
          mergedData[key] = existing[key]
        } else {
          // Both are empty, set to null
          mergedData[key] = value
        }
      }
      
      // Remove metadata fields that shouldn't be in the update
      delete mergedData.user_id
      delete mergedData.id
      delete mergedData.created_at
      delete mergedData.updated_at
      
      await userDetailsAPI.save(mergedData)
      return true
    } catch (error: any) {
      console.error('Error saving step:', error)
      showToast('Failed to save data. Please try again.', 'error')
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleNext = async () => {
    if (currentStep < totalSteps && canProceedToNext()) {
      // For step 7, validate signature matches full name
      if (currentStep === 7) {
        const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ').trim()
        const signatureTrimmed = signature.trim()
        if (signatureTrimmed.toLowerCase() !== fullName.toLowerCase()) {
          showToast('Signature must match your full name exactly', 'error')
          return
        }
      }
      
      const saved = await saveCurrentStep()
      if (saved) {
        setCurrentStep(currentStep + 1)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }
  }

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  if (loadingDetails) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-4 md:p-8">
            <div className="mb-8">
              <div className="h-9 bg-gray-200 dark:bg-gray-700 rounded w-64 animate-pulse" />
            </div>
            <CardSkeleton />
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-4 md:p-8">
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(-1)}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                NCLEX Application Form
              </h1>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/my-details')}
              >
                <Info className="h-4 w-4 mr-2" />
                Manage Details
              </Button>
            </div>
          </div>

          {/* Progress Indicator */}
          <Card className="mb-6">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Step {currentStep} of {totalSteps}: {stepTitles[currentStep - 1]}
                </h3>
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {completedSteps} / {totalSteps} sections complete
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 relative overflow-hidden">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all duration-300 relative"
                  style={{ width: `${(currentStep / totalSteps) * 100}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                </div>
                <div 
                  className="absolute top-0 h-2 w-2 bg-green-500 rounded-full animate-pulse"
                  style={{ left: `${(currentStep / totalSteps) * 100}%`, marginLeft: '-4px' }}
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 text-xs">
              {stepTitles.map((title, index) => {
                const stepNum = index + 1
                const isComplete = [
                  isPersonalInfoComplete,
                  isAddressComplete,
                  isElementaryComplete,
                  isHighSchoolComplete,
                  isNursingSchoolComplete,
                  isDocumentsComplete,
                  isReviewComplete,
                  isPaymentComplete
                ][index]
                const isActive = currentStep === stepNum
                
                return (
                  <button
                    key={stepNum}
                    onClick={() => {
                      setCurrentStep(stepNum)
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                    className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                      isActive
                        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-semibold'
                        : isComplete
                        ? 'text-green-600 dark:text-green-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                        : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    {isComplete ? (
                      <CheckCircle className="h-3 w-3" />
                    ) : (
                      <div className={`h-3 w-3 rounded-full border-2 ${
                        isActive ? 'border-primary-600' : 'border-gray-300'
                      }`} />
                    )}
                    <span className="hidden sm:inline">{title.split(' ')[0]}</span>
                  </button>
                )
              })}
            </div>
          </Card>

          {autoFilled && (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                    Form auto-filled from your saved details
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    All fields are editable. Update any information as needed. You can manage your saved details in{' '}
                    <button
                      onClick={() => navigate('/my-details')}
                      className="underline font-semibold hover:text-blue-900 dark:hover:text-blue-100"
                    >
                      My Details
                    </button>
                  </p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Step 1: Personal Information */}
            {currentStep === 1 && (
            <Card title="Personal Information">
              <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    <strong>Please write your name as per passport.</strong> Ensure all names match exactly as they appear on your passport document.
                  </p>
                </div>
              </div>
              {/* Validation Errors Summary */}
              {Object.keys(validationErrors).length > 0 && (
                <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-red-900 dark:text-red-100 mb-2">
                        Please fix the following validation errors:
                      </p>
                      <ul className="list-disc list-inside space-y-1 text-sm text-red-800 dark:text-red-200">
                        {Object.entries(validationErrors).map(([field, error]) => (
                          <li key={field}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Input
                    label="First Name *"
                    value={firstName}
                    onChange={(e) => {
                      setFirstName(e.target.value)
                      if (touchedFields.firstName) {
                        handleFieldBlur('firstName')
                      }
                    }}
                    onBlur={() => handleFieldBlur('firstName')}
                    required
                    error={touchedFields.firstName ? validationErrors.firstName : undefined}
                    className={cn(
                      getFieldStatus('firstName', firstName) === 'success' && 'border-green-500 focus:ring-green-500',
                      getFieldStatus('firstName', firstName) === 'error' && 'border-red-500 focus:ring-red-500'
                    )}
                  />
                </div>
                <div>
                  <Input
                    label="Middle Name"
                    value={middleName}
                    onChange={(e) => setMiddleName(e.target.value)}
                    className={cn(
                      middleName && 'border-green-500 focus:ring-green-500'
                    )}
                  />
                </div>
                <div>
                  <Input
                    label="Last Name *"
                    value={lastName}
                    onChange={(e) => {
                      setLastName(e.target.value)
                      if (touchedFields.lastName) {
                        handleFieldBlur('lastName')
                      }
                    }}
                    onBlur={() => handleFieldBlur('lastName')}
                    required
                    error={touchedFields.lastName ? validationErrors.lastName : undefined}
                    className={cn(
                      getFieldStatus('lastName', lastName) === 'success' && 'border-green-500 focus:ring-green-500',
                      getFieldStatus('lastName', lastName) === 'error' && 'border-red-500 focus:ring-red-500'
                    )}
                  />
                </div>
                <div>
                  <Input
                    label="Mobile Number *"
                    type="tel"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    onBlur={() => handleFieldBlur('mobileNumber')}
                    required
                    error={touchedFields.mobileNumber ? validationErrors.mobileNumber : undefined}
                    className={cn(
                      getFieldStatus('mobileNumber', mobileNumber) === 'success' && 'border-green-500 focus:ring-green-500',
                      getFieldStatus('mobileNumber', mobileNumber) === 'error' && 'border-red-500 focus:ring-red-500'
                    )}
                  />
                </div>
                <div>
                  <Input
                    label="Email Address *"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={() => handleFieldBlur('email')}
                    required
                    error={touchedFields.email ? validationErrors.email : undefined}
                    className={cn(
                      getFieldStatus('email', email) === 'success' && 'border-green-500 focus:ring-green-500',
                      getFieldStatus('email', email) === 'error' && 'border-red-500 focus:ring-red-500'
                    )}
                  />
                </div>
                <Select
                  label="Gender *"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  options={[
                    { value: '', label: 'Select Gender' },
                    { value: 'male', label: 'Male' },
                    { value: 'female', label: 'Female' },
                    { value: 'other', label: 'Other' },
                  ]}
                  required
                />
                <Select
                  label="Marital Status *"
                  value={maritalStatus}
                  onChange={(e) => setMaritalStatus(e.target.value)}
                  options={[
                    { value: '', label: 'Select Status' },
                    { value: 'single', label: 'Single' },
                    { value: 'married', label: 'Married' },
                    { value: 'divorced', label: 'Divorced' },
                    { value: 'widowed', label: 'Widowed' },
                  ]}
                  required
                />
                {maritalStatus === 'single' && (
                  <div>
                    <Input
                      label="Write Your Full Name When You Are Single *"
                      value={singleFullName}
                      onChange={(e) => {
                        setSingleFullName(e.target.value)
                        if (touchedFields.singleFullName) {
                          handleFieldBlur('singleFullName')
                        }
                      }}
                      onBlur={() => handleFieldBlur('singleFullName')}
                      required
                      error={touchedFields.singleFullName ? validationErrors.singleFullName : undefined}
                      className={cn(
                        getFieldStatus('singleFullName', singleFullName) === 'success' && 'border-green-500 focus:ring-green-500',
                        getFieldStatus('singleFullName', singleFullName) === 'error' && 'border-red-500 focus:ring-red-500'
                      )}
                    />
                  </div>
                )}
                <div>
                  <Input
                    label="Date of Birth (MM/DD/YYYY) *"
                    type="text"
                    value={dateOfBirth}
                    onChange={(e) => {
                      const formatted = formatMMDDYYYY(e.target.value)
                      setDateOfBirth(formatted)
                      if (touchedFields.dateOfBirth) {
                        handleFieldBlur('dateOfBirth')
                      }
                    }}
                    onBlur={() => handleFieldBlur('dateOfBirth')}
                    placeholder="MM/DD/YYYY"
                    maxLength={10}
                    required
                    error={touchedFields.dateOfBirth ? validationErrors.dateOfBirth : undefined}
                    className={cn(
                      getFieldStatus('dateOfBirth', dateOfBirth) === 'success' && 'border-green-500 focus:ring-green-500',
                      getFieldStatus('dateOfBirth', dateOfBirth) === 'error' && 'border-red-500 focus:ring-red-500'
                    )}
                  />
                </div>
                <div>
                  <Input
                    label="Birth Place *"
                    value={birthPlace}
                    onChange={(e) => setBirthPlace(e.target.value)}
                    placeholder="City, Country"
                    required
                    className={cn(
                      birthPlace && 'border-green-500 focus:ring-green-500'
                    )}
                  />
                </div>
              </div>
            </Card>
            )}

            {/* Step 2: Address */}
            {currentStep === 2 && (
            <Card title="Address">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Input
                    label="House Number & Street Name *"
                    value={houseNumber}
                    onChange={(e) => setHouseNumber(e.target.value)}
                    required
                    className={cn(
                      houseNumber && 'border-green-500 focus:ring-green-500'
                    )}
                  />
                </div>
                <div>
                  <Input
                    label="Barangay *"
                    value={streetName}
                    onChange={(e) => setStreetName(e.target.value)}
                    required
                    className={cn(
                      streetName && 'border-green-500 focus:ring-green-500'
                    )}
                  />
                </div>
                <div>
                  <Input
                    label="City / Municipality Name *"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    required
                    className={cn(
                      city && 'border-green-500 focus:ring-green-500'
                    )}
                  />
                </div>
                <div>
                  <Input
                    label="Province *"
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    required
                    className={cn(
                      province && 'border-green-500 focus:ring-green-500'
                    )}
                  />
                </div>
                <div>
                  <Input
                    label="Country *"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    required
                    className={cn(
                      country && 'border-green-500 focus:ring-green-500'
                    )}
                  />
                </div>
                <div>
                  <Input
                    label="Zipcode *"
                    value={zipcode}
                    onChange={(e) => setZipcode(e.target.value)}
                    onBlur={() => handleFieldBlur('zipcode')}
                    required
                    error={touchedFields.zipcode ? validationErrors.zipcode : undefined}
                    className={cn(
                      getFieldStatus('zipcode', zipcode) === 'success' && 'border-green-500 focus:ring-green-500',
                      getFieldStatus('zipcode', zipcode) === 'error' && 'border-red-500 focus:ring-red-500'
                    )}
                  />
                </div>
              </div>
            </Card>
            )}

            {/* Step 3: Elementary School */}
            {currentStep === 3 && (
            <Card title="Elementary School">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Input
                    label="Name of Elementary School *"
                    value={elementarySchool}
                    onChange={(e) => setElementarySchool(e.target.value)}
                    required
                    className={cn(
                      elementarySchool && 'border-green-500 focus:ring-green-500'
                    )}
                  />
                </div>
                <div>
                  <Input
                    label="City *"
                    value={elementaryCity}
                    onChange={(e) => setElementaryCity(e.target.value)}
                    required
                    className={cn(
                      elementaryCity && 'border-green-500 focus:ring-green-500'
                    )}
                  />
                </div>
                <div>
                  <Input
                    label="Province *"
                    value={elementaryProvince}
                    onChange={(e) => setElementaryProvince(e.target.value)}
                    required
                    className={cn(
                      elementaryProvince && 'border-green-500 focus:ring-green-500'
                    )}
                  />
                </div>
                <div>
                  <Input
                    label="Country *"
                    value={elementaryCountry}
                    onChange={(e) => setElementaryCountry(e.target.value)}
                    required
                    className={cn(
                      elementaryCountry && 'border-green-500 focus:ring-green-500'
                    )}
                  />
                </div>
                <div>
                  <Input
                    label="Number of Years Attended *"
                    type="number"
                    value={elementaryYearsAttended}
                    onChange={(e) => setElementaryYearsAttended(e.target.value)}
                    onBlur={() => handleFieldBlur('elementaryYearsAttended')}
                    required
                    error={touchedFields.elementaryYearsAttended ? validationErrors.elementaryYearsAttended : undefined}
                    className={cn(
                      getFieldStatus('elementaryYearsAttended', elementaryYearsAttended) === 'success' && 'border-green-500 focus:ring-green-500',
                      getFieldStatus('elementaryYearsAttended', elementaryYearsAttended) === 'error' && 'border-red-500 focus:ring-red-500'
                    )}
                  />
                </div>
                <div>
                  <Input
                    label="Start Date (MM/YYYY) *"
                    type="text"
                    value={elementaryStartDate}
                    onChange={(e) => {
                      const formatted = formatMMYYYY(e.target.value)
                      setElementaryStartDate(formatted)
                      if (touchedFields.elementaryStartDate) {
                        handleFieldBlur('elementaryStartDate')
                      }
                    }}
                    onBlur={() => handleFieldBlur('elementaryStartDate')}
                    placeholder="MM/YYYY"
                    maxLength={7}
                    required
                    error={touchedFields.elementaryStartDate ? validationErrors.elementaryStartDate : undefined}
                    className={cn(
                      getFieldStatus('elementaryStartDate', elementaryStartDate) === 'success' && 'border-green-500 focus:ring-green-500',
                      getFieldStatus('elementaryStartDate', elementaryStartDate) === 'error' && 'border-red-500 focus:ring-red-500'
                    )}
                  />
                </div>
                <div>
                  <Input
                    label="End Date (MM/YYYY) *"
                    type="text"
                    value={elementaryEndDate}
                    onChange={(e) => {
                      const formatted = formatMMYYYY(e.target.value)
                      setElementaryEndDate(formatted)
                      if (touchedFields.elementaryEndDate) {
                        handleFieldBlur('elementaryEndDate')
                      }
                    }}
                    onBlur={() => handleFieldBlur('elementaryEndDate')}
                    placeholder="MM/YYYY"
                    maxLength={7}
                    required
                    error={touchedFields.elementaryEndDate ? validationErrors.elementaryEndDate : undefined}
                    className={cn(
                      getFieldStatus('elementaryEndDate', elementaryEndDate) === 'success' && 'border-green-500 focus:ring-green-500',
                      getFieldStatus('elementaryEndDate', elementaryEndDate) === 'error' && 'border-red-500 focus:ring-red-500'
                    )}
                  />
                </div>
              </div>
            </Card>
            )}

            {/* Step 4: High School */}
            {currentStep === 4 && (
            <Card title="High School">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Input
                    label="Name of High School *"
                    value={highSchool}
                    onChange={(e) => setHighSchool(e.target.value)}
                    required
                    className={cn(
                      highSchool && 'border-green-500 focus:ring-green-500'
                    )}
                  />
                </div>
                <div>
                  <Input
                    label="City *"
                    value={highSchoolCity}
                    onChange={(e) => setHighSchoolCity(e.target.value)}
                    required
                    className={cn(
                      highSchoolCity && 'border-green-500 focus:ring-green-500'
                    )}
                  />
                </div>
                <div>
                  <Input
                    label="Province *"
                    value={highSchoolProvince}
                    onChange={(e) => setHighSchoolProvince(e.target.value)}
                    required
                    className={cn(
                      highSchoolProvince && 'border-green-500 focus:ring-green-500'
                    )}
                  />
                </div>
                <div>
                  <Input
                    label="Country *"
                    value={highSchoolCountry}
                    onChange={(e) => setHighSchoolCountry(e.target.value)}
                    required
                    className={cn(
                      highSchoolCountry && 'border-green-500 focus:ring-green-500'
                    )}
                  />
                </div>
                <div>
                  <Input
                    label="Number of Years Attended *"
                    type="number"
                    value={highSchoolYearsAttended}
                    onChange={(e) => setHighSchoolYearsAttended(e.target.value)}
                    onBlur={() => handleFieldBlur('highSchoolYearsAttended')}
                    required
                    error={touchedFields.highSchoolYearsAttended ? validationErrors.highSchoolYearsAttended : undefined}
                    className={cn(
                      getFieldStatus('highSchoolYearsAttended', highSchoolYearsAttended) === 'success' && 'border-green-500 focus:ring-green-500',
                      getFieldStatus('highSchoolYearsAttended', highSchoolYearsAttended) === 'error' && 'border-red-500 focus:ring-red-500'
                    )}
                  />
                </div>
                <div>
                  <Input
                    label="Start Date (MM/YYYY) *"
                    type="text"
                    value={highSchoolStartDate}
                    onChange={(e) => {
                      const formatted = formatMMYYYY(e.target.value)
                      setHighSchoolStartDate(formatted)
                      if (touchedFields.highSchoolStartDate) {
                        handleFieldBlur('highSchoolStartDate')
                      }
                    }}
                    onBlur={() => handleFieldBlur('highSchoolStartDate')}
                    placeholder="MM/YYYY"
                    maxLength={7}
                    required
                    error={touchedFields.highSchoolStartDate ? validationErrors.highSchoolStartDate : undefined}
                    className={cn(
                      getFieldStatus('highSchoolStartDate', highSchoolStartDate) === 'success' && 'border-green-500 focus:ring-green-500',
                      getFieldStatus('highSchoolStartDate', highSchoolStartDate) === 'error' && 'border-red-500 focus:ring-red-500'
                    )}
                  />
                </div>
                <div>
                  <Input
                    label="End Date (MM/YYYY) *"
                    type="text"
                    value={highSchoolEndDate}
                    onChange={(e) => {
                      const formatted = formatMMYYYY(e.target.value)
                      setHighSchoolEndDate(formatted)
                      if (touchedFields.highSchoolEndDate) {
                        handleFieldBlur('highSchoolEndDate')
                      }
                    }}
                    onBlur={() => handleFieldBlur('highSchoolEndDate')}
                    placeholder="MM/YYYY"
                    maxLength={7}
                    required
                    error={touchedFields.highSchoolEndDate ? validationErrors.highSchoolEndDate : undefined}
                    className={cn(
                      getFieldStatus('highSchoolEndDate', highSchoolEndDate) === 'success' && 'border-green-500 focus:ring-green-500',
                      getFieldStatus('highSchoolEndDate', highSchoolEndDate) === 'error' && 'border-red-500 focus:ring-red-500'
                    )}
                  />
                </div>
              </div>
            </Card>
            )}

            {/* Step 5: Nursing School */}
            {currentStep === 5 && (
            <Card title="Nursing School">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Input
                    label="Name of Nursing School *"
                    value={nursingSchool}
                    onChange={(e) => setNursingSchool(e.target.value)}
                    required
                    className={cn(
                      nursingSchool && 'border-green-500 focus:ring-green-500'
                    )}
                  />
                </div>
                <div>
                  <Input
                    label="City *"
                    value={nursingSchoolCity}
                    onChange={(e) => setNursingSchoolCity(e.target.value)}
                    required
                    className={cn(
                      nursingSchoolCity && 'border-green-500 focus:ring-green-500'
                    )}
                  />
                </div>
                <div>
                  <Input
                    label="Province *"
                    value={nursingSchoolProvince}
                    onChange={(e) => setNursingSchoolProvince(e.target.value)}
                    required
                    className={cn(
                      nursingSchoolProvince && 'border-green-500 focus:ring-green-500'
                    )}
                  />
                </div>
                <div>
                  <Input
                    label="Country *"
                    value={nursingSchoolCountry}
                    onChange={(e) => setNursingSchoolCountry(e.target.value)}
                    required
                    className={cn(
                      nursingSchoolCountry && 'border-green-500 focus:ring-green-500'
                    )}
                  />
                </div>
                <div>
                  <Input
                    label="Number of Years Attended *"
                    type="number"
                    value={nursingSchoolYearsAttended}
                    onChange={(e) => setNursingSchoolYearsAttended(e.target.value)}
                    onBlur={() => handleFieldBlur('nursingSchoolYearsAttended')}
                    required
                    error={touchedFields.nursingSchoolYearsAttended ? validationErrors.nursingSchoolYearsAttended : undefined}
                    className={cn(
                      getFieldStatus('nursingSchoolYearsAttended', nursingSchoolYearsAttended) === 'success' && 'border-green-500 focus:ring-green-500',
                      getFieldStatus('nursingSchoolYearsAttended', nursingSchoolYearsAttended) === 'error' && 'border-red-500 focus:ring-red-500'
                    )}
                  />
                </div>
                <div>
                  <Input
                    label="Start Date (MM/YYYY) *"
                    type="text"
                    value={nursingSchoolStartDate}
                    onChange={(e) => {
                      const formatted = formatMMYYYY(e.target.value)
                      setNursingSchoolStartDate(formatted)
                      if (touchedFields.nursingSchoolStartDate) {
                        handleFieldBlur('nursingSchoolStartDate')
                      }
                    }}
                    onBlur={() => handleFieldBlur('nursingSchoolStartDate')}
                    placeholder="MM/YYYY"
                    maxLength={7}
                    required
                    error={touchedFields.nursingSchoolStartDate ? validationErrors.nursingSchoolStartDate : undefined}
                    className={cn(
                      getFieldStatus('nursingSchoolStartDate', nursingSchoolStartDate) === 'success' && 'border-green-500 focus:ring-green-500',
                      getFieldStatus('nursingSchoolStartDate', nursingSchoolStartDate) === 'error' && 'border-red-500 focus:ring-red-500'
                    )}
                  />
                </div>
                <div>
                  <Input
                    label="End Date (MM/YYYY) *"
                    type="text"
                    value={nursingSchoolEndDate}
                    onChange={(e) => {
                      const formatted = formatMMYYYY(e.target.value)
                      setNursingSchoolEndDate(formatted)
                      if (touchedFields.nursingSchoolEndDate) {
                        handleFieldBlur('nursingSchoolEndDate')
                      }
                    }}
                    onBlur={() => handleFieldBlur('nursingSchoolEndDate')}
                    placeholder="MM/YYYY"
                    maxLength={7}
                    required
                    error={touchedFields.nursingSchoolEndDate ? validationErrors.nursingSchoolEndDate : undefined}
                    className={cn(
                      getFieldStatus('nursingSchoolEndDate', nursingSchoolEndDate) === 'success' && 'border-green-500 focus:ring-green-500',
                      getFieldStatus('nursingSchoolEndDate', nursingSchoolEndDate) === 'error' && 'border-red-500 focus:ring-red-500'
                    )}
                  />
                </div>
                <div>
                  <Input
                    label="Major / Concentration"
                    value={nursingSchoolMajor}
                    onChange={(e) => setNursingSchoolMajor(e.target.value)}
                    placeholder="BS in Nursing"
                    className={cn(
                      nursingSchoolMajor && 'border-green-500 focus:ring-green-500'
                    )}
                  />
                </div>
                <div>
                  <Input
                    label="Date of Diploma Awarded (MM/YYYY)"
                    type="text"
                    value={nursingSchoolDiplomaDate}
                    onChange={(e) => {
                      const formatted = formatMMYYYY(e.target.value)
                      setNursingSchoolDiplomaDate(formatted)
                      if (touchedFields.nursingSchoolDiplomaDate) {
                        handleFieldBlur('nursingSchoolDiplomaDate')
                      }
                    }}
                    onBlur={() => handleFieldBlur('nursingSchoolDiplomaDate')}
                    placeholder="MM/YYYY"
                    maxLength={7}
                    error={touchedFields.nursingSchoolDiplomaDate ? validationErrors.nursingSchoolDiplomaDate : undefined}
                    className={cn(
                      getFieldStatus('nursingSchoolDiplomaDate', nursingSchoolDiplomaDate) === 'success' && 'border-green-500 focus:ring-green-500',
                      getFieldStatus('nursingSchoolDiplomaDate', nursingSchoolDiplomaDate) === 'error' && 'border-red-500 focus:ring-red-500'
                    )}
                  />
                </div>
              </div>
            </Card>
            )}

            {/* Step 6: Required Documents */}
            {currentStep === 6 && (
            <Card title="Required Documents">
              <div className="grid md:grid-cols-3 gap-6">
                {/* 2x2 Picture */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    2x2 Picture *
                  </label>
                  {uploadedDocuments.picture ? (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      {/* Square Image Preview */}
                      <div className="mb-3 relative group cursor-pointer aspect-square" onClick={async () => {
                        try {
                          const picDoc = uploadedDocuments.picture as { file_path?: string; file_name?: string }
                          if (!picDoc.file_path) return
                          const filePath = picDoc.file_path
                          const signedUrl = await getSignedFileUrl(filePath, 3600)
                          const isImage = picDoc.file_name?.match(/\.(jpg|jpeg|png|gif|webp)$/i) || true
                          setViewingFile({
                            url: signedUrl,
                            fileName: picDoc.file_name || '',
                            isImage: !!isImage
                          })
                        } catch (error) {
                          showToast('Failed to load file', 'error')
                        }
                      }}>
                        <DocumentImagePreview
                          filePath={(uploadedDocuments.picture as { file_path?: string })?.file_path || ''}
                          alt={(uploadedDocuments.picture as { file_name?: string })?.file_name || 'Picture'}
                          className="w-full h-full object-cover rounded-lg border border-gray-200 dark:border-gray-700 transition-opacity group-hover:opacity-90"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-lg transition-colors flex items-center justify-center">
                          <Eye className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                          {(uploadedDocuments.picture as { file_name?: string })?.file_name}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          handleFileChange(e, setPicture)
                          setUseUploadedDocs({ ...useUploadedDocs, picture: false })
                        }}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                        required={!useUploadedDocs.picture}
                      />
                      {picture && (
                        <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                          {picture.name}
                          <button
                            type="button"
                            onClick={() => setPicture(null)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Nursing Diploma */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Nursing Diploma *
                  </label>
                  {uploadedDocuments.diploma ? (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      {/* Square Document Preview */}
                      {(() => {
                        const isImage = uploadedDocuments.diploma.file_name?.match(/\.(jpg|jpeg|png|gif|webp)$/i) || false
                        return isImage ? (
                          <div className="mb-3 relative group cursor-pointer aspect-square" onClick={async () => {
                            try {
                              if (!uploadedDocuments.diploma) return
                              const filePath = uploadedDocuments.diploma.file_path
                              if (!filePath) return
                              const signedUrl = await getSignedFileUrl(filePath, 3600)
                              setViewingFile({
                                url: signedUrl,
                                fileName: uploadedDocuments.diploma.file_name || '',
                                isImage: true
                              })
                            } catch (error) {
                              showToast('Failed to load file', 'error')
                            }
                          }}>
                            <DocumentImagePreview
                              filePath={typeof uploadedDocuments.diploma.file_path === 'string' ? uploadedDocuments.diploma.file_path : ''}
                              alt={uploadedDocuments.diploma.file_name || 'Diploma'}
                              className="w-full h-full object-cover rounded-lg border border-gray-200 dark:border-gray-700 transition-opacity group-hover:opacity-90"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-lg transition-colors flex items-center justify-center">
                              <Eye className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </div>
                        ) : (
                          <div 
                            className="mb-3 aspect-square flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors group"
                            onClick={async () => {
                              try {
                                const dipDoc = uploadedDocuments.diploma as { file_path?: string; file_name?: string }
                                if (!dipDoc.file_path) return
                                const filePath = dipDoc.file_path
                                const signedUrl = await getSignedFileUrl(filePath, 3600)
                                setViewingFile({
                                  url: signedUrl,
                                  fileName: dipDoc.file_name || '',
                                  isImage: false
                                })
                              } catch (error) {
                                showToast('Failed to load file', 'error')
                              }
                            }}
                          >
                            <FileIcon className="h-12 w-12 text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors" />
                          </div>
                        )
                      })()}
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                          {(uploadedDocuments.diploma as { file_name?: string })?.file_name}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          handleFileChange(e, setDiploma)
                          setUseUploadedDocs({ ...useUploadedDocs, diploma: false })
                        }}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                        required={!useUploadedDocs.diploma}
                      />
                      {diploma && (
                        <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                          {diploma.name}
                          <button
                            type="button"
                            onClick={() => setDiploma(null)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Passport */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Passport *
                  </label>
                  {uploadedDocuments.passport ? (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      {/* Square Document Preview */}
                      {(() => {
                        const isImage = uploadedDocuments.passport.file_name?.match(/\.(jpg|jpeg|png|gif|webp)$/i) || false
                        return isImage ? (
                          <div className="mb-3 relative group cursor-pointer aspect-square" onClick={async () => {
                            try {
                              if (!uploadedDocuments.passport) return
                              const filePath = uploadedDocuments.passport.file_path
                              if (!filePath) return
                              const signedUrl = await getSignedFileUrl(filePath, 3600)
                              setViewingFile({
                                url: signedUrl,
                                fileName: uploadedDocuments.passport.file_name || '',
                                isImage: true
                              })
                            } catch (error) {
                              showToast('Failed to load file', 'error')
                            }
                          }}>
                            <DocumentImagePreview
                              filePath={(uploadedDocuments.passport as { file_path?: string })?.file_path || ''}
                              alt={(uploadedDocuments.passport as { file_name?: string })?.file_name || 'Passport'}
                              className="w-full h-full object-cover rounded-lg border border-gray-200 dark:border-gray-700 transition-opacity group-hover:opacity-90"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-lg transition-colors flex items-center justify-center">
                              <Eye className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </div>
                        ) : (
                          <div 
                            className="mb-3 aspect-square flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors group"
                            onClick={async () => {
                              try {
                                const passDoc = uploadedDocuments.passport as { file_path?: string; file_name?: string }
                                if (!passDoc.file_path) return
                                const filePath = passDoc.file_path
                                const signedUrl = await getSignedFileUrl(filePath, 3600)
                                setViewingFile({
                                  url: signedUrl,
                                  fileName: passDoc.file_name || 'file',
                                  isImage: false
                                })
                              } catch (error) {
                                showToast('Failed to load file', 'error')
                              }
                            }}
                          >
                            <FileIcon className="h-12 w-12 text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors" />
                          </div>
                        )
                      })()}
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                          {(uploadedDocuments.passport as { file_name?: string })?.file_name}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          handleFileChange(e, setPassport)
                          setUseUploadedDocs({ ...useUploadedDocs, passport: false })
                        }}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                        required={!useUploadedDocs.passport}
                      />
                      {passport && (
                        <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                          {passport.name || 'Passport file'}
                          <button
                            type="button"
                            onClick={() => setPassport(null)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Card>
            )}

            {/* Step 7: Review & Signature */}
            {currentStep === 7 && (
            <Card title="Review & Signature">
              <div className="space-y-6">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-blue-900 dark:text-blue-100">
                      Please review all the information you have provided. Once you sign below, you confirm that all information is accurate and complete.
                    </p>
                  </div>
                </div>

                {/* Review Sections */}
                <div className="space-y-6">
                  {/* Personal Information */}
                  <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                    <h3 className="font-semibold text-lg mb-3 text-gray-900 dark:text-gray-100">Personal Information</h3>
                    <div className="grid md:grid-cols-2 gap-3 text-sm">
                      <div><span className="font-medium">First Name:</span> {firstName || 'N/A'}</div>
                      <div><span className="font-medium">Middle Name:</span> {middleName || 'N/A'}</div>
                      <div><span className="font-medium">Last Name:</span> {lastName || 'N/A'}</div>
                      <div><span className="font-medium">Full Name:</span> {[firstName, middleName, lastName].filter(Boolean).join(' ') || 'N/A'}</div>
                      <div><span className="font-medium">Email:</span> {email || 'N/A'}</div>
                      <div><span className="font-medium">Mobile Number:</span> {mobileNumber || 'N/A'}</div>
                      <div><span className="font-medium">Gender:</span> {gender || 'N/A'}</div>
                      <div><span className="font-medium">Marital Status:</span> {maritalStatus || 'N/A'}</div>
                      {maritalStatus === 'single' && singleFullName && (
                        <div className="md:col-span-2"><span className="font-medium">Full Name When Single:</span> {singleFullName}</div>
                      )}
                      <div><span className="font-medium">Date of Birth:</span> {dateOfBirth || 'N/A'}</div>
                      <div><span className="font-medium">Birth Place:</span> {birthPlace || 'N/A'}</div>
                    </div>
                  </div>

                  {/* Address */}
                  <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                    <h3 className="font-semibold text-lg mb-3 text-gray-900 dark:text-gray-100">Address</h3>
                    <div className="grid md:grid-cols-2 gap-3 text-sm">
                      <div><span className="font-medium">House Number & Street Name:</span> {houseNumber || 'N/A'}</div>
                      <div><span className="font-medium">Barangay:</span> {streetName || 'N/A'}</div>
                      <div><span className="font-medium">City / Municipality:</span> {city || 'N/A'}</div>
                      <div><span className="font-medium">Province:</span> {province || 'N/A'}</div>
                      <div><span className="font-medium">Country:</span> {country || 'N/A'}</div>
                      <div><span className="font-medium">Zipcode:</span> {zipcode || 'N/A'}</div>
                    </div>
                  </div>

                  {/* Elementary School */}
                  <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                    <h3 className="font-semibold text-lg mb-3 text-gray-900 dark:text-gray-100">Elementary School</h3>
                    <div className="grid md:grid-cols-2 gap-3 text-sm">
                      <div><span className="font-medium">School Name:</span> {elementarySchool || 'N/A'}</div>
                      <div><span className="font-medium">City:</span> {elementaryCity || 'N/A'}</div>
                      <div><span className="font-medium">Province:</span> {elementaryProvince || 'N/A'}</div>
                      <div><span className="font-medium">Country:</span> {elementaryCountry || 'N/A'}</div>
                      <div><span className="font-medium">Years Attended:</span> {elementaryYearsAttended || 'N/A'}</div>
                      <div><span className="font-medium">Start Date:</span> {elementaryStartDate || 'N/A'}</div>
                      <div className="md:col-span-2"><span className="font-medium">End Date:</span> {elementaryEndDate || 'N/A'}</div>
                    </div>
                  </div>

                  {/* High School */}
                  <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                    <h3 className="font-semibold text-lg mb-3 text-gray-900 dark:text-gray-100">High School</h3>
                    <div className="grid md:grid-cols-2 gap-3 text-sm">
                      <div><span className="font-medium">School Name:</span> {highSchool || 'N/A'}</div>
                      <div><span className="font-medium">City:</span> {highSchoolCity || 'N/A'}</div>
                      <div><span className="font-medium">Province:</span> {highSchoolProvince || 'N/A'}</div>
                      <div><span className="font-medium">Country:</span> {highSchoolCountry || 'N/A'}</div>
                      <div><span className="font-medium">Years Attended:</span> {highSchoolYearsAttended || 'N/A'}</div>
                      <div><span className="font-medium">Start Date:</span> {highSchoolStartDate || 'N/A'}</div>
                      <div className="md:col-span-2"><span className="font-medium">End Date:</span> {highSchoolEndDate || 'N/A'}</div>
                    </div>
                  </div>

                  {/* Nursing School */}
                  <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                    <h3 className="font-semibold text-lg mb-3 text-gray-900 dark:text-gray-100">Nursing School</h3>
                    <div className="grid md:grid-cols-2 gap-3 text-sm">
                      <div><span className="font-medium">School Name:</span> {nursingSchool || 'N/A'}</div>
                      <div><span className="font-medium">City:</span> {nursingSchoolCity || 'N/A'}</div>
                      <div><span className="font-medium">Province:</span> {nursingSchoolProvince || 'N/A'}</div>
                      <div><span className="font-medium">Country:</span> {nursingSchoolCountry || 'N/A'}</div>
                      <div><span className="font-medium">Years Attended:</span> {nursingSchoolYearsAttended || 'N/A'}</div>
                      <div><span className="font-medium">Start Date:</span> {nursingSchoolStartDate || 'N/A'}</div>
                      <div><span className="font-medium">End Date:</span> {nursingSchoolEndDate || 'N/A'}</div>
                      <div><span className="font-medium">Major / Concentration:</span> {nursingSchoolMajor || 'N/A'}</div>
                      <div><span className="font-medium">Diploma Date:</span> {nursingSchoolDiplomaDate || 'N/A'}</div>
                    </div>
                  </div>

                  {/* Documents */}
                  <div>
                    <h3 className="font-semibold text-lg mb-3 text-gray-900 dark:text-gray-100">Required Documents</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">2x2 Picture:</span>
                          {(picture || (useUploadedDocs.picture && uploadedDocuments.picture)) ? (
                            <span className="text-green-600 dark:text-green-400">✓ Uploaded</span>
                          ) : (
                            <span className="text-red-600 dark:text-red-400">✗ Missing</span>
                          )}
                        </div>
                        {(picture || (useUploadedDocs.picture && uploadedDocuments.picture)) && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {picture?.name || uploadedDocuments.picture?.file_name || 'File uploaded'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Nursing Diploma:</span>
                          {(diploma || (useUploadedDocs.diploma && uploadedDocuments.diploma)) ? (
                            <span className="text-green-600 dark:text-green-400">✓ Uploaded</span>
                          ) : (
                            <span className="text-red-600 dark:text-red-400">✗ Missing</span>
                          )}
                        </div>
                        {(diploma || (useUploadedDocs.diploma && uploadedDocuments.diploma)) && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {diploma?.name || uploadedDocuments.diploma?.file_name || 'File uploaded'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Passport:</span>
                          {(passport || (useUploadedDocs.passport && uploadedDocuments.passport)) ? (
                            <span className="text-green-600 dark:text-green-400">✓ Uploaded</span>
                          ) : (
                            <span className="text-red-600 dark:text-red-400">✗ Missing</span>
                          )}
                        </div>
                        {(passport || (useUploadedDocs.passport && uploadedDocuments.passport)) && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {passport?.name || uploadedDocuments.passport?.file_name || 'File uploaded'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Signature */}
                <div className="mt-6 p-4 border-2 border-gray-300 dark:border-gray-600 rounded-lg">
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Digital Signature *
                  </label>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                    Please type your full name (First Name, Middle Name, Last Name) to sign this application:
                  </p>
                  <Input
                    type="text"
                    value={signature}
                    onChange={(e) => setSignature(e.target.value)}
                    placeholder={`${firstName} ${middleName} ${lastName}`.trim() || "Enter your full name"}
                    required
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Expected: {[firstName, middleName, lastName].filter(Boolean).join(' ')}
                  </p>
                </div>
              </div>
            </Card>
            )}

            {/* Step 8: Payment Selection */}
            {currentStep === 8 && (
            <Card title="Payment Selection">
              <div className="space-y-6">
                {checkingRetaker ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                    <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">Checking payment options...</p>
                  </div>
                ) : (
                  <>
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <div className="flex items-start gap-3">
                        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                            Select your payment category
                          </p>
                          <p className="text-xs text-blue-700 dark:text-blue-300">
                            {isRetaker 
                              ? 'As a retaker, select "Retake Payment" option.'
                              : 'First-time takers should select "First Take Payment" option.'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Payment Category Dropdown */}
                    <Select
                      label="Payment Category"
                      value={paymentCategory}
                      onChange={(e) => handlePaymentCategoryChange(e.target.value)}
                      className="w-full"
                      options={[
                        { value: '', label: 'Select payment category' },
                        { value: 'firstTake', label: 'First Take Payment' },
                        { value: 'retake', label: 'Retake Payment' },
                      ]}
                    />

                    {/* Quotation Breakdown */}
                    {paymentCategory === 'firstTake' && (
                      <div className="mt-6 p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                          First Take Payment - Quotation
                        </h3>
                        
                        {/* Payment Type Selection for First Take */}
                        <div className="mb-6">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                            Payment Type
                          </label>
                          <div className="space-y-3">
                            <label className={`flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                              paymentType === 'full'
                                ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                            }`}>
                              <input
                                type="radio"
                                name="firstTakePaymentType"
                                value="full"
                                checked={paymentType === 'full'}
                                onChange={(e) => setPaymentType(e.target.value as 'full')}
                                className="mt-1"
                              />
                              <div className="flex-1">
                                <div className="font-semibold text-gray-900 dark:text-gray-100">
                                  Full Payment (Both Step 1 and Step 2)
                                </div>
                              </div>
                            </label>
                            <label className={`flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                              paymentType === 'step1'
                                ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                            }`}>
                              <input
                                type="radio"
                                name="firstTakePaymentType"
                                value="step1"
                                checked={paymentType === 'step1'}
                                onChange={(e) => setPaymentType(e.target.value as 'step1')}
                                className="mt-1"
                              />
                              <div className="flex-1">
                                <div className="font-semibold text-gray-900 dark:text-gray-100">
                                  Staggered Payment (Step 1 Only)
                                </div>
                              </div>
                            </label>
                          </div>
                        </div>

                        {loadingServices ? (
                          <div className="text-center py-4">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
                            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Loading pricing...</p>
                          </div>
                        ) : firstTakeService ? (
                          <>
                            {/* Step 1 Breakdown */}
                            <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Step 1 Breakdown</h4>
                              <div className="space-y-2">
                                {firstTakeService.staggered?.line_items
                                  ?.filter((item: any) => item.step === 1 || !item.step)
                                  .map((item: any, idx: number) => {
                                    const itemTax = calculateItemTax(item)
                                    const itemTotal = calculateItemTotal(item)
                                    return (
                                      <div key={idx} className="space-y-1">
                                        <div className="flex justify-between text-sm">
                                          <span className="text-gray-700 dark:text-gray-300">
                                            {item.description}
                                            {item.taxable && (
                                              <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">(Taxable)</span>
                                            )}
                                          </span>
                                          <span className="text-gray-900 dark:text-gray-100 font-medium">{formatCurrency(item.amount)}</span>
                                        </div>
                                        {item.taxable && itemTax > 0 && (
                                          <div className="flex justify-between text-xs pl-4 text-gray-600 dark:text-gray-400">
                                            <span>Tax (12%):</span>
                                            <span>{formatCurrency(itemTax)}</span>
                                          </div>
                                        )}
                                        {item.taxable && (
                                          <div className="flex justify-between text-sm pl-4 font-medium text-gray-900 dark:text-gray-100 border-t border-gray-200 dark:border-gray-700 pt-1">
                                            <span>Subtotal:</span>
                                            <span>{formatCurrency(itemTotal)}</span>
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })}
                                <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700 mt-2">
                                  <span className="text-gray-700 dark:text-gray-300">Subtotal</span>
                                  <span className="text-gray-900 dark:text-gray-100 font-medium">
                                    {formatCurrency((firstTakeService.staggered?.total_step1 || firstTakeService.staggered?.total_full || 0) - (firstTakeService.staggered?.tax_step1 || 0))}
                                  </span>
                                </div>
                                {firstTakeService.staggered?.tax_step1 && firstTakeService.staggered.tax_step1 > 0 && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-gray-700 dark:text-gray-300">Tax</span>
                                    <span className="text-gray-900 dark:text-gray-100 font-medium">
                                      {formatCurrency(firstTakeService.staggered.tax_step1)}
                                    </span>
                                  </div>
                                )}
                                <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700 mt-2">
                                  <span className="font-semibold text-gray-900 dark:text-gray-100">Step 1 Total</span>
                                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                                    {formatCurrency(firstTakeService.staggered?.total_step1 || firstTakeService.staggered?.total_full || 0)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Step 2 Breakdown */}
                            <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Step 2 Breakdown</h4>
                              <div className="space-y-2">
                                {firstTakeService.staggered?.line_items
                                  ?.filter((item: any) => item.step === 2)
                                  .map((item: any, idx: number) => {
                                    const itemTax = calculateItemTax(item)
                                    const itemTotal = calculateItemTotal(item)
                                    return (
                                      <div key={idx} className="space-y-1">
                                        <div className="flex justify-between text-sm">
                                          <span className="text-gray-700 dark:text-gray-300">
                                            {item.description}
                                            {item.taxable && (
                                              <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">(Taxable)</span>
                                            )}
                                          </span>
                                          <span className="text-gray-900 dark:text-gray-100 font-medium">{formatCurrency(item.amount)}</span>
                                        </div>
                                        {item.taxable && itemTax > 0 && (
                                          <div className="flex justify-between text-xs pl-4 text-gray-600 dark:text-gray-400">
                                            <span>Tax (12%):</span>
                                            <span>{formatCurrency(itemTax)}</span>
                                          </div>
                                        )}
                                        {item.taxable && (
                                          <div className="flex justify-between text-sm pl-4 font-medium text-gray-900 dark:text-gray-100 border-t border-gray-200 dark:border-gray-700 pt-1">
                                            <span>Subtotal:</span>
                                            <span>{formatCurrency(itemTotal)}</span>
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })}
                                <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700 mt-2">
                                  <span className="text-gray-700 dark:text-gray-300">Subtotal</span>
                                  <span className="text-gray-900 dark:text-gray-100 font-medium">
                                    {formatCurrency((firstTakeService.staggered?.total_step2 || 0) - (firstTakeService.staggered?.tax_step2 || 0))}
                                  </span>
                                </div>
                                {firstTakeService.staggered?.tax_step2 && firstTakeService.staggered.tax_step2 > 0 && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-gray-700 dark:text-gray-300">Tax</span>
                                    <span className="text-gray-900 dark:text-gray-100 font-medium">
                                      {formatCurrency(firstTakeService.staggered.tax_step2)}
                                    </span>
                                  </div>
                                )}
                                <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700 mt-2">
                                  <span className="font-semibold text-gray-900 dark:text-gray-100">Step 2 Total</span>
                                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                                    {formatCurrency(firstTakeService.staggered?.total_step2 || 0)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Total Summary */}
                            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                              {paymentType === 'full' ? (
                                <>
                                  <div className="flex justify-between text-sm mb-2">
                                    <span className="text-gray-700 dark:text-gray-300">Subtotal</span>
                                    <span className="text-gray-900 dark:text-gray-100">
                                      {formatCurrency((firstTakeService.full?.total_full || 0) - (firstTakeService.full?.tax_amount || 0))}
                                    </span>
                                  </div>
                                  {firstTakeService.full?.tax_amount && firstTakeService.full.tax_amount > 0 && (
                                    <div className="flex justify-between text-sm mb-2">
                                      <span className="text-gray-700 dark:text-gray-300">Tax</span>
                                      <span className="text-gray-900 dark:text-gray-100">
                                        {formatCurrency(firstTakeService.full.tax_amount)}
                                      </span>
                                    </div>
                                  )}
                                  <div className="flex justify-between items-center pt-2 border-t border-green-200 dark:border-green-800 mt-2">
                                    <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                                      Total Amount (Full Payment)
                                    </span>
                                    <span className="text-xl font-bold text-green-600 dark:text-green-400">
                                      {formatCurrency(firstTakeService.full?.total_full || 0)}
                                    </span>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="flex justify-between items-center">
                                    <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                                      Amount Due Now (Step 1 Only)
                                    </span>
                                    <span className="text-xl font-bold text-green-600 dark:text-green-400">
                                      {formatCurrency(firstTakeService.staggered?.total_step1 || firstTakeService.staggered?.total_full || 0)}
                                    </span>
                                  </div>
                                  {paymentType === 'step1' && (
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                                      Step 2 ({formatCurrency(firstTakeService.staggered?.total_step2 || 0)}) will be due later
                                    </p>
                                  )}
                                </>
                              )}
                            </div>
                          </>
                        ) : (
                          <div className="text-center py-4 text-gray-600 dark:text-gray-400">
                            <p>Service pricing not available. Please contact support.</p>
                          </div>
                        )}
                      </div>
                    )}

                    {paymentCategory === 'retake' && (
                      <div className="mt-6 p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                          Retake Payment - Quotation
                        </h3>
                        
                        {loadingServices ? (
                          <div className="text-center py-4">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
                            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Loading pricing...</p>
                          </div>
                        ) : retakeService ? (
                          <>
                            <div className="space-y-2 mb-4">
                              {retakeService.line_items?.map((item: any, idx: number) => (
                                <div key={idx} className="flex justify-between text-sm">
                                  <span className="text-gray-700 dark:text-gray-300">{item.description}</span>
                                  <span className="text-gray-900 dark:text-gray-100 font-medium">{formatCurrency(item.amount)}</span>
                                </div>
                              ))}
                            </div>

                            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                              <div className="flex justify-between text-sm mb-2">
                                <span className="text-gray-700 dark:text-gray-300">Subtotal</span>
                                <span className="text-gray-900 dark:text-gray-100">
                                  {formatCurrency((retakeService.total_full || 0) - (retakeService.tax_amount || 0))}
                                </span>
                              </div>
                              {retakeService.tax_amount && retakeService.tax_amount > 0 && (
                                <div className="flex justify-between text-sm mb-2">
                                  <span className="text-gray-700 dark:text-gray-300">Tax</span>
                                  <span className="text-gray-900 dark:text-gray-100">
                                    {formatCurrency(retakeService.tax_amount)}
                                  </span>
                                </div>
                              )}
                              <div className="flex justify-between items-center pt-2 border-t border-green-200 dark:border-green-800 mt-2">
                                <span className="text-lg font-bold text-gray-900 dark:text-gray-100">Total Amount</span>
                                <span className="text-xl font-bold text-green-600 dark:text-green-400">
                                  {formatCurrency(retakeService.total_full || 0)}
                                </span>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="text-center py-4 text-gray-600 dark:text-gray-400">
                            <p>Service pricing not available. Please contact support.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </Card>
            )}

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            {currentStep < totalSteps && !canProceedToNext() && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 text-yellow-800 dark:text-yellow-200">
                <div className="flex items-start gap-2">
                  <Info className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <p className="text-sm">
                    Please complete all required fields in this section before proceeding to the next step.
                  </p>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between gap-4 mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="flex gap-4">
                {currentStep > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePrevious}
                    className="flex items-center gap-2"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
              </Button>
                )}
                {currentStep === 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/applications')}
                    className="flex items-center gap-2 text-red-600 hover:text-red-700 border-red-300 hover:border-red-400 dark:text-red-400 dark:hover:text-red-300"
              >
                Cancel
              </Button>
                )}
              </div>
              <div className="flex gap-4">
                {currentStep < totalSteps && (
                  <Button
                    type="button"
                    onClick={handleNext}
                    disabled={!canProceedToNext() || saving}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white border-green-600 hover:border-green-700"
                  >
                    {saving ? 'Saving...' : 'Save & Next'}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
                {currentStep === totalSteps && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigate('/applications')}
                      className="text-red-600 hover:text-red-700 border-red-300 hover:border-red-400 dark:text-red-400 dark:hover:text-red-300"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={loading || !canProceedToNext()}
                      className="bg-green-600 hover:bg-green-700 text-white border-green-600 hover:border-green-700"
                    >
                      {loading ? 'Submitting...' : 'Submit Application'}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </form>
        </main>
      </div>

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
            <div className="flex justify-end gap-2 pt-4 px-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                variant="outline"
                onClick={async () => {
                  if (!viewingFile) return
                  try {
                    const token = localStorage.getItem('token')
                    const response = await fetch(viewingFile.url, {
                      headers: {
                        'Authorization': `Bearer ${token}`
                      }
                    })
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
        )}
      </Modal>
    </div>
  )
}

