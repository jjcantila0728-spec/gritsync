import { useColorScheme } from 'react-native'
import { useSyncExternalStore } from 'react'

export interface Palette {
  background: string
  surface: string
  surfaceMuted: string
  border: string
  text: string
  textMuted: string
  accent: string
  danger: string
  success: string
  /** Informational tint — used by neutral status pills, link chips. */
  info: string
  /** Warning tint — used by "pending" status pills, offline banners. */
  warning: string
  overlay: string
  tabBarActive: string
  tabBarInactive: string
  tabBarBackground: string
  /** Tonal pairs for status pills + soft callouts. Foreground stays legible
   *  on the matching background in both modes. */
  tones: {
    success: { bg: string; border: string; fg: string }
    info:    { bg: string; border: string; fg: string }
    warning: { bg: string; border: string; fg: string }
    danger:  { bg: string; border: string; fg: string }
    neutral: { bg: string; border: string; fg: string }
  }
}

interface ThemePalettes {
  brand: {
    red50: string
    red100: string
    red200: string
    red500: string
    red600: string
    red700: string
    red800: string
    blue: string
  }
  light: Palette
  dark: Palette
}

export const palette: ThemePalettes = {
  brand: {
    red50: '#FEF2F2',
    red100: '#FEE2E2',
    red200: '#FECACA',
    red500: '#EF4444',
    red600: '#DC2626',
    red700: '#B91C1C',
    red800: '#991B1B',
    blue: '#1D4ED8',
  },
  light: {
    background: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceMuted: '#F9FAFB',
    border: '#E5E7EB',
    text: '#111827',
    textMuted: '#6B7280',
    accent: '#DC2626',
    danger: '#DC2626',
    success: '#059669',
    info: '#1D4ED8',
    warning: '#B45309',
    overlay: 'rgba(17,24,39,0.45)',
    tabBarActive: '#DC2626',
    tabBarInactive: '#6B7280',
    tabBarBackground: '#FFFFFF',
    tones: {
      success: { bg: '#DCFCE7', border: '#86EFAC', fg: '#15803D' },
      info:    { bg: '#DBEAFE', border: '#93C5FD', fg: '#1D4ED8' },
      warning: { bg: '#FEF3C7', border: '#FCD34D', fg: '#B45309' },
      danger:  { bg: '#FEE2E2', border: '#FCA5A5', fg: '#B91C1C' },
      neutral: { bg: '#F3F4F6', border: '#E5E7EB', fg: '#374151' },
    },
  },
  dark: {
    background: '#0B0B0E',
    surface: '#111827',
    surfaceMuted: '#1F2937',
    border: '#374151',
    text: '#F9FAFB',
    textMuted: '#9CA3AF',
    accent: '#F87171',
    danger: '#F87171',
    success: '#34D399',
    info: '#60A5FA',
    warning: '#FBBF24',
    overlay: 'rgba(0,0,0,0.7)',
    tabBarActive: '#F87171',
    tabBarInactive: '#9CA3AF',
    tabBarBackground: '#0B0B0E',
    // Tonal pairs use higher-alpha overlays so they read on the dark surface
    // without the pastel "washed out" look of the light palette.
    tones: {
      success: { bg: 'rgba(52,211,153,0.16)',  border: 'rgba(52,211,153,0.40)',  fg: '#6EE7B7' },
      info:    { bg: 'rgba(96,165,250,0.16)',  border: 'rgba(96,165,250,0.40)',  fg: '#93C5FD' },
      warning: { bg: 'rgba(251,191,36,0.16)',  border: 'rgba(251,191,36,0.40)',  fg: '#FCD34D' },
      danger:  { bg: 'rgba(248,113,113,0.16)', border: 'rgba(248,113,113,0.40)', fg: '#FCA5A5' },
      neutral: { bg: 'rgba(156,163,175,0.14)', border: 'rgba(156,163,175,0.30)', fg: '#D1D5DB' },
    },
  },
}

// Tiny pub/sub for the user's theme override so non-context code (deep in
// helpers) can subscribe without going through React Context.
type ThemeOverride = 'system' | 'light' | 'dark'
let _override: ThemeOverride = 'system'
const _listeners = new Set<() => void>()
export function setThemeOverride(v: ThemeOverride) {
  if (_override === v) return
  _override = v
  _listeners.forEach((fn) => fn())
}
function subscribeOverride(cb: () => void) {
  _listeners.add(cb)
  return () => _listeners.delete(cb)
}
function getOverride() {
  return _override
}

export function useTheme(): { mode: 'light' | 'dark'; colors: Palette } {
  const scheme = useColorScheme()
  const override = useSyncExternalStore(subscribeOverride, getOverride, getOverride)
  const mode: 'light' | 'dark' =
    override === 'light' ? 'light' : override === 'dark' ? 'dark' : scheme === 'dark' ? 'dark' : 'light'
  return { mode, colors: palette[mode] }
}

/**
 * Theme hook for screens that need to look the same regardless of system
 * appearance — the exam runner, results, and review screens model the real
 * Pearson Vue testing environment, which is a light, neutral surface in
 * every NCLEX testing center worldwide. Locking those screens to a fixed
 * light palette keeps muscle memory consistent for test-takers.
 *
 * Note: this returns a hardcoded `light` palette but with `mode` set to
 * 'light' so the StatusBar and any conditional rendering stays consistent.
 */
export function useExamTheme(): { mode: 'light'; colors: Palette } {
  return { mode: 'light', colors: palette.light }
}

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 999,
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
}

export const fontSize = {
  xs: 12,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  title: 28,
}
