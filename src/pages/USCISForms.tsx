import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { Input } from '../components/Input'
import { Select } from '../components/Select'
import { Loading } from '../components/Loading'
import { FileText, Download, Upload, AlertCircle, CheckCircle } from 'lucide-react'
import { 
  generateG1145, 
  generateI765, 
  downloadForm, 
  uploadGeneratedForm,
  getFormDataFromApplication,
  type USCISFormData 
} from '../lib/api/uscis-forms'
import { showToast } from '../lib/toast'

export function USCISForms() {
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const applicationId = searchParams.get('applicationId')

  const [loading, setLoading] = useState(false)
  const [loadingForm, setLoadingForm] = useState(false)
  const [selectedForm, setSelectedForm] = useState<'G-1145' | 'I-765' | null>(null)
  const [formData, setFormData] = useState<USCISFormData>({
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    mobileNumber: '',
    address: '',
    city: '',
    state: '',
    zipcode: '',
    country: 'United States',
    dateOfBirth: '',
    gender: '',
    maritalStatus: '',
  })
  const [generatedBlob, setGeneratedBlob] = useState<Blob | null>(null)
  const [uploadedPath, setUploadedPath] = useState<string | null>(null)

  // Load form data from application if provided
  useEffect(() => {
    if (applicationId) {
      loadApplicationData()
    }
  }, [applicationId])

  async function loadApplicationData() {
    try {
      setLoading(true)
      const data = await getFormDataFromApplication(applicationId!)
      setFormData(data)
      showToast('Application data loaded successfully', 'success')
    } catch (error: any) {
      showToast(error.message || 'Failed to load application data', 'error')
    } finally {
      setLoading(false)
    }
  }

  function handleInputChange(field: keyof USCISFormData, value: string) {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  async function handleGenerateForm(formType: 'G-1145' | 'I-765') {
    try {
      setLoadingForm(true)
      setSelectedForm(formType)
      setGeneratedBlob(null)
      setUploadedPath(null)

      // Validate required fields
      if (!formData.firstName || !formData.lastName) {
        showToast('First name and last name are required', 'error')
        return
      }

      if (formType === 'G-1145' && !formData.email && !formData.mobileNumber) {
        showToast('Email or mobile number is required for G-1145', 'error')
        return
      }

      // Generate the form
      const blob = formType === 'G-1145' 
        ? await generateG1145(formData)
        : await generateI765(formData)

      setGeneratedBlob(blob)
      showToast(`${formType} generated successfully!`, 'success')
    } catch (error: any) {
      showToast(error.message || 'Failed to generate form', 'error')
    } finally {
      setLoadingForm(false)
    }
  }

  async function handleDownload() {
    if (!generatedBlob || !selectedForm) return

    const clientName = `${formData.firstName}_${formData.lastName}`.replace(/[^a-zA-Z0-9_]/g, '_')
    const dateStr = new Date().toISOString().split('T')[0]
    const fileName = `${selectedForm}_${clientName}_${dateStr}.pdf`

    downloadForm(generatedBlob, fileName)
    showToast('Form downloaded successfully', 'success')
  }

  async function handleUpload() {
    if (!generatedBlob || !selectedForm || !user) return

    try {
      setLoading(true)
      const clientName = `${formData.firstName}_${formData.lastName}`.replace(/[^a-zA-Z0-9_]/g, '_')
      const dateStr = new Date().toISOString().split('T')[0]
      const fileName = `${selectedForm}_${clientName}_${dateStr}.pdf`

      const path = await uploadGeneratedForm(generatedBlob, fileName, user.id)
      setUploadedPath(path)
      showToast('Form uploaded to your documents successfully', 'success')
    } catch (error: any) {
      showToast(error.message || 'Failed to upload form', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    navigate('/login')
    return null
  }

  if (loading && applicationId) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Loading />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            USCIS Forms Generator
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Generate and auto-fill official USCIS forms with your information
          </p>
        </div>

        {/* Form Selection */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-red-500">
            <div className="flex flex-col items-center text-center p-6">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Form G-1145
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                E-Notification of Application/Petition Acceptance
              </p>
              <Button
                onClick={() => handleGenerateForm('G-1145')}
                disabled={loadingForm}
                className="w-full"
              >
                {loadingForm && selectedForm === 'G-1145' ? 'Generating...' : 'Generate G-1145'}
              </Button>
            </div>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-red-500">
            <div className="flex flex-col items-center text-center p-6">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Form I-765
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Application for Employment Authorization
              </p>
              <Button
                onClick={() => handleGenerateForm('I-765')}
                disabled={loadingForm}
                className="w-full"
              >
                {loadingForm && selectedForm === 'I-765' ? 'Generating...' : 'Generate I-765'}
              </Button>
            </div>
          </Card>
        </div>

        {/* Form Data Input */}
        <Card className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
            Your Information
          </h2>

          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <Input
              label="First Name *"
              value={formData.firstName || ''}
              onChange={(e) => handleInputChange('firstName', e.target.value)}
              placeholder="John"
            />
            <Input
              label="Middle Name"
              value={formData.middleName || ''}
              onChange={(e) => handleInputChange('middleName', e.target.value)}
              placeholder="Michael"
            />
            <Input
              label="Last Name *"
              value={formData.lastName || ''}
              onChange={(e) => handleInputChange('lastName', e.target.value)}
              placeholder="Doe"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <Input
              label="Email Address"
              type="email"
              value={formData.email || ''}
              onChange={(e) => handleInputChange('email', e.target.value)}
              placeholder="john.doe@example.com"
            />
            <Input
              label="Mobile Number"
              type="tel"
              value={formData.mobileNumber || ''}
              onChange={(e) => handleInputChange('mobileNumber', e.target.value)}
              placeholder="+1 (555) 123-4567"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <Input
              label="Street Address"
              value={formData.address || ''}
              onChange={(e) => handleInputChange('address', e.target.value)}
              placeholder="123 Main St, Apt 4B"
            />
            <Input
              label="City"
              value={formData.city || ''}
              onChange={(e) => handleInputChange('city', e.target.value)}
              placeholder="New York"
            />
          </div>

          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <Input
              label="State/Province"
              value={formData.state || formData.province || ''}
              onChange={(e) => {
                handleInputChange('state', e.target.value)
                handleInputChange('province', e.target.value)
              }}
              placeholder="NY"
            />
            <Input
              label="ZIP/Postal Code"
              value={formData.zipcode || ''}
              onChange={(e) => handleInputChange('zipcode', e.target.value)}
              placeholder="10001"
            />
            <Input
              label="Country"
              value={formData.country || ''}
              onChange={(e) => handleInputChange('country', e.target.value)}
              placeholder="United States"
            />
          </div>

          {/* Additional I-765 fields */}
          <details className="mt-6">
            <summary className="cursor-pointer text-red-600 dark:text-red-400 font-medium mb-4">
              Additional Information (for I-765)
            </summary>
            
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <Input
                label="Date of Birth"
                type="date"
                value={formData.dateOfBirth || ''}
                onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
              />
              <Select
                label="Gender"
                value={formData.gender || ''}
                onChange={(e) => handleInputChange('gender', e.target.value)}
              >
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </Select>
            </div>

            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <Select
                label="Marital Status"
                value={formData.maritalStatus || ''}
                onChange={(e) => handleInputChange('maritalStatus', e.target.value)}
              >
                <option value="">Select Status</option>
                <option value="Single">Single</option>
                <option value="Married">Married</option>
                <option value="Divorced">Divorced</option>
                <option value="Widowed">Widowed</option>
              </Select>
              <Input
                label="Country of Birth"
                value={formData.countryOfBirth || ''}
                onChange={(e) => handleInputChange('countryOfBirth', e.target.value)}
                placeholder="Philippines"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <Input
                label="Passport Number"
                value={formData.passportNumber || ''}
                onChange={(e) => handleInputChange('passportNumber', e.target.value)}
                placeholder="P1234567"
              />
              <Input
                label="Alien Number (A-Number)"
                value={formData.alienNumber || ''}
                onChange={(e) => handleInputChange('alienNumber', e.target.value)}
                placeholder="A123456789"
              />
            </div>
          </details>
        </Card>

        {/* Generated Form Preview */}
        {generatedBlob && (
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Form Generated Successfully
              </h2>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
              <p className="text-sm text-green-800 dark:text-green-200 flex items-start gap-2">
                <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <span>
                  Your {selectedForm} form has been generated with your information. 
                  The form can be edited in Adobe Acrobat Reader. Download it now or upload it to your documents.
                </span>
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                onClick={handleDownload}
                variant="primary"
                className="flex-1"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Form
              </Button>

              <Button
                onClick={handleUpload}
                variant="outline"
                disabled={loading || !!uploadedPath}
                className="flex-1"
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploadedPath ? 'Uploaded ✓' : 'Upload to Documents'}
              </Button>
            </div>

            {uploadedPath && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  ✓ Form uploaded to: documents/{uploadedPath}
                </p>
              </div>
            )}
          </Card>
        )}

        {/* Instructions */}
        <Card className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">
            How to Use
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800 dark:text-blue-200">
            <li>Fill in your personal information in the form above</li>
            <li>Click "Generate" button for the form you need (G-1145 or I-765)</li>
            <li>The system will automatically fill the form with your information using AI</li>
            <li>Download the generated PDF to your computer</li>
            <li>Open the PDF in Adobe Acrobat Reader to review and make any edits if needed</li>
            <li>The form remains fillable so you can complete any additional fields manually</li>
            <li>Print and submit the completed form to USCIS</li>
          </ol>
        </Card>
      </div>
    </div>
  )
}

