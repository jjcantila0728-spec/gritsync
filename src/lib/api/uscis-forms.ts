/**
 * USCIS Forms API
 * NOTE: This feature is currently stubbed pending full migration
 */

export interface USCISFormData {
  firstName?: string
  middleName?: string
  lastName?: string
  email?: string
  mobileNumber?: string
  address?: string
  houseNumber?: string
  streetName?: string
  aptNumber?: string
  city?: string
  state?: string
  province?: string
  zipcode?: string
  country?: string
  dateOfBirth?: string
  cityOfBirth?: string
  stateOfBirth?: string
  countryOfBirth?: string
  gender?: string
  maritalStatus?: string
  socialSecurityNumber?: string
  alienNumber?: string
  spouseFirstName?: string
  spouseMiddleName?: string
  spouseLastName?: string
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
  [key: string]: any
}

export type FormType = 'G-1145' | 'I-765'

/**
 * Generate and fill a USCIS form (stubbed)
 */
export async function generateUSCISForm(
  _formType: FormType,
  _data: USCISFormData
): Promise<Blob> {
  throw new Error('USCIS form generation is temporarily unavailable. Please try again later.')
}

/**
 * Generate and fill G-1145 form (stubbed)
 */
export async function generateG1145(_data: USCISFormData): Promise<Blob> {
  throw new Error('G-1145 form generation is temporarily unavailable. Please try again later.')
}

/**
 * Generate and fill I-765 form (stubbed)
 */
export async function generateI765(_data: USCISFormData): Promise<Blob> {
  throw new Error('I-765 form generation is temporarily unavailable. Please try again later.')
}

/**
 * Get AI suggestions for filling out forms (stubbed)
 */
export async function getFormFillingSuggestions(
  _formType: FormType,
  _partialData: Partial<USCISFormData>
): Promise<Partial<USCISFormData>> {
  return {}
}
