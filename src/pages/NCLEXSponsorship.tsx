import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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
import { sponsorshipsAPI, userDocumentsAPI } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { SEO, generateBreadcrumbSchema, generateServiceSchema } from '@/components/SEO'
import { CheckCircle, Upload, FileText, AlertCircle, ArrowLeft } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'

export function NCLEXSponsorship() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  // Form fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [mobileNumber, setMobileNumber] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [country, setCountry] = useState('')
  const [nursingSchool, setNursingSchool] = useState('')
  const [graduationDate, setGraduationDate] = useState('')
  const [currentEmploymentStatus, setCurrentEmploymentStatus] = useState('')
  const [yearsOfExperience, setYearsOfExperience] = useState('')
  const [financialNeedDescription, setFinancialNeedDescription] = useState('')
  const [motivationStatement, setMotivationStatement] = useState('')
  const [howWillThisHelp, setHowWillThisHelp] = useState('')

  // File uploads
  const [resume, setResume] = useState<File | null>(null)
  const [transcript, setTranscript] = useState<File | null>(null)
  const [recommendationLetter, setRecommendationLetter] = useState<File | null>(null)
  const [uploadingFiles, setUploadingFiles] = useState(false)

  // View file modal
  const [viewingFile, setViewingFile] = useState<{ url: string; fileName: string; isImage: boolean } | null>(null)

  // Load user details if logged in
  useEffect(() => {
    if (user) {
      setEmail(user.email || '')
      // Try to load user details from user_details table
      const loadUserDetails = async () => {
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
      loadUserDetails()
    }
  }, [user])

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
    if (!financialNeedDescription.trim()) errors.financialNeedDescription = 'Financial need description is required'
    if (!motivationStatement.trim()) errors.motivationStatement = 'Motivation statement is required'

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleFileUpload = async (file: File, type: 'resume' | 'transcript' | 'recommendation_letter'): Promise<string | null> => {
    // For anonymous users, file uploads are not available
    // They can still submit the application without files
    if (!user) {
      showToast('File uploads are only available for logged-in users. You can still submit your application without files.', 'info')
      return null
    }

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `sponsorship_${type}_${Date.now()}.${fileExt}`
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
      let transcriptPath: string | null = null
      let recommendationLetterPath: string | null = null

      if (resume) {
        resumePath = await handleFileUpload(resume, 'resume')
        if (!resumePath) {
          setLoading(false)
          setUploadingFiles(false)
          return
        }
      }

      if (transcript) {
        transcriptPath = await handleFileUpload(transcript, 'transcript')
        if (!transcriptPath) {
          setLoading(false)
          setUploadingFiles(false)
          return
        }
      }

      if (recommendationLetter) {
        recommendationLetterPath = await handleFileUpload(recommendationLetter, 'recommendation_letter')
        if (!recommendationLetterPath) {
          setLoading(false)
          setUploadingFiles(false)
          return
        }
      }

      setUploadingFiles(false)

      // Create sponsorship application
      const sponsorshipData = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        mobile_number: mobileNumber.trim(),
        date_of_birth: dateOfBirth.trim() || null,
        country: country.trim() || null,
        nursing_school: nursingSchool.trim() || null,
        graduation_date: graduationDate.trim() || null,
        current_employment_status: currentEmploymentStatus.trim() || null,
        years_of_experience: yearsOfExperience.trim() || null,
        financial_need_description: financialNeedDescription.trim(),
        motivation_statement: motivationStatement.trim(),
        how_will_this_help: howWillThisHelp.trim() || null,
        resume_path: resumePath,
        transcript_path: transcriptPath,
        recommendation_letter_path: recommendationLetterPath,
      }

      await sponsorshipsAPI.create(sponsorshipData)

      showToast('Sponsorship application submitted successfully! We will review your application and get back to you soon.', 'success')
      
      // Redirect based on authentication status
      if (user) {
        navigate('/dashboard')
      } else {
        // For anonymous users, redirect to home or show a thank you message
        navigate('/')
      }
    } catch (err: any) {
      console.error('Error submitting sponsorship:', err)
      setError(err.message || 'Failed to submit sponsorship application')
      showToast(err.message || 'Failed to submit sponsorship application', 'error')
    } finally {
      setLoading(false)
      setUploadingFiles(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'resume' | 'transcript' | 'recommendation_letter') => {
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
    else if (type === 'transcript') setTranscript(file)
    else if (type === 'recommendation_letter') setRecommendationLetter(file)

    e.target.value = ''
  }

  const getFilePreview = (file: File | null): string | null => {
    if (!file) return null
    if (file.type.startsWith('image/')) {
      return URL.createObjectURL(file)
    }
    return null
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const currentUrl = typeof window !== 'undefined' ? window.location.href : ''
  const breadcrumbs = [
    { name: 'Home', url: baseUrl },
    { name: 'NCLEX Sponsorship', url: currentUrl },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <SEO
        title="NCLEX Sponsorship Application - Apply for Financial Support | GritSync"
        description="Apply for NCLEX sponsorship to receive financial support for your NCLEX exam. GritSync helps eligible nurses get the funding they need to become licensed nurses in the United States."
        keywords="NCLEX sponsorship, NCLEX financial aid, nursing sponsorship, NCLEX funding, nursing financial support, NCLEX assistance"
        canonicalUrl={currentUrl}
        ogTitle="NCLEX Sponsorship Application - Apply for Financial Support | GritSync"
        ogDescription="Apply for NCLEX sponsorship to receive financial support for your NCLEX exam. Get the funding you need to become a licensed nurse."
        ogImage={`${baseUrl}/gritsync_logo.png`}
        ogUrl={currentUrl}
        structuredData={[
          generateBreadcrumbSchema(breadcrumbs),
          generateServiceSchema('NCLEX Sponsorship', 'Financial support for NCLEX exam fees to help nurses become licensed in the United States'),
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
                  <FileText className="h-4 w-4" />
                  <span>Financial Support</span>
                </div>
                <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900 dark:text-gray-100">
                  NCLEX Sponsorship Application
                </h1>
                <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto">
                  Apply for sponsorship to help fund your USRN dreams. Get financial support for your NCLEX exam and take the next step in your nursing career.
                </p>
              </div>
            </div>
          </section>

          {/* Content Section */}
          <div className={`p-6 md:p-8 lg:p-10 max-w-5xl mx-auto w-full ${!user ? 'mx-auto' : ''}`}>
            {/* Back Button */}
            <div className="mb-6">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/sponsorship')}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Sponsorship Information
              </Button>
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
                <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Education & Experience</h2>
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
                </div>
              </div>
            </Card>

            <Card className="mb-6">
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Application Details</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      Financial Need Description <span className="text-red-500">*</span>
                    </label>
                    <Textarea
                      value={financialNeedDescription}
                      onChange={(e) => setFinancialNeedDescription(e.target.value)}
                      placeholder="Describe your financial situation and why you need sponsorship..."
                      rows={5}
                      className={validationErrors.financialNeedDescription ? 'border-red-500' : ''}
                    />
                    {validationErrors.financialNeedDescription && (
                      <p className="text-red-500 text-sm mt-1">{validationErrors.financialNeedDescription}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      Motivation Statement <span className="text-red-500">*</span>
                    </label>
                    <Textarea
                      value={motivationStatement}
                      onChange={(e) => setMotivationStatement(e.target.value)}
                      placeholder="Tell us why you want to become a USRN and how this sponsorship will help you achieve your goals..."
                      rows={5}
                      className={validationErrors.motivationStatement ? 'border-red-500' : ''}
                    />
                    {validationErrors.motivationStatement && (
                      <p className="text-red-500 text-sm mt-1">{validationErrors.motivationStatement}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      How Will This Help You? (Optional)
                    </label>
                    <Textarea
                      value={howWillThisHelp}
                      onChange={(e) => setHowWillThisHelp(e.target.value)}
                      placeholder="Explain how receiving this sponsorship will impact your journey..."
                      rows={4}
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
                      Transcript
                    </label>
                    <div className="flex items-center gap-4">
                      <label className={`flex-1 cursor-pointer ${!user ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                          onChange={(e) => handleFileChange(e, 'transcript')}
                          className="hidden"
                          disabled={!user}
                        />
                        <div className={`flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg ${user ? 'hover:bg-gray-50 dark:hover:bg-gray-800' : ''}`}>
                          <Upload className="h-4 w-4" />
                          <span className="text-sm">{transcript ? transcript.name : 'Upload Transcript'}</span>
                        </div>
                      </label>
                      {transcript && (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      Recommendation Letter
                    </label>
                    <div className="flex items-center gap-4">
                      <label className={`flex-1 cursor-pointer ${!user ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                          onChange={(e) => handleFileChange(e, 'recommendation_letter')}
                          className="hidden"
                          disabled={!user}
                        />
                        <div className={`flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg ${user ? 'hover:bg-gray-50 dark:hover:bg-gray-800' : ''}`}>
                          <Upload className="h-4 w-4" />
                          <span className="text-sm">{recommendationLetter ? recommendationLetter.name : 'Upload Recommendation Letter'}</span>
                        </div>
                      </label>
                      {recommendationLetter && (
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
          </div>
        </main>
      </div>
      <Footer />
    </div>
  )
}

