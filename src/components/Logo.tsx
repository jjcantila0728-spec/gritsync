import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
  showText?: boolean
}

export function Logo({ className, showText = true }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="logo-container">
        <img 
          src="/gritsync_logo.png" 
          alt="GritSync Logo" 
          className="rounded-lg"
        />
      </div>
      {showText && (
        <span className="text-xl font-bold logo-text">
          <span className="logo-text-grit">GRIT</span>
          <span className="logo-text-sync">SYNC</span>
        </span>
      )}
    </div>
  )
}

