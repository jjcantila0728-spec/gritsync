import { useState, useEffect, type ReactNode } from 'react'
import { 
  X, 
  ChevronRight, 
  ChevronLeft, 
  FileText, 
  BarChart3, 
  Bell, 
  Upload, 
  CreditCard,
  CheckCircle,
  Sparkles,
  Home,
  Settings,
  Users,
  FolderOpen,
  Clock,
  ArrowRight
} from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface OnboardingStep {
  id: string
  icon: ReactNode
  title: string
  description: string
  highlight?: string
  position: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  animationType: 'fade' | 'slide-up' | 'slide-left' | 'slide-right' | 'zoom' | 'bounce'
}

const STORAGE_KEY = 'gritsync_dashboard_onboarding_completed'

const steps: OnboardingStep[] = [
  {
    id: 'welcome',
    icon: <Sparkles className="h-12 w-12 text-primary-500" />,
    title: 'Welcome to Your Dashboard!',
    description: 'This is your command center for managing NCLEX applications. Let us show you around so you can navigate like a pro.',
    position: 'center',
    animationType: 'zoom'
  },
  {
    id: 'stats',
    icon: <BarChart3 className="h-12 w-12 text-blue-500" />,
    title: 'Your Statistics at a Glance',
    description: 'The stats cards show your application progress - total applications, pending reviews, completed cases, and quotations. Stay informed at all times.',
    highlight: 'stats-grid',
    position: 'top-left',
    animationType: 'slide-right'
  },
  {
    id: 'quick-actions',
    icon: <ArrowRight className="h-12 w-12 text-green-500" />,
    title: 'Quick Actions',
    description: 'Need to start a new application or check your documents? Quick action buttons give you instant access to common tasks.',
    highlight: 'quick-actions',
    position: 'top-right',
    animationType: 'slide-left'
  },
  {
    id: 'sidebar',
    icon: <Home className="h-12 w-12 text-purple-500" />,
    title: 'Navigation Sidebar',
    description: 'The sidebar on the left is your navigation hub. Access your Dashboard, Applications, Documents, Quotations, and Account Settings.',
    highlight: 'sidebar',
    position: 'center',
    animationType: 'slide-right'
  },
  {
    id: 'applications',
    icon: <FileText className="h-12 w-12 text-primary-500" />,
    title: 'Manage Applications',
    description: 'Click "Applications" to view, track, and manage all your NCLEX applications. Each application shows real-time status updates.',
    highlight: 'applications-link',
    position: 'top-left',
    animationType: 'fade'
  },
  {
    id: 'documents',
    icon: <Upload className="h-12 w-12 text-amber-500" />,
    title: 'Document Management',
    description: 'Upload and organize your important documents - passport, diploma, certificates, and more. All securely stored in your dedicated cloud storage.',
    highlight: 'documents-link',
    position: 'top-left',
    animationType: 'slide-up'
  },
  {
    id: 'activity',
    icon: <Clock className="h-12 w-12 text-indigo-500" />,
    title: 'Recent Activity',
    description: 'Track all updates on your applications in real-time. Every status change, document upload, and payment is logged here.',
    highlight: 'recent-activity',
    position: 'bottom-right',
    animationType: 'slide-left'
  },
  {
    id: 'notifications',
    icon: <Bell className="h-12 w-12 text-orange-500" />,
    title: 'Stay Notified',
    description: 'The notification bell in the header alerts you to important updates. Never miss a status change or required action.',
    highlight: 'notifications',
    position: 'top-right',
    animationType: 'bounce'
  },
  {
    id: 'complete',
    icon: <CheckCircle className="h-12 w-12 text-green-500" />,
    title: "You're All Set!",
    description: "You're now ready to navigate GritSync like a pro. Start your NCLEX journey today and achieve your American Dream!",
    position: 'center',
    animationType: 'zoom'
  }
]

interface DashboardOnboardingProps {
  onComplete?: () => void
  forceShow?: boolean
}

