/**
 * Settings utility functions
 * Provides easy access to admin settings throughout the application
 */

import { supabase } from './supabase'

// Cache for settings to avoid repeated database queries
let settingsCache: Record<string, string> | null = null
let cacheTimestamp: number = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

/**
 * Get all settings from the database
 * Uses caching to reduce database queries
 */
async function getAllSettings(): Promise<Record<string, string>> {
  const now = Date.now()
  
  // Return cached settings if still valid
  if (settingsCache && (now - cacheTimestamp) < CACHE_DURATION) {
    return settingsCache
  }
  
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
    
    if (error) {
      console.error('Error fetching settings:', error)
      // Return cached settings if available, even if expired
      return settingsCache || {}
    }
    
    // Convert array to object
    const settings: Record<string, string> = {}
    if (data && Array.isArray(data) && !('error' in data)) {
      data.forEach((setting: any) => {
        if (setting && typeof setting === 'object' && 'key' in setting && 'value' in setting) {
          settings[setting.key] = setting.value
        }
      })
    }
    
    // Update cache
    settingsCache = settings
    cacheTimestamp = now
    
    return settings
  } catch (error) {
    console.error('Error fetching settings:', error)
    return settingsCache || {}
  }
}

/**
 * Get a specific setting value
 */
export async function getSetting(key: string, defaultValue: string = ''): Promise<string> {
  const settings = await getAllSettings()
  return settings[key] || defaultValue
}

/**
 * Get a boolean setting
 */
export async function getBooleanSetting(key: string, defaultValue: boolean = false): Promise<boolean> {
  const value = await getSetting(key, defaultValue.toString())
  return value === 'true'
}

/**
 * Get a number setting
 */
export async function getNumberSetting(key: string, defaultValue: number = 0): Promise<number> {
  const value = await getSetting(key, defaultValue.toString())
  const num = parseFloat(value)
  return isNaN(num) ? defaultValue : num
}

/**
 * Clear the settings cache (useful after updating settings)
 */
export function clearSettingsCache() {
  settingsCache = null
  cacheTimestamp = 0
}

// Email Notification Settings
export const emailSettings = {
  /**
   * Check if email notifications are enabled
   */
  isEnabled: async (): Promise<boolean> => {
    return getBooleanSetting('emailNotificationsEnabled', true)
  },
  
  /**
   * Check if timeline update emails are enabled
   */
  timelineUpdates: async (): Promise<boolean> => {
    const masterEnabled = await emailSettings.isEnabled()
    if (!masterEnabled) return false
    return getBooleanSetting('emailTimelineUpdates', true)
  },
  
  /**
   * Check if status change emails are enabled
   */
  statusChanges: async (): Promise<boolean> => {
    const masterEnabled = await emailSettings.isEnabled()
    if (!masterEnabled) return false
    return getBooleanSetting('emailStatusChanges', true)
  },
  
  /**
   * Check if payment update emails are enabled
   */
  paymentUpdates: async (): Promise<boolean> => {
    const masterEnabled = await emailSettings.isEnabled()
    if (!masterEnabled) return false
    return getBooleanSetting('emailPaymentUpdates', true)
  },
}

// Security Settings
export const securitySettings = {
  /**
   * Get session timeout in minutes
   */
  getSessionTimeout: async (): Promise<number> => {
    return getNumberSetting('sessionTimeout', 30)
  },
  
  /**
   * Get maximum login attempts before lockout
   */
  getMaxLoginAttempts: async (): Promise<number> => {
    return getNumberSetting('maxLoginAttempts', 5)
  },
  
  /**
   * Get minimum password length
   */
  getPasswordMinLength: async (): Promise<number> => {
    return getNumberSetting('passwordMinLength', 8)
  },
  
  /**
   * Check if strong passwords are required
   */
  requireStrongPassword: async (): Promise<boolean> => {
    return getBooleanSetting('requireStrongPassword', false)
  },
}

// General Settings
export const generalSettings = {
  /**
   * Get site name
   */
  getSiteName: async (): Promise<string> => {
    return getSetting('siteName', 'GritSync')
  },
  
  /**
   * Get admin email
   */
  getAdminEmail: async (): Promise<string> => {
    return getSetting('siteEmail', 'admin@gritsync.com')
  },
  
  /**
   * Get support email
   */
  getSupportEmail: async (): Promise<string> => {
    return getSetting('supportEmail', 'support@gritsync.com')
  },
  
  /**
   * Check if maintenance mode is enabled
   */
  isMaintenanceMode: async (): Promise<boolean> => {
    return getBooleanSetting('maintenanceMode', false)
  },
}

