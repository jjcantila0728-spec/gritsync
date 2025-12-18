/**
 * Progress Bar Component
 * Visual progress indicator for multi-step processes
 */

import { CheckCircle, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProgressStep {
  id: number
  label: string
  completed: boolean
  current: boolean
}

interface ProgressBarProps {
  steps: ProgressStep[]
  currentStep: number
  className?: string
  showLabels?: boolean
  orientation?: 'horizontal' | 'vertical'
}

export function ProgressBar({
  steps,
  currentStep,
  className,
  showLabels = true,
  orientation = 'horizontal'
}: ProgressBarProps) {
  if (orientation === 'vertical') {
    return (
      <div className={cn('flex flex-col gap-2', className)}>
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all',
                  step.completed
                    ? 'bg-primary-600 border-primary-600 text-white'
                    : step.current
                    ? 'bg-primary-100 dark:bg-primary-900/30 border-primary-600 text-primary-600 dark:text-primary-400'
                    : 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-400'
                )}
              >
                {step.completed ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <span className="text-sm font-semibold">{step.id}</span>
                )}
              </div>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    'w-0.5 flex-1 my-1',
                    step.completed ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
                  )}
                />
              )}
            </div>
            {showLabels && (
              <div className="flex-1 pt-1">
                <p
                  className={cn(
                    'text-sm font-medium',
                    step.completed || step.current
                      ? 'text-gray-900 dark:text-gray-100'
                      : 'text-gray-500 dark:text-gray-400'
                  )}
                >
                  {step.label}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={cn('w-full', className)}>
      {/* Progress Bar */}
      <div className="relative">
        {/* Background Line */}
        <div className="absolute top-1/2 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-700 rounded-full transform -translate-y-1/2" />
        
        {/* Progress Fill */}
        <div
          className="absolute top-1/2 left-0 h-1 bg-primary-600 rounded-full transform -translate-y-1/2 transition-all duration-500"
          style={{
            width: `${((currentStep - 1) / (steps.length - 1)) * 100}%`
          }}
        />

        {/* Steps */}
        <div className="relative flex justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex flex-col items-center flex-1">
              <div
                className={cn(
                  'relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all',
                  step.completed
                    ? 'bg-primary-600 border-primary-600 text-white shadow-lg'
                    : step.current
                    ? 'bg-white dark:bg-gray-800 border-primary-600 text-primary-600 dark:text-primary-400 shadow-md'
                    : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-400'
                )}
              >
                {step.completed ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <span className="text-sm font-semibold">{step.id}</span>
                )}
              </div>
              {showLabels && (
                <div className="mt-2 text-center max-w-[100px]">
                  <p
                    className={cn(
                      'text-xs font-medium',
                      step.completed || step.current
                        ? 'text-gray-900 dark:text-gray-100'
                        : 'text-gray-500 dark:text-gray-400'
                    )}
                  >
                    {step.label}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Progress Percentage */}
      <div className="mt-4 text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Step {currentStep} of {steps.length} ({Math.round((currentStep / steps.length) * 100)}% complete)
        </p>
      </div>
    </div>
  )
}



