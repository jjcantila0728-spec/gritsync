import * as LocalAuthentication from 'expo-local-authentication'
import { storage } from './storage'

const REMEMBER_KEY = 'gritsync.biometric.credentials'
const ENABLED_KEY = 'gritsync.biometric.enabled'

export interface RememberedCredentials {
  identifier: string
  password: string
}

export const biometric = {
  async isAvailable(): Promise<boolean> {
    try {
      const has = await LocalAuthentication.hasHardwareAsync()
      const enrolled = await LocalAuthentication.isEnrolledAsync()
      return has && enrolled
    } catch {
      return false
    }
  },

  async kind(): Promise<'face' | 'fingerprint' | 'iris' | 'none'> {
    try {
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync()
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'face'
      if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'fingerprint'
      if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) return 'iris'
      return 'none'
    } catch {
      return 'none'
    }
  },

  async isEnabled(): Promise<boolean> {
    const v = await storage.get(ENABLED_KEY)
    return v === '1'
  },

  async setEnabled(enabled: boolean): Promise<void> {
    if (enabled) await storage.set(ENABLED_KEY, '1')
    else await storage.remove(ENABLED_KEY)
  },

  async rememberCredentials(c: RememberedCredentials): Promise<void> {
    await storage.set(REMEMBER_KEY, JSON.stringify(c))
    await this.setEnabled(true)
  },

  async getRemembered(): Promise<RememberedCredentials | null> {
    const raw = await storage.get(REMEMBER_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw) as RememberedCredentials
    } catch {
      return null
    }
  },

  async forget(): Promise<void> {
    await storage.remove(REMEMBER_KEY)
    await this.setEnabled(false)
  },

  async authenticate(prompt = 'Sign in with biometrics'): Promise<boolean> {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: prompt,
        fallbackLabel: 'Use password',
        disableDeviceFallback: false,
        cancelLabel: 'Cancel',
      })
      return result.success
    } catch {
      return false
    }
  },
}
