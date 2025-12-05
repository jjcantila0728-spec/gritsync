export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          role: 'client' | 'admin'
          first_name: string | null
          last_name: string | null
          grit_id: string
          avatar_path: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          role?: 'client' | 'admin'
          first_name?: string | null
          last_name?: string | null
          grit_id?: string
          avatar_path?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          role?: 'client' | 'admin'
          first_name?: string | null
          last_name?: string | null
          grit_id?: string
          avatar_path?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      applications: {
        Row: {
          id: string
          user_id: string
          first_name: string
          middle_name: string | null
          last_name: string
          mobile_number: string
          email: string
          gender: string
          marital_status: string
          single_full_name: string | null
          date_of_birth: string
          birth_place: string
          country_of_birth: string | null
          house_number: string
          street_name: string
          city: string
          province: string
          country: string
          zipcode: string
          elementary_school: string
          elementary_city: string
          elementary_province: string | null
          elementary_country: string | null
          elementary_years_attended: string
          elementary_start_date: string
          elementary_end_date: string
          high_school: string
          high_school_city: string
          high_school_province: string | null
          high_school_country: string | null
          high_school_years_attended: string
          high_school_start_date: string
          high_school_end_date: string
          high_school_graduated: string | null
          high_school_diploma_type: string | null
          high_school_diploma_date: string | null
          nursing_school: string
          nursing_school_city: string
          nursing_school_province: string | null
          nursing_school_country: string | null
          nursing_school_years_attended: string
          nursing_school_start_date: string
          nursing_school_end_date: string
          nursing_school_major: string | null
          nursing_school_diploma_date: string | null
          picture_path: string
          diploma_path: string
          passport_path: string
          signature: string | null
          payment_type: string | null
          status: 'pending' | 'completed' | 'rejected' | 'initiated' | 'in-progress' | 'approved'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          first_name: string
          middle_name?: string | null
          last_name: string
          mobile_number: string
          email: string
          gender: string
          marital_status: string
          single_full_name?: string | null
          date_of_birth: string
          birth_place: string
          country_of_birth?: string | null
          house_number: string
          street_name: string
          city: string
          province: string
          country: string
          zipcode: string
          elementary_school: string
          elementary_city: string
          elementary_province?: string | null
          elementary_country?: string | null
          elementary_years_attended: string
          elementary_start_date: string
          elementary_end_date: string
          high_school: string
          high_school_city: string
          high_school_province?: string | null
          high_school_country?: string | null
          high_school_years_attended: string
          high_school_start_date: string
          high_school_end_date: string
          high_school_graduated?: string | null
          high_school_diploma_type?: string | null
          high_school_diploma_date?: string | null
          nursing_school: string
          nursing_school_city: string
          nursing_school_province?: string | null
          nursing_school_country?: string | null
          nursing_school_years_attended: string
          nursing_school_start_date: string
          nursing_school_end_date: string
          nursing_school_major?: string | null
          nursing_school_diploma_date?: string | null
          picture_path: string
          diploma_path: string
          passport_path: string
          signature?: string | null
          payment_type?: string | null
          status?: 'pending' | 'completed' | 'rejected'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          first_name?: string
          middle_name?: string | null
          last_name?: string
          mobile_number?: string
          email?: string
          gender?: string
          marital_status?: string
          single_full_name?: string | null
          date_of_birth?: string
          birth_place?: string
          country_of_birth?: string | null
          house_number?: string
          street_name?: string
          city?: string
          province?: string
          country?: string
          zipcode?: string
          elementary_school?: string
          elementary_city?: string
          elementary_province?: string | null
          elementary_country?: string | null
          elementary_years_attended?: string
          elementary_start_date?: string
          elementary_end_date?: string
          high_school?: string
          high_school_city?: string
          high_school_province?: string | null
          high_school_country?: string | null
          high_school_years_attended?: string
          high_school_start_date?: string
          high_school_end_date?: string
          high_school_graduated?: string | null
          high_school_diploma_type?: string | null
          high_school_diploma_date?: string | null
          nursing_school?: string
          nursing_school_city?: string
          nursing_school_province?: string | null
          nursing_school_country?: string | null
          nursing_school_years_attended?: string
          nursing_school_start_date?: string
          nursing_school_end_date?: string
          nursing_school_major?: string | null
          nursing_school_diploma_date?: string | null
          picture_path?: string
          diploma_path?: string
          passport_path?: string
          signature?: string | null
          payment_type?: string | null
          status?: 'pending' | 'completed' | 'rejected'
          created_at?: string
          updated_at?: string
        }
      }
      quotations: {
        Row: {
          id: string
          user_id: string | null
          amount: number
          description: string
          status: 'pending' | 'paid' | 'cancelled'
          service: string | null
          state: string | null
          payment_type: 'full' | 'staggered' | null
          line_items: Json | null
          client_first_name: string | null
          client_last_name: string | null
          client_email: string | null
          client_mobile: string | null
          validity_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          amount: number
          description: string
          status?: 'pending' | 'paid' | 'cancelled'
          service?: string | null
          state?: string | null
          payment_type?: 'full' | 'staggered' | null
          line_items?: Json | null
          client_first_name?: string | null
          client_last_name?: string | null
          client_email?: string | null
          client_mobile?: string | null
          validity_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          amount?: number
          description?: string
          status?: 'pending' | 'paid' | 'cancelled'
          service?: string | null
          state?: string | null
          payment_type?: 'full' | 'staggered' | null
          line_items?: Json | null
          client_first_name?: string | null
          client_last_name?: string | null
          client_email?: string | null
          client_mobile?: string | null
          validity_date?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          application_id: string | null
          type: 'timeline_update' | 'status_change' | 'payment' | 'general'
          title: string
          message: string
          read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          application_id?: string | null
          type: 'timeline_update' | 'status_change' | 'payment' | 'general'
          title: string
          message: string
          read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          application_id?: string | null
          type?: 'timeline_update' | 'status_change' | 'payment' | 'general'
          title?: string
          message?: string
          read?: boolean
          created_at?: string
        }
      }
      user_preferences: {
        Row: {
          user_id: string
          email_notifications_enabled: boolean
          email_timeline_updates: boolean
          email_status_changes: boolean
          email_payment_updates: boolean
          email_general_notifications: boolean
          two_factor_enabled: boolean
          two_factor_secret: string | null
          two_factor_backup_codes: string[] | null
          two_factor_verified_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          email_notifications_enabled?: boolean
          email_timeline_updates?: boolean
          email_status_changes?: boolean
          email_payment_updates?: boolean
          email_general_notifications?: boolean
          two_factor_enabled?: boolean
          two_factor_secret?: string | null
          two_factor_backup_codes?: string[] | null
          two_factor_verified_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          email_notifications_enabled?: boolean
          email_timeline_updates?: boolean
          email_status_changes?: boolean
          email_payment_updates?: boolean
          email_general_notifications?: boolean
          two_factor_enabled?: boolean
          two_factor_secret?: string | null
          two_factor_backup_codes?: string[] | null
          two_factor_verified_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      [key: string]: any
    }
    Views: {
      [key: string]: never
    }
    Functions: {
      [key: string]: never
    }
    Enums: {
      [key: string]: never
    }
  }
}

