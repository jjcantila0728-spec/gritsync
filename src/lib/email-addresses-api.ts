/**
 * Email Addresses API
 * Manages multiple email addresses for users and admin addresses
 * NOTE: This feature is currently stubbed pending full migration
 */

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

// Stubbed API - feature pending migration
export const emailAddressesAPI = {
  getAll: async (): Promise<EmailAddress[]> => [],
  getActive: async (): Promise<ActiveEmailAddress[]> => [],
  getAdminAddresses: async (): Promise<EmailAddress[]> => [],
  getSupportAddresses: async (): Promise<EmailAddress[]> => [],
  getSystemAddresses: async (): Promise<EmailAddress[]> => [],
  getUserAddresses: async (_userId?: string): Promise<EmailAddress[]> => [],
  getById: async (_id: string): Promise<EmailAddress | null> => null,
  getByEmail: async (_email: string): Promise<EmailAddress | null> => null,
  getByUserId: async (_userId: string): Promise<EmailAddress[]> => [],
  create: async (_address: Partial<EmailAddress>): Promise<EmailAddress | null> => null,
  update: async (_id: string, _address: Partial<EmailAddress>): Promise<EmailAddress | null> => null,
  delete: async (_id: string): Promise<boolean> => false,
  verify: async (_id: string): Promise<boolean> => false,
  setPrimary: async (_id: string): Promise<boolean> => false,
  toggleActive: async (_id: string): Promise<boolean> => false,
  generateClientEmail: async (_userId: string): Promise<EmailAddress | null> => null,
  getForwardingRules: async (): Promise<any[]> => [],
  createForwardingRule: async (_rule: any): Promise<any> => null,
  updateForwardingRule: async (_id: string, _rule: any): Promise<any> => null,
  deleteForwardingRule: async (_id: string): Promise<boolean> => false,
}
