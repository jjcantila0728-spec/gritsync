export interface ApplicationData {
  id: string
  user_id?: string
  application_type?: 'NCLEX'
  first_name: string
  middle_name: string
  last_name: string
  gender: string
  marital_status: string
  single_name?: string
  single_full_name?: string
  date_of_birth: string
  country_of_birth?: string
  place_of_birth?: string
  birth_place?: string
  email: string
  mobile_number: string
  mailing_address?: string
  house_number?: string
  street_name?: string
  city: string
  province: string
  country?: string
  zipcode: string
  // Elementary School
  elementary_school?: string
  elementary_city?: string
  elementary_province?: string
  elementary_country?: string
  elementary_years_attended?: string
  elementary_start_date?: string
  elementary_end_date?: string
  // High School
  high_school?: string
  high_school_city?: string
  high_school_province?: string
  high_school_country?: string
  high_school_years_attended?: string
  high_school_start_date?: string
  high_school_end_date?: string
  high_school_graduated?: string
  high_school_diploma_type?: string
  high_school_diploma_date?: string
  // Nursing School
  nursing_school?: string
  nursing_school_city?: string
  nursing_school_province?: string
  nursing_school_country?: string
  nursing_school_years_attended?: string
  nursing_school_start_date?: string
  nursing_school_end_date?: string
  nursing_school_major?: string
  nursing_school_diploma_date?: string
  // Documents
  picture_path: string
  diploma_path: string
  passport_path: string
  // Status
  status: string
  created_at: string
  updated_at?: string
  signature?: string
  payment_type?: string
  spouse_name?: string
  spouse_first_name?: string
  spouse_middle_name?: string
  spouse_last_name?: string
  grit_app_id?: string
  [key: string]: any
}

export interface TimelineStepProps {
  stepNumber: number
  title: string
  isCompleted: boolean
  isAdmin: boolean
  onUpdateStep: (status: string, data?: any) => void
  onUpdateSubStep?: (stepKey: string, status: 'pending' | 'completed', data?: any) => void
  subSteps?: Array<{
    key: string
    label: string
    completed: boolean
    date?: string
    data?: any
    hasActionButton?: boolean
    actionButtonLabel?: string
  }>
  application?: any
  payments?: any[]
  _payments?: any[]
  attCode?: string
  examDate?: string
  examLocation?: string
  examTime?: string
  result?: 'pass' | 'failed'
  showGenerateLetter?: boolean
  phoneNumber?: string
  user?: any
  navigate?: any
  showToast?: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void
  verifyUSCISForms?: () => Promise<{ 
    matched: boolean
    g1145Version?: string
    i765Version?: string
    message: string
    serviceCenter?: {
      receiptNumber: string
      serviceCenter: string
      address: {
        name: string
        attn: string
        poBox?: string
        streetAddress?: string
        city: string
        state: string
        zip: string
      }
    } | null
  }>
  generateG1145Form?: () => Promise<Blob>
  generateI765Form?: () => Promise<Blob>
  generateCoverLetter?: () => Promise<Blob>
  viewingPdfUrl?: string | null
  viewingPdfName?: string
  showPdfModal?: boolean
  setViewingPdfUrl?: (url: string | null) => void
  setViewingPdfName?: (name: string) => void
  setShowPdfModal?: (show: boolean) => void
}