// Payment Settings
export const paymentSettings = {
  /**
   * Check if Stripe is enabled
   */
  isStripeEnabled: async (): Promise<boolean> => {
    return getBooleanSetting('stripeEnabled', false)
  },
  
  /**
   * Get USD to PHP conversion mode
   */
  getUsdToPhpMode: async (): Promise<'manual' | 'automatic'> => {
    const mode = await getSetting('usdToPhpMode', 'manual')
    return (mode === 'automatic' ? 'automatic' : 'manual') as 'manual' | 'automatic'
  },
  
  /**
   * Get USD to PHP conversion rate
   */
  getUsdToPhpRate: async (): Promise<number> => {
    return getNumberSetting('usdToPhpRate', 56.00)
  },
  
  /**
   * Check if mobile banking is enabled
   */
  isMobileBankingEnabled: async (): Promise<boolean> => {
    return getBooleanSetting('mobileBankingEnabled', true)
  },
  
  /**
   * Get mobile banking configurations
   */
  getMobileBankingConfigs: async (): Promise<Array<{
    id: string
    name: string
    accountName: string
    accountNumber: string
    enabled: boolean
  }>> => {
    const configsJson = await getSetting('mobileBankingConfigs', '[]')
    try {
      const configs = JSON.parse(configsJson)
      // Filter to only enabled configs
      return configs.filter((c: any) => c.enabled)
    } catch {
      // Return default configs if parsing fails
      return [
        { id: 'bdo', name: 'BDO', accountName: 'Joy Jeric Cantila', accountNumber: '0059 4600 0994', enabled: true },
        { id: 'gcash', name: 'GCash', accountName: 'Joy Jeric Cantila', accountNumber: '09691533239', enabled: true },
        { id: 'zelle', name: 'Zelle', accountName: 'Joy Jeric Cantila', accountNumber: '509 270 3437', enabled: true },
      ]
    }
  },
  
  /**
   * Get mobile banking config by ID
   */
  getMobileBankingConfig: async (id: string): Promise<{
    id: string
    name: string
    accountName: string
    accountNumber: string
    enabled: boolean
  } | null> => {
    const configs = await paymentSettings.getMobileBankingConfigs()
    return configs.find(c => c.id === id) || null
  },
}

/**
 * Validate password against security settings
 */
export async function validatePasswordAgainstSettings(password: string): Promise<{ valid: boolean; message?: string }> {
  const minLength = await securitySettings.getPasswordMinLength()
  const requireStrong = await securitySettings.requireStrongPassword()
  
  if (password.length < minLength) {
    return {
      valid: false,
      message: `Password must be at least ${minLength} characters long`
    }
  }
  
  if (requireStrong) {
    const hasUpperCase = /[A-Z]/.test(password)
    const hasLowerCase = /[a-z]/.test(password)
    const hasNumber = /\d/.test(password)
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password)
    
    if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecialChar) {
      return {
        valid: false,
        message: 'Password must contain uppercase, lowercase, number, and special character'
      }
    }
  }
  
  return { valid: true }
}

/**
 * Check if a notification type should send email
 */
export async function shouldSendEmailNotification(type: 'timeline_update' | 'status_change' | 'payment' | 'general'): Promise<boolean> {
  const masterEnabled = await emailSettings.isEnabled()
  if (!masterEnabled) return false
  
  switch (type) {
    case 'timeline_update':
      return emailSettings.timelineUpdates()
    case 'status_change':
      return emailSettings.statusChanges()
    case 'payment':
      return emailSettings.paymentUpdates()
    case 'general':
      return true // General notifications are always enabled if master is enabled
    default:
      return false
  }
}

// Reminder Settings
export const reminderSettings = {
  /**
   * Check if reminders are enabled
   */
  isEnabled: async (): Promise<boolean> => {
    return getBooleanSetting('remindersEnabled', true)
  },
  
  /**
   * Check if profile completion reminders are enabled
   */
  isProfileReminderEnabled: async (): Promise<boolean> => {
    const masterEnabled = await reminderSettings.isEnabled()
    if (!masterEnabled) return false
    return getBooleanSetting('profileReminderEnabled', true)
  },
  
  /**
   * Get profile reminder interval in hours
   */
  getProfileReminderInterval: async (): Promise<number> => {
    return getNumberSetting('profileReminderInterval', 24)
  },
  
  /**
   * Get profile reminder message for a completion percentage
   */
  getProfileReminderMessage: async (completion: number): Promise<string> => {
    let messageKey = 'profileReminderMessage0'
    if (completion >= 80) {
      messageKey = 'profileReminderMessage80'
    } else if (completion >= 60) {
      messageKey = 'profileReminderMessage60'
    } else if (completion >= 40) {
      messageKey = 'profileReminderMessage40'
    } else if (completion >= 20) {
      messageKey = 'profileReminderMessage20'
    }
    
    const message = await getSetting(messageKey, '')
    // Replace {completion} placeholder with actual completion percentage
    return message.replace(/{completion}/g, completion.toString())
  },
}

// Greeting Settings
export const greetingSettings = {
  /**
   * Check if custom greetings are enabled
   */
  isCustomEnabled: async (): Promise<boolean> => {
    return getBooleanSetting('greetingCustomEnabled', false)
  },
  
  /**
   * Get greeting based on time of day
   */
  getGreeting: async (): Promise<string> => {
    const customEnabled = await greetingSettings.isCustomEnabled()
    
    if (customEnabled) {
      const hour = new Date().getHours()
      if (hour < 12) {
        return await getSetting('greetingMorning', 'Good morning')
      } else if (hour < 18) {
        return await getSetting('greetingAfternoon', 'Good afternoon')
      } else {
        return await getSetting('greetingEvening', 'Good evening')
      }
    } else {
      // Default behavior
      const hour = new Date().getHours()
      if (hour < 12) return 'Good morning'
      if (hour < 18) return 'Good afternoon'
      return 'Good evening'
    }
  },
  
  /**
   * Get morning greeting
   */
  getMorningGreeting: async (): Promise<string> => {
    return getSetting('greetingMorning', 'Good morning')
  },
  
  /**
   * Get afternoon greeting
   */
  getAfternoonGreeting: async (): Promise<string> => {
    return getSetting('greetingAfternoon', 'Good afternoon')
  },
  
  /**
   * Get evening greeting
   */
  getEveningGreeting: async (): Promise<string> => {
    return getSetting('greetingEvening', 'Good evening')
  },
}

