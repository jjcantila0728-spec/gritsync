import { useState } from 'react'
import { cn } from '@/lib/utils'

type AvatarSize = 'sm' | 'md' | 'lg'

const SIZES: Record<AvatarSize, string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-base',
}

interface AvatarCircleProps {
  src?: string | null
  name?: string | null
  size?: AvatarSize
  className?: string
}

function initialsOf(name?: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?'
}

// Shared avatar: image when available, initials fallback otherwise. Replaces
// the three independent avatar implementations in Header/Sidebar/menus.
export function AvatarCircle({ src, name, size = 'md', className }: AvatarCircleProps) {
  const [errored, setErrored] = useState(false)
  const showImage = src && !errored

  return (
    <div
      className={cn(
        'relative flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full',
        'bg-primary-100 dark:bg-primary-900/40 font-semibold text-primary-700 dark:text-primary-300',
        SIZES[size],
        className
      )}
      aria-hidden={!name}
    >
      {showImage ? (
        <img
          src={src}
          alt={name ?? ''}
          className="h-full w-full object-cover"
          onError={() => setErrored(true)}
        />
      ) : (
        <span>{initialsOf(name)}</span>
      )}
    </div>
  )
}
