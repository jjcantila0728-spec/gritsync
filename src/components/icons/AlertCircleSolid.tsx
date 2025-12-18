import { memo } from 'react'

interface AlertCircleSolidProps {
  className?: string
}

export const AlertCircleSolid = memo(({ className = '' }: AlertCircleSolidProps) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" className="text-red-600 dark:text-red-500" />
      <path
        d="M12 7v6m0 4h.01"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
})

AlertCircleSolid.displayName = 'AlertCircleSolid'

