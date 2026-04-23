/**
 * Email Addresses API
 * Manages multiple email addresses for users and admin addresses
 */

import { supabase } from './supabase'

export interface EmailAddress {
  id: string
  email_address: string
  display_name: string | null
  user_id: string | null
  is_system_address: boolean
  address_type: 'admin' | 'client' | 'support' | 'noreply' | 'department'
  department: string | null
  is_active: boolean
  is_verified: boolean
  is_primary: boolean
  can_send: boolean
  can_receive: boolean
  forward_to_email: string | null
  auto_reply_enabled: boolean
  auto_reply_message: string | null
  notes: string | null
  metadata: Record<string, any>
  created_at: string
  verified_at: string | null
  last_used_at: string | null
  updated_at: string
}

export interface ActiveEmailAddress extends EmailAddress {
  first_name: string | null
  last_name: string | null
  user_role: string | null
}

/**
 * Email Addresses API
 */
export const emailAddressesAPI = {
  /**
   * Get all email addresses (admin only)
   */
  getAll: async () => {
    const { data, error } = await supabase
      .from('email_addresses')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data as EmailAddress[]
  },

  /**
   * Get active email addresses
   */
  getActive: async () => {
    const { data, error } = await supabase
      .from('active_email_addresses')
      .select('*')
      .order('email_address')

    if (error) throw error
    return data as ActiveEmailAddress[]
  },

  /**
   * Get admin email addresses
   */
  getAdminAddresses: async () => {
    const { data, error } = await supabase
      .from('email_addresses')
      .select('*')
      .eq('address_type', 'admin')
      .eq('is_active', true)
      .order('department')

    if (error) throw error
    return data as EmailAddress[]
  },

  /**
   * Get user's email addresses
   */
  getUserAddresses: async (userId: string) => {
    const { data, error } = await supabase
      .from('email_addresses')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('is_primary', { ascending: false })

    if (error) throw error
    return data as EmailAddress[]
  },

  /**
   * Get user's primary email address
   */
  getUserPrimaryEmail: async (userId: string) => {
    const { data, error } = await supabase
      .rpc('get_user_primary_email', { p_user_id: userId })

    if (error) throw error
    return data as string
  },

  /**
   * Get email address by ID
   */
  getById: async (id: string) => {
    const { data, error } = await supabase
      .from('email_addresses')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data as EmailAddress
  },

  /**
   * Get email address by email string
   */
  getByEmail: async (email: string) => {
    const { data, error } = await supabase
      .from('email_addresses')
      .select('*')
      .eq('email_address', email.toLowerCase())
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // Not found
      throw error
    }
    return data as EmailAddress
  },

  /**
   * Create email address
   */
  create: async (emailData: Partial<EmailAddress>) => {
    const { data, error } = await supabase
      .from('email_addresses')
      .insert(emailData)
      .select()
      .single()

    if (error) throw error
    return data as EmailAddress
  },

  /**
   * Update email address
   */
  update: async (id: string, updates: Partial<EmailAddress>) => {
    const { data, error } = await supabase
      .from('email_addresses')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data as EmailAddress
  },

  /**
   * Delete email address
   */
  delete: async (id: string) => {
    const { error } = await supabase
      .from('email_addresses')
      .delete()
      .eq('id', id)

    if (error) throw error
    return true
  },

  /**
   * Generate client email address for user
   */
  generateClientEmail: async (userId: string) => {
    const { data, error } = await supabase
      .rpc('create_client_email_address', { p_user_id: userId })

    if (error) throw error
    return data as string
  },

  /**
   * Set primary email for user
   */
  setPrimary: async (userId: string, emailAddressId: string) => {
    // First, unset all primary flags for this user
    await supabase
      .from('email_addresses')
      .update({ is_primary: false })
      .eq('user_id', userId)

    // Then set the new primary
    const { data, error } = await supabase
      .from('email_addresses')
      .update({ is_primary: true })
      .eq('id', emailAddressId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error
    return data as EmailAddress
  },

  /**
   * Verify email address
   */
  verify: async (id: string) => {
    const { data, error } = await supabase
      .from('email_addresses')
      .update({
        is_verified: true,
        verified_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data as EmailAddress
  },

  /**
   * Update last used timestamp
   */
  updateLastUsed: async (id: string) => {
    const { error } = await supabase
      .from('email_addresses')
      .update({
        last_used_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) throw error
    return true
  },

  /**
   * Toggle active status
   */
  toggleActive: async (id: string) => {
    // Get current status
    const current = await emailAddressesAPI.getById(id)
    
    const { data, error } = await supabase
      .from('email_addresses')
      .update({ is_active: !current.is_active })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data as EmailAddress
  },

  /**
   * Set auto-reply
   */
  setAutoReply: async (id: string, enabled: boolean, message?: string) => {
    const { data, error } = await supabase
      .from('email_addresses')
      .update({
        auto_reply_enabled: enabled,
        auto_reply_message: message || null,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data as EmailAddress
  },

  /**
   * Set email forwarding
   */
  setForwarding: async (id: string, forwardToEmail: string | null) => {
    const { data, error } = await supabase
      .from('email_addresses')
      .update({ forward_to_email: forwardToEmail })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data as EmailAddress
  },
}

/**
 * Helper functions for email generation
 */
export const emailAddressHelpers = {
  /**
   * Generate client email format preview
   */
  previewClientEmail: (firstName: string, middleName: string, lastName: string): string => {
    const firstInitial = firstName.charAt(0).toLowerCase()
    const middleInitial = middleName ? middleName.charAt(0).toLowerCase() : ''
    const cleanLastName = lastName.toLowerCase().replace(/[^a-z]/g, '')
    
    return `${firstInitial}${middleInitial}${cleanLastName}@gritsync.com`
  },

  /**
   * Validate email format
   */
  validateEmail: (email: string): boolean => {
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/
    return emailRegex.test(email)
  },

  /**
   * Check if email is gritsync domain
   */
  isGritsyncEmail: (email: string): boolean => {
    return email.toLowerCase().endsWith('@gritsync.com')
  },

  /**
   * Format display name
   */
  formatDisplayName: (firstName: string, lastName: string): string => {
    return `${firstName} ${lastName}`
  },
}

/**
 * Create email address on user registration
 * This should be called after user registration
 */
export async function createUserEmailOnRegistration(userId: string) {
  try {
    const email = await emailAddressesAPI.generateClientEmail(userId)
    console.log('Created client email address:', email)
    return email
  } catch (error) {
    console.error('Error creating client email:', error)
    throw error
  }
}

export default emailAddressesAPI

