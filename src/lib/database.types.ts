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
          default_avatar_design: string | null
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
          default_avatar_design?: string | null
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
          default_avatar_design?: string | null
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
          status?: 'pending' | 'completed' | 'rejected' | 'initiated' | 'in-progress' | 'approved'
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
          status?: 'pending' | 'completed' | 'rejected' | 'initiated' | 'in-progress' | 'approved'
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
      nclex_sponsorships: {
        Row: {
          id: string
          user_id: string | null
          first_name: string
          last_name: string
          email: string
          mobile_number: string
          date_of_birth: string | null
          country: string | null
          nursing_school: string | null
          graduation_date: string | null
          current_employment_status: string | null
          years_of_experience: string | null
          financial_need_description: string
          motivation_statement: string
          how_will_this_help: string | null
          resume_path: string | null
          transcript_path: string | null
          recommendation_letter_path: string | null
          status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'awarded'
          admin_notes: string | null
          reviewed_by: string | null
          reviewed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          first_name: string
          last_name: string
          email: string
          mobile_number: string
          date_of_birth?: string | null
          country?: string | null
          nursing_school?: string | null
          graduation_date?: string | null
          current_employment_status?: string | null
          years_of_experience?: string | null
          financial_need_description: string
          motivation_statement: string
          how_will_this_help?: string | null
          resume_path?: string | null
          transcript_path?: string | null
          recommendation_letter_path?: string | null
          status?: 'pending' | 'under_review' | 'approved' | 'rejected' | 'awarded'
          admin_notes?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          first_name?: string
          last_name?: string
          email?: string
          mobile_number?: string
          date_of_birth?: string | null
          country?: string | null
          nursing_school?: string | null
          graduation_date?: string | null
          current_employment_status?: string | null
          years_of_experience?: string | null
          financial_need_description?: string
          motivation_statement?: string
          how_will_this_help?: string | null
          resume_path?: string | null
          transcript_path?: string | null
          recommendation_letter_path?: string | null
          status?: 'pending' | 'under_review' | 'approved' | 'rejected' | 'awarded'
          admin_notes?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      donations: {
        Row: {
          id: string
          donor_name: string | null
          donor_email: string | null
          donor_phone: string | null
          is_anonymous: boolean
          amount: number
          currency: string
          payment_method: string | null
          stripe_payment_intent_id: string | null
          transaction_id: string | null
          sponsorship_id: string | null
          status: 'pending' | 'completed' | 'failed' | 'refunded'
          message: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          donor_name?: string | null
          donor_email?: string | null
          donor_phone?: string | null
          is_anonymous?: boolean
          amount: number
          currency?: string
          payment_method?: string | null
          stripe_payment_intent_id?: string | null
          transaction_id?: string | null
          sponsorship_id?: string | null
          status?: 'pending' | 'completed' | 'failed' | 'refunded'
          message?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          donor_name?: string | null
          donor_email?: string | null
          donor_phone?: string | null
          is_anonymous?: boolean
          amount?: number
          currency?: string
          payment_method?: string | null
          stripe_payment_intent_id?: string | null
          transaction_id?: string | null
          sponsorship_id?: string | null
          status?: 'pending' | 'completed' | 'failed' | 'refunded'
          message?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      partner_agencies: {
        Row: {
          id: string
          name: string
          email: string
          phone: string | null
          website: string | null
          address: string | null
          city: string | null
          state: string | null
          country: string
          zipcode: string | null
          contact_person_name: string | null
          contact_person_email: string | null
          contact_person_phone: string | null
          is_active: boolean
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          email: string
          phone?: string | null
          website?: string | null
          address?: string | null
          city?: string | null
          state?: string | null
          country?: string
          zipcode?: string | null
          contact_person_name?: string | null
          contact_person_email?: string | null
          contact_person_phone?: string | null
          is_active?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string
          phone?: string | null
          website?: string | null
          address?: string | null
          city?: string | null
          state?: string | null
          country?: string
          zipcode?: string | null
          contact_person_name?: string | null
          contact_person_email?: string | null
          contact_person_phone?: string | null
          is_active?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      career_applications: {
        Row: {
          id: string
          user_id: string | null
          career_id: string | null
          first_name: string
          last_name: string
          email: string
          mobile_number: string
          date_of_birth: string | null
          country: string | null
          nursing_school: string | null
          graduation_date: string | null
          years_of_experience: string | null
          current_employment_status: string | null
          license_number: string | null
          license_state: string | null
          resume_path: string | null
          cover_letter_path: string | null
          additional_documents_path: string | null
          partner_agency_id: string | null
          forwarded_to_agency_at: string | null
          forwarded_email_sent: boolean
          status: 'pending' | 'under_review' | 'forwarded' | 'interviewed' | 'accepted' | 'rejected'
          admin_notes: string | null
          reviewed_by: string | null
          reviewed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          career_id?: string | null
          first_name: string
          last_name: string
          email: string
          mobile_number: string
          date_of_birth?: string | null
          country?: string | null
          nursing_school?: string | null
          graduation_date?: string | null
          years_of_experience?: string | null
          current_employment_status?: string | null
          license_number?: string | null
          license_state?: string | null
          resume_path?: string | null
          cover_letter_path?: string | null
          additional_documents_path?: string | null
          partner_agency_id?: string | null
          forwarded_to_agency_at?: string | null
          forwarded_email_sent?: boolean
          status?: 'pending' | 'under_review' | 'forwarded' | 'interviewed' | 'accepted' | 'rejected'
          admin_notes?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          career_id?: string | null
          first_name?: string
          last_name?: string
          email?: string
          mobile_number?: string
          date_of_birth?: string | null
          country?: string | null
          nursing_school?: string | null
          graduation_date?: string | null
          years_of_experience?: string | null
          current_employment_status?: string | null
          license_number?: string | null
          license_state?: string | null
          resume_path?: string | null
          cover_letter_path?: string | null
          additional_documents_path?: string | null
          partner_agency_id?: string | null
          forwarded_to_agency_at?: string | null
          forwarded_email_sent?: boolean
          status?: 'pending' | 'under_review' | 'forwarded' | 'interviewed' | 'accepted' | 'rejected'
          admin_notes?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      careers: {
        Row: {
          id: string
          title: string
          description: string
          requirements: string | null
          responsibilities: string | null
          location: string | null
          employment_type: 'full-time' | 'part-time' | 'contract' | 'temporary' | 'internship' | null
          salary_range: string | null
          department: string | null
          is_active: boolean
          is_featured: boolean
          application_deadline: string | null
          application_instructions: string | null
          partner_agency_id: string | null
          views_count: number
          applications_count: number
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          title: string
          description: string
          requirements?: string | null
          responsibilities?: string | null
          location?: string | null
          employment_type?: 'full-time' | 'part-time' | 'contract' | 'temporary' | 'internship' | null
          salary_range?: string | null
          department?: string | null
          is_active?: boolean
          is_featured?: boolean
          application_deadline?: string | null
          application_instructions?: string | null
          partner_agency_id?: string | null
          views_count?: number
          applications_count?: number
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          title?: string
          description?: string
          requirements?: string | null
          responsibilities?: string | null
          location?: string | null
          employment_type?: 'full-time' | 'part-time' | 'contract' | 'temporary' | 'internship' | null
          salary_range?: string | null
          department?: string | null
          is_active?: boolean
          is_featured?: boolean
          application_deadline?: string | null
          application_instructions?: string | null
          partner_agency_id?: string | null
          views_count?: number
          applications_count?: number
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
      }
      [key: string]: any
    }
    Views: {
      [key: string]: never
    }
    Functions: {
      increment_career_views: {
        Args: {
          career_uuid: string
        }
        Returns: void
      }
      increment_career_applications: {
        Args: {
          career_uuid: string
        }
        Returns: void
      }
      get_career_statistics: {
        Args: Record<PropertyKey, never>
        Returns: {
          total_careers: number
          active_careers: number
          featured_careers: number
          total_applications: number
          pending_applications: number
        }
      }
      get_donation_statistics: {
        Args: Record<PropertyKey, never>
        Returns: {
          total_donations: number
          total_amount: number
          completed_donations: number
          completed_amount: number
          pending_donations: number
        }
      }
      get_sponsorship_statistics: {
        Args: Record<PropertyKey, never>
        Returns: {
          total_sponsorships: number
          pending_sponsorships: number
          approved_sponsorships: number
          awarded_sponsorships: number
        }
      }
      [key: string]: any
    }
    Enums: {
      [key: string]: never
    }
  }
}

