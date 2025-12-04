// Application Constants

// Tax and Pricing
export const TAX_RATE = 0.12 // 12% tax rate

// File Upload
export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

// Quotation
export const QUOTE_VALIDITY_DAYS = 30

// JWT
export const JWT_EXPIRY = '7d'

// Application Status
export const APPLICATION_STATUSES = ['pending', 'approved', 'rejected', 'in-progress', 'completed']
export const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'cancelled']
export const PAYMENT_TYPES = ['step1', 'step2', 'full']
export const USER_ROLES = ['client', 'admin']

// Account Types
export const ACCOUNT_TYPES = ['gmail', 'pearson_vue', 'custom']

// Notification Types
export const NOTIFICATION_TYPES = ['timeline_update', 'status_change', 'payment', 'general']

// Document Types
export const DOCUMENT_TYPES = ['picture', 'diploma', 'passport']

// Service Payment Types
export const SERVICE_PAYMENT_TYPES = ['full', 'staggered']

// Default Service Configuration
export const DEFAULT_SERVICE_NAME = 'NCLEX Processing'
export const DEFAULT_SERVICE_STATE = 'New York'


