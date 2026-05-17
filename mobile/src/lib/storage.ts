import * as SecureStore from 'expo-secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

const useSecure = Platform.OS === 'ios' || Platform.OS === 'android'

export const storage = {
  async get(key: string): Promise<string | null> {
    if (useSecure) return SecureStore.getItemAsync(key)
    return AsyncStorage.getItem(key)
  },
  async set(key: string, value: string): Promise<void> {
    if (useSecure) return SecureStore.setItemAsync(key, value)
    await AsyncStorage.setItem(key, value)
  },
  async remove(key: string): Promise<void> {
    if (useSecure) return SecureStore.deleteItemAsync(key)
    await AsyncStorage.removeItem(key)
  },
}

export const StorageKeys = {
  accessToken: 'gritsync.accessToken',
  refreshToken: 'gritsync.refreshToken',
  user: 'gritsync.user',
  /** Last identifier used to log in (email / mobile / GRIT ID).
   *  Pre-fills the login screen so the user only types their password. */
  lastIdentifier: 'gritsync.lastIdentifier',
} as const
