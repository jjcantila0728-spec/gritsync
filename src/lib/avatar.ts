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
 * Generate a consistent background color based on a string (name or email)
 * Uses soft background colors - unique and permanent for each user
 */
export function getAvatarColor(str: string | undefined | null): string {
  if (!str) return 'bg-gray-200'
  
  const hash = generateHash(str)
  
  // Soft color palette for backgrounds (light mode)
  const colors = [
    'bg-primary-200',      // Soft red
    'bg-blue-200',         // Soft blue
    'bg-green-200',        // Soft green
    'bg-purple-200',       // Soft purple
    'bg-pink-200',         // Soft pink
    'bg-indigo-200',       // Soft indigo
    'bg-teal-200',         // Soft teal
    'bg-orange-200',       // Soft orange
    'bg-cyan-200',         // Soft cyan
    'bg-amber-200',        // Soft amber
  ]
  
  const index = Math.abs(hash) % colors.length
  return colors[index]
}

/**
 * Get dark mode variant of avatar background color
 * Uses softer colors for dark mode backgrounds - unique and permanent for each user
 */
export function getAvatarColorDark(str: string | undefined | null): string {
  if (!str) return 'dark:bg-gray-700'
  
  const hash = generateHash(str)
  
  // Softer colors for dark mode backgrounds
  const colors = [
    'dark:bg-primary-800',
    'dark:bg-blue-800',
    'dark:bg-green-800',
    'dark:bg-purple-800',
    'dark:bg-pink-800',
    'dark:bg-indigo-800',
    'dark:bg-teal-800',
    'dark:bg-orange-800',
    'dark:bg-cyan-800',
    'dark:bg-amber-800',
  ]
  
  const index = Math.abs(hash) % colors.length
  return colors[index]
}

/**
 * Generate a consistent text color based on a string (name or email)
 * Returns colored text that contrasts with the soft background
 * Unique and permanent for each user
 */
export function getAvatarTextColor(str: string | undefined | null): string {
  if (!str) return 'text-gray-700'
  
  const hash = generateHash(str)
  
  // Vibrant text colors that contrast with soft backgrounds (light mode)
  const colors = [
    'text-primary-700',      // Dark red
    'text-blue-700',         // Dark blue
    'text-green-700',        // Dark green
    'text-purple-700',       // Dark purple
    'text-pink-700',         // Dark pink
    'text-indigo-700',       // Dark indigo
    'text-teal-700',         // Dark teal
    'text-orange-700',       // Dark orange
    'text-cyan-700',         // Dark cyan
    'text-amber-700',        // Dark amber
  ]
  
  const index = Math.abs(hash) % colors.length
  return colors[index]
}

/**
 * Get dark mode variant of avatar text color
 * Returns lighter text colors for dark mode backgrounds
 * Unique and permanent for each user
 */
export function getAvatarTextColorDark(str: string | undefined | null): string {
  if (!str) return 'dark:text-gray-200'
  
  const hash = generateHash(str)
  
  // Lighter text colors for dark mode backgrounds
  const colors = [
    'dark:text-primary-200',
    'dark:text-blue-200',
    'dark:text-green-200',
    'dark:text-purple-200',
    'dark:text-pink-200',
    'dark:text-indigo-200',
    'dark:text-teal-200',
    'dark:text-orange-200',
    'dark:text-cyan-200',
    'dark:text-amber-200',
  ]
  
  const index = Math.abs(hash) % colors.length
  return colors[index]
}

