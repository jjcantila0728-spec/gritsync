import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { Sidebar } from '@/components/Sidebar'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { careerApplicationsAPI, partnerAgenciesAPI, careersAPI } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { SEO, generateBreadcrumbSchema, generateServiceSchema } from '@/components/SEO'
import { CheckCircle, Upload, AlertCircle, ArrowLeft, Users, Briefcase } from 'lucide-react'

export function Career() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const careerId = searchParams.get('careerId')
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [loadingCareer, setLoadingCareer] = useState(false)
  const [error, setError] = useState('')
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [partnerAgencies, setPartnerAgencies] = useState<any[]>([])
  const [career, setCareer] = useState<any>(null)

  // Form fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [mobileNumber, setMobileNumber] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [country, setCountry] = useState('')
  const [nursingSchool, setNursingSchool] = useState('')
  const [graduationDate, setGraduationDate] = useState('')
  const [yearsOfExperience, setYearsOfExperience] = useState('')
  const [currentEmploymentStatus, setCurrentEmploymentStatus] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [licenseState, setLicenseState] = useState('')

  // File uploads
  const [resume, setResume] = useState<File | null>(null)
  const [coverLetter, setCoverLetter] = useState<File | null>(null)
  const [additionalDocuments, setAdditionalDocuments] = useState<File | null>(null)
  const [uploadingFiles, setUploadingFiles] = useState(false)

  // Load career details, partner agencies and user details
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load career if careerId is provided
        if (careerId) {
          setLoadingCareer(true)
          try {
            const careerData = await careersAPI.getById(careerId)
            setCareer(careerData)
          } catch (error: any) {
            showToast('Career not found', 'error')
            navigate('/career')
          } finally {
            setLoadingCareer(false)
          }
        }

        const agencies = await partnerAgenciesAPI.getAll(true)
        setPartnerAgencies(agencies)
      } catch (error) {
        console.error('Error loading data:', error)
      }

      if (user) {
        setEmail(user.email || '')
        // Try to load user details from user_details table
        try {
          const { data } = await supabase
            .from('user_details')
            .select('first_name, last_name, mobile_number, date_of_birth, country')
            .eq('user_id', user.id)
            .single()
          
          if (data) {
            if (data.first_name) setFirstName(data.first_name)
            if (data.last_name) setLastName(data.last_name)
            if (data.mobile_number) setMobileNumber(data.mobile_number)
            if (data.date_of_birth) setDateOfBirth(data.date_of_birth)
            if (data.country) setCountry(data.country)
          }
        } catch (error) {
          // Ignore errors
        }
      }
    }
    loadData()
  }, [user, careerId, navigate, showToast])

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!firstName.trim()) errors.firstName = 'First name is required'
    if (!lastName.trim()) errors.lastName = 'Last name is required'
    if (!email.trim()) {
      errors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Invalid email format'
    }
    if (!mobileNumber.trim()) errors.mobileNumber = 'Mobile number is required'

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleFileUpload = async (file: File, type: 'resume' | 'cover_letter' | 'additional_documents'): Promise<string | null> => {
    if (!user) {
      showToast('File uploads are only available for logged-in users. You can still submit your application without files.', 'info')
      return null
    }

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `career_${type}_${Date.now()}.${fileExt}`
      const filePath = `${user.id}/${fileName}`

      const { error } = await supabase.storage
        .from('documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (error) throw new Error(error.message)
      return filePath
    } catch (error: any) {
      showToast(`Failed to upload ${type}: ${error.message}`, 'error')
      return null
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      showToast('Please fix the errors in the form', 'error')
      return
    }

    setLoading(true)
    setError('')

    try {
      setUploadingFiles(true)

      // Upload files if provided
      let resumePath: string | null = null
      let coverLetterPath: string | null = null
      let additionalDocumentsPath: string | null = null

      if (resume) {
        resumePath = await handleFileUpload(resume, 'resume')
        if (!resumePath && user) {
          setLoading(false)
          setUploadingFiles(false)
          return
        }
      }

      if (coverLetter) {
        coverLetterPath = await handleFileUpload(coverLetter, 'cover_letter')
        if (!coverLetterPath && user) {
          setLoading(false)
          setUploadingFiles(false)
          return
        }
      }

      if (additionalDocuments) {
        additionalDocumentsPath = await handleFileUpload(additionalDocuments, 'additional_documents')
        if (!additionalDocumentsPath && user) {
          setLoading(false)
          setUploadingFiles(false)
          return
        }
      }

      setUploadingFiles(false)

      // Create career application
      const applicationData = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        mobile_number: mobileNumber.trim(),
        date_of_birth: dateOfBirth.trim() || null,
        country: country.trim() || null,
        nursing_school: nursingSchool.trim() || null,
        graduation_date: graduationDate.trim() || null,
        years_of_experience: yearsOfExperience.trim() || null,
        current_employment_status: currentEmploymentStatus.trim() || null,
        license_number: licenseNumber.trim() || null,
        license_state: licenseState.trim() || null,
        resume_path: resumePath,
        cover_letter_path: coverLetterPath,
        additional_documents_path: additionalDocumentsPath,
        career_id: careerId || null,
        partner_agency_id: career?.partner_agency_id || null,
      }

      await careerApplicationsAPI.create(applicationData)

      showToast('Career application submitted successfully! GritSync will automatically forward your application to our partner agencies in the USA.', 'success')
      
      // Redirect based on authentication status
      if (user) {
        navigate('/dashboard')
      } else {
        navigate('/')
      }
    } catch (err: any) {
      console.error('Error submitting career application:', err)
      setError(err.message || 'Failed to submit career application')
      showToast(err.message || 'Failed to submit career application', 'error')
    } finally {
      setLoading(false)
      setUploadingFiles(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'resume' | 'cover_letter' | 'additional_documents') => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      showToast('File size must be less than 10MB', 'error')
      e.target.value = ''
      return
    }

    // Validate file type
    const validTypes = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png']
    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!validTypes.includes(fileExt)) {
      showToast('Invalid file type. Accepted: PDF, DOC, DOCX, JPG, PNG', 'error')
      e.target.value = ''
      return
    }

    if (type === 'resume') setResume(file)
    else if (type === 'cover_letter') setCoverLetter(file)
    else if (type === 'additional_documents') setAdditionalDocuments(file)

    e.target.value = ''
  }

  const usStates = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
  ]

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const currentUrl = typeof window !== 'undefined' ? window.location.href : ''
  const breadcrumbs = [
    { name: 'Home', url: baseUrl },
    { name: 'Career', url: currentUrl },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <SEO
        title="Career Opportunities - Join GritSync | NCLEX Processing Agency"
        description="Explore career opportunities with GritSync. Join our team of healthcare professionals helping nurses navigate the NCLEX process. Apply for nursing positions and support roles."
        keywords="career, jobs, nursing jobs, healthcare careers, NCLEX agency jobs, nursing positions, healthcare employment"
        canonicalUrl={currentUrl}
        ogTitle="Career Opportunities - Join GritSync | NCLEX Processing Agency"
        ogDescription="Explore career opportunities with GritSync. Join our team of healthcare professionals helping nurses navigate the NCLEX process."
        ogImage={`${baseUrl}/gritsync_logo.png`}
        ogUrl={currentUrl}
        structuredData={[
          generateBreadcrumbSchema(breadcrumbs),
          generateServiceSchema('Career Application', 'Apply for career opportunities with GritSync'),
          {
            '@context': 'https://schema.org',
            '@type': 'JobPosting',
            title: 'Nursing Career Opportunities',
            description: 'Join GritSync and help nurses navigate the NCLEX process to become licensed nurses in the United States.',
            hiringOrganization: {
              '@type': 'Organization',
              name: 'GritSync',
            },
          },
        ]}
      />
      <Header />
      <div className="flex">
        {user && <Sidebar />}
        <main className="flex-1">
          {/* Banner Section */}
          <section className="relative overflow-hidden bg-gradient-to-br from-primary-50 via-white to-primary-50 dark:from-gray-900 dark:via-gray-900 dark:to-primary-900/20">
            <div className="container mx-auto px-4 py-12 md:py-16">
              <div className="max-w-4xl mx-auto text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-sm font-medium mb-6">
                  <Users className="h-4 w-4" />
                  <span>Join Our Team</span>
                </div>
                <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900 dark:text-gray-100">
                  {career ? `Apply for ${career.title}` : 'Career Application'}
                </h1>
                <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto">
                  {career 
                    ? career.description.substring(0, 150) + '...'
                    : "Apply directly to GritSync. We'll automatically forward your application to our partner agencies in the USA. Join our team and help nurses achieve their USRN dreams."}
                </p>
              </div>
            </div>
          </section>

          {/* Content Section */}
          <div className={`p-6 md:p-8 lg:p-10 max-w-5xl mx-auto w-full ${!user ? 'mx-auto' : ''}`}>
            {loadingCareer ? (
              <Card className="p-6 mb-6">
                <p className="text-gray-600 dark:text-gray-400">Loading career details...</p>
              </Card>
            ) : career ? (
              <Card className="p-6 mb-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-semibold mb-2 text-gray-900 dark:text-gray-100">{career.title}</h2>
                    {career.location && (
                      <p className="text-gray-600 dark:text-gray-400 flex items-center gap-2">
                        <Briefcase className="h-4 w-4" />
                        {career.location}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/career')}
                    className="flex items-center gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Listings
                  </Button>
                </div>
                <div className="prose dark:prose-invert max-w-none">
                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line">{career.description}</p>
                  {career.requirements && (
                    <div className="mt-4">
                      <h3 className="font-semibold mb-2 text-gray-900 dark:text-gray-100">Requirements</h3>
                      <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line">{career.requirements}</p>
                    </div>
                  )}
                  {career.responsibilities && (
                    <div className="mt-4">
                      <h3 className="font-semibold mb-2 text-gray-900 dark:text-gray-100">Responsibilities</h3>
                      <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line">{career.responsibilities}</p>
                    </div>
                  )}
                </div>
              </Card>
            ) : null}
            {partnerAgencies.length > 0 && !career && (
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                Partner agencies: {partnerAgencies.map(a => a.name).join(', ')}
              </p>
            )}
          </div>

          {error && (
            <Card className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertCircle className="h-5 w-5" />
                <span>{error}</span>
              </div>
            </Card>
          )}

          <form onSubmit={handleSubmit}>
            <Card className="mb-6">
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Personal Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Enter your first name"
                      className={validationErrors.firstName ? 'border-red-500' : ''}
                    />
                    {validationErrors.firstName && (
                      <p className="text-red-500 text-sm mt-1">{validationErrors.firstName}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      Last Name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Enter your last name"
                      className={validationErrors.lastName ? 'border-red-500' : ''}
                    />
                    {validationErrors.lastName && (
                      <p className="text-red-500 text-sm mt-1">{validationErrors.lastName}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      className={validationErrors.email ? 'border-red-500' : ''}
                    />
                    {validationErrors.email && (
                      <p className="text-red-500 text-sm mt-1">{validationErrors.email}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      Mobile Number <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      placeholder="Enter your mobile number"
                      className={validationErrors.mobileNumber ? 'border-red-500' : ''}
                    />
                    {validationErrors.mobileNumber && (
                      <p className="text-red-500 text-sm mt-1">{validationErrors.mobileNumber}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      Date of Birth
                    </label>
                    <Input
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      Country
                    </label>
                    <Input
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="Enter your country"
                    />
                  </div>
                </div>
              </div>
            </Card>

            <Card className="mb-6">
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Professional Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      Nursing School
                    </label>
                    <Input
                      value={nursingSchool}
                      onChange={(e) => setNursingSchool(e.target.value)}
                      placeholder="Enter your nursing school"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      Graduation Date
                    </label>
                    <Input
                      type="date"
                      value={graduationDate}
                      onChange={(e) => setGraduationDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      Years of Experience
                    </label>
                    <Input
                      type="number"
                      min="0"
                      value={yearsOfExperience}
                      onChange={(e) => setYearsOfExperience(e.target.value)}
                      placeholder="Enter years of experience"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      Current Employment Status
                    </label>
                    <Select
                      value={currentEmploymentStatus}
                      onChange={(e) => setCurrentEmploymentStatus(e.target.value)}
                      options={[
                        { value: '', label: 'Select status' },
                        { value: 'employed', label: 'Employed' },
                        { value: 'unemployed', label: 'Unemployed' },
                        { value: 'student', label: 'Student' },
                        { value: 'self-employed', label: 'Self-Employed' },
                      ]}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      License Number
                    </label>
                    <Input
                      value={licenseNumber}
                      onChange={(e) => setLicenseNumber(e.target.value)}
                      placeholder="Enter your license number"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      License State
                    </label>
                    <Select
                      value={licenseState}
                      onChange={(e) => setLicenseState(e.target.value)}
                      options={[
                        { value: '', label: 'Select state' },
                        ...usStates.map(state => ({ value: state, label: state }))
                      ]}
                    />
                  </div>
                </div>
              </div>
            </Card>

            <Card className="mb-6">
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
                  Supporting Documents (Optional)
                  {!user && (
                    <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                      (File uploads available for logged-in users only)
                    </span>
                  )}
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      Resume/CV
                    </label>
                    <div className="flex items-center gap-4">
                      <label className={`flex-1 cursor-pointer ${!user ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                          onChange={(e) => handleFileChange(e, 'resume')}
                          className="hidden"
                          disabled={!user}
                        />
                        <div className={`flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg ${user ? 'hover:bg-gray-50 dark:hover:bg-gray-800' : ''}`}>
                          <Upload className="h-4 w-4" />
                          <span className="text-sm">{resume ? resume.name : 'Upload Resume'}</span>
                        </div>
                      </label>
                      {resume && (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      Cover Letter
                    </label>
                    <div className="flex items-center gap-4">
                      <label className={`flex-1 cursor-pointer ${!user ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                          onChange={(e) => handleFileChange(e, 'cover_letter')}
                          className="hidden"
                          disabled={!user}
                        />
                        <div className={`flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg ${user ? 'hover:bg-gray-50 dark:hover:bg-gray-800' : ''}`}>
                          <Upload className="h-4 w-4" />
                          <span className="text-sm">{coverLetter ? coverLetter.name : 'Upload Cover Letter'}</span>
                        </div>
                      </label>
                      {coverLetter && (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      Additional Documents
                    </label>
                    <div className="flex items-center gap-4">
                      <label className={`flex-1 cursor-pointer ${!user ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                          onChange={(e) => handleFileChange(e, 'additional_documents')}
                          className="hidden"
                          disabled={!user}
                        />
                        <div className={`flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg ${user ? 'hover:bg-gray-50 dark:hover:bg-gray-800' : ''}`}>
                          <Upload className="h-4 w-4" />
                          <span className="text-sm">{additionalDocuments ? additionalDocuments.name : 'Upload Additional Documents'}</span>
                        </div>
                      </label>
                      {additionalDocuments && (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(user ? '/dashboard' : '/')}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || uploadingFiles}
                className="flex-1"
              >
                {loading || uploadingFiles ? 'Submitting...' : 'Submit Application'}
              </Button>
            </div>
          </form>
        </main>
      </div>
      <Footer />
    </div>
  )
}

