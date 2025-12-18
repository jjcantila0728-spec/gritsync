import { CheckCircle, XCircle, Clock, FileText } from 'lucide-react'
import type { ApplicationData } from '../types'

export const formatStatusDisplay = (status: string): string => {
  return status
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed':
      return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
    case 'rejected':
      return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
    case 'in-progress':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
    case 'initiated':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
    case 'approved': // Legacy support
      return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
    case 'pending': // Legacy support
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
  }
}

export const getStatusIcon = (status: string) => {
  switch (status) {
    case 'completed':
      return <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
    case 'rejected':
      return <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
    case 'in-progress':
      return <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
    case 'initiated':
      return <FileText className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
    case 'approved': // Legacy support
      return <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
    case 'pending': // Legacy support
      return <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
    default:
      return <FileText className="h-5 w-5 text-gray-600 dark:text-gray-400" />
  }
}

export const calculateStatus = (
  application: ApplicationData | null,
  payments: any[],
  getStepStatus: (key: string) => 'pending' | 'completed',
  getStepData: (key: string) => any
): 'initiated' | 'in-progress' | 'rejected' | 'completed' | 'pending' | 'approved' => {
  // FIRST: Check the database status - this is the source of truth
  // Normalize status to lowercase for case-insensitive comparison
  const dbStatus = application?.status ? String(application.status).toLowerCase().trim() : null
  
  // If database status is explicitly completed or approved, return completed
  if (dbStatus === 'completed' || dbStatus === 'approved') {
    return 'completed'
  }
  
  // If status is manually set to rejected by admin, keep it
  if (dbStatus === 'rejected') {
    return 'rejected'
  }
  
  // Check if exam result has been declared (quick_results step with result data)
  const quickResultsData = getStepData('quick_results')
  const hasResult = !!(quickResultsData?.result)
  if (hasResult) {
    return 'completed'
  }
  
  // Check if quick_results step is marked as completed (even without result data)
  const quickResultsStep = getStepStatus('quick_results')
  if (quickResultsStep === 'completed') {
    return 'completed'
  }
  
  // Check if Application Submission is completed
  const appCreated = getStepStatus('app_created') === 'completed' || !!application?.created_at
  const docsSubmitted = getStepStatus('documents_submitted') === 'completed' || !!(application?.picture_path && application?.diploma_path && application?.passport_path)
  const appPaid = getStepStatus('app_paid') === 'completed' || payments.some((p: any) => p.status === 'paid' && p.payment_type === 'step1')
  const appSubmissionCompleted = appCreated && docsSubmitted && appPaid
  
  if (!appSubmissionCompleted) {
    return 'initiated'
  }
  
  return 'in-progress'
}







