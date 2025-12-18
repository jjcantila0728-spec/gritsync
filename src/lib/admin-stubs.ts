/**
 * Admin Services Stub Module
 * Consolidated stubs for admin features pending migration
 * These return inert data to allow compilation without functional backend
 */

// ============== ADMIN EMAIL SERVICES ==============
export interface EmailAddress {
  id: string;
  email: string;
  verified: boolean;
  is_default: boolean;
  created_at: string;
}

export const fromEmailAddressesAPI = {
  getAll: async (): Promise<EmailAddress[]> => [],
  getById: async (_id: string): Promise<EmailAddress | null> => null,
  create: async (_data: Partial<EmailAddress>): Promise<EmailAddress | null> => null,
  update: async (_id: string, _data: Partial<EmailAddress>): Promise<EmailAddress | null> => null,
  delete: async (_id: string): Promise<boolean> => false,
  setDefault: async (_id: string): Promise<boolean> => false,
  verify: async (_id: string): Promise<boolean> => false,
};

// ============== ADMIN DONATIONS SERVICES ==============
export interface DonationStats {
  total: number;
  count: number;
  pending: number;
  completed: number;
  failed: number;
  totalDonated: number;
  totalDonors: number;
  goal: number;
  monthlyDonations: any[];
  recentDonations: any[];
  donations: any[];
}

export const donationsAPI = {
  getAll: async (_options?: any): Promise<any[]> => [],
  getById: async (_id: string): Promise<any | null> => null,
  getStats: async (): Promise<DonationStats> => ({
    total: 0,
    count: 0,
    pending: 0,
    completed: 0,
    failed: 0,
    totalDonated: 0,
    totalDonors: 0,
    goal: 0,
    monthlyDonations: [],
    recentDonations: [],
    donations: [],
  }),
  create: async (_data: any): Promise<any | null> => null,
  update: async (_id: string, _data: any): Promise<any | null> => null,
  delete: async (_id: string): Promise<boolean> => false,
  process: async (_id: string): Promise<boolean> => false,
  refund: async (_id: string): Promise<boolean> => false,
};

// ============== EMAIL SUBSCRIBERS ==============
export interface EmailSubscriber {
  id: string;
  email: string;
  name?: string;
  status: 'active' | 'unsubscribed' | 'bounced';
  subscribed_at: string;
  unsubscribed_at?: string;
  lists?: string[];
}

export const emailSubscribersAPI = {
  getAll: async (_options?: any): Promise<EmailSubscriber[]> => [],
  getById: async (_id: string): Promise<EmailSubscriber | null> => null,
  getByEmail: async (_email: string): Promise<EmailSubscriber | null> => null,
  create: async (_data: Partial<EmailSubscriber>): Promise<EmailSubscriber | null> => null,
  update: async (_id: string, _data: Partial<EmailSubscriber>): Promise<EmailSubscriber | null> => null,
  delete: async (_id: string): Promise<boolean> => false,
  subscribe: async (_email: string, _lists?: string[]): Promise<boolean> => false,
  unsubscribe: async (_email: string): Promise<boolean> => false,
  bulkImport: async (_subscribers: Partial<EmailSubscriber>[]): Promise<{ imported: number; failed: number }> => ({ imported: 0, failed: 0 }),
  getStats: async (): Promise<{ total: number; active: number; unsubscribed: number }> => ({ total: 0, active: 0, unsubscribed: 0 }),
};

// ============== EMAIL TEMPLATES ==============
export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body_html: string;
  body_text?: string;
  category?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const emailTemplatesAPI = {
  getAll: async (): Promise<EmailTemplate[]> => [],
  getById: async (_id: string): Promise<EmailTemplate | null> => null,
  getByCategory: async (_category: string): Promise<EmailTemplate[]> => [],
  create: async (_data: Partial<EmailTemplate>): Promise<EmailTemplate | null> => null,
  update: async (_id: string, _data: Partial<EmailTemplate>): Promise<EmailTemplate | null> => null,
  delete: async (_id: string): Promise<boolean> => false,
  duplicate: async (_id: string): Promise<EmailTemplate | null> => null,
  preview: async (_id: string, _variables?: Record<string, any>): Promise<string> => '',
};

// ============== CLIENT TOKENS ==============
export interface ClientToken {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token?: string;
  expires_at?: string;
  created_at: string;
}

export const clientTokensAPI = {
  getAll: async (): Promise<ClientToken[]> => [],
  getByUserId: async (_userId: string): Promise<ClientToken | null> => null,
  create: async (_data: Partial<ClientToken>): Promise<ClientToken | null> => null,
  update: async (_id: string, _data: Partial<ClientToken>): Promise<ClientToken | null> => null,
  delete: async (_id: string): Promise<boolean> => false,
  refresh: async (_id: string): Promise<ClientToken | null> => null,
};

// ============== NOTIFICATION PREFERENCES ==============
export interface NotificationPreference {
  id: string;
  user_id: string;
  email_notifications: boolean;
  sms_notifications: boolean;
  push_notifications: boolean;
  marketing_emails: boolean;
  newsletter: boolean;
  created_at: string;
  updated_at: string;
}

export const notificationPreferencesAPI = {
  get: async (_userId?: string): Promise<NotificationPreference | null> => null,
  getByUserId: async (_userId: string): Promise<NotificationPreference | null> => null,
  update: async (_userId: string, _data: Partial<NotificationPreference>): Promise<NotificationPreference | null> => null,
  create: async (_data: Partial<NotificationPreference>): Promise<NotificationPreference | null> => null,
};

// ============== USCIS FORMS ==============
export interface USCISForm {
  id: string;
  name: string;
  form_number: string;
  description?: string;
  file_url?: string;
  category?: string;
  is_active: boolean;
  created_at: string;
}

export const uscisFormsAPI = {
  getAll: async (): Promise<USCISForm[]> => [],
  getById: async (_id: string): Promise<USCISForm | null> => null,
  getByFormNumber: async (_formNumber: string): Promise<USCISForm | null> => null,
  download: async (_id: string): Promise<Blob | null> => null,
};

// ============== ACCOUNT SETTINGS ==============
export const accountSettingsAPI = {
  get: async (_userId?: string): Promise<any> => ({}),
  update: async (_userId: string, _data: any): Promise<any> => ({}),
  getNotificationPreferences: async (_userId?: string): Promise<string[]> => [],
  updateNotificationPreferences: async (_userId: string, _preferences: string[]): Promise<boolean> => false,
  deleteAccount: async (_userId: string): Promise<boolean> => false,
  exportData: async (_userId: string): Promise<any> => ({}),
};

// ============== QUOTES MANAGEMENT ==============
export const adminQuotesAPI = {
  getAll: async (_options?: any): Promise<any[]> => [],
  getById: async (_id: string): Promise<any | null> => null,
  update: async (_id: string, _data: any): Promise<any | null> => null,
  delete: async (_id: string): Promise<boolean> => false,
  approve: async (_id: string): Promise<boolean> => false,
  reject: async (_id: string, _reason?: string): Promise<boolean> => false,
  sendToClient: async (_id: string): Promise<boolean> => false,
};
