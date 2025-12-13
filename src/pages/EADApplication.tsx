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
import { ChevronRight, ChevronLeft, AlertCircle } from 'lucide-react'
import { applicationsAPI, userDetailsAPI, servicesAPI, applicationPaymentsAPI } from '@/lib/api'

// Helper function to format MM/DD/YYYY input
const formatMMDDYYYY = (value: string): string => {
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

// Helper function to validate MM/DD/YYYY format
const isValidMMDDYYYY = (value: string): boolean => {
  const pattern = /^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}$/
  if (!pattern.test(value)) return false
  
  const [month, day, year] = value.split('/').map(Number)
  if (month < 1 || month > 12) return false
  if (year < 1900 || year > 2100) return false
  
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
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

// Convert YYYY-MM-DD to MM/DD/YYYY for display
const convertFromDatabaseFormat = (yyyymmdd: string): string => {
  if (!yyyymmdd || !/^\d{4}-\d{2}-\d{2}$/.test(yyyymmdd)) return ''
  const [year, month, day] = yyyymmdd.split('-')
  return `${month}/${day}/${year}`
}

export function EADApplication() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [error, setError] = useState('')
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [draftApplicationId, setDraftApplicationId] = useState<string | null>(null)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())

  // Part 1: Reason for Applying
  const [reasonForFiling, setReasonForFiling] = useState('')
  const [hasAttorney, setHasAttorney] = useState('No') // Always "No", cannot be changed
  const [uscisOnlineAccountNumber, setUscisOnlineAccountNumber] = useState('')

  // Part 1 & 2: Legal Name Information
  const [lastName, setLastName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [maidenName, setMaidenName] = useState('')
  const [aliases, setAliases] = useState('')
  const [previousLegalNames, setPreviousLegalNames] = useState('')

  // Part 2: Address Information
  const [inCareOfName, setInCareOfName] = useState('')
  const [streetAddress, setStreetAddress] = useState('')
  const [apartmentSuite, setApartmentSuite] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zipCode, setZipCode] = useState('')
  const [physicalAddressSame, setPhysicalAddressSame] = useState('')
  const [physicalInCareOf, setPhysicalInCareOf] = useState('')
  const [physicalStreetAddress, setPhysicalStreetAddress] = useState('')
  const [physicalApartmentSuite, setPhysicalApartmentSuite] = useState('')
  const [physicalCity, setPhysicalCity] = useState('')
  const [physicalState, setPhysicalState] = useState('')
  const [physicalZipCode, setPhysicalZipCode] = useState('')

  // Part 2: Personal Information
  const [sex, setSex] = useState('')
  const [maritalStatus, setMaritalStatus] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [birthCity, setBirthCity] = useState('')
  const [birthState, setBirthState] = useState('')
  const [birthCountry, setBirthCountry] = useState('')
  const [citizenshipCountries, setCitizenshipCountries] = useState<string[]>([])
  const [spouseName, setSpouseName] = useState('') // Spouse name (employee at Insight Global LLC)
  const [spouseEmail, setSpouseEmail] = useState('') // Spouse email
  const [spouseContactNumber, setSpouseContactNumber] = useState('') // Spouse contact number

  // Part 2: Social Security Information
  const [hasSSN, setHasSSN] = useState('')
  const [ssn, setSsn] = useState('')
  const [wantSSNCard, setWantSSNCard] = useState('')
  const [consentSSADisclosure, setConsentSSADisclosure] = useState('')

  // Part 2: Parents' Information
  const [fatherLastName, setFatherLastName] = useState('')
  const [fatherFirstName, setFatherFirstName] = useState('')
  const [motherLastName, setMotherLastName] = useState('')
  const [motherFirstName, setMotherFirstName] = useState('')

  // Part 2: Immigration & Arrival Information
  const [aNumber, setANumber] = useState('')
  const [uscisAccountNumber, setUscisAccountNumber] = useState('NA') // Default to "NA"
  const [i94Number, setI94Number] = useState('')
  const [passportNumber, setPassportNumber] = useState('')
  const [passportCountry, setPassportCountry] = useState('')
  const [passportExpiration, setPassportExpiration] = useState('')
  const [travelDocumentNumber, setTravelDocumentNumber] = useState('')
  const [lastArrivalDate, setLastArrivalDate] = useState('')
  const [lastArrivalPlace, setLastArrivalPlace] = useState('')
  const [immigrationStatusAtArrival, setImmigrationStatusAtArrival] = useState('')
  const [currentImmigrationStatus, setCurrentImmigrationStatus] = useState('')
  const [sevisNumber, setSevisNumber] = useState('')

  // Part 2: Eligibility Category
  const [eligibilityCategory, setEligibilityCategory] = useState('C 26') // Default to "C 26"
  const [employerName, setEmployerName] = useState('')
  const [everifyCompanyId, setEverifyCompanyId] = useState('')
  const [receiptNumber, setReceiptNumber] = useState('')
  const [hasCriminalHistory, setHasCriminalHistory] = useState('No') // Default to "No"

  // Part 3: Contact Information
  const [phoneNumber, setPhoneNumber] = useState('')
  const [mobileNumber, setMobileNumber] = useState('')
  const [emailAddress, setEmailAddress] = useState('')

  // Applicant Declaration
  const [canReadEnglish, setCanReadEnglish] = useState('Yes') // Default to "Yes"
  const [signature, setSignature] = useState('')
  const [signatureDate, setSignatureDate] = useState('')
  const [digitalSignature, setDigitalSignature] = useState('') // For Step 12

  // Part 4: Interpreter Information
  const [hasInterpreter, setHasInterpreter] = useState(false)
  const [interpreterName, setInterpreterName] = useState('')
  const [interpreterAddress, setInterpreterAddress] = useState('')
  const [interpreterPhone, setInterpreterPhone] = useState('')
  const [interpreterEmail, setInterpreterEmail] = useState('')
  const [interpreterSignature, setInterpreterSignature] = useState('')
  const [interpreterSignatureDate, setInterpreterSignatureDate] = useState('')

  // Part 5: Preparer Information (default values - cannot be changed)
  const [hasPreparer, setHasPreparer] = useState(true)
  const [preparerName, setPreparerName] = useState('JOY JERIC ALBURO CANTILA')
  const [preparerBusinessName, setPreparerBusinessName] = useState('')
  const [preparerAddress, setPreparerAddress] = useState('612 S LINCOLN ST APT 105')
  const [preparerPhone, setPreparerPhone] = useState('509 270 3437')
  const [preparerEmail, setPreparerEmail] = useState('jjcantila@gritsync.com')
  const [preparerType, setPreparerType] = useState('Non-Attorney')
  const [preparerSignature, setPreparerSignature] = useState('')
  const [preparerSignatureDate, setPreparerSignatureDate] = useState('')

  const totalSteps = 11

  // Load saved user details and existing EAD application
  useEffect(() => {
    if (user) {
      loadSavedDetails()
      loadExistingEADApplication()
    }
  }, [user])

  // Load existing EAD application from Supabase
  async function loadExistingEADApplication() {
    try {
      const applications = await applicationsAPI.getAll()
      // Find the most recent EAD application that's still pending (draft)
      const eadApplications = applications.filter((app: any) => 
        app.application_type === 'EAD' && 
        (app.status === 'pending' || !app.signature) // Draft applications
      )
      
      if (eadApplications.length > 0) {
        // Get the most recent one
        const latestEAD = eadApplications.sort((a: any, b: any) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0]
        
        setDraftApplicationId(latestEAD.id)
        
        // Load all the form data from the existing application
        if (latestEAD.reason_for_filing) setReasonForFiling(latestEAD.reason_for_filing)
        if (latestEAD.first_name) setFirstName(latestEAD.first_name)
        if (latestEAD.middle_name) setMiddleName(latestEAD.middle_name)
        if (latestEAD.last_name) setLastName(latestEAD.last_name)
        if (latestEAD.maiden_name) setMaidenName(latestEAD.maiden_name)
        if (latestEAD.aliases) setAliases(latestEAD.aliases)
        if (latestEAD.previous_legal_names) setPreviousLegalNames(latestEAD.previous_legal_names)
        
        // Address
        if (latestEAD.in_care_of_name) setInCareOfName(latestEAD.in_care_of_name)
        if (latestEAD.street_address) setStreetAddress(latestEAD.street_address)
        if (latestEAD.apartment_suite) setApartmentSuite(latestEAD.apartment_suite)
        if (latestEAD.city) setCity(latestEAD.city)
        if (latestEAD.state) setState(latestEAD.state)
        if (latestEAD.zip_code) setZipCode(latestEAD.zip_code)
        if (latestEAD.physical_address_same !== undefined) {
          setPhysicalAddressSame(latestEAD.physical_address_same ? 'Yes' : 'No')
        }
        if (latestEAD.physical_street_address) setPhysicalStreetAddress(latestEAD.physical_street_address)
        if (latestEAD.physical_apartment_suite) setPhysicalApartmentSuite(latestEAD.physical_apartment_suite)
        if (latestEAD.physical_city) setPhysicalCity(latestEAD.physical_city)
        if (latestEAD.physical_state) setPhysicalState(latestEAD.physical_state)
        if (latestEAD.physical_zip_code) setPhysicalZipCode(latestEAD.physical_zip_code)
        
        // Personal Information
        if (latestEAD.sex) setSex(latestEAD.sex)
        if (latestEAD.marital_status) setMaritalStatus(latestEAD.marital_status)
        if (latestEAD.date_of_birth) {
          setDateOfBirth(convertFromDatabaseFormat(latestEAD.date_of_birth))
        }
        if (latestEAD.birth_city) setBirthCity(latestEAD.birth_city)
        if (latestEAD.birth_state) setBirthState(latestEAD.birth_state)
        if (latestEAD.birth_country) setBirthCountry(latestEAD.birth_country)
        if (latestEAD.citizenship_countries && Array.isArray(latestEAD.citizenship_countries)) {
          setCitizenshipCountries(latestEAD.citizenship_countries)
        }
        if (latestEAD.spouse_name) setSpouseName(latestEAD.spouse_name)
        if (latestEAD.spouse_email) setSpouseEmail(latestEAD.spouse_email)
        if (latestEAD.spouse_contact_number) setSpouseContactNumber(latestEAD.spouse_contact_number)
        
        // Social Security
        if (latestEAD.has_ssn !== undefined) setHasSSN(latestEAD.has_ssn ? 'Yes' : 'No')
        if (latestEAD.ssn) setSsn(latestEAD.ssn)
        if (latestEAD.want_ssn_card !== undefined) setWantSSNCard(latestEAD.want_ssn_card ? 'Yes' : 'No')
        if (latestEAD.consent_ssa_disclosure !== undefined) setConsentSSADisclosure(latestEAD.consent_ssa_disclosure ? 'Yes' : 'No')
        
        // Parents
        if (latestEAD.father_first_name) setFatherFirstName(latestEAD.father_first_name)
        if (latestEAD.father_last_name) setFatherLastName(latestEAD.father_last_name)
        if (latestEAD.mother_first_name) setMotherFirstName(latestEAD.mother_first_name)
        if (latestEAD.mother_last_name) setMotherLastName(latestEAD.mother_last_name)
        
        // Immigration
        if (latestEAD.a_number) setANumber(latestEAD.a_number)
        if (latestEAD.uscis_account_number) setUscisAccountNumber(latestEAD.uscis_account_number)
        if (latestEAD.i94_number) setI94Number(latestEAD.i94_number)
        if (latestEAD.passport_number) setPassportNumber(latestEAD.passport_number)
        if (latestEAD.passport_country) setPassportCountry(latestEAD.passport_country)
        if (latestEAD.passport_expiration) {
          setPassportExpiration(convertFromDatabaseFormat(latestEAD.passport_expiration))
        }
        if (latestEAD.travel_document_number) setTravelDocumentNumber(latestEAD.travel_document_number)
        if (latestEAD.last_arrival_date) {
          setLastArrivalDate(convertFromDatabaseFormat(latestEAD.last_arrival_date))
        }
        if (latestEAD.last_arrival_place) setLastArrivalPlace(latestEAD.last_arrival_place)
        if (latestEAD.immigration_status_at_arrival) setImmigrationStatusAtArrival(latestEAD.immigration_status_at_arrival)
        if (latestEAD.current_immigration_status) setCurrentImmigrationStatus(latestEAD.current_immigration_status)
        if (latestEAD.sevis_number) setSevisNumber(latestEAD.sevis_number)
        
        // Eligibility
        if (latestEAD.eligibility_category) setEligibilityCategory(latestEAD.eligibility_category)
        if (latestEAD.employer_name) setEmployerName(latestEAD.employer_name)
        if (latestEAD.everify_company_id) setEverifyCompanyId(latestEAD.everify_company_id)
        if (latestEAD.receipt_number) setReceiptNumber(latestEAD.receipt_number)
        if (latestEAD.has_criminal_history !== undefined) setHasCriminalHistory(latestEAD.has_criminal_history ? 'Yes' : 'No')
        
        // Contact
        if (latestEAD.phone_number) setPhoneNumber(latestEAD.phone_number)
        if (latestEAD.mobile_number) setMobileNumber(latestEAD.mobile_number)
        if (latestEAD.email_address) setEmailAddress(latestEAD.email_address)
        
        // Declaration
        if (latestEAD.can_read_english !== undefined) setCanReadEnglish(latestEAD.can_read_english ? 'Yes' : 'No')
        if (latestEAD.signature) setSignature(latestEAD.signature)
        if (latestEAD.signature_date) {
          setSignatureDate(convertFromDatabaseFormat(latestEAD.signature_date))
        }
        
        // Interpreter
        if (latestEAD.has_interpreter !== undefined) setHasInterpreter(latestEAD.has_interpreter)
        if (latestEAD.interpreter_name) setInterpreterName(latestEAD.interpreter_name)
        if (latestEAD.interpreter_address) setInterpreterAddress(latestEAD.interpreter_address)
        if (latestEAD.interpreter_phone) setInterpreterPhone(latestEAD.interpreter_phone)
        if (latestEAD.interpreter_email) setInterpreterEmail(latestEAD.interpreter_email)
        if (latestEAD.interpreter_signature) setInterpreterSignature(latestEAD.interpreter_signature)
        if (latestEAD.interpreter_signature_date) {
          setInterpreterSignatureDate(convertFromDatabaseFormat(latestEAD.interpreter_signature_date))
        }
        
        // Preparer
        if (latestEAD.has_preparer !== undefined) setHasPreparer(latestEAD.has_preparer)
        if (latestEAD.preparer_name) setPreparerName(latestEAD.preparer_name)
        if (latestEAD.preparer_business_name) setPreparerBusinessName(latestEAD.preparer_business_name)
        if (latestEAD.preparer_address) setPreparerAddress(latestEAD.preparer_address)
        if (latestEAD.preparer_phone) setPreparerPhone(latestEAD.preparer_phone)
        if (latestEAD.preparer_email) setPreparerEmail(latestEAD.preparer_email)
        if (latestEAD.preparer_type) setPreparerType(latestEAD.preparer_type)
        if (latestEAD.preparer_signature) setPreparerSignature(latestEAD.preparer_signature)
        if (latestEAD.preparer_signature_date) {
          setPreparerSignatureDate(convertFromDatabaseFormat(latestEAD.preparer_signature_date))
        }
        
        // Digital signature
        if (latestEAD.signature && !digitalSignature) {
          setDigitalSignature(latestEAD.signature)
        }
        
        showToast('Loaded your saved application', 'success')
      }
    } catch (error) {
      console.error('Error loading existing EAD application:', error)
      // Silently fail - user can start fresh
    }
  }

  // Set default SSN values when reason for filing is "initial"
  useEffect(() => {
    if (reasonForFiling === 'initial') {
      setHasSSN('No')
      setWantSSNCard('Yes')
      setConsentSSADisclosure('Yes')
      setSsn('') // Clear SSN if it was previously set
    }
  }, [reasonForFiling])

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
        date_of_birth?: string
        birth_place?: string
        house_number?: string
        street_name?: string
        city?: string
        province?: string
        state?: string
        country?: string
        zipcode?: string
      } | null

      if (typedDetails) {
        setFirstName(typedDetails.first_name || '')
        setMiddleName(typedDetails.middle_name || '')
        setLastName(typedDetails.last_name || '')
        setMobileNumber(typedDetails.mobile_number || '')
        setEmailAddress(typedDetails.email || '')
        setSex(typedDetails.gender || '')
        setMaritalStatus(typedDetails.marital_status || '')
        if (typedDetails.date_of_birth) {
          const dbDate = typedDetails.date_of_birth
          if (/^\d{4}-\d{2}-\d{2}$/.test(dbDate)) {
            const [year, month, day] = dbDate.split('-')
            setDateOfBirth(`${month}/${day}/${year}`)
          }
        }
        // Birth place is split into city, state, country
        if (typedDetails.birth_place) {
          // If birth_place contains a comma, split it
          const parts = typedDetails.birth_place.split(',').map(p => p.trim())
          if (parts.length >= 1) setBirthCity(parts[0])
          if (parts.length >= 2) setBirthState(parts[1])
          if (parts.length >= 3) setBirthCountry(parts[2])
        }
        setStreetAddress(`${typedDetails.house_number || ''} ${typedDetails.street_name || ''}`.trim())
        setCity(typedDetails.city || '')
        setState(typedDetails.state || typedDetails.province || '')
        setZipCode(typedDetails.zipcode || '')
        setBirthCountry(typedDetails.country || '')
      }
    } catch (error) {
      console.error('Error loading saved details:', error)
    }
  }

  const validateStep = (step: number): boolean => {
    const errors: Record<string, string> = {}

    if (step === 1) {
      if (!reasonForFiling) errors.reasonForFiling = 'Reason for filing is required'
    }

    if (step === 2) {
      if (!lastName) errors.lastName = 'Last name is required'
      if (!firstName) errors.firstName = 'First name is required'
    }

    if (step === 3) {
      if (!streetAddress) errors.streetAddress = 'Street address is required'
      if (!city) errors.city = 'City is required'
      if (!state) errors.state = 'State is required'
      if (!zipCode) errors.zipCode = 'ZIP code is required'
      if (physicalAddressSame === 'No' && !physicalStreetAddress) {
        errors.physicalStreetAddress = 'Physical address is required'
      }
    }

    if (step === 4) {
      if (!sex) errors.sex = 'Sex is required'
      if (!maritalStatus) errors.maritalStatus = 'Marital status is required'
      if (!dateOfBirth || !isValidMMDDYYYY(dateOfBirth)) {
        errors.dateOfBirth = 'Valid date of birth (MM/DD/YYYY) is required'
      }
      if (!birthCity) errors.birthCity = 'Birth city is required'
      if (!birthCountry) errors.birthCountry = 'Birth country is required'
      if (!spouseName || !spouseName.trim()) {
        errors.spouseName = 'Spouse name is required for Employer Verification Letter'
      }
      if (!spouseEmail || !spouseEmail.trim()) {
        errors.spouseEmail = 'Spouse email is required'
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(spouseEmail)) {
        errors.spouseEmail = 'Invalid email address'
      }
      if (!spouseContactNumber || !spouseContactNumber.trim()) {
        errors.spouseContactNumber = 'Spouse contact number is required'
      }
    }

    if (step === 5) {
      if (hasSSN === 'Yes' && !ssn) errors.ssn = 'SSN is required'
    }

    if (step === 6) {
      // Parents' information is optional
    }

    if (step === 7) {
      if (!lastArrivalDate || !isValidMMDDYYYY(lastArrivalDate)) {
        errors.lastArrivalDate = 'Valid last arrival date (MM/DD/YYYY) is required'
      }
      if (!lastArrivalPlace) errors.lastArrivalPlace = 'Place of last arrival is required'
      if (!currentImmigrationStatus) errors.currentImmigrationStatus = 'Current immigration status is required'
    }

    if (step === 8) {
      if (!eligibilityCategory) errors.eligibilityCategory = 'Eligibility category is required'
    }

    if (step === 9) {
      if (!phoneNumber) errors.phoneNumber = 'Phone number is required'
      if (emailAddress && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress)) {
        errors.emailAddress = 'Invalid email address'
      }
    }

    if (step === 10) {
      // No validation needed - fields removed
    }

    if (step === 11) {
      if (!digitalSignature || digitalSignature.trim().length === 0) {
        errors.digitalSignature = 'Digital signature (full name) is required'
      }
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Helper function to build application data object
  const buildApplicationData = () => {
    // Build birth_place from birth city, state, and country
    const birthPlaceParts = [birthCity, birthState, birthCountry].filter(Boolean)
    const birthPlace = birthPlaceParts.length > 0 ? birthPlaceParts.join(', ') : 'N/A'

    return {
      application_type: 'EAD',
      // Required fields for applications table (mapped from EAD fields)
      // These fields are required by the database schema, so we provide defaults if not filled yet
      email: emailAddress || (user?.email as string) || 'draft@temp.com', // Required field - use user email or temp
      mobile_number: phoneNumber || mobileNumber || '000-000-0000', // Required field
      gender: sex || 'Not Specified', // Required field (maps from 'sex' to 'gender')
      marital_status: maritalStatus || 'Not Specified', // Required field
      date_of_birth: dateOfBirth ? convertToDatabaseFormat(dateOfBirth) : '1900-01-01', // Required field
      birth_place: birthPlace || 'N/A', // Required field
      city: city || 'N/A', // Required field
      country: birthCountry || 'N/A', // Required field
      zipcode: zipCode || '00000', // Required field
      // Map street_address to required street_name and house_number
      street_name: streetAddress || 'N/A', // Required field (mapped from street_address)
      house_number: 'N/A', // Required field (empty for EAD, or extract from street_address if needed)
      province: state || 'N/A', // Required field (mapped from state)
      // Part 1
      reason_for_filing: reasonForFiling,
      has_attorney: hasAttorney === 'Yes',
      uscis_online_account_number: uscisOnlineAccountNumber || null,
      // Legal Name
      last_name: lastName || '', // Required field
      first_name: firstName || '', // Required field
      middle_name: middleName || null,
      maiden_name: maidenName || null,
      aliases: aliases || null,
      previous_legal_names: previousLegalNames || null,
      // Address
      in_care_of_name: inCareOfName || null,
      street_address: streetAddress,
      apartment_suite: apartmentSuite || null,
      state: state,
      zip_code: zipCode,
      physical_address_same: physicalAddressSame === 'Yes',
      physical_in_care_of: physicalAddressSame === 'No' ? (physicalInCareOf || null) : null,
      physical_street_address: physicalAddressSame === 'No' ? physicalStreetAddress : null,
      physical_apartment_suite: physicalAddressSame === 'No' ? (physicalApartmentSuite || null) : null,
      physical_city: physicalAddressSame === 'No' ? physicalCity : null,
      physical_state: physicalAddressSame === 'No' ? physicalState : null,
      physical_zip_code: physicalAddressSame === 'No' ? physicalZipCode : null,
      // Personal Information
      sex: sex,
      birth_city: birthCity,
      birth_state: birthState || null,
      birth_country: birthCountry,
      citizenship_countries: citizenshipCountries,
      spouse_name: spouseName || null,
      spouse_email: spouseEmail || null,
      spouse_contact_number: spouseContactNumber || null,
      // Social Security
      has_ssn: hasSSN === 'Yes',
      ssn: hasSSN === 'Yes' ? ssn : null,
      want_ssn_card: wantSSNCard === 'Yes',
      consent_ssa_disclosure: consentSSADisclosure === 'Yes',
      // Parents
      father_last_name: fatherLastName || null,
      father_first_name: fatherFirstName || null,
      mother_last_name: motherLastName || null,
      mother_first_name: motherFirstName || null,
      // Immigration
      a_number: aNumber || null,
      uscis_account_number: uscisAccountNumber || null,
      i94_number: i94Number || null,
      passport_number: passportNumber || null,
      passport_country: passportCountry || null,
      passport_expiration: passportExpiration ? convertToDatabaseFormat(passportExpiration) : null,
      travel_document_number: travelDocumentNumber || null,
      last_arrival_date: lastArrivalDate ? convertToDatabaseFormat(lastArrivalDate) : null,
      last_arrival_place: lastArrivalPlace,
      immigration_status_at_arrival: immigrationStatusAtArrival || null,
      current_immigration_status: currentImmigrationStatus,
      sevis_number: sevisNumber || null,
      // Eligibility
      eligibility_category: eligibilityCategory,
      employer_name: employerName || null,
      everify_company_id: everifyCompanyId || null,
      receipt_number: receiptNumber || null,
      has_criminal_history: hasCriminalHistory === 'Yes',
      // Contact
      phone_number: phoneNumber,
      mobile_number: mobileNumber || null,
      email_address: emailAddress || null,
      // Declaration
      can_read_english: canReadEnglish === 'Yes',
      signature: digitalSignature || signature || null,
      signature_date: digitalSignature ? new Date().toISOString().split('T')[0] : (signatureDate ? convertToDatabaseFormat(signatureDate) : null),
      // Interpreter
      has_interpreter: hasInterpreter,
      interpreter_name: hasInterpreter ? interpreterName : null,
      interpreter_address: hasInterpreter ? interpreterAddress : null,
      interpreter_phone: hasInterpreter ? interpreterPhone : null,
      interpreter_email: hasInterpreter ? interpreterEmail : null,
      interpreter_signature: hasInterpreter ? interpreterSignature : null,
      interpreter_signature_date: hasInterpreter ? (interpreterSignatureDate ? convertToDatabaseFormat(interpreterSignatureDate) : null) : null,
      // Preparer
      has_preparer: hasPreparer,
      preparer_name: hasPreparer ? preparerName : null,
      preparer_business_name: hasPreparer ? preparerBusinessName : null,
      preparer_address: hasPreparer ? preparerAddress : null,
      preparer_phone: hasPreparer ? preparerPhone : null,
      preparer_email: hasPreparer ? preparerEmail : null,
      preparer_type: hasPreparer ? preparerType : null,
      preparer_signature: hasPreparer ? preparerSignature : null,
      preparer_signature_date: hasPreparer ? (preparerSignatureDate ? convertToDatabaseFormat(preparerSignatureDate) : null) : null,
    }
  }

  // Save draft to Supabase
  const saveDraft = async () => {
    setSaving(true)
    try {
      const applicationData = buildApplicationData()
      
      // Add draft status
      const draftData = {
        ...applicationData,
        status: 'pending' as const, // Use pending status for drafts
      }

      if (draftApplicationId) {
        // Update existing draft
        await applicationsAPI.update(draftApplicationId, draftData)
        showToast('Progress saved!', 'success')
      } else {
        // Create new draft
        const draft = await applicationsAPI.create(draftData)
        setDraftApplicationId(draft.id)
        showToast('Progress saved!', 'success')
      }
    } catch (err: any) {
      console.error('Error saving draft:', err)
      showToast('Failed to save progress. Please try again.', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Check if a step is completed
  const isStepCompleted = (step: number): boolean => {
    return completedSteps.has(step)
  }

  // Mark step as completed
  const markStepCompleted = (step: number) => {
    setCompletedSteps(prev => new Set([...prev, step]))
  }

  // Check step completion based on validation
  const checkStepCompletion = (step: number): boolean => {
    if (step === 1) {
      if (!reasonForFiling) return false
    }
    if (step === 2) {
      if (!lastName || !firstName) return false
    }
    if (step === 3) {
      if (!streetAddress || !city || !state || !zipCode) return false
      if (physicalAddressSame === 'No' && !physicalStreetAddress) return false
    }
    if (step === 4) {
      if (!sex || !maritalStatus || !dateOfBirth || !isValidMMDDYYYY(dateOfBirth) || !birthCity || !birthCountry || !spouseName || !spouseName.trim() || !spouseEmail || !spouseEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(spouseEmail) || !spouseContactNumber || !spouseContactNumber.trim()) return false
    }
    if (step === 5) {
      if (hasSSN === 'Yes' && !ssn) return false
    }
    if (step === 6) {
      // Parents' information is optional
      return true
    }
    if (step === 7) {
      if (!lastArrivalDate || !isValidMMDDYYYY(lastArrivalDate) || !lastArrivalPlace || !currentImmigrationStatus) return false
    }
    if (step === 8) {
      if (!eligibilityCategory) return false
    }
    if (step === 9) {
      if (!phoneNumber) return false
      if (emailAddress && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress)) return false
    }
    if (step === 10) {
      // No validation needed - fields removed
      return true
    }
    if (step === 11) {
      if (!digitalSignature || digitalSignature.trim().length === 0) return false
    }
    
    return true
  }

  // Update completed steps when form data changes
  useEffect(() => {
    const newCompleted = new Set<number>()
    for (let step = 1; step <= totalSteps; step++) {
      if (checkStepCompletion(step)) {
        newCompleted.add(step)
      }
    }
    setCompletedSteps(newCompleted)
  }, [
    reasonForFiling, lastName, firstName, streetAddress, city, state, zipCode, physicalAddressSame, physicalStreetAddress,
    sex, maritalStatus, dateOfBirth, birthCity, birthCountry, spouseName, spouseEmail, spouseContactNumber, hasSSN, ssn, lastArrivalDate, lastArrivalPlace,
    currentImmigrationStatus, eligibilityCategory, phoneNumber, emailAddress, digitalSignature
  ])

  const handleNext = async () => {
    if (validateStep(currentStep)) {
      markStepCompleted(currentStep)
      // Save progress before moving to next step
      await saveDraft()
      
      if (currentStep < totalSteps) {
        setCurrentStep(currentStep + 1)
        setError('')
      }
    }
  }

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
      setError('')
    }
  }

  // Handle step navigation
  const handleStepClick = (step: number) => {
    // Allow navigation to any step
    setCurrentStep(step)
    setError('')
  }

  const handleSubmit = async () => {
    // Validate Step 11 (digital signature required)
    if (!validateStep(11)) {
      setError('Please provide your digital signature (full name) before submitting')
      return
    }

    setLoading(true)
    setError('')

    try {
      const applicationData = buildApplicationData()

      // If there's a draft, update it; otherwise create new
      let application
      if (draftApplicationId) {
        const updated = await applicationsAPI.update(draftApplicationId, {
          ...applicationData,
          status: 'pending' as const,
        })
        application = updated
      } else {
        application = await applicationsAPI.create({
          ...applicationData,
          status: 'pending' as const,
        })
        setDraftApplicationId(application.id)
      }

      // Fetch EAD service pricing to create payment
      // EAD pricing is nationwide (not state-specific), use 'All States'
      try {
        const services = await servicesAPI.getAllByServiceAndState('EAD Processing', 'All States')
        const eadService = services.find((s: any) => s.payment_type === 'full')
        
        if (eadService && eadService.total_full) {
          // Create payment record for the EAD application
          const payment = await applicationPaymentsAPI.create(application.id, 'full', eadService.total_full)
          
          // Redirect to checkout page with payment
          showToast('EAD application submitted successfully! Proceeding to checkout...', 'success')
          navigate(`/applications/${application.id}/checkout?payment_id=${payment.id}`)
        } else {
          // No service configured, just show success and go to timeline
          showToast('EAD application submitted successfully!', 'success')
          navigate(`/applications/${application.id}/timeline`)
        }
      } catch (paymentError: any) {
        console.error('Error creating payment:', paymentError)
        // Application was created successfully, but payment creation failed
        // Still redirect to timeline, user can pay later from the payments page
        showToast('Application submitted! You can complete payment from your application dashboard.', 'success')
        navigate(`/applications/${application.id}/timeline`)
      }
    } catch (err: any) {
      console.error('Error submitting application:', err)
      setError(err.message || 'Failed to submit application')
      showToast(err.message || 'Failed to submit application', 'error')
    } finally {
      setLoading(false)
    }
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Reason for Applying (Part 1)</h2>
            
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Reason for I-765 filing <span className="text-red-500">*</span>
              </label>
              <Select
                value={reasonForFiling}
                onChange={(e) => setReasonForFiling(e.target.value)}
                error={validationErrors.reasonForFiling}
                options={[
                  { value: '', label: 'Select reason...' },
                  { value: 'initial', label: 'Initial permission to accept employment' },
                  { value: 'renewal', label: 'Renewal of employment authorization' },
                  { value: 'replacement', label: 'Replacement of lost/stolen/damaged EAD' },
                  { value: 'correction', label: 'Correction NOT due to USCIS error' },
                ]}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Do you have an attorney or accredited representative?
              </label>
              <Select
                value="No"
                disabled
                options={[
                  { value: 'No', label: 'No' },
                ]}
              />
            </div>
          </div>
        )

      case 2:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Legal Name Information (Part 1 & Part 2)</h2>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                  Last Name (Family Name) <span className="text-red-500">*</span>
                </label>
                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  error={validationErrors.lastName}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                  First Name (Given Name) <span className="text-red-500">*</span>
                </label>
                <Input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  error={validationErrors.firstName}
                  required
                />
              </div>
            </div>

            <Input
              label="Middle Name (or 'None')"
              value={middleName}
              onChange={(e) => setMiddleName(e.target.value)}
              placeholder="Enter 'None' if not applicable"
            />

            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Other Names Used (if any)</h3>
              
              <Input
                label="Maiden Name"
                value={maidenName}
                onChange={(e) => setMaidenName(e.target.value)}
              />
              
              <Input
                label="Aliases / Nicknames"
                value={aliases}
                onChange={(e) => setAliases(e.target.value)}
              />
              
              <Input
                label="Previous Legal Names"
                value={previousLegalNames}
                onChange={(e) => setPreviousLegalNames(e.target.value)}
              />
            </div>
          </div>
        )

      case 3:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Address Information (Part 2)</h2>
            
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">U.S. Mailing Address</h3>
              
              <Input
                label="In Care Of Name (if any)"
                value={inCareOfName}
                onChange={(e) => setInCareOfName(e.target.value)}
              />
              
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                  Street Address <span className="text-red-500">*</span>
                </label>
                <Input
                  value={streetAddress}
                  onChange={(e) => setStreetAddress(e.target.value)}
                  error={validationErrors.streetAddress}
                  required
                />
              </div>
              
              <Input
                label="Apartment / Suite / Floor"
                value={apartmentSuite}
                onChange={(e) => setApartmentSuite(e.target.value)}
              />
              
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                    City <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    error={validationErrors.city}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                    State <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    error={validationErrors.state}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                    ZIP Code <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={zipCode}
                    onChange={(e) => setZipCode(e.target.value)}
                    error={validationErrors.zipCode}
                    required
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Is your physical address the same as mailing address?
              </label>
              <Select
                value={physicalAddressSame}
                onChange={(e) => {
                  setPhysicalAddressSame(e.target.value)
                  if (e.target.value === 'Yes') {
                    setPhysicalInCareOf('')
                    setPhysicalStreetAddress('')
                    setPhysicalApartmentSuite('')
                    setPhysicalCity('')
                    setPhysicalState('')
                    setPhysicalZipCode('')
                  }
                }}
                options={[
                  { value: '', label: 'Select...' },
                  { value: 'Yes', label: 'Yes' },
                  { value: 'No', label: 'No' },
                ]}
              />
            </div>

            {physicalAddressSame === 'No' && (
              <div className="space-y-4 mt-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Physical Address</h3>
                
                <Input
                  label="In Care Of Name (if any)"
                  value={physicalInCareOf}
                  onChange={(e) => setPhysicalInCareOf(e.target.value)}
                />
                
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                    Street Address <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={physicalStreetAddress}
                    onChange={(e) => setPhysicalStreetAddress(e.target.value)}
                    error={validationErrors.physicalStreetAddress}
                    required
                  />
                </div>
                
                <Input
                  label="Apartment / Suite / Floor"
                  value={physicalApartmentSuite}
                  onChange={(e) => setPhysicalApartmentSuite(e.target.value)}
                />
                
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      City <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={physicalCity}
                      onChange={(e) => setPhysicalCity(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      State <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={physicalState}
                      onChange={(e) => setPhysicalState(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      ZIP Code <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={physicalZipCode}
                      onChange={(e) => setPhysicalZipCode(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )

      case 4:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Personal Information (Part 2)</h2>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Sex <span className="text-red-500">*</span>
                </label>
                <Select
                  value={sex}
                  onChange={(e) => setSex(e.target.value)}
                  error={validationErrors.sex}
                  options={[
                    { value: '', label: 'Select...' },
                    { value: 'Male', label: 'Male' },
                    { value: 'Female', label: 'Female' },
                  ]}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Marital Status <span className="text-red-500">*</span>
                </label>
                <Select
                  value={maritalStatus}
                  onChange={(e) => setMaritalStatus(e.target.value)}
                  error={validationErrors.maritalStatus}
                  options={[
                    { value: '', label: 'Select...' },
                    { value: 'Single', label: 'Single' },
                    { value: 'Married', label: 'Married' },
                    { value: 'Divorced', label: 'Divorced' },
                    { value: 'Widowed', label: 'Widowed' },
                  ]}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Date of Birth (MM/DD/YYYY) <span className="text-red-500">*</span>
              </label>
              <Input
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(formatMMDDYYYY(e.target.value))}
                placeholder="MM/DD/YYYY"
                error={validationErrors.dateOfBirth}
                required
              />
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Place of Birth</h3>
              
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                  City / Town <span className="text-red-500">*</span>
                </label>
                <Input
                  value={birthCity}
                  onChange={(e) => setBirthCity(e.target.value)}
                  error={validationErrors.birthCity}
                  required
                />
              </div>
              
              <Input
                label="State / Province"
                value={birthState}
                onChange={(e) => setBirthState(e.target.value)}
              />
              
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                  Country <span className="text-red-500">*</span>
                </label>
                <Input
                  value={birthCountry}
                  onChange={(e) => setBirthCountry(e.target.value)}
                  error={validationErrors.birthCountry}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Country or Countries of Citizenship / Nationality
              </label>
              <Input
                value={citizenshipCountries.join(', ')}
                onChange={(e) => {
                  const countries = e.target.value.split(',').map(c => c.trim()).filter(c => c)
                  setCitizenshipCountries(countries)
                }}
                placeholder="Philippines"
              />
            </div>

            {/* Spouse Name Field for H4-EAD Applications */}
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Spouse Full Name (Employee at Insight Global LLC) <span className="text-red-500">*</span>
                  </label>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                    Enter the full name of your spouse who is employed at Insight Global LLC. This is required for the Employer Verification Letter.
                  </p>
                  <Input
                    value={spouseName}
                    onChange={(e) => setSpouseName(e.target.value)}
                    placeholder="Enter spouse's full name"
                    error={validationErrors.spouseName}
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    SPOUSE EMAIL: <span className="text-red-500">*</span>
                  </label>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                    Enter your spouse's email address. The verification letter will be sent as a reply to this email.
                  </p>
                  <Input
                    type="email"
                    value={spouseEmail}
                    onChange={(e) => setSpouseEmail(e.target.value)}
                    placeholder="Enter spouse's email address"
                    error={validationErrors.spouseEmail}
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    SPOUSE CONTACT NUMBER: <span className="text-red-500">*</span>
                  </label>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                    Enter your spouse's contact number. This will be included in the verification letter for the company to contact them.
                  </p>
                  <Input
                    value={spouseContactNumber}
                    onChange={(e) => setSpouseContactNumber(e.target.value)}
                    placeholder="Enter spouse's contact number"
                    error={validationErrors.spouseContactNumber}
                    required
                  />
                </div>
              </div>
            </div>
          </div>
        )

      case 5:
        const isInitialPermission = reasonForFiling === 'initial'
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Social Security Information (Part 2)</h2>
            
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Has SSA ever issued you a Social Security Number?
              </label>
              <Select
                value={hasSSN}
                onChange={(e) => {
                  setHasSSN(e.target.value)
                  if (e.target.value === 'No') setSsn('')
                }}
                disabled={isInitialPermission}
                options={[
                  { value: '', label: 'Select...' },
                  { value: 'Yes', label: 'Yes' },
                  { value: 'No', label: 'No' },
                ]}
              />
            </div>

            {hasSSN === 'Yes' && (
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                  SSN <span className="text-red-500">*</span>
                </label>
                <Input
                  value={ssn}
                  onChange={(e) => setSsn(e.target.value)}
                  error={validationErrors.ssn}
                  placeholder="XXX-XX-XXXX"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Do you want SSA to issue you a Social Security card?
              </label>
              <Select
                value={wantSSNCard}
                onChange={(e) => setWantSSNCard(e.target.value)}
                disabled={isInitialPermission}
                options={[
                  { value: '', label: 'Select...' },
                  { value: 'Yes', label: 'Yes' },
                  { value: 'No', label: 'No' },
                ]}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Consent for SSA disclosure
              </label>
              <Select
                value={consentSSADisclosure}
                onChange={(e) => setConsentSSADisclosure(e.target.value)}
                disabled={isInitialPermission}
                options={[
                  { value: '', label: 'Select...' },
                  { value: 'Yes', label: 'Yes' },
                  { value: 'No', label: 'No' },
                ]}
              />
            </div>
          </div>
        )

      case 6:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Parents' Information (Part 2)</h2>
            
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Father's Birth Name</h3>
              
              <div className="grid md:grid-cols-2 gap-4">
                <Input
                  label="Last Name"
                  value={fatherLastName}
                  onChange={(e) => setFatherLastName(e.target.value)}
                />
                <Input
                  label="First Name"
                  value={fatherFirstName}
                  onChange={(e) => setFatherFirstName(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Mother's Birth Name</h3>
              
              <div className="grid md:grid-cols-2 gap-4">
                <Input
                  label="Last Name"
                  value={motherLastName}
                  onChange={(e) => setMotherLastName(e.target.value)}
                />
                <Input
                  label="First Name"
                  value={motherFirstName}
                  onChange={(e) => setMotherFirstName(e.target.value)}
                />
              </div>
            </div>
          </div>
        )

      case 7:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Immigration & Arrival Information (Part 2)</h2>
            
            <Input
              label="I-94 Number (if any)"
              value={i94Number}
              onChange={(e) => setI94Number(e.target.value)}
              placeholder="328862362A5"
            />

            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Passport Information</h3>
              
              <Input
                label="Passport Number"
                value={passportNumber}
                onChange={(e) => setPassportNumber(e.target.value)}
                placeholder="P9812081B"
              />
              
              <Input
                label="Country of Issuance"
                value={passportCountry}
                onChange={(e) => setPassportCountry(e.target.value)}
                placeholder="PHILIPPINES"
              />
              
              <Input
                label="Expiration Date (MM/DD/YYYY)"
                value={passportExpiration}
                onChange={(e) => setPassportExpiration(formatMMDDYYYY(e.target.value))}
                placeholder="MM/DD/YYYY"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Date of Last Arrival in the U.S. (MM/DD/YYYY) <span className="text-red-500">*</span>
              </label>
              <Input
                value={lastArrivalDate}
                onChange={(e) => setLastArrivalDate(formatMMDDYYYY(e.target.value))}
                placeholder="MM/DD/YYYY"
                error={validationErrors.lastArrivalDate}
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Place of Last Arrival (City & State or Port of Entry) <span className="text-red-500">*</span>
              </label>
              <Input
                value={lastArrivalPlace}
                onChange={(e) => setLastArrivalPlace(e.target.value)}
                placeholder="SEATTLE"
                error={validationErrors.lastArrivalPlace}
                required
              />
            </div>
            
            <Input
              label="Immigration Status at Last Arrival (e.g., B-2, F-1, H-1B)"
              value={immigrationStatusAtArrival}
              onChange={(e) => setImmigrationStatusAtArrival(e.target.value)}
              placeholder="B-2, F-1, H-1B, etc."
            />
            
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Current Immigration Status <span className="text-red-500">*</span>
              </label>
              <Input
                value={currentImmigrationStatus}
                onChange={(e) => setCurrentImmigrationStatus(e.target.value)}
                error={validationErrors.currentImmigrationStatus}
                placeholder="H4 Non-immigrant"
                required
              />
            </div>
          </div>
        )

      case 8:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Eligibility Category (Part 2)</h2>
            
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                I-765 Eligibility Category <span className="text-red-500">*</span>
              </label>
              <Input
                value={eligibilityCategory}
                onChange={(e) => setEligibilityCategory(e.target.value)}
                error={validationErrors.eligibilityCategory}
                required
              />
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                If your category involves spouse petition (H-1B, I-140, etc.), please provide:
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Receipt Number (Form I-797)
              </label>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                Please add your spouse H1 Receipt Number
              </p>
              <Input
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
                placeholder="IOE0926523168"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Have you EVER been arrested or convicted? (only for certain categories)
              </label>
              <Select
                value="No"
                disabled
                options={[
                  { value: 'No', label: 'No' },
                ]}
              />
            </div>
          </div>
        )

      case 9:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Contact Information (Part 3)</h2>
            
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Phone Number (Daytime) <span className="text-red-500">*</span>
              </label>
              <Input
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                error={validationErrors.phoneNumber}
                required
              />
            </div>
            
            <Input
              label="Mobile Number (optional)"
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
            />
            
            <Input
              label="Email Address (optional)"
              type="email"
              value={emailAddress}
              onChange={(e) => setEmailAddress(e.target.value)}
              error={validationErrors.emailAddress}
            />
          </div>
        )

      case 10:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Interpreter Information (Part 4)</h2>
            
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Can you read and understand English?
              </label>
              <Select
                value="Yes"
                disabled
                options={[
                  { value: 'Yes', label: 'Yes' },
                ]}
              />
            </div>

            {hasInterpreter && (
              <div className="space-y-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Interpreter Details</h3>
                
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={interpreterName}
                    onChange={(e) => setInterpreterName(e.target.value)}
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                    Address <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={interpreterAddress}
                    onChange={(e) => setInterpreterAddress(e.target.value)}
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                    Phone <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={interpreterPhone}
                    onChange={(e) => setInterpreterPhone(e.target.value)}
                    required
                  />
                </div>
                
                <Input
                  label="Email"
                  type="email"
                  value={interpreterEmail}
                  onChange={(e) => setInterpreterEmail(e.target.value)}
                />
                
                <Input
                  label="Signature"
                  value={interpreterSignature}
                  onChange={(e) => setInterpreterSignature(e.target.value)}
                />
                
                <Input
                  label="Signature Date (MM/DD/YYYY)"
                  value={interpreterSignatureDate}
                  onChange={(e) => setInterpreterSignatureDate(formatMMDDYYYY(e.target.value))}
                  placeholder="MM/DD/YYYY"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Do you have a preparer?
              </label>
              <Select
                value="Yes"
                disabled
                options={[
                  { value: 'Yes', label: 'Yes' },
                ]}
              />
            </div>

            <div className="space-y-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
                  ⚠️ This is default. Do not add anything.
                </p>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Preparer Information (Part 5)</h3>
              
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <Input
                  value={preparerName}
                  onChange={(e) => setPreparerName(e.target.value)}
                  disabled
                  required
                />
              </div>
              
              <Input
                label="Business Name"
                value={preparerBusinessName}
                onChange={(e) => setPreparerBusinessName(e.target.value)}
                disabled
              />
              
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                  Address <span className="text-red-500">*</span>
                </label>
                <Input
                  value={preparerAddress}
                  onChange={(e) => setPreparerAddress(e.target.value)}
                  disabled
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                  Phone <span className="text-red-500">*</span>
                </label>
                <Input
                  value={preparerPhone}
                  onChange={(e) => setPreparerPhone(e.target.value)}
                  disabled
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                  Email <span className="text-red-500">*</span>
                </label>
                <Input
                  type="email"
                  value={preparerEmail}
                  onChange={(e) => setPreparerEmail(e.target.value)}
                  disabled
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Attorney or Non-Attorney <span className="text-red-500">*</span>
                </label>
                <Select
                  value={preparerType}
                  onChange={(e) => setPreparerType(e.target.value)}
                  disabled
                  options={[
                    { value: 'Non-Attorney', label: 'Non-Attorney' },
                  ]}
                />
              </div>
              
            </div>
          </div>
        )

      case 11:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Review & Submit</h2>
            
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Please review all information before submitting. Once submitted, you will be able to track your application status.
              </p>
            </div>

            {/* Review Section */}
            <div className="space-y-6">
              {/* Step 1: Reason for Applying */}
              <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Step 1: Reason for Applying</h3>
                <div className="space-y-2 text-sm">
                  <p><span className="font-medium">Reason for Filing:</span> {
                    reasonForFiling === 'initial' ? 'Initial permission to accept employment' :
                    reasonForFiling === 'renewal' ? 'Renewal of employment authorization' :
                    reasonForFiling === 'replacement' ? 'Replacement of lost/stolen/damaged EAD' :
                    reasonForFiling === 'correction' ? 'Correction NOT due to USCIS error' : 'Not provided'
                  }</p>
                  <p><span className="font-medium">Has Attorney:</span> No</p>
                </div>
              </div>

              {/* Step 2: Legal Name */}
              <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Step 2: Legal Name Information</h3>
                <div className="space-y-2 text-sm">
                  <p><span className="font-medium">Name:</span> {firstName} {middleName} {lastName}</p>
                  {maidenName && <p><span className="font-medium">Maiden Name:</span> {maidenName}</p>}
                  {aliases && <p><span className="font-medium">Aliases:</span> {aliases}</p>}
                  {previousLegalNames && <p><span className="font-medium">Previous Legal Names:</span> {previousLegalNames}</p>}
                </div>
              </div>

              {/* Step 3: Address */}
              <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Step 3: Address Information</h3>
                <div className="space-y-2 text-sm">
                  <p><span className="font-medium">Mailing Address:</span> {streetAddress} {apartmentSuite && `, ${apartmentSuite}`}, {city}, {state} {zipCode}</p>
                  <p><span className="font-medium">Physical Address Same:</span> {physicalAddressSame || 'Not provided'}</p>
                </div>
              </div>

              {/* Step 4: Personal Information */}
              <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Step 4: Personal Information</h3>
                <div className="space-y-2 text-sm">
                  <p><span className="font-medium">Sex:</span> {sex}</p>
                  <p><span className="font-medium">Marital Status:</span> {maritalStatus}</p>
                  <p><span className="font-medium">Date of Birth:</span> {dateOfBirth}</p>
                  <p><span className="font-medium">Place of Birth:</span> {birthCity}, {birthState} {birthCountry}</p>
                  <p><span className="font-medium">Citizenship:</span> {citizenshipCountries.join(', ') || 'Not provided'}</p>
                </div>
              </div>

              {/* Step 5: Social Security */}
              <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Step 5: Social Security Information</h3>
                <div className="space-y-2 text-sm">
                  <p><span className="font-medium">Has SSN:</span> {hasSSN}</p>
                  {hasSSN === 'Yes' && <p><span className="font-medium">SSN:</span> {ssn}</p>}
                  <p><span className="font-medium">Want SSN Card:</span> {wantSSNCard}</p>
                  <p><span className="font-medium">Consent SSA Disclosure:</span> {consentSSADisclosure}</p>
                </div>
              </div>

              {/* Step 6: Parents */}
              <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Step 6: Parents' Information</h3>
                <div className="space-y-2 text-sm">
                  <p><span className="font-medium">Father:</span> {fatherFirstName} {fatherLastName || 'Not provided'}</p>
                  <p><span className="font-medium">Mother:</span> {motherFirstName} {motherLastName || 'Not provided'}</p>
                </div>
              </div>

              {/* Step 7: Immigration */}
              <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Step 7: Immigration & Arrival Information</h3>
                <div className="space-y-2 text-sm">
                  <p><span className="font-medium">A-Number:</span> {aNumber || 'Not provided'}</p>
                  <p><span className="font-medium">USCIS Online Account Number:</span> {uscisAccountNumber}</p>
                  <p><span className="font-medium">I-94 Number:</span> {i94Number || 'Not provided'}</p>
                  <p><span className="font-medium">Last Arrival Date:</span> {lastArrivalDate}</p>
                  <p><span className="font-medium">Last Arrival Place:</span> {lastArrivalPlace}</p>
                  <p><span className="font-medium">Current Immigration Status:</span> {currentImmigrationStatus}</p>
                </div>
              </div>

              {/* Step 8: Eligibility */}
              <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Step 8: Eligibility Category</h3>
                <div className="space-y-2 text-sm">
                  <p><span className="font-medium">Eligibility Category:</span> {eligibilityCategory}</p>
                  {receiptNumber && <p><span className="font-medium">Receipt Number:</span> {receiptNumber}</p>}
                  <p><span className="font-medium">Criminal History:</span> {hasCriminalHistory || 'Not provided'}</p>
                </div>
              </div>

              {/* Step 9: Contact */}
              <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Step 9: Contact Information</h3>
                <div className="space-y-2 text-sm">
                  <p><span className="font-medium">Phone:</span> {phoneNumber}</p>
                  {mobileNumber && <p><span className="font-medium">Mobile:</span> {mobileNumber}</p>}
                  {emailAddress && <p><span className="font-medium">Email:</span> {emailAddress}</p>}
                </div>
              </div>

              {/* Step 10: Interpreter & Preparer */}
              <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Step 10: Interpreter & Preparer Information</h3>
                <div className="space-y-2 text-sm">
                  <p><span className="font-medium">Can Read English:</span> Yes</p>
                  <p><span className="font-medium">Has Preparer:</span> Yes</p>
                  <p><span className="font-medium">Preparer Name:</span> {preparerName}</p>
                  <p><span className="font-medium">Preparer Type:</span> {preparerType}</p>
                </div>
              </div>

            </div>

            {/* Digital Signature */}
            <div className="mt-6 p-4 border-2 border-primary-300 dark:border-primary-700 rounded-lg bg-primary-50/50 dark:bg-primary-900/10">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Digital Signature (Type your full name) <span className="text-red-500">*</span>
                </label>
                <div className="mb-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Expected: </span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {firstName && lastName 
                      ? `${firstName} ${middleName ? middleName + ' ' : ''}${lastName}`.trim()
                      : 'Your full legal name (First Name Middle Name Last Name)'
                    }
                  </span>
                </div>
                <Input
                  value={digitalSignature}
                  onChange={(e) => setDigitalSignature(e.target.value)}
                  error={validationErrors.digitalSignature}
                  placeholder="Enter your full name to sign this application"
                  required
                />
                <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                  By typing your full name, you are electronically signing this application and certifying that all information is true and correct.
                </p>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6 lg:p-8">
          <div className="max-w-4xl mx-auto">
            <div className="mb-8">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <Button
                    variant="ghost"
                    onClick={() => navigate('/application/new')}
                    className="flex items-center gap-2"
                  >
                    <ChevronLeft className="w-5 h-5" />
                    Back
                  </Button>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                    EAD Application (Form I-765)
                  </h1>
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-lg font-medium">
                  Step {currentStep} of {totalSteps}
                </p>
              </div>
              
              {/* Progress Bar with Step Indicators */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-4">
                  {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => {
                    const isCompleted = isStepCompleted(step)
                    const isCurrent = currentStep === step
                    const stepNames = [
                      'Reason',
                      'Legal Name',
                      'Address',
                      'Personal',
                      'SSN',
                      'Parents',
                      'Immigration',
                      'Eligibility',
                      'Contact',
                      'Interpreter',
                      'Review'
                    ]
                    
                    return (
                      <div key={step} className="flex items-center flex-1">
                        <div className="flex flex-col items-center flex-1">
                          <button
                            type="button"
                            onClick={() => handleStepClick(step)}
                            className={`
                              w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm
                              transition-all duration-200 cursor-pointer
                              ${isCurrent 
                                ? 'bg-primary-600 text-white ring-4 ring-primary-200 dark:ring-primary-800 scale-110' 
                                : isCompleted
                                ? 'bg-green-500 text-white hover:bg-green-600'
                                : 'bg-red-500 text-white hover:bg-red-600'
                              }
                            `}
                            title={`Step ${step}: ${stepNames[step - 1]}`}
                          >
                            {step}
                          </button>
                          <span className={`text-xs mt-2 text-center max-w-[60px] ${isCurrent ? 'font-semibold text-primary-600 dark:text-primary-400' : 'text-gray-600 dark:text-gray-400'}`}>
                            {stepNames[step - 1]}
                          </span>
                        </div>
                        {step < totalSteps && (
                          <div className={`
                            flex-1 h-1 mx-2 transition-colors duration-200
                            ${isCompleted ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-700'}
                          `} />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <Card>
              {renderStepContent()}
            </Card>

            <div className="flex justify-between items-center mt-6">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStep === 1}
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Previous
              </Button>

              <div className="flex gap-2">
                {currentStep < totalSteps ? (
                  <Button onClick={handleNext} disabled={saving || loading}>
                    {saving ? 'Saving...' : 'Save and Next'}
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button onClick={handleSubmit} disabled={loading || saving}>
                    {loading ? 'Submitting...' : 'Submit Application'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