export function DashboardOnboarding({ onComplete, forceShow = false }: DashboardOnboardingProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const [showSpotlight, setShowSpotlight] = useState(false)

  useEffect(() => {
    if (forceShow) {
      setIsVisible(true)
      return
    }

    const hasCompleted = localStorage.getItem(STORAGE_KEY)
    if (!hasCompleted) {
      const timer = setTimeout(() => {
        setIsVisible(true)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [forceShow])

  useEffect(() => {
    if (isVisible && steps[currentStep]?.highlight) {
      setShowSpotlight(true)
    } else {
      setShowSpotlight(false)
    }
  }, [currentStep, isVisible])

  const handleNext = () => {
    if (isAnimating) return
    setIsAnimating(true)
    
    if (currentStep < steps.length - 1) {
      setTimeout(() => {
        setCurrentStep(prev => prev + 1)
        setIsAnimating(false)
      }, 300)
    } else {
      handleComplete()
    }
  }

  const handlePrev = () => {
    if (isAnimating || currentStep === 0) return
    setIsAnimating(true)
    
    setTimeout(() => {
      setCurrentStep(prev => prev - 1)
      setIsAnimating(false)
    }, 300)
  }

  const handleComplete = () => {
    localStorage.setItem(STORAGE_KEY, 'true')
    setIsVisible(false)
    onComplete?.()
  }

  const handleSkip = () => {
    localStorage.setItem(STORAGE_KEY, 'true')
    setIsVisible(false)
    onComplete?.()
  }

  const getAnimationClass = (type: string, isEntering: boolean) => {
    if (isAnimating && !isEntering) {
      return 'opacity-0 scale-95'
    }
    
    const animations: Record<string, string> = {
      'fade': 'animate-fadeIn',
      'slide-up': 'animate-slideUp',
      'slide-left': 'animate-slideLeft',
      'slide-right': 'animate-slideRight',
      'zoom': 'animate-zoomIn',
      'bounce': 'animate-bounceIn'
    }
    return animations[type] || 'animate-fadeIn'
  }

  const getPositionClass = (position: string) => {
    const positions: Record<string, string> = {
      'center': 'items-center justify-center',
      'top-left': 'items-start justify-start pt-32 pl-8 md:pl-72',
      'top-right': 'items-start justify-end pt-32 pr-8',
      'bottom-left': 'items-end justify-start pb-32 pl-8 md:pl-72',
      'bottom-right': 'items-end justify-end pb-32 pr-8'
    }
    return positions[position] || positions['center']
  }

  if (!isVisible) return null

  const step = steps[currentStep]
  const progress = ((currentStep + 1) / steps.length) * 100

  return (
    <>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideLeft {
          from { opacity: 0; transform: translateX(30px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideRight {
          from { opacity: 0; transform: translateX(-30px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes zoomIn {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes bounceIn {
          0% { opacity: 0; transform: scale(0.3); }
          50% { transform: scale(1.05); }
          70% { transform: scale(0.9); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes spotlight {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          70% { box-shadow: 0 0 0 20px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .animate-fadeIn { animation: fadeIn 0.5s ease-out forwards; }
        .animate-slideUp { animation: slideUp 0.5s ease-out forwards; }
        .animate-slideLeft { animation: slideLeft 0.5s ease-out forwards; }
        .animate-slideRight { animation: slideRight 0.5s ease-out forwards; }
        .animate-zoomIn { animation: zoomIn 0.5s ease-out forwards; }
        .animate-bounceIn { animation: bounceIn 0.6s ease-out forwards; }
        .animate-pulse-slow { animation: pulse 2s ease-in-out infinite; }
        .animate-spotlight { animation: spotlight 2s infinite; }
        .animate-float { animation: float 3s ease-in-out infinite; }
        .shimmer-bg {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
          background-size: 200% 100%;
          animation: shimmer 2s infinite;
        }
      `}</style>

      <div className="fixed inset-0 z-[100] pointer-events-auto">
        <div 
          className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-500"
          onClick={handleSkip}
        />

        {showSpotlight && step.highlight && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="relative w-full h-full">
              <div 
                className="absolute rounded-2xl border-4 border-primary-500 animate-spotlight"
                style={{
                  transition: 'all 0.5s ease-out',
                  ...(step.highlight === 'stats-grid' && {
                    top: '140px',
                    left: '280px',
                    right: '40px',
                    height: '180px'
                  }),
                  ...(step.highlight === 'sidebar' && {
                    top: '64px',
                    left: '0',
                    width: '256px',
                    bottom: '0'
                  }),
                  ...(step.highlight === 'quick-actions' && {
                    top: '350px',
                    left: '280px',
                    width: '400px',
                    height: '200px'
                  }),
                  ...(step.highlight === 'recent-activity' && {
                    top: '350px',
                    right: '40px',
                    width: '500px',
                    height: '300px'
                  }),
                  ...(step.highlight === 'notifications' && {
                    top: '12px',
                    right: '120px',
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%'
                  })
                }}
              >
                <div className="absolute inset-0 bg-primary-500/10 rounded-xl shimmer-bg" />
              </div>
            </div>
          </div>
        )}

        <div className={`absolute inset-0 flex ${getPositionClass(step.position)} p-4 pointer-events-none`}>
          <div 
            className={`
              relative max-w-lg w-full bg-white dark:bg-gray-900 rounded-3xl shadow-2xl 
              border border-gray-200 dark:border-gray-700 overflow-hidden pointer-events-auto
              ${getAnimationClass(step.animationType, !isAnimating)}
            `}
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-700">
              <div 
                className="h-full bg-gradient-to-r from-primary-500 to-primary-600 transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>

            <button
              onClick={handleSkip}
              className="absolute top-4 right-4 p-2 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors z-10"
              aria-label="Skip tutorial"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="p-8 pt-10">
              <div className="flex flex-col items-center text-center">
                <div className="mb-6 p-4 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 animate-float">
                  {step.icon}
                </div>

                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                  {step.title}
                </h2>

                <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
                  {step.description}
                </p>

                <div className="flex items-center justify-center gap-2 mb-8">
                  {steps.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => !isAnimating && setCurrentStep(index)}
                      className={`
                        h-2 rounded-full transition-all duration-300
                        ${index === currentStep 
                          ? 'w-8 bg-primary-500' 
                          : index < currentStep 
                            ? 'w-2 bg-primary-300 dark:bg-primary-700' 
                            : 'w-2 bg-gray-300 dark:bg-gray-600'
                        }
                      `}
                      aria-label={`Go to step ${index + 1}`}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-3 w-full">
                  {currentStep > 0 && (
                    <Button
                      variant="outline"
                      onClick={handlePrev}
                      disabled={isAnimating}
                      className="flex-1"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Back
                    </Button>
                  )}
                  
                  <Button
                    onClick={handleNext}
                    disabled={isAnimating}
                    className={`flex-1 ${currentStep === 0 ? 'w-full' : ''}`}
                  >
                    {currentStep === steps.length - 1 ? (
                      <>
                        Get Started
                        <Sparkles className="h-4 w-4 ml-2" />
                      </>
                    ) : (
                      <>
                        Next
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </>
                    )}
                  </Button>
                </div>

                <button
                  onClick={handleSkip}
                  className="mt-4 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                >
                  Skip tutorial
                </button>
              </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-500 via-purple-500 to-blue-500 opacity-50" />
          </div>
        </div>
      </div>
    </>
  )
}

export function resetDashboardOnboarding() {
  localStorage.removeItem(STORAGE_KEY)
}
