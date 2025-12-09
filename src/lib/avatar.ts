/**
 * Generate avatar initials from a name
 */
export function getInitials(name: string | undefined | null): string {
  if (!name) return 'U'
  
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}

/**
 * Generate a hash from a string (consistent for same input)
 */
function generateHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return hash
}

/**
 * Get color palette based on design preference
 */
function getColorPalette(design: string | null | undefined): {
  light: string[]
  dark: string[]
  textLight: string[]
  textDark: string[]
} {
  const designs: Record<string, {
    light: string[]
    dark: string[]
    textLight: string[]
    textDark: string[]
  }> = {
    default: {
      light: [
        'bg-primary-200', 'bg-blue-200', 'bg-green-200', 'bg-purple-200',
        'bg-pink-200', 'bg-indigo-200', 'bg-teal-200', 'bg-orange-200',
        'bg-cyan-200', 'bg-amber-200'
      ],
      dark: [
        'dark:bg-primary-800', 'dark:bg-blue-800', 'dark:bg-green-800', 'dark:bg-purple-800',
        'dark:bg-pink-800', 'dark:bg-indigo-800', 'dark:bg-teal-800', 'dark:bg-orange-800',
        'dark:bg-cyan-800', 'dark:bg-amber-800'
      ],
      textLight: [
        'text-primary-700', 'text-blue-700', 'text-green-700', 'text-purple-700',
        'text-pink-700', 'text-indigo-700', 'text-teal-700', 'text-orange-700',
        'text-cyan-700', 'text-amber-700'
      ],
      textDark: [
        'dark:text-primary-200', 'dark:text-blue-200', 'dark:text-green-200', 'dark:text-purple-200',
        'dark:text-pink-200', 'dark:text-indigo-200', 'dark:text-teal-200', 'dark:text-orange-200',
        'dark:text-cyan-200', 'dark:text-amber-200'
      ]
    },
    vibrant: {
      light: [
        'bg-red-400', 'bg-blue-400', 'bg-green-400', 'bg-purple-400',
        'bg-pink-400', 'bg-indigo-400', 'bg-teal-400', 'bg-orange-400',
        'bg-cyan-400', 'bg-yellow-400'
      ],
      dark: [
        'dark:bg-red-600', 'dark:bg-blue-600', 'dark:bg-green-600', 'dark:bg-purple-600',
        'dark:bg-pink-600', 'dark:bg-indigo-600', 'dark:bg-teal-600', 'dark:bg-orange-600',
        'dark:bg-cyan-600', 'dark:bg-yellow-600'
      ],
      textLight: [
        'text-white', 'text-white', 'text-white', 'text-white',
        'text-white', 'text-white', 'text-white', 'text-white',
        'text-white', 'text-gray-900'
      ],
      textDark: [
        'dark:text-white', 'dark:text-white', 'dark:text-white', 'dark:text-white',
        'dark:text-white', 'dark:text-white', 'dark:text-white', 'dark:text-white',
        'dark:text-white', 'dark:text-gray-900'
      ]
    },
    pastel: {
      light: [
        'bg-rose-100', 'bg-sky-100', 'bg-emerald-100', 'bg-violet-100',
        'bg-fuchsia-100', 'bg-indigo-100', 'bg-cyan-100', 'bg-amber-100',
        'bg-teal-100', 'bg-pink-100'
      ],
      dark: [
        'dark:bg-rose-900', 'dark:bg-sky-900', 'dark:bg-emerald-900', 'dark:bg-violet-900',
        'dark:bg-fuchsia-900', 'dark:bg-indigo-900', 'dark:bg-cyan-900', 'dark:bg-amber-900',
        'dark:bg-teal-900', 'dark:bg-pink-900'
      ],
      textLight: [
        'text-rose-700', 'text-sky-700', 'text-emerald-700', 'text-violet-700',
        'text-fuchsia-700', 'text-indigo-700', 'text-cyan-700', 'text-amber-700',
        'text-teal-700', 'text-pink-700'
      ],
      textDark: [
        'dark:text-rose-200', 'dark:text-sky-200', 'dark:text-emerald-200', 'dark:text-violet-200',
        'dark:text-fuchsia-200', 'dark:text-indigo-200', 'dark:text-cyan-200', 'dark:text-amber-200',
        'dark:text-teal-200', 'dark:text-pink-200'
      ]
    },
    monochrome: {
      light: [
        'bg-gray-300', 'bg-gray-400', 'bg-gray-500', 'bg-slate-300',
        'bg-slate-400', 'bg-zinc-300', 'bg-zinc-400', 'bg-neutral-300',
        'bg-neutral-400', 'bg-stone-300'
      ],
      dark: [
        'dark:bg-gray-600', 'dark:bg-gray-700', 'dark:bg-gray-500', 'dark:bg-slate-600',
        'dark:bg-slate-700', 'dark:bg-zinc-600', 'dark:bg-zinc-700', 'dark:bg-neutral-600',
        'dark:bg-neutral-700', 'dark:bg-stone-600'
      ],
      textLight: [
        'text-gray-800', 'text-gray-900', 'text-white', 'text-slate-800',
        'text-slate-900', 'text-zinc-800', 'text-zinc-900', 'text-neutral-800',
        'text-neutral-900', 'text-stone-800'
      ],
      textDark: [
        'dark:text-gray-100', 'dark:text-gray-50', 'dark:text-gray-900', 'dark:text-slate-100',
        'dark:text-slate-50', 'dark:text-zinc-100', 'dark:text-zinc-50', 'dark:text-neutral-100',
        'dark:text-neutral-50', 'dark:text-stone-100'
      ]
    }
  }
  
  return designs[design || 'default'] || designs.default
}

