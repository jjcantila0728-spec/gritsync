import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useToast } from '@/components/ui/Toast'
import { Loading, CardSkeleton } from '@/components/ui/Loading'
import { Modal } from '@/components/ui/Modal'
import { userDetailsAPI, notificationsAPI } from '@/lib/api'
import { getInitials, getAvatarColor, getAvatarColorDark, getAvatarTextColor, getAvatarTextColorDark } from '@/lib/avatar'
import { User, Mail, Calendar, Shield, Edit2, Save, X, FileText, MapPin, ArrowLeft, CheckCircle2, Building2, Award, Sparkles, School, Info, Camera, Upload, AlertCircle } from 'lucide-react'
import { getSignedFileUrl } from '@/lib/supabase-api'
import { supabase } from '@/lib/supabase'
import { cn, getFullNameWithMiddle } from '@/lib/utils'
import { Link, useNavigate } from 'react-router-dom'
import { reminderSettings } from '@/lib/settings'

// Helper function to format MM/DD/YYYY input
function formatMMDDYYYY(value: string): string {
  const digits = value.replace(/\D/g, '')
  const limited = digits.slice(0, 8)
  
  if (limited.length <= 2) {
    return limited
  } else if (limited.length <= 4) {
    return `${limited.slice(0, 2)}/${limited.slice(2)}`
  } else {
    return `${limited.slice(0, 2)}/${limited.slice(2, 4)}/${limited.slice(4)}`
  }
}

// Helper function to format MM/YYYY input
function formatMMYYYY(value: string): string {
  const digits = value.replace(/\D/g, '')
  const limited = digits.slice(0, 6)
  
  if (limited.length <= 2) {
    return limited
  } else {
    return `${limited.slice(0, 2)}/${limited.slice(2)}`
  }
}

// Convert from database format (YYYY-MM-DD or other) to MM/DD/YYYY
function convertFromDatabaseFormat(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  
  if (/^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}$/.test(dateStr)) {
    return dateStr
  }
  
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split('-')
    return `${month}/${day}/${year}`
  }
  
  if (/^(0[1-9]|1[0-2])\/\d{4}$/.test(dateStr)) {
    const [month, year] = dateStr.split('/')
    return `${month}/01/${year}`
  }
  
  const date = new Date(dateStr)
  if (!isNaN(date.getTime())) {
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const year = date.getFullYear()
    return `${month}/${day}/${year}`
  }
  
  return dateStr
}

// Convert MM/DD/YYYY to YYYY-MM-DD for database storage
function convertToDatabaseFormat(mmddyyyy: string): string {
  if (!mmddyyyy || !/^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}$/.test(mmddyyyy)) return ''
  
  const [month, day, year] = mmddyyyy.split('/')
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

// Convert YYYY-MM to MM/YYYY
function convertToMMYYYY(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  if (/^(0[1-9]|1[0-2])\/\d{4}$/.test(dateStr)) return dateStr
  if (/^\d{4}-\d{2}$/.test(dateStr)) {
    const [year, month] = dateStr.split('-')
    return `${month}/${year}`
  }
  return dateStr
}

// Convert MM/YYYY to YYYY-MM for database storage
function convertMMYYYYToDatabase(mmyyyy: string): string {
  if (!mmyyyy || !/^(0[1-9]|1[0-2])\/\d{4}$/.test(mmyyyy)) return ''
  
  const [month, year] = mmyyyy.split('/')
  return `${year}-${month.padStart(2, '0')}`
}

// Helper function to format month-year dates
function formatMonthYear(dateStr: string): string {
  if (!dateStr) return 'Not set'
  try {
    if (dateStr.includes('-')) {
      const [year, month] = dateStr.split('-')
      const date = new Date(parseInt(year), parseInt(month) - 1)
      return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    }
    if (dateStr.includes('/')) {
      const [month, year] = dateStr.split('/')
      const date = new Date(parseInt(year), parseInt(month) - 1)
      return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    }
    return dateStr
  } catch {
    return dateStr
  }
}

// Helper function to calculate completion percentage
function calculateCompletion(details: any): number {
  // Personal Information fields
  const personalInfoFields = [
    'firstName', 'lastName', 'gender', 'dateOfBirth', 'birthPlace'
  ]
  
  // Address fields
  const addressFields = [
    'email', 'mobileNumber', 'houseNumber', 'streetName', 'city', 'province', 'country', 'zipcode'
  ]
  
  // Elementary School fields
  const elementaryFields = [
    'elementarySchool', 'elementaryCity', 'elementaryProvince', 'elementaryCountry',
    'elementaryYearsAttended', 'elementaryStartDate', 'elementaryEndDate'
  ]
  
  // High School fields
  const highSchoolFields = [
    'highSchool', 'highSchoolCity', 'highSchoolProvince', 'highSchoolCountry',
    'highSchoolYearsAttended', 'highSchoolStartDate', 'highSchoolEndDate'
  ]
  
  // Nursing School fields
  const nursingSchoolFields = [
    'nursingSchool', 'nursingSchoolCity', 'nursingSchoolProvince', 'nursingSchoolCountry',
    'nursingSchoolYearsAttended', 'nursingSchoolStartDate', 'nursingSchoolEndDate',
    'nursingSchoolMajor', 'nursingSchoolDiplomaDate'
  ]
  
  const allFields = [
    ...personalInfoFields,
    ...addressFields,
    ...elementaryFields,
    ...highSchoolFields,
    ...nursingSchoolFields
  ]
  
  let completed = 0
  allFields.forEach(field => {
    const value = details[field]
    if (value && value.trim() !== '') {
      completed++
    }
  })
  
  return Math.round((completed / allFields.length) * 100)
}

