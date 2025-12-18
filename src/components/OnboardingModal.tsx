import { useState, useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { X, ChevronRight, ChevronLeft, FileText, Mail, Database, Cloud, CheckCircle, Sparkles } from 'lucide-react'

interface OnboardingStep {
  icon: ReactNode
  title: string
  description: string
  highlight?: string
}

const steps: OnboardingStep[] = [
  {
    icon: <Sparkles className="h-12 w-12 text-primary-500" />,
    title: 'Welcome to GritSync!',
    description: 'Your trusted partner in achieving your American Dream. We help Filipino nurses navigate the complex NCLEX application process with ease.',
    highlight: 'Join thousands of successful nurses who have obtained their US licenses with our help.'
  },
  {
    icon: <FileText className="h-12 w-12 text-blue-500" />,
    title: 'NCLEX Application Processing',
    description: 'Submit your NCLEX application with confidence. Our streamlined process ensures accuracy and reduces processing time by up to 50%.',
    highlight: 'Real-time tracking keeps you informed every step of the way.'
  },
  {
    icon: <Mail className="h-12 w-12 text-green-500" />,
    title: 'Personalized Business Mail',
    description: 'Get your own professional GritSync email address. Communicate with agencies and employers with a credible, professional identity.',
    highlight: 'Example: yourname@gritsync.com'
  },
  {
    icon: <Database className="h-12 w-12 text-purple-500" />,
    title: 'Full Client Database',
    description: 'All your application data, documents, and history in one secure place. Access your information anytime, anywhere.',
    highlight: 'Never lose track of your application progress again.'
  },
  {
    icon: <Cloud className="h-12 w-12 text-indigo-500" />,
    title: 'Dedicated Document Storage',
    description: 'Securely store all your important documents in the cloud. Upload once, use everywhere across all your applications.',
    highlight: 'Enterprise-grade security protects your sensitive information.'
  },
  {
    icon: <CheckCircle className="h-12 w-12 text-primary-500" />,
    title: "You're All Set!",
    description: 'Start your journey today by getting a free quote or submitting your first application. Our support team is available 24/7 to help.',
    highlight: 'Your American Dream awaits!'
  }
]

const ONBOARDING_KEY = 'gritsync_onboarding_completed'

export function OnboardingModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    const hasCompleted = localStorage.getItem(ONBOARDING_KEY)
    if (!hasCompleted) {
      const timer = setTimeout(() => setIsOpen(true), 1500)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleClose = () => {
    setIsOpen(false)
    localStorage.setItem(ONBOARDING_KEY, 'true')
  }

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1)
    } else {
      handleClose()
    }
  }

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
    }
  }

  const handleSkip = () => {
    handleClose()
  }

  if (!isOpen) return null

  const step = steps[currentStep]
  const isLastStep = currentStep === steps.length - 1

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-300">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors z-10"
          aria-label="Close onboarding"
        >
          <X className="h-5 w-5 text-gray-500" />
        </button>

        <div className="h-2 bg-gray-200 dark:bg-gray-700">
          <div 
            className="h-full bg-primary-500 transition-all duration-300"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>

        <div className="p-8 text-center">
          <div className="mb-6 flex justify-center">
            <div className="p-4 rounded-full bg-gray-100 dark:bg-gray-800">
              {step.icon}
            </div>
          </div>

          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            {step.title}
          </h2>

          <p className="text-gray-600 dark:text-gray-400 mb-4 text-lg">
            {step.description}
          </p>

          {step.highlight && (
            <div className="inline-block px-4 py-2 bg-primary-50 dark:bg-primary-900/30 rounded-lg">
              <p className="text-primary-700 dark:text-primary-300 font-medium">
                {step.highlight}
              </p>
            </div>
          )}
        </div>

        <div className="px-8 pb-8">
          <div className="flex items-center justify-between gap-4">
            <button
              onClick={handleSkip}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-sm font-medium"
            >
              Skip tour
            </button>

            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <Button
                  variant="outline"
                  onClick={handlePrev}
                  className="px-4"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              )}

              {isLastStep ? (
                <div className="flex gap-2">
                  <Link to="/quote" onClick={handleClose}>
                    <Button className="px-6">
                      Get a Quote
                    </Button>
                  </Link>
                  <Link to="/register" onClick={handleClose}>
                    <Button variant="outline" className="px-6">
                      Sign Up
                    </Button>
                  </Link>
                </div>
              ) : (
                <Button onClick={handleNext} className="px-6">
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </div>

          <div className="flex justify-center gap-2 mt-6">
            {steps.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentStep
                    ? 'bg-primary-500 w-6'
                    : index < currentStep
                    ? 'bg-primary-300'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
                aria-label={`Go to step ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function resetOnboarding() {
  localStorage.removeItem(ONBOARDING_KEY)
}
