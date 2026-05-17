export type UserRole = 'client' | 'admin' | 'advisor' | 'affiliate'

export interface User {
  id: string
  email: string
  role: UserRole
  first_name?: string
  middle_name?: string
  last_name?: string
  grit_id?: string
  mobile?: string
  avatar_path?: string
  gritsync_email?: string
  created_at?: string
}

export interface Application {
  id: string
  user_id: string
  status?: string
  service_type?: string
  service_subtype?: string
  current_stage?: string
  progress_percentage?: number
  created_at?: string
  updated_at?: string
}

export interface DocumentRow {
  id: string
  user_id: string
  application_id?: string | null
  document_type?: string | null
  filename?: string | null
  file_name?: string | null
  file_path?: string | null
  file_size?: number | null
  mime_type?: string | null
  status?: string | null
  uploaded_at?: string | null
  created_at?: string
}
