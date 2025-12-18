import { supabase } from '../supabase'

export interface USCISFormData {
  // Personal Information
  firstName?: string
  middleName?: string
  lastName?: string
  email?: string
  mobileNumber?: string
  
  // Address Information
  address?: string
  houseNumber?: string
  streetName?: string
  aptNumber?: string
  city?: string
  state?: string
  province?: string
  zipcode?: string
  country?: string
  
  // Birth Information
  dateOfBirth?: string
  cityOfBirth?: string
  stateOfBirth?: string
  countryOfBirth?: string
  
  // Personal Details
  gender?: string
  maritalStatus?: string
  socialSecurityNumber?: string
  alienNumber?: string
  
  // Spouse Information (if applicable)
  spouseFirstName?: string
  spouseMiddleName?: string
  spouseLastName?: string
  
  // Additional fields for I-765
  eligibilityCategory?: string
  i94Number?: string
  passportNumber?: string
  passportCountry?: string
  passportExpirationDate?: string
  lastArrivalDate?: string
  placeOfLastArrival?: string
  immigrationStatus?: string
  sevisNumber?: string
  fatherFirstName?: string
  fatherLastName?: string
  motherFirstName?: string
  motherLastName?: string
  
  // Additional fields
  [key: string]: any
}

export type FormType = 'G-1145' | 'I-765'

/**
 * Generate and fill a USCIS form using AI-powered edge function
 */
export async function generateUSCISForm(
  formType: FormType,
  data: USCISFormData
): Promise<Blob> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      throw new Error('Authentication required')
    }

    // Call the AI-powered fill-pdf-form edge function
    const response = await supabase.functions.invoke('fill-pdf-form-ai', {
      body: {
        formType,
        data
      }
    })

    if (response.error) {
      throw new Error(response.error.message || 'Failed to generate form')
    }

    // The response.data should be the PDF blob
    if (response.data instanceof Blob) {
      return response.data
    }

    // If response.data is ArrayBuffer or similar, convert to Blob
    if (response.data && typeof response.data === 'object') {
      return new Blob([response.data], { type: 'application/pdf' })
    }

    throw new Error('Invalid response format from server')
  } catch (error: any) {
    console.error(`Error generating ${formType}:`, error)
    throw new Error(error.message || `Failed to generate ${formType} form`)
  }
}

/**
 * Generate and fill G-1145 form
 */
export async function generateG1145(data: USCISFormData): Promise<Blob> {
  return generateUSCISForm('G-1145', data)
}

/**
 * Generate and fill I-765 form
 */
export async function generateI765(data: USCISFormData): Promise<Blob> {
  return generateUSCISForm('I-765', data)
}

/**
 * Download a generated form
 */
export function downloadForm(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  window.URL.revokeObjectURL(url)
  document.body.removeChild(a)
}

/**
 * Upload generated form to Supabase Storage
 */
export async function uploadGeneratedForm(
  blob: Blob,
  fileName: string,
  userId: string
): Promise<string> {
  try {
    const filePath = `${userId}/uscis-forms/${fileName}`
    
    const { data, error } = await supabase.storage
      .from('documents')
      .upload(filePath, blob, {
        contentType: 'application/pdf',
        upsert: true
      })

    if (error) {
      throw error
    }

    return data.path
  } catch (error: any) {
    console.error('Error uploading form:', error)
    throw new Error(error.message || 'Failed to upload form')
  }
}

/**
 * Get form data from application
 */
export async function getFormDataFromApplication(
  applicationId: string
): Promise<USCISFormData> {
  try {
    const { data, error } = await supabase
      .from('applications')
      .select(`
        *,
        users!inner(
          email,
          first_name,
          last_name,
          middle_name,
          date_of_birth,
          mobile_number
        )
      `)
      .eq('id', applicationId)
      .single()

    if (error) {
      throw error
    }

    // Map application data to form data
    const formData: USCISFormData = {
      firstName: data.users?.first_name || data.first_name,
      middleName: data.users?.middle_name || data.middle_name,
      lastName: data.users?.last_name || data.last_name,
      email: data.users?.email || data.email,
      mobileNumber: data.users?.mobile_number || data.mobile_number,
      dateOfBirth: data.users?.date_of_birth || data.date_of_birth,
      address: data.address,
      city: data.city,
      province: data.province,
      zipcode: data.zipcode,
      country: data.country,
      gender: data.gender,
      maritalStatus: data.marital_status,
      countryOfBirth: data.country_of_birth,
      cityOfBirth: data.city_of_birth,
      passportNumber: data.passport_number,
      spouseFirstName: data.spouse_first_name,
      spouseMiddleName: data.spouse_middle_name,
      spouseLastName: data.spouse_last_name,
    }

    return formData
  } catch (error: any) {
    console.error('Error fetching application data:', error)
    throw new Error(error.message || 'Failed to fetch application data')
  }
}

