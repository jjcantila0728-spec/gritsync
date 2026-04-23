export type UserRole = 'client' | 'admin'

export interface User {
  id: string
  email: string
  role: UserRole
  first_name?: string
  last_name?: string
  grit_id?: string  // Optional - may not exist immediately after registration
  created_at: string
}

export interface Application {
  id: string
  user_id: string
  first_name: string
  middle_name?: string
  last_name: string
  gender: string
  marital_status: string
  single_name?: string
  date_of_birth: string
  country_of_birth: string
  place_of_birth: string
  email: string
  mobile_number: string
  mailing_address: string
  city: string
  province: string
  zipcode: string
  elementary_school: string
  elementary_address: string
  elementary_city: string
  elementary_entry_date: string
  elementary_completion_date: string
  elementary_closed: number
  elementary_new_school?: string
  secondary_school: string
  secondary_address: string
  secondary_city: string
  secondary_entry_date: string
  secondary_completion_date: string
  secondary_closed: number
  secondary_new_school?: string
  university: string
  university_address: string
  university_city: string
  university_entry_date: string
  university_completion_date: string
  picture_path: string
  diploma_path: string
  passport_path: string
  status: 'pending' | 'completed' | 'rejected'
  created_at: string
  updated_at: string
}

export interface Quotation {
  id: string
  user_id: string | null // NULL for public/guest quotations
  amount: number
  description: string
  status: 'pending' | 'paid' | 'cancelled'
  created_at: string
  updated_at: string
  validity_date?: string // Quote expiration date
}