export function MyDetails() {
  const { user, refreshUser } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [completionPercentage, setCompletionPercentage] = useState(0)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({})

  // Validation functions
  const validateEmail = (email: string): string => {
    if (!email) return ''
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return 'Please enter a valid email address'
    }
    return ''
  }

  const validatePhone = (phone: string): string => {
    if (!phone) return ''
    const phoneRegex = /^[\d\s\-\+\(\)]+$/
    if (!phoneRegex.test(phone) || phone.replace(/\D/g, '').length < 7) {
      return 'Please enter a valid phone number (at least 7 digits)'
    }
    return ''
  }

  const validateDate = (date: string, fieldName: string): string => {
    if (!date) return ''
    if (!/^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}$/.test(date)) {
      return `Please enter a valid ${fieldName} in MM/DD/YYYY format`
    }
    const [month, day, year] = date.split('/').map(Number)
    const dateObj = new Date(year, month - 1, day)
    if (dateObj.getFullYear() !== year || dateObj.getMonth() !== month - 1 || dateObj.getDate() !== day) {
      return `Please enter a valid ${fieldName}`
    }
    // Check if date is not in the future
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
      return `Please enter a valid month (01-12)`
    }
    if (year < 1900 || year > new Date().getFullYear() + 1) {
      return `Please enter a valid year`
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

  // Validate all fields
  const validateAllFields = (): boolean => {
    const errors: Record<string, string> = {}

    // Personal Information
    if (!firstName.trim()) errors.firstName = 'First name is required'
    if (!lastName.trim()) errors.lastName = 'Last name is required'
    if (email && email !== user?.email) {
      const emailError = validateEmail(email)
      if (emailError) errors.email = emailError
    }
    if (mobileNumber) {
      const phoneError = validatePhone(mobileNumber)
      if (phoneError) errors.mobileNumber = phoneError
    }
    if (dateOfBirth) {
      const dateError = validateDate(dateOfBirth, 'Date of Birth')
      if (dateError) errors.dateOfBirth = dateError
    }
    if (maritalStatus === 'single' && !singleFullName.trim()) {
      errors.singleFullName = 'Full name when single is required'
    }

    // Address
    if (zipcode) {
      const zipError = validateZipcode(zipcode)
      if (zipError) errors.zipcode = zipError
    }

    // Education - Elementary
    if (elementarySchool) {
      if (elementaryStartDate) {
        const dateError = validateMMYYYY(elementaryStartDate, 'Start Date')
        if (dateError) errors.elementaryStartDate = dateError
      }
      if (elementaryEndDate) {
        const dateError = validateMMYYYY(elementaryEndDate, 'End Date')
        if (dateError) errors.elementaryEndDate = dateError
      }
      if (elementaryYearsAttended) {
        const yearsError = validateYearsAttended(elementaryYearsAttended)
        if (yearsError) errors.elementaryYearsAttended = yearsError
      }
    }

    // Education - High School
    if (highSchool) {
      if (highSchoolStartDate) {
        const dateError = validateMMYYYY(highSchoolStartDate, 'Start Date')
        if (dateError) errors.highSchoolStartDate = dateError
      }
      if (highSchoolEndDate) {
        const dateError = validateMMYYYY(highSchoolEndDate, 'End Date')
        if (dateError) errors.highSchoolEndDate = dateError
      }
      if (highSchoolYearsAttended) {
        const yearsError = validateYearsAttended(highSchoolYearsAttended)
        if (yearsError) errors.highSchoolYearsAttended = yearsError
      }
    }

    // Education - Nursing School
    if (nursingSchool) {
      if (nursingSchoolStartDate) {
        const dateError = validateMMYYYY(nursingSchoolStartDate, 'Start Date')
        if (dateError) errors.nursingSchoolStartDate = dateError
      }
      if (nursingSchoolEndDate) {
        const dateError = validateMMYYYY(nursingSchoolEndDate, 'End Date')
        if (dateError) errors.nursingSchoolEndDate = dateError
      }
      if (nursingSchoolYearsAttended) {
        const yearsError = validateYearsAttended(nursingSchoolYearsAttended)
        if (yearsError) errors.nursingSchoolYearsAttended = yearsError
      }
      if (nursingSchoolDiplomaDate) {
        const dateError = validateDate(nursingSchoolDiplomaDate, 'Diploma Date')
        if (dateError) errors.nursingSchoolDiplomaDate = dateError
      }
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Handle field blur for validation
  const handleFieldBlur = (fieldName: string) => {
    setTouchedFields(prev => ({ ...prev, [fieldName]: true }))
    const errors: Record<string, string> = { ...validationErrors }

    switch (fieldName) {
      case 'email':
        if (email && email !== user?.email) {
          errors.email = validateEmail(email)
        } else {
          delete errors.email
        }
        break
      case 'mobileNumber':
        if (mobileNumber) {
          errors.mobileNumber = validatePhone(mobileNumber)
        } else {
          delete errors.mobileNumber
        }
        break
      case 'dateOfBirth':
        if (dateOfBirth) {
          errors.dateOfBirth = validateDate(dateOfBirth, 'Date of Birth')
        } else {
          delete errors.dateOfBirth
        }
        break
      case 'zipcode':
        if (zipcode) {
          errors.zipcode = validateZipcode(zipcode)
        } else {
          delete errors.zipcode
        }
        break
      case 'elementaryYearsAttended':
        if (elementaryYearsAttended) {
          errors.elementaryYearsAttended = validateYearsAttended(elementaryYearsAttended)
        } else {
          delete errors.elementaryYearsAttended
        }
        break
      case 'elementaryStartDate':
        if (elementaryStartDate) {
          errors.elementaryStartDate = validateMMYYYY(elementaryStartDate, 'Start Date')
        } else {
          delete errors.elementaryStartDate
        }
        break
      case 'elementaryEndDate':
        if (elementaryEndDate) {
          errors.elementaryEndDate = validateMMYYYY(elementaryEndDate, 'End Date')
        } else {
          delete errors.elementaryEndDate
        }
        break
      case 'highSchoolYearsAttended':
        if (highSchoolYearsAttended) {
          errors.highSchoolYearsAttended = validateYearsAttended(highSchoolYearsAttended)
        } else {
          delete errors.highSchoolYearsAttended
        }
        break
      case 'highSchoolStartDate':
        if (highSchoolStartDate) {
          errors.highSchoolStartDate = validateMMYYYY(highSchoolStartDate, 'Start Date')
        } else {
          delete errors.highSchoolStartDate
        }
        break
      case 'highSchoolEndDate':
        if (highSchoolEndDate) {
          errors.highSchoolEndDate = validateMMYYYY(highSchoolEndDate, 'End Date')
        } else {
          delete errors.highSchoolEndDate
        }
        break
      case 'nursingSchoolYearsAttended':
        if (nursingSchoolYearsAttended) {
          errors.nursingSchoolYearsAttended = validateYearsAttended(nursingSchoolYearsAttended)
        } else {
          delete errors.nursingSchoolYearsAttended
        }
        break
      case 'nursingSchoolStartDate':
        if (nursingSchoolStartDate) {
          errors.nursingSchoolStartDate = validateMMYYYY(nursingSchoolStartDate, 'Start Date')
        } else {
          delete errors.nursingSchoolStartDate
        }
        break
      case 'nursingSchoolEndDate':
        if (nursingSchoolEndDate) {
          errors.nursingSchoolEndDate = validateMMYYYY(nursingSchoolEndDate, 'End Date')
        } else {
          delete errors.nursingSchoolEndDate
        }
        break
      case 'nursingSchoolDiplomaDate':
        if (nursingSchoolDiplomaDate) {
          errors.nursingSchoolDiplomaDate = validateDate(nursingSchoolDiplomaDate, 'Diploma Date')
        } else {
          delete errors.nursingSchoolDiplomaDate
        }
        break
    }

    // Remove empty errors
    Object.keys(errors).forEach(key => {
      if (!errors[key]) delete errors[key]
    })

    setValidationErrors(errors)
  }

  // Personal Information
  const [firstName, setFirstName] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [lastName, setLastName] = useState('')
  const [gender, setGender] = useState('')
  const [maritalStatus, setMaritalStatus] = useState('')
  const [singleFullName, setSingleFullName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [birthPlace, setBirthPlace] = useState('')

  // Address
  const [email, setEmail] = useState('')
  const [mobileNumber, setMobileNumber] = useState('')
  const [houseNumber, setHouseNumber] = useState('')
  const [streetName, setStreetName] = useState('')
  const [city, setCity] = useState('')
  const [province, setProvince] = useState('')
  const [country, setCountry] = useState('')
  const [zipcode, setZipcode] = useState('')

  // Education - Elementary School
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

  // Application Details
  const [signature, setSignature] = useState('')
  const [paymentType, setPaymentType] = useState('')

  // Avatar
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<{ file: File, previewUrl: string } | null>(null)

  // Check and send profile completion reminders
  const checkAndSendReminders = async () => {
    if (!user) return
    
    try {
      // Check if reminders are enabled
      const remindersEnabled = await reminderSettings.isProfileReminderEnabled()
      if (!remindersEnabled) return
      
      const details = await userDetailsAPI.get()
      if (!details) return
      
      const completion = calculateCompletion({
        firstName: details.first_name,
        lastName: details.last_name,
        gender: details.gender,
        dateOfBirth: details.date_of_birth,
        birthPlace: details.birth_place || details.place_of_birth,
        email: details.email || user?.email,
        mobileNumber: details.mobile_number,
        houseNumber: details.house_number,
        streetName: details.street_name,
        city: details.city,
        province: details.province,
        country: details.country,
        zipcode: details.zipcode,
        elementarySchool: details.elementary_school,
        elementaryCity: details.elementary_city,
        elementaryProvince: details.elementary_province,
        elementaryCountry: details.elementary_country,
        elementaryYearsAttended: details.elementary_years_attended,
        elementaryStartDate: details.elementary_start_date,
        elementaryEndDate: details.elementary_end_date,
        highSchool: details.high_school,
        highSchoolCity: details.high_school_city,
        highSchoolProvince: details.high_school_province,
        highSchoolCountry: details.high_school_country,
        highSchoolYearsAttended: details.high_school_years_attended,
        highSchoolStartDate: details.high_school_start_date,
        highSchoolEndDate: details.high_school_end_date,
        nursingSchool: details.nursing_school,
        nursingSchoolCity: details.nursing_school_city,
        nursingSchoolProvince: details.nursing_school_province,
        nursingSchoolCountry: details.nursing_school_country,
        nursingSchoolYearsAttended: details.nursing_school_years_attended,
        nursingSchoolStartDate: details.nursing_school_start_date,
        nursingSchoolEndDate: details.nursing_school_end_date,
        nursingSchoolMajor: details.nursing_school_major,
        nursingSchoolDiplomaDate: details.nursing_school_diploma_date
      })
      
      // Check if we should send a reminder (only if < 100% and haven't sent one recently)
      if (completion < 100) {
        const lastReminderKey = `lastProfileReminder_${user.id}`
        const lastReminderTime = localStorage.getItem(lastReminderKey)
        const now = Date.now()
        
        // Get reminder interval from settings (in hours)
        const reminderIntervalHours = await reminderSettings.getProfileReminderInterval()
        const reminderIntervalMs = reminderIntervalHours * 60 * 60 * 1000
        
        // Send reminder if:
        // 1. Never sent before, OR
        // 2. Last reminder was more than the configured interval ago
        if (!lastReminderTime || (now - parseInt(lastReminderTime)) > reminderIntervalMs) {
          // Get reminder message from settings
          const reminderMessage = await reminderSettings.getProfileReminderMessage(completion)
          
          try {
            await notificationsAPI.create(
              'Complete Your Profile',
              reminderMessage,
              'general'
            )
            localStorage.setItem(lastReminderKey, now.toString())
          } catch (error) {
            console.error('Failed to send profile completion reminder:', error)
          }
        }
      }
    } catch (error) {
      console.error('Error checking profile completion:', error)
    }
  }

  useEffect(() => {
    if (user) {
      fetchDetails()
      checkAndSendReminders()
    }
  }, [user])

  async function fetchDetails() {
    try {
      // Fetch avatar from users table (separate from 2x2 picture)
      try {
        const { data: userData } = await supabase
          .from('users')
          .select('avatar_path')
          .eq('id', user?.id)
          .single()
        
        if (userData?.avatar_path) {
          const url = await getSignedFileUrl(userData.avatar_path)
          setAvatarUrl(url)
        } else {
          setAvatarUrl(null)
        }
      } catch {
        // Could not load avatar
        setAvatarUrl(null)
      }

      const details = await userDetailsAPI.get()
      if (details) {
        // Populate all fields from saved details
        setFirstName(details.first_name || '')
        setMiddleName(details.middle_name || '')
        setLastName(details.last_name || '')
        setGender(details.gender || '')
        setMaritalStatus(details.marital_status || '')
        setSingleFullName(details.single_full_name || details.single_name || '')
        setDateOfBirth(convertFromDatabaseFormat(details.date_of_birth))
        setBirthPlace(details.birth_place || details.place_of_birth || '')
        setEmail(details.email || user?.email || '')
        setMobileNumber(details.mobile_number || '')
        setHouseNumber(details.house_number || '')
        setStreetName(details.street_name || '')
        setCity(details.city || '')
        setProvince(details.province || '')
        setCountry(details.country || '')
        setZipcode(details.zipcode || '')
        // Elementary School
        setElementarySchool(details.elementary_school || '')
        setElementaryCity(details.elementary_city || '')
        setElementaryProvince(details.elementary_province || '')
        setElementaryCountry(details.elementary_country || '')
        setElementaryYearsAttended(details.elementary_years_attended || '')
        setElementaryStartDate(convertToMMYYYY(details.elementary_start_date))
        setElementaryEndDate(convertToMMYYYY(details.elementary_end_date))
        
        // High School
        setHighSchool(details.high_school || '')
        setHighSchoolCity(details.high_school_city || '')
        setHighSchoolProvince(details.high_school_province || '')
        setHighSchoolCountry(details.high_school_country || '')
        setHighSchoolYearsAttended(details.high_school_years_attended || '')
        setHighSchoolStartDate(convertToMMYYYY(details.high_school_start_date))
        setHighSchoolEndDate(convertToMMYYYY(details.high_school_end_date))
        
        // Nursing School
        setNursingSchool(details.nursing_school || '')
        setNursingSchoolCity(details.nursing_school_city || '')
        setNursingSchoolProvince(details.nursing_school_province || '')
        setNursingSchoolCountry(details.nursing_school_country || '')
        setNursingSchoolYearsAttended(details.nursing_school_years_attended || '')
        setNursingSchoolStartDate(convertToMMYYYY(details.nursing_school_start_date))
        setNursingSchoolEndDate(convertToMMYYYY(details.nursing_school_end_date))
        setNursingSchoolMajor(details.nursing_school_major || '')
        setNursingSchoolDiplomaDate(convertFromDatabaseFormat(details.nursing_school_diploma_date))
        setSignature(details.signature || '')
        setPaymentType(details.payment_type || '')
        
        // Calculate completion percentage
        const completion = calculateCompletion({
          firstName: details.first_name,
          lastName: details.last_name,
          gender: details.gender,
          dateOfBirth: details.date_of_birth,
          birthPlace: details.birth_place || details.place_of_birth,
          email: details.email || user?.email,
          mobileNumber: details.mobile_number,
          houseNumber: details.house_number,
          streetName: details.street_name,
          city: details.city,
          province: details.province,
          country: details.country,
          zipcode: details.zipcode,
          elementarySchool: details.elementary_school,
          elementaryCity: details.elementary_city,
          elementaryProvince: details.elementary_province,
          elementaryCountry: details.elementary_country,
          elementaryYearsAttended: details.elementary_years_attended,
          elementaryStartDate: details.elementary_start_date,
          elementaryEndDate: details.elementary_end_date,
          highSchool: details.high_school,
          highSchoolCity: details.high_school_city,
          highSchoolProvince: details.high_school_province,
          highSchoolCountry: details.high_school_country,
          highSchoolYearsAttended: details.high_school_years_attended,
          highSchoolStartDate: details.high_school_start_date,
          highSchoolEndDate: details.high_school_end_date,
          nursingSchool: details.nursing_school,
          nursingSchoolCity: details.nursing_school_city,
          nursingSchoolProvince: details.nursing_school_province,
          nursingSchoolCountry: details.nursing_school_country,
          nursingSchoolYearsAttended: details.nursing_school_years_attended,
          nursingSchoolStartDate: details.nursing_school_start_date,
          nursingSchoolEndDate: details.nursing_school_end_date,
          nursingSchoolMajor: details.nursing_school_major,
          nursingSchoolDiplomaDate: details.nursing_school_diploma_date
        })
        setCompletionPercentage(completion)
      } else {
        // If no saved details, use user's basic info from auth metadata
        // This ensures first_name, last_name, and email from registration are auto-populated
        setFirstName(user?.first_name || '')
        setLastName(user?.last_name || '')
        setEmail(user?.email || '')
        setCompletionPercentage(calculateCompletion({
          firstName: user?.first_name || '',
          lastName: user?.last_name || '',
          email: user?.email || ''
        }))
      }
    } catch (error) {
      console.error('Error fetching details:', error)
      // If no saved details, use user's basic info from auth metadata
      // This ensures first_name, last_name, and email from registration are auto-populated
      setFirstName(user?.first_name || '')
      setLastName(user?.last_name || '')
      setEmail(user?.email || '')
      setCompletionPercentage(calculateCompletion({
        firstName: user?.first_name || '',
        lastName: user?.last_name || '',
        email: user?.email || ''
      }))
    } finally {
      setLoading(false)
    }
  }

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showToast('Please upload an image file', 'error')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image size must be less than 5MB', 'error')
      return
    }

    // Create preview URL
    const previewUrl = URL.createObjectURL(file)
    setAvatarPreview({ file, previewUrl })
    // Reset input
    e.target.value = ''
  }

  const handleAvatarSubmit = async () => {
    if (!avatarPreview || !user) return

    setUploadingAvatar(true)
    try {
      // Upload to Supabase Storage in avatar folder
      const fileExt = avatarPreview.file.name.split('.').pop() || 'jpg'
      const fileName = `avatar_${Date.now()}.${fileExt}`
      const filePath = `${user.id}/${fileName}`
      
      // Delete old avatar if exists
      const { data: currentUser } = await supabase
        .from('users')
        .select('avatar_path')
        .eq('id', user.id)
        .single()
      
      if (currentUser?.avatar_path) {
        try {
          await supabase.storage
            .from('documents')
            .remove([currentUser.avatar_path])
        } catch {
          // Could not delete old avatar
        }
      }
      
      // Upload new avatar
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, avatarPreview.file, {
          cacheControl: '3600',
          upsert: false,
        })
      
      if (uploadError) throw uploadError
      
      // Update users table with avatar_path
      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_path: filePath })
        .eq('id', user.id)
      
      if (updateError) throw updateError
      
      showToast('Profile avatar updated successfully!', 'success')
      
      // Clean up preview URL
      if (avatarPreview.previewUrl) {
        URL.revokeObjectURL(avatarPreview.previewUrl)
      }
      setAvatarPreview(null)
      
      // Refresh avatar
      await fetchDetails()
      // Refresh user context
      refreshUser()
    } catch (error: any) {
      showToast(error.message || 'Failed to upload profile avatar', 'error')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleAvatarCancel = () => {
    if (avatarPreview?.previewUrl) {
      URL.revokeObjectURL(avatarPreview.previewUrl)
    }
    setAvatarPreview(null)
  }

  const handleSave = async () => {
    // Validate all fields before saving
    if (!validateAllFields()) {
      showToast('Please fix the validation errors before saving.', 'error')
      setSaving(false)
      return
    }

    setSaving(true)
    try {
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
        gender: gender || null,
        marital_status: maritalStatus || null,
        single_full_name: maritalStatus === 'single' ? safeTrim(singleFullName) : null,
        date_of_birth: convertToDatabaseFormat(dateOfBirth) || null,
        birth_place: safeTrim(birthPlace),
        email: safeTrim(email) || user?.email || null,
        mobile_number: safeTrim(mobileNumber),
        house_number: safeTrim(houseNumber),
        street_name: safeTrim(streetName),
        city: safeTrim(city),
        province: safeTrim(province),
        country: safeTrim(country),
        zipcode: safeTrim(zipcode),
        // Elementary School
        elementary_school: safeTrim(elementarySchool),
        elementary_city: safeTrim(elementaryCity),
        elementary_province: safeTrim(elementaryProvince),
        elementary_country: safeTrim(elementaryCountry),
        elementary_years_attended: safeTrim(elementaryYearsAttended),
        elementary_start_date: convertMMYYYYToDatabase(elementaryStartDate) || null,
        elementary_end_date: convertMMYYYYToDatabase(elementaryEndDate) || null,
        // High School
        high_school: safeTrim(highSchool),
        high_school_city: safeTrim(highSchoolCity),
        high_school_province: safeTrim(highSchoolProvince),
        high_school_country: safeTrim(highSchoolCountry),
        high_school_years_attended: safeTrim(highSchoolYearsAttended),
        high_school_start_date: convertMMYYYYToDatabase(highSchoolStartDate) || null,
        high_school_end_date: convertMMYYYYToDatabase(highSchoolEndDate) || null,
        // Nursing School
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
      
      // Update with new values, but preserve existing non-null values when new value is null/empty
      const existing = existingDetails && typeof existingDetails === 'object' && !Array.isArray(existingDetails) 
        ? existingDetails as Record<string, any> 
        : null
      
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
      
      showToast('Details saved successfully! These will auto-fill your next application.', 'success')
      setEditing(false)
      
      // Refresh the data to show updated values
      await fetchDetails()
      
      // Refresh user context to update navbar name in real-time
      await refreshUser()
      
      // Recalculate completion percentage with all fields
      const completion = calculateCompletion({
        firstName,
        lastName,
        gender,
        dateOfBirth,
        birthPlace,
        email: email || user?.email,
        mobileNumber,
        houseNumber,
        streetName,
        city,
        province,
        country,
        zipcode,
        elementarySchool,
        elementaryCity,
        elementaryProvince,
        elementaryCountry,
        elementaryYearsAttended,
        elementaryStartDate,
        elementaryEndDate,
        highSchool,
        highSchoolCity,
        highSchoolProvince,
        highSchoolCountry,
        highSchoolYearsAttended,
        highSchoolStartDate,
        highSchoolEndDate,
        nursingSchool,
        nursingSchoolCity,
        nursingSchoolProvince,
        nursingSchoolCountry,
        nursingSchoolYearsAttended,
        nursingSchoolStartDate,
        nursingSchoolEndDate,
        nursingSchoolMajor,
        nursingSchoolDiplomaDate
      })
      setCompletionPercentage(completion)
      
      // Check and send reminder after saving if completion increased
      if (completion < 100) {
        setTimeout(() => {
          checkAndSendReminders()
        }, 1000)
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to save details. Please try again.'
      showToast(errorMessage, 'error')
      console.error('Error saving details:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    fetchDetails()
    setEditing(false)
    setValidationErrors({})
    setTouchedFields({})
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-4 md:p-8">
            <div className="mb-8">
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-64 animate-pulse mb-2" />
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-96 animate-pulse" />
            </div>
            <div className="space-y-6">
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </div>
          </main>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-4 md:p-8">
            <Loading text="Loading..." />
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-4 md:p-8">
          <div className="mb-8">
            <div className="mb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
                <div className="flex items-center gap-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>
                  <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100">
                    My Details
                  </h1>
                </div>
                {!editing && (
                  <div className="flex gap-3 flex-shrink-0">
                    <Link to="/application/new">
                      <Button variant="outline" size="sm" className="hover:bg-primary-50 dark:hover:bg-primary-900/20">
                        <FileText className="h-4 w-4 mr-2" />
                        New Application
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing(true)}
                      className="hover:bg-primary-50 dark:hover:bg-primary-900/20"
                    >
                      <Edit2 className="h-4 w-4 mr-2" />
                      Edit Details
                    </Button>
                  </div>
                )}
              </div>
              <p className="text-gray-600 dark:text-gray-400">
                {editing 
                  ? 'Update your information. Saved details will auto-fill your application forms.'
                  : 'View and manage your personal information. These details will auto-fill your application forms.'}
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Completion Progress Card */}
            {!editing && (
              <Card className={cn(
                "border-0 shadow-md transition-all duration-300",
                completionPercentage === 100 
                  ? "bg-gradient-to-br from-green-50 via-green-50/50 to-white dark:from-green-900/20 dark:via-green-800/10 dark:to-gray-800"
                  : completionPercentage >= 80
                  ? "bg-gradient-to-br from-blue-50 via-blue-50/50 to-white dark:from-blue-900/20 dark:via-blue-800/10 dark:to-gray-800"
                  : completionPercentage >= 60
                  ? "bg-gradient-to-br from-primary-50 via-primary-50/50 to-white dark:from-primary-900/20 dark:via-primary-800/10 dark:to-gray-800"
                  : completionPercentage >= 40
                  ? "bg-gradient-to-br from-yellow-50 via-yellow-50/50 to-white dark:from-yellow-900/20 dark:via-yellow-800/10 dark:to-gray-800"
                  : completionPercentage >= 20
                  ? "bg-gradient-to-br from-orange-50 via-orange-50/50 to-white dark:from-orange-900/20 dark:via-orange-800/10 dark:to-gray-800"
                  : "bg-gradient-to-br from-red-50 via-red-50/50 to-white dark:from-red-900/20 dark:via-red-800/10 dark:to-gray-800"
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "p-3 rounded-xl",
                      completionPercentage === 100 
                        ? "bg-green-500/10 dark:bg-green-400/20"
                        : completionPercentage >= 80
                        ? "bg-blue-500/10 dark:bg-blue-400/20"
                        : completionPercentage >= 60
                        ? "bg-primary-500/10 dark:bg-primary-400/20"
                        : completionPercentage >= 40
                        ? "bg-yellow-500/10 dark:bg-yellow-400/20"
                        : completionPercentage >= 20
                        ? "bg-orange-500/10 dark:bg-orange-400/20"
                        : "bg-red-500/10 dark:bg-red-400/20"
                    )}>
                      <Sparkles className={cn(
                        "h-6 w-6",
                        completionPercentage === 100 
                          ? "text-green-600 dark:text-green-400"
                          : completionPercentage >= 80
                          ? "text-blue-600 dark:text-blue-400"
                          : completionPercentage >= 60
                          ? "text-primary-600 dark:text-primary-400"
                          : completionPercentage >= 40
                          ? "text-yellow-600 dark:text-yellow-400"
                          : completionPercentage >= 20
                          ? "text-orange-600 dark:text-orange-400"
                          : "text-red-600 dark:text-red-400"
                      )} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                        Profile Completion
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {completionPercentage === 100 
                          ? 'All details completed! 🎉' 
                          : `${completionPercentage}% complete - Fill in more details to speed up your applications`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={cn(
                      "text-3xl font-bold mb-1",
                      completionPercentage === 100 
                        ? "text-green-600 dark:text-green-400"
                        : completionPercentage >= 80
                        ? "text-blue-600 dark:text-blue-400"
                        : completionPercentage >= 60
                        ? "text-primary-600 dark:text-primary-400"
                        : completionPercentage >= 40
                        ? "text-yellow-600 dark:text-yellow-400"
                        : completionPercentage >= 20
                        ? "text-orange-600 dark:text-orange-400"
                        : "text-red-600 dark:text-red-400"
                    )}>
                      {completionPercentage}%
                    </div>
                    <div className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full transition-all duration-500 rounded-full",
                          completionPercentage === 100 
                            ? "bg-gradient-to-r from-green-500 to-green-600" 
                            : completionPercentage >= 80
                            ? "bg-gradient-to-r from-blue-500 to-blue-600"
                            : completionPercentage >= 60
                            ? "bg-gradient-to-r from-primary-500 to-primary-600"
                            : completionPercentage >= 40
                            ? "bg-gradient-to-r from-yellow-500 to-yellow-600"
                            : completionPercentage >= 20
                            ? "bg-gradient-to-r from-orange-500 to-orange-600"
                            : "bg-gradient-to-r from-red-500 to-red-600"
                        )}
                        style={{ width: `${completionPercentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Profile Header */}
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow duration-300">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                <div className="relative group">
                {(() => {
                  // Generate avatar based on first name + last name only (no middle name)
                  // This is the source of truth for avatar generation - uniform across all components
                  const fullNameForAvatar = [firstName, lastName].filter(Boolean).join(' ') || user?.email || ''
                  
                  return (
                    <div className={cn(
                      "w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold flex-shrink-0 shadow-lg overflow-hidden",
                      !avatarUrl && getAvatarColor(fullNameForAvatar),
                      !avatarUrl && getAvatarColorDark(fullNameForAvatar),
                      !avatarUrl && getAvatarTextColor(fullNameForAvatar),
                      !avatarUrl && getAvatarTextColorDark(fullNameForAvatar)
                    )}>
                      {avatarUrl ? (
                        <img 
                          src={avatarUrl} 
                          alt="Profile" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        getInitials(fullNameForAvatar)
                      )}
                    </div>
                  )
                })()}
                  <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 rounded-full cursor-pointer transition-opacity">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarUpload}
                      disabled={uploadingAvatar}
                    />
                    {uploadingAvatar ? (
                      <Loading className="text-white" />
                    ) : (
                      <Camera className="h-6 w-6 text-white" />
                    )}
                  </label>
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                    {getFullNameWithMiddle(firstName, middleName, lastName, '') || user.full_name || 'User'}
                  </h2>
                  <div className="flex items-center gap-2 justify-center sm:justify-start mb-2">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <p className="text-gray-600 dark:text-gray-400">
                      {user.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 justify-center sm:justify-start flex-wrap">
                    {user.role === 'admin' && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400">
                        <Shield className="h-3 w-3" />
                        Administrator
                      </span>
                    )}
                    {user.role === 'client' && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                        <User className="h-3 w-3" />
                        Client
                      </span>
                    )}
                    {user.grit_id && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                        <Award className="h-3 w-3" />
                        ID: {user.grit_id}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            {/* Personal Information */}
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow duration-300">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/40 dark:to-primary-800/30">
                  <User className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  Personal Information
                </h2>
              </div>

              {editing ? (
                <div className="space-y-4">
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
                  <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-blue-900 dark:text-blue-100">
                        <strong>Please write your name as per passport.</strong> Ensure all names match exactly as they appear on your passport document.
                      </p>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Input
                        label="First Name"
                        value={firstName}
                        onChange={(e) => {
                          setFirstName(e.target.value)
                          if (touchedFields.firstName) {
                            handleFieldBlur('firstName')
                          }
                        }}
                        onBlur={() => handleFieldBlur('firstName')}
                        placeholder="John"
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
                        placeholder="Michael"
                        className={cn(
                          middleName && 'border-green-500 focus:ring-green-500'
                        )}
                      />
                    </div>
                    <div>
                      <Input
                        label="Last Name"
                        value={lastName}
                        onChange={(e) => {
                          setLastName(e.target.value)
                          if (touchedFields.lastName) {
                            handleFieldBlur('lastName')
                          }
                        }}
                        onBlur={() => handleFieldBlur('lastName')}
                        placeholder="Doe"
                        error={touchedFields.lastName ? validationErrors.lastName : undefined}
                        className={cn(
                          getFieldStatus('lastName', lastName) === 'success' && 'border-green-500 focus:ring-green-500',
                          getFieldStatus('lastName', lastName) === 'error' && 'border-red-500 focus:ring-red-500'
                        )}
                      />
                    </div>
                    <div>
                      <Input
                        label="Mobile Number"
                        type="tel"
                        value={mobileNumber}
                        onChange={(e) => setMobileNumber(e.target.value)}
                        onBlur={() => handleFieldBlur('mobileNumber')}
                        placeholder="+1 (234) 567-8900"
                        error={touchedFields.mobileNumber ? validationErrors.mobileNumber : undefined}
                        className={cn(
                          getFieldStatus('mobileNumber', mobileNumber) === 'success' && 'border-green-500 focus:ring-green-500',
                          getFieldStatus('mobileNumber', mobileNumber) === 'error' && 'border-red-500 focus:ring-red-500'
                        )}
                      />
                    </div>
                    <div>
                      <Input
                        label="Email Address"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onBlur={() => handleFieldBlur('email')}
                        placeholder="john.doe@example.com"
                        error={touchedFields.email ? validationErrors.email : undefined}
                        className={cn(
                          getFieldStatus('email', email) === 'success' && 'border-green-500 focus:ring-green-500',
                          getFieldStatus('email', email) === 'error' && 'border-red-500 focus:ring-red-500'
                        )}
                      />
                    </div>
                    <Select
                      label="Gender"
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      options={[
                        { value: '', label: 'Select Gender' },
                        { value: 'male', label: 'Male' },
                        { value: 'female', label: 'Female' },
                        { value: 'other', label: 'Other' },
                      ]}
                    />
                    <Select
                      label="Marital Status"
                      value={maritalStatus}
                      onChange={(e) => setMaritalStatus(e.target.value)}
                      options={[
                        { value: '', label: 'Select Status' },
                        { value: 'single', label: 'Single' },
                        { value: 'married', label: 'Married' },
                        { value: 'divorced', label: 'Divorced' },
                        { value: 'widowed', label: 'Widowed' },
                      ]}
                    />
                    {maritalStatus === 'single' && (
                      <div>
                        <Input
                          label="Write Your Full Name When You Are Single"
                          value={singleFullName}
                          onChange={(e) => {
                            setSingleFullName(e.target.value)
                            if (touchedFields.singleFullName) {
                              handleFieldBlur('singleFullName')
                            }
                          }}
                          onBlur={() => handleFieldBlur('singleFullName')}
                          placeholder="Your full name when single"
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
                        label="Date of Birth (MM/DD/YYYY)"
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
                        error={touchedFields.dateOfBirth ? validationErrors.dateOfBirth : undefined}
                        className={cn(
                          getFieldStatus('dateOfBirth', dateOfBirth) === 'success' && 'border-green-500 focus:ring-green-500',
                          getFieldStatus('dateOfBirth', dateOfBirth) === 'error' && 'border-red-500 focus:ring-red-500'
                        )}
                      />
                    </div>
                    <div>
                      <Input
                        label="Birth Place"
                        value={birthPlace}
                        onChange={(e) => setBirthPlace(e.target.value)}
                        placeholder="City, Country"
                        className={cn(
                          birthPlace && 'border-green-500 focus:ring-green-500'
                        )}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="group">
                    <div className="flex items-center gap-2 mb-2">
                      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">First Name</label>
                      {firstName && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    </div>
                    <p className={cn(
                      "text-gray-900 dark:text-gray-100 font-medium",
                      !firstName && "text-gray-400 dark:text-gray-500 italic"
                    )}>
                      {firstName || 'Not set'}
                    </p>
                  </div>
                  <div className="group">
                    <div className="flex items-center gap-2 mb-2">
                      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Middle Name</label>
                      {middleName && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    </div>
                    <p className={cn(
                      "text-gray-900 dark:text-gray-100 font-medium",
                      !middleName && "text-gray-400 dark:text-gray-500 italic"
                    )}>
                      {middleName || 'Not set'}
                    </p>
                  </div>
                  <div className="group">
                    <div className="flex items-center gap-2 mb-2">
                      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Last Name</label>
                      {lastName && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    </div>
                    <p className={cn(
                      "text-gray-900 dark:text-gray-100 font-medium",
                      !lastName && "text-gray-400 dark:text-gray-500 italic"
                    )}>
                      {lastName || 'Not set'}
                    </p>
                  </div>
                  <div className="group">
                    <div className="flex items-center gap-2 mb-2">
                      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Gender</label>
                      {gender && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    </div>
                    <p className={cn(
                      "text-gray-900 dark:text-gray-100 font-medium capitalize",
                      !gender && "text-gray-400 dark:text-gray-500 italic"
                    )}>
                      {gender || 'Not set'}
                    </p>
                  </div>
                  <div className="group">
                    <div className="flex items-center gap-2 mb-2">
                      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Marital Status</label>
                      {maritalStatus && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    </div>
                    <p className={cn(
                      "text-gray-900 dark:text-gray-100 font-medium capitalize",
                      !maritalStatus && "text-gray-400 dark:text-gray-500 italic"
                    )}>
                      {maritalStatus || 'Not set'}
                    </p>
                  </div>
                  <div className="group">
                    <div className="flex items-center gap-2 mb-2">
                      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Mobile Number</label>
                      {mobileNumber && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    </div>
                    <p className={cn(
                      "text-gray-900 dark:text-gray-100 font-medium",
                      !mobileNumber && "text-gray-400 dark:text-gray-500 italic"
                    )}>
                      {mobileNumber || 'Not set'}
                    </p>
                  </div>
                  {maritalStatus === 'single' && singleFullName && (
                    <div className="group">
                      <div className="flex items-center gap-2 mb-2">
                        <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Full Name When Single</label>
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      </div>
                      <p className="text-gray-900 dark:text-gray-100 font-medium">{singleFullName}</p>
                    </div>
                  )}
                  <div className="group">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Date of Birth</label>
                      {dateOfBirth && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    </div>
                    <p className={cn(
                      "text-gray-900 dark:text-gray-100 font-medium",
                      !dateOfBirth && "text-gray-400 dark:text-gray-500 italic"
                    )}>
                      {dateOfBirth || 'Not set'}
                    </p>
                  </div>
                  <div className="group">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Birth Place</label>
                      {birthPlace && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    </div>
                    <p className={cn(
                      "text-gray-900 dark:text-gray-100 font-medium",
                      !birthPlace && "text-gray-400 dark:text-gray-500 italic"
                    )}>
                      {birthPlace || 'Not set'}
                    </p>
                  </div>
                </div>
              )}
            </Card>

            {/* Address */}
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow duration-300">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/40 dark:to-blue-800/30">
                  <MapPin className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  Address
                </h2>
              </div>

              {editing ? (
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Input
                        label="House Number & Street Name"
                        value={houseNumber}
                        onChange={(e) => setHouseNumber(e.target.value)}
                        placeholder="123 Main Street"
                        className={cn(
                          houseNumber && 'border-green-500 focus:ring-green-500'
                        )}
                      />
                    </div>
                    <div>
                      <Input
                        label="Barangay"
                        value={streetName}
                        onChange={(e) => setStreetName(e.target.value)}
                        placeholder="Barangay Name"
                        className={cn(
                          streetName && 'border-green-500 focus:ring-green-500'
                        )}
                      />
                    </div>
                    <div>
                      <Input
                        label="City / Municipality Name"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="City"
                        className={cn(
                          city && 'border-green-500 focus:ring-green-500'
                        )}
                      />
                    </div>
                    <div>
                      <Input
                        label="Province"
                        value={province}
                        onChange={(e) => setProvince(e.target.value)}
                        placeholder="Province"
                        className={cn(
                          province && 'border-green-500 focus:ring-green-500'
                        )}
                      />
                    </div>
                    <div>
                      <Input
                        label="Country"
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        placeholder="Country"
                        className={cn(
                          country && 'border-green-500 focus:ring-green-500'
                        )}
                      />
                    </div>
                    <div>
                      <Input
                        label="Zipcode"
                        value={zipcode}
                        onChange={(e) => setZipcode(e.target.value)}
                        onBlur={() => handleFieldBlur('zipcode')}
                        placeholder="10001"
                        error={touchedFields.zipcode ? validationErrors.zipcode : undefined}
                        className={cn(
                          getFieldStatus('zipcode', zipcode) === 'success' && 'border-green-500 focus:ring-green-500',
                          getFieldStatus('zipcode', zipcode) === 'error' && 'border-red-500 focus:ring-red-500'
                        )}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="group">
                    <div className="flex items-center gap-2 mb-2">
                      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">House Number & Street Name</label>
                      {houseNumber && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    </div>
                    <p className={cn(
                      "text-gray-900 dark:text-gray-100 font-medium",
                      !houseNumber && "text-gray-400 dark:text-gray-500 italic"
                    )}>
                      {houseNumber || 'Not set'}
                    </p>
                  </div>
                  <div className="group">
                    <div className="flex items-center gap-2 mb-2">
                      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Barangay</label>
                      {streetName && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    </div>
                    <p className={cn(
                      "text-gray-900 dark:text-gray-100 font-medium",
                      !streetName && "text-gray-400 dark:text-gray-500 italic"
                    )}>
                      {streetName || 'Not set'}
                    </p>
                  </div>
                  <div className="group">
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 className="h-4 w-4 text-gray-400" />
                      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">City / Municipality Name</label>
                      {city && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    </div>
                    <p className={cn(
                      "text-gray-900 dark:text-gray-100 font-medium",
                      !city && "text-gray-400 dark:text-gray-500 italic"
                    )}>
                      {city || 'Not set'}
                    </p>
                  </div>
                  <div className="group">
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 className="h-4 w-4 text-gray-400" />
                      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Province</label>
                      {province && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    </div>
                    <p className={cn(
                      "text-gray-900 dark:text-gray-100 font-medium",
                      !province && "text-gray-400 dark:text-gray-500 italic"
                    )}>
                      {province || 'Not set'}
                    </p>
                  </div>
                  <div className="group">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Country</label>
                      {country && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    </div>
                    <p className={cn(
                      "text-gray-900 dark:text-gray-100 font-medium",
                      !country && "text-gray-400 dark:text-gray-500 italic"
                    )}>
                      {country || 'Not set'}
                    </p>
                  </div>
                  <div className="group">
                    <div className="flex items-center gap-2 mb-2">
                      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Zipcode</label>
                      {zipcode && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    </div>
                    <p className={cn(
                      "text-gray-900 dark:text-gray-100 font-medium",
                      !zipcode && "text-gray-400 dark:text-gray-500 italic"
                    )}>
                      {zipcode || 'Not set'}
                    </p>
                  </div>
                </div>
              )}
            </Card>

            {/* Elementary School */}
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow duration-300">
              <div className="flex items-center gap-2 mb-4">
                <School className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Elementary School
                </h2>
                {elementarySchool && <CheckCircle2 className="h-5 w-5 text-green-500" />}
              </div>

              {editing ? (
                <div className="space-y-4">
                  <div>
                    <Input
                      label="Name of Elementary School"
                      value={elementarySchool}
                      onChange={(e) => setElementarySchool(e.target.value)}
                      placeholder="Elementary School Name"
                      className={cn(
                        elementarySchool && 'border-green-500 focus:ring-green-500'
                      )}
                    />
                  </div>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <Input
                        label="City"
                        value={elementaryCity}
                        onChange={(e) => setElementaryCity(e.target.value)}
                        placeholder="City"
                        className={cn(
                          elementaryCity && 'border-green-500 focus:ring-green-500'
                        )}
                      />
                    </div>
                    <div>
                      <Input
                        label="Province/State"
                        value={elementaryProvince}
                        onChange={(e) => setElementaryProvince(e.target.value)}
                        placeholder="Province/State"
                        className={cn(
                          elementaryProvince && 'border-green-500 focus:ring-green-500'
                        )}
                      />
                    </div>
                    <div>
                      <Input
                        label="Country"
                        value={elementaryCountry}
                        onChange={(e) => setElementaryCountry(e.target.value)}
                        placeholder="Country"
                        className={cn(
                          elementaryCountry && 'border-green-500 focus:ring-green-500'
                        )}
                      />
                    </div>
                  </div>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <Input
                        label="Years Attended"
                        type="number"
                        value={elementaryYearsAttended}
                        onChange={(e) => setElementaryYearsAttended(e.target.value)}
                        onBlur={() => handleFieldBlur('elementaryYearsAttended')}
                        placeholder="e.g., 6"
                        error={touchedFields.elementaryYearsAttended ? validationErrors.elementaryYearsAttended : undefined}
                        className={cn(
                          getFieldStatus('elementaryYearsAttended', elementaryYearsAttended) === 'success' && 'border-green-500 focus:ring-green-500',
                          getFieldStatus('elementaryYearsAttended', elementaryYearsAttended) === 'error' && 'border-red-500 focus:ring-red-500'
                        )}
                      />
                    </div>
                    <div>
                      <Input
                        label="Start Date (MM/YYYY)"
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
                        error={touchedFields.elementaryStartDate ? validationErrors.elementaryStartDate : undefined}
                        className={cn(
                          getFieldStatus('elementaryStartDate', elementaryStartDate) === 'success' && 'border-green-500 focus:ring-green-500',
                          getFieldStatus('elementaryStartDate', elementaryStartDate) === 'error' && 'border-red-500 focus:ring-red-500'
                        )}
                      />
                    </div>
                    <div>
                      <Input
                        label="End Date (MM/YYYY)"
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
                        error={touchedFields.elementaryEndDate ? validationErrors.elementaryEndDate : undefined}
                        className={cn(
                          getFieldStatus('elementaryEndDate', elementaryEndDate) === 'success' && 'border-green-500 focus:ring-green-500',
                          getFieldStatus('elementaryEndDate', elementaryEndDate) === 'error' && 'border-red-500 focus:ring-red-500'
                        )}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  {elementarySchool ? (
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="group">
                        <div className="flex items-center gap-2 mb-2">
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">School Name</label>
                          {elementarySchool && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                        </div>
                        <p className="text-gray-900 dark:text-gray-100 font-medium">{elementarySchool}</p>
                      </div>
                      <div className="group">
                        <div className="flex items-center gap-2 mb-2">
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">City</label>
                          {elementaryCity && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                        </div>
                        <p className={cn(
                          "text-gray-900 dark:text-gray-100 font-medium",
                          !elementaryCity && "text-gray-400 dark:text-gray-500 italic"
                        )}>
                          {elementaryCity || 'Not set'}
                        </p>
                      </div>
                      <div className="group">
                        <div className="flex items-center gap-2 mb-2">
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Province</label>
                          {elementaryProvince && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                        </div>
                        <p className={cn(
                          "text-gray-900 dark:text-gray-100 font-medium",
                          !elementaryProvince && "text-gray-400 dark:text-gray-500 italic"
                        )}>
                          {elementaryProvince || 'Not set'}
                        </p>
                      </div>
                      <div className="group">
                        <div className="flex items-center gap-2 mb-2">
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Country</label>
                          {elementaryCountry && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                        </div>
                        <p className={cn(
                          "text-gray-900 dark:text-gray-100 font-medium",
                          !elementaryCountry && "text-gray-400 dark:text-gray-500 italic"
                        )}>
                          {elementaryCountry || 'Not set'}
                        </p>
                      </div>
                      {elementaryYearsAttended && (
                        <div className="group">
                          <div className="flex items-center gap-2 mb-2">
                            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Years Attended</label>
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          </div>
                          <p className="text-gray-900 dark:text-gray-100 font-medium">{elementaryYearsAttended}</p>
                        </div>
                      )}
                      {elementaryStartDate && (
                        <div className="group">
                          <div className="flex items-center gap-2 mb-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Start Date</label>
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          </div>
                          <p className="text-gray-900 dark:text-gray-100 font-medium">{formatMonthYear(elementaryStartDate)}</p>
                        </div>
                      )}
                      {elementaryEndDate && (
                        <div className="group">
                          <div className="flex items-center gap-2 mb-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">End Date</label>
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          </div>
                          <p className="text-gray-900 dark:text-gray-100 font-medium">{formatMonthYear(elementaryEndDate)}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 text-sm">No elementary school information saved</p>
                  )}
                </div>
              )}
            </Card>

            {/* High School */}
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow duration-300">
              <div className="flex items-center gap-2 mb-4">
                <School className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  High School
                </h2>
                {highSchool && <CheckCircle2 className="h-5 w-5 text-green-500" />}
              </div>

              {editing ? (
                <div className="space-y-4">
                  <Input
                    label="Name of High School"
                    value={highSchool}
                    onChange={(e) => setHighSchool(e.target.value)}
                    placeholder="High School Name"
                  />
                  <div className="grid md:grid-cols-3 gap-4">
                    <Input
                      label="City"
                      value={highSchoolCity}
                      onChange={(e) => setHighSchoolCity(e.target.value)}
                      placeholder="City"
                    />
                    <Input
                      label="Province/State"
                      value={highSchoolProvince}
                      onChange={(e) => setHighSchoolProvince(e.target.value)}
                      placeholder="Province/State"
                    />
                    <Input
                      label="Country"
                      value={highSchoolCountry}
                      onChange={(e) => setHighSchoolCountry(e.target.value)}
                      placeholder="Country"
                    />
                  </div>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <Input
                        label="Years Attended"
                        type="number"
                        value={highSchoolYearsAttended}
                        onChange={(e) => setHighSchoolYearsAttended(e.target.value)}
                        onBlur={() => handleFieldBlur('highSchoolYearsAttended')}
                        placeholder="e.g., 4"
                        error={touchedFields.highSchoolYearsAttended ? validationErrors.highSchoolYearsAttended : undefined}
                        className={cn(
                          getFieldStatus('highSchoolYearsAttended', highSchoolYearsAttended) === 'success' && 'border-green-500 focus:ring-green-500',
                          getFieldStatus('highSchoolYearsAttended', highSchoolYearsAttended) === 'error' && 'border-red-500 focus:ring-red-500'
                        )}
                      />
                    </div>
                    <div>
                      <Input
                        label="Start Date (MM/YYYY)"
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
                        error={touchedFields.highSchoolStartDate ? validationErrors.highSchoolStartDate : undefined}
                        className={cn(
                          getFieldStatus('highSchoolStartDate', highSchoolStartDate) === 'success' && 'border-green-500 focus:ring-green-500',
                          getFieldStatus('highSchoolStartDate', highSchoolStartDate) === 'error' && 'border-red-500 focus:ring-red-500'
                        )}
                      />
                    </div>
                    <div>
                      <Input
                        label="End Date (MM/YYYY)"
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
                        error={touchedFields.highSchoolEndDate ? validationErrors.highSchoolEndDate : undefined}
                        className={cn(
                          getFieldStatus('highSchoolEndDate', highSchoolEndDate) === 'success' && 'border-green-500 focus:ring-green-500',
                          getFieldStatus('highSchoolEndDate', highSchoolEndDate) === 'error' && 'border-red-500 focus:ring-red-500'
                        )}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  {highSchool ? (
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="group">
                        <div className="flex items-center gap-2 mb-2">
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">School Name</label>
                          {highSchool && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                        </div>
                        <p className="text-gray-900 dark:text-gray-100 font-medium">{highSchool}</p>
                      </div>
                      <div className="group">
                        <div className="flex items-center gap-2 mb-2">
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">City</label>
                          {highSchoolCity && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                        </div>
                        <p className={cn(
                          "text-gray-900 dark:text-gray-100 font-medium",
                          !highSchoolCity && "text-gray-400 dark:text-gray-500 italic"
                        )}>
                          {highSchoolCity || 'Not set'}
                        </p>
                      </div>
                      <div className="group">
                        <div className="flex items-center gap-2 mb-2">
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Province</label>
                          {highSchoolProvince && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                        </div>
                        <p className={cn(
                          "text-gray-900 dark:text-gray-100 font-medium",
                          !highSchoolProvince && "text-gray-400 dark:text-gray-500 italic"
                        )}>
                          {highSchoolProvince || 'Not set'}
                        </p>
                      </div>
                      <div className="group">
                        <div className="flex items-center gap-2 mb-2">
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Country</label>
                          {highSchoolCountry && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                        </div>
                        <p className={cn(
                          "text-gray-900 dark:text-gray-100 font-medium",
                          !highSchoolCountry && "text-gray-400 dark:text-gray-500 italic"
                        )}>
                          {highSchoolCountry || 'Not set'}
                        </p>
                      </div>
                      {highSchoolYearsAttended && (
                        <div className="group">
                          <div className="flex items-center gap-2 mb-2">
                            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Years Attended</label>
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          </div>
                          <p className="text-gray-900 dark:text-gray-100 font-medium">{highSchoolYearsAttended}</p>
                        </div>
                      )}
                      {highSchoolStartDate && (
                        <div className="group">
                          <div className="flex items-center gap-2 mb-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Start Date</label>
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          </div>
                          <p className="text-gray-900 dark:text-gray-100 font-medium">{formatMonthYear(highSchoolStartDate)}</p>
                        </div>
                      )}
                      {highSchoolEndDate && (
                        <div className="group">
                          <div className="flex items-center gap-2 mb-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">End Date</label>
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          </div>
                          <p className="text-gray-900 dark:text-gray-100 font-medium">{formatMonthYear(highSchoolEndDate)}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 text-sm">No high school information saved</p>
                  )}
                </div>
              )}
            </Card>

            {/* Nursing School */}
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow duration-300">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Nursing School
                </h2>
                {nursingSchool && <CheckCircle2 className="h-5 w-5 text-green-500" />}
              </div>

              {editing ? (
                <div className="space-y-4">
                  <div>
                    <Input
                      label="Name of Nursing School"
                      value={nursingSchool}
                      onChange={(e) => setNursingSchool(e.target.value)}
                      placeholder="Nursing School Name"
                      className={cn(
                        nursingSchool && 'border-green-500 focus:ring-green-500'
                      )}
                    />
                  </div>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <Input
                        label="City"
                        value={nursingSchoolCity}
                        onChange={(e) => setNursingSchoolCity(e.target.value)}
                        placeholder="City"
                        className={cn(
                          nursingSchoolCity && 'border-green-500 focus:ring-green-500'
                        )}
                      />
                    </div>
                    <div>
                      <Input
                        label="Province/State"
                        value={nursingSchoolProvince}
                        onChange={(e) => setNursingSchoolProvince(e.target.value)}
                        placeholder="Province/State"
                        className={cn(
                          nursingSchoolProvince && 'border-green-500 focus:ring-green-500'
                        )}
                      />
                    </div>
                    <div>
                      <Input
                        label="Country"
                        value={nursingSchoolCountry}
                        onChange={(e) => setNursingSchoolCountry(e.target.value)}
                        placeholder="Country"
                        className={cn(
                          nursingSchoolCountry && 'border-green-500 focus:ring-green-500'
                        )}
                      />
                    </div>
                  </div>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <Input
                        label="Years Attended"
                        type="number"
                        value={nursingSchoolYearsAttended}
                        onChange={(e) => setNursingSchoolYearsAttended(e.target.value)}
                        onBlur={() => handleFieldBlur('nursingSchoolYearsAttended')}
                        placeholder="e.g., 4"
                        error={touchedFields.nursingSchoolYearsAttended ? validationErrors.nursingSchoolYearsAttended : undefined}
                        className={cn(
                          getFieldStatus('nursingSchoolYearsAttended', nursingSchoolYearsAttended) === 'success' && 'border-green-500 focus:ring-green-500',
                          getFieldStatus('nursingSchoolYearsAttended', nursingSchoolYearsAttended) === 'error' && 'border-red-500 focus:ring-red-500'
                        )}
                      />
                    </div>
                    <div>
                      <Input
                        label="Start Date (MM/YYYY)"
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
                        error={touchedFields.nursingSchoolStartDate ? validationErrors.nursingSchoolStartDate : undefined}
                        className={cn(
                          getFieldStatus('nursingSchoolStartDate', nursingSchoolStartDate) === 'success' && 'border-green-500 focus:ring-green-500',
                          getFieldStatus('nursingSchoolStartDate', nursingSchoolStartDate) === 'error' && 'border-red-500 focus:ring-red-500'
                        )}
                      />
                    </div>
                    <div>
                      <Input
                        label="End Date (MM/YYYY)"
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
                        error={touchedFields.nursingSchoolEndDate ? validationErrors.nursingSchoolEndDate : undefined}
                        className={cn(
                          getFieldStatus('nursingSchoolEndDate', nursingSchoolEndDate) === 'success' && 'border-green-500 focus:ring-green-500',
                          getFieldStatus('nursingSchoolEndDate', nursingSchoolEndDate) === 'error' && 'border-red-500 focus:ring-red-500'
                        )}
                      />
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Input
                        label="Major/Field of Study"
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
                        label="Diploma Date (MM/DD/YYYY)"
                        type="text"
                        value={nursingSchoolDiplomaDate}
                        onChange={(e) => {
                          const formatted = formatMMDDYYYY(e.target.value)
                          setNursingSchoolDiplomaDate(formatted)
                          if (touchedFields.nursingSchoolDiplomaDate) {
                            handleFieldBlur('nursingSchoolDiplomaDate')
                          }
                        }}
                        onBlur={() => handleFieldBlur('nursingSchoolDiplomaDate')}
                        placeholder="MM/DD/YYYY"
                        maxLength={10}
                        error={touchedFields.nursingSchoolDiplomaDate ? validationErrors.nursingSchoolDiplomaDate : undefined}
                        className={cn(
                          getFieldStatus('nursingSchoolDiplomaDate', nursingSchoolDiplomaDate) === 'success' && 'border-green-500 focus:ring-green-500',
                          getFieldStatus('nursingSchoolDiplomaDate', nursingSchoolDiplomaDate) === 'error' && 'border-red-500 focus:ring-red-500'
                        )}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  {nursingSchool ? (
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="group">
                        <div className="flex items-center gap-2 mb-2">
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">School Name</label>
                          {nursingSchool && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                        </div>
                        <p className="text-gray-900 dark:text-gray-100 font-medium">{nursingSchool}</p>
                      </div>
                      <div className="group">
                        <div className="flex items-center gap-2 mb-2">
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">City</label>
                          {nursingSchoolCity && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                        </div>
                        <p className={cn(
                          "text-gray-900 dark:text-gray-100 font-medium",
                          !nursingSchoolCity && "text-gray-400 dark:text-gray-500 italic"
                        )}>
                          {nursingSchoolCity || 'Not set'}
                        </p>
                      </div>
                      <div className="group">
                        <div className="flex items-center gap-2 mb-2">
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Province</label>
                          {nursingSchoolProvince && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                        </div>
                        <p className={cn(
                          "text-gray-900 dark:text-gray-100 font-medium",
                          !nursingSchoolProvince && "text-gray-400 dark:text-gray-500 italic"
                        )}>
                          {nursingSchoolProvince || 'Not set'}
                        </p>
                      </div>
                      <div className="group">
                        <div className="flex items-center gap-2 mb-2">
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Country</label>
                          {nursingSchoolCountry && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                        </div>
                        <p className={cn(
                          "text-gray-900 dark:text-gray-100 font-medium",
                          !nursingSchoolCountry && "text-gray-400 dark:text-gray-500 italic"
                        )}>
                          {nursingSchoolCountry || 'Not set'}
                        </p>
                      </div>
                      {nursingSchoolYearsAttended && (
                        <div className="group">
                          <div className="flex items-center gap-2 mb-2">
                            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Years Attended</label>
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          </div>
                          <p className="text-gray-900 dark:text-gray-100 font-medium">{nursingSchoolYearsAttended}</p>
                        </div>
                      )}
                      {nursingSchoolStartDate && (
                        <div className="group">
                          <div className="flex items-center gap-2 mb-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Start Date</label>
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          </div>
                          <p className="text-gray-900 dark:text-gray-100 font-medium">{formatMonthYear(nursingSchoolStartDate)}</p>
                        </div>
                      )}
                      {nursingSchoolEndDate && (
                        <div className="group">
                          <div className="flex items-center gap-2 mb-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">End Date</label>
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          </div>
                          <p className="text-gray-900 dark:text-gray-100 font-medium">{formatMonthYear(nursingSchoolEndDate)}</p>
                        </div>
                      )}
                      {nursingSchoolMajor && (
                        <div className="group">
                          <div className="flex items-center gap-2 mb-2">
                            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Major/Field of Study</label>
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          </div>
                          <p className="text-gray-900 dark:text-gray-100 font-medium">{nursingSchoolMajor}</p>
                        </div>
                      )}
                      {nursingSchoolDiplomaDate && (
                        <div className="group">
                          <div className="flex items-center gap-2 mb-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Diploma Date</label>
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          </div>
                          <p className="text-gray-900 dark:text-gray-100 font-medium">{nursingSchoolDiplomaDate}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 text-sm">No nursing school information saved</p>
                  )}
                </div>
              )}
            </Card>

            {/* Application Details */}
            {(signature || paymentType) && (
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow duration-300">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/40 dark:to-purple-800/30">
                  <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  Application Details
                </h2>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {signature && (
                  <div className="group">
                    <div className="flex items-center gap-2 mb-2">
                      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Digital Signature</label>
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    </div>
                    <p className="text-gray-900 dark:text-gray-100 font-medium">{signature}</p>
                  </div>
                )}
                {paymentType && (
                  <div className="group">
                    <div className="flex items-center gap-2 mb-2">
                      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Payment Type</label>
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    </div>
                    <p className="text-gray-900 dark:text-gray-100 font-medium capitalize">
                      {paymentType === 'full' ? 'Full Payment' : paymentType === 'step1' ? 'Staggered Payment (Step 1)' : paymentType === 'step2' ? 'Staggered Payment (Step 2)' : paymentType === 'retake' ? 'Retake Payment' : paymentType}
                    </p>
                  </div>
                )}
              </div>
            </Card>
            )}

            {/* Action Buttons */}
            {editing && (
              <Card className="border-0 shadow-lg bg-gradient-to-br from-primary-50 via-primary-50/50 to-white dark:from-primary-900/20 dark:via-primary-800/10 dark:to-gray-800">
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button 
                    onClick={handleSave} 
                    disabled={saving} 
                    className="flex-1 shadow-md hover:shadow-lg transition-shadow"
                    type="button"
                  >
                    {saving ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save All Details
                      </>
                    )}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleCancel} 
                    disabled={saving} 
                    className="flex-1 hover:bg-gray-50 dark:hover:bg-gray-700"
                    type="button"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
                <div className="mt-4 pt-4 border-t border-primary-200 dark:border-primary-800">
                  <div className="flex items-start gap-2">
                    <Sparkles className="h-4 w-4 text-primary-600 dark:text-primary-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Saved details will automatically populate your application forms, making the process faster and easier.
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </main>
      </div>

      {/* Avatar Upload Preview Modal */}
      <Modal
        isOpen={!!avatarPreview}
        onClose={handleAvatarCancel}
        title="Upload Profile Avatar"
        size="lg"
      >
        {avatarPreview && (
          <div className="space-y-4">
            {/* Image Preview */}
            <div className="flex justify-center bg-gray-100 dark:bg-gray-900 p-4 rounded-lg">
              <img
                src={avatarPreview.previewUrl}
                alt="Preview"
                className="max-w-full max-h-96 object-contain rounded-lg"
              />
            </div>
            
            {/* File Info */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">File Name:</span>
                <span className="text-sm text-gray-900 dark:text-gray-100 truncate ml-4">{avatarPreview.file.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Size:</span>
                <span className="text-sm text-gray-900 dark:text-gray-100">
                  {(avatarPreview.file.size / 1024 / 1024).toFixed(2)} MB
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                variant="outline"
                onClick={handleAvatarCancel}
                disabled={uploadingAvatar}
              >
                Cancel
              </Button>
              <Button
                variant="default"
                onClick={handleAvatarSubmit}
                disabled={uploadingAvatar}
              >
                {uploadingAvatar ? (
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
                    Upload
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