/**
 * Generate a consistent background color based on a string (name or email)
 * Uses soft background colors - unique and permanent for each user
 */
export function getAvatarColor(str: string | undefined | null, design?: string | null): string {
  if (!str) return 'bg-gray-200'
  
  const hash = generateHash(str)
  const palette = getColorPalette(design)
  
  const index = Math.abs(hash) % palette.light.length
  return palette.light[index]
}

/**
 * Get dark mode variant of avatar background color
 * Uses softer colors for dark mode backgrounds - unique and permanent for each user
 */
export function getAvatarColorDark(str: string | undefined | null, design?: string | null): string {
  if (!str) return 'dark:bg-gray-700'
  
  const hash = generateHash(str)
  const palette = getColorPalette(design)
  
  const index = Math.abs(hash) % palette.dark.length
  return palette.dark[index]
}

/**
 * Generate a consistent text color based on a string (name or email)
 * Returns colored text that contrasts with the soft background
 * Unique and permanent for each user
 */
export function getAvatarTextColor(str: string | undefined | null, design?: string | null): string {
  if (!str) return 'text-gray-700'
  
  const hash = generateHash(str)
  const palette = getColorPalette(design)
  
  const index = Math.abs(hash) % palette.textLight.length
  return palette.textLight[index]
}

/**
 * Get dark mode variant of avatar text color
 * Returns lighter text colors for dark mode backgrounds
 * Unique and permanent for each user
 */
export function getAvatarTextColorDark(str: string | undefined | null, design?: string | null): string {
  if (!str) return 'dark:text-gray-200'
  
  const hash = generateHash(str)
  const palette = getColorPalette(design)
  
  const index = Math.abs(hash) % palette.textDark.length
  return palette.textDark[index]
}

/**
 * Get available avatar design options
 */
export function getAvatarDesigns(): Array<{ value: string; label: string; description: string }> {
  return [
    { value: 'default', label: 'Default', description: 'Soft, balanced colors' },
    { value: 'vibrant', label: 'Vibrant', description: 'Bold, bright colors' },
    { value: 'pastel', label: 'Pastel', description: 'Light, gentle colors' },
    { value: 'monochrome', label: 'Monochrome', description: 'Gray scale colors' }
  ]
}

