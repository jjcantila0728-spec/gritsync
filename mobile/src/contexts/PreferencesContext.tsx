import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { storage } from '@/lib/storage'
import { setThemeOverride, useTheme, type Palette } from '@/theme'

export type ThemePreference = 'system' | 'light' | 'dark'

interface PreferencesState {
  themePreference: ThemePreference
  setThemePreference: (t: ThemePreference) => void
  mode: 'light' | 'dark'
  colors: Palette
}

const PrefsContext = createContext<PreferencesState | undefined>(undefined)

const THEME_KEY = 'gritsync.prefs.theme'

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>('system')

  useEffect(() => {
    void (async () => {
      const t = await storage.get(THEME_KEY)
      if (t === 'light' || t === 'dark' || t === 'system') {
        setThemePreferenceState(t)
        setThemeOverride(t)
      }
    })()
  }, [])

  const setThemePreference = useCallback((t: ThemePreference) => {
    setThemePreferenceState(t)
    setThemeOverride(t)
    void storage.set(THEME_KEY, t)
  }, [])

  const { mode, colors } = useTheme()

  const value = useMemo<PreferencesState>(
    () => ({ themePreference, setThemePreference, mode, colors }),
    [themePreference, setThemePreference, mode, colors],
  )

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>
}

export function usePreferences(): PreferencesState {
  const ctx = useContext(PrefsContext)
  if (!ctx) throw new Error('usePreferences must be used inside <PreferencesProvider>')
  return ctx
}
