import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { CheckCircle, ChevronDown, ChevronRight, FileText, Download, Upload, Clock, Copy, Loader2, PenTool, Eye, Info } from 'lucide-react'
import { formatDate, formatCurrency, sanitizeHTML } from '@/lib/utils'
import { userDocumentsAPI, getSignedFileUrl, processingAccountsAPI } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { useErrorHandler } from '@/lib/use-error-handler'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { PDFDocument } from 'pdf-lib'
import { employerVerificationEmailTemplate } from '@/templates/employer-verification-email-template'
import { getRenderedTemplate } from '@/lib/email-template-service'
import { SignatureModal } from '@/components/SignatureModal'
import { PDFReviewModal } from '@/components/PDFReviewModal'
import { SignatureSuccessAnimation } from '@/components/SignatureSuccessAnimation'
import type { TimelineStepProps } from '../types'

export function TimelineStep({ 
  stepNumber, 
  title, 
  isCompleted, 
  isAdmin, 
  onUpdateStep, 
  onUpdateSubStep,
  subSteps,
  application,
  attCode,
  examDate,
  examLocation,
  examTime,
  result,
  showGenerateLetter = false,
  phoneNumber = '+1 (509) 270-3437',
  user,
  navigate,
  showToast,
  verifyUSCISForms,
  generateG1145Form,
  generateI765Form,
  generateCoverLetter,
  viewingPdfUrl,
  viewingPdfName,
  showPdfModal,
  setViewingPdfUrl,
  setViewingPdfName,
  setShowPdfModal
}: TimelineStepProps) {
  const { handleError: handleErrorSilently } = useErrorHandler()
  const [isExpanded, setIsExpanded] = useState(true)
  const [attCodeValue, setAttCodeValue] = useState<string>('')
  const [attExpiryDate, setAttExpiryDate] = useState<string>('')
  const [savingAttNotes, setSavingAttNotes] = useState(false)
  const [examDateValue, setExamDateValue] = useState<string>('')
  const [examTimeValue, setExamTimeValue] = useState<string>('')
  const [examLocationValue, setExamLocationValue] = useState<string>('')
  const [savingExamDetails, setSavingExamDetails] = useState(false)
  const [examResult, setExamResult] = useState<string>(result || '')
  const [savingResult, setSavingResult] = useState(false)
  const [form1RefNumber, setForm1RefNumber] = useState<string>('')
  const [form1Date, setForm1Date] = useState<string>('')
  const [savingForm1, setSavingForm1] = useState(false)
  const [eadTrackingNumber, setEadTrackingNumber] = useState<string>('')
  const [eadUscisNumber, setEadUscisNumber] = useState<string>('')
  const [eadCardTrackingNumber, setEadCardTrackingNumber] = useState<string>('')
  const [savingEadData, setSavingEadData] = useState(false)
  const [generatingEmail, setGeneratingEmail] = useState(false)
  const [compilingDocuments, setCompilingDocuments] = useState(false)
  const [generatingFinalPackage, setGeneratingFinalPackage] = useState(false)
  const [showSignatureModal, setShowSignatureModal] = useState(false)
  const [signatureDocumentName, setSignatureDocumentName] = useState<string>('')
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [reviewPdfBlob, setReviewPdfBlob] = useState<Blob | null>(null)
  const [loadingReviewFiles, setLoadingReviewFiles] = useState(false)
  const [showPreparerPreviewModal, setShowPreparerPreviewModal] = useState(false)
  const [preparerPreviewPdfBlob, setPreparerPreviewPdfBlob] = useState<Blob | null>(null)
  const [showSignatureSuccess, setShowSignatureSuccess] = useState(false)
  const [showSignaturePreviewModal, setShowSignaturePreviewModal] = useState(false)
  const [signaturePreviewDataUrl, setSignaturePreviewDataUrl] = useState<string | null>(null)
  const [signaturePreviewTitle, setSignaturePreviewTitle] = useState<string>('')
  
  // Initialize review state from sub-step data
  useEffect(() => {
    if (!subSteps || !Array.isArray(subSteps)) return
    const clientDownloadedStep = subSteps.find(step => step.key === 'ead_client_downloaded_signed')
    if (clientDownloadedStep?.data?.reviewed_at) {
      // setHasReviewed removed - no longer needed(true)
    }
  }, [subSteps])

  // Initialize ATT code and expiry date from sub-step data
  useEffect(() => {
    if (!subSteps || !Array.isArray(subSteps)) return
    const attReceivedStep = subSteps.find(step => step.key === 'att_received')
    if (attReceivedStep?.data) {
      if (attReceivedStep.data.code || attReceivedStep.data.att_code) {
        setAttCodeValue(attReceivedStep.data.code || attReceivedStep.data.att_code || '')
      } else if (attCode) {
        // Use prop value if available
        setAttCodeValue(attCode)
      }
      if (attReceivedStep.data.expiry_date || attReceivedStep.data.att_expiry_date) {
        const expiryDate = attReceivedStep.data.expiry_date || attReceivedStep.data.att_expiry_date
        setAttExpiryDate(expiryDate ? expiryDate.split('T')[0] : '')
      }
    } else if (attCode) {
      // Use prop value if no sub-step data
      setAttCodeValue(attCode)
    }
  }, [subSteps, attCode])

  // Initialize exam date, time, and location from sub-step data
  useEffect(() => {
    if (!subSteps || !Array.isArray(subSteps)) return
    const examDateBookedStep = subSteps.find(step => step.key === 'exam_date_booked')
    if (examDateBookedStep?.data) {
      if (examDateBookedStep.data.date) {
        setExamDateValue(examDateBookedStep.data.date.split('T')[0])
      } else if (examDate) {
        setExamDateValue(examDate.split('T')[0])
      }
      if (examDateBookedStep.data.time) {
        setExamTimeValue(examDateBookedStep.data.time)
      } else if (examTime) {
        setExamTimeValue(examTime)
      }
      if (examDateBookedStep.data.location) {
        setExamLocationValue(examDateBookedStep.data.location)
      } else if (examLocation) {
        setExamLocationValue(examLocation)
      }
    } else {
      if (examDate) setExamDateValue(examDate.split('T')[0])
      if (examTime) setExamTimeValue(examTime)
      if (examLocation) setExamLocationValue(examLocation)
    }
  }, [subSteps, examDate, examTime, examLocation])

  // Initialize exam result
  useEffect(() => {
    if (result) {
      setExamResult(result)
    }
  }, [result])

  // Initialize Form 1 data from sub-step data
  useEffect(() => {
    if (!subSteps || !Array.isArray(subSteps)) return
    const form1Step = subSteps.find(step => step.key === 'form1_submitted')
    if (form1Step?.data) {
      if (form1Step.data.reference_number || form1Step.data.ref_number) {
        setForm1RefNumber(form1Step.data.reference_number || form1Step.data.ref_number || '')
      }
      if (form1Step.date) {
        setForm1Date(form1Step.date.split('T')[0])
      }
    } else if (form1Step?.date) {
      setForm1Date(form1Step.date.split('T')[0])
    }
  }, [subSteps])

  const handleSubStepToggle = async (subStepKey: string, currentStatus: boolean) => {
    if (onUpdateSubStep && application?.id) {
      const newStatus = currentStatus ? 'pending' : 'completed'
      // Set time to noon to avoid timezone issues
      const dateObj = new Date()
      dateObj.setHours(12, 0, 0, 0)
      await onUpdateSubStep(subStepKey, newStatus, { 
        date: dateObj.toISOString()
      })
    }
  }

  return (
    <div className="relative mb-3">
      {/* Timeline connector line */}
      <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700"></div>
      
      {/* Main step card */}
      <div className={`relative bg-white dark:bg-gray-800 rounded-lg border transition-all duration-200 ${
          isCompleted 
          ? 'border-green-200 dark:border-green-800/50' 
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
      }`}>
        {/* Step number badge */}
        <div className="absolute -left-2 top-4 z-10">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm border-2 border-white dark:border-gray-800 transition-all duration-200 ${
            isCompleted 
              ? 'bg-green-500 dark:bg-green-600' 
              : 'bg-gray-300 dark:bg-gray-600'
        }`}>
          {isCompleted ? (
              <CheckCircle className="h-4 w-4 text-white" />
          ) : (
              <span className="text-white font-bold text-xs">{stepNumber}</span>
          )}
        </div>
      </div>

        <div className="p-3 pl-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
                  className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0"
                  aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
              ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
              )}
            </button>
                <h3 className={`text-sm font-semibold truncate ${
                  isCompleted 
                    ? 'text-gray-900 dark:text-gray-100' 
                    : 'text-gray-700 dark:text-gray-300'
                }`}>
              {stepNumber}. {title}
            </h3>
            {isCompleted && (
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800 flex-shrink-0">
                    ✓
              </span>
            )}
          </div>

              {/* Note for Quick Results step */}
              {stepNumber === 8 && (
                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-700 dark:text-blue-300 italic">
                    Note: Quick Results is available 72 Business Hrs after taking the exam
              </p>
            </div>
          )}

              {/* Special fields for specific steps */}
              {stepNumber === 6 && attCode && (
                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
                    ATT Code
                  </p>
                  <p className="text-base font-mono font-bold text-blue-700 dark:text-blue-300">
                    {attCode}
                  </p>
            </div>
          )}


          {isExpanded && subSteps && Array.isArray(subSteps) && (
            <div className="mt-2 space-y-1.5">
              {subSteps.map((subStep, _index) => (
                <div 
                  key={subStep.key} 
                  className={`group relative flex items-start gap-2 p-2 rounded border transition-all duration-200 ${
                    subStep.completed 
                      ? 'bg-green-50/30 dark:bg-green-900/5 border-green-200 dark:border-green-800/30' 
                      : 'bg-gray-50/30 dark:bg-gray-800/30 border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {/* Sub-step indicator */}
                  <div className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center transition-all duration-200 ${
                    subStep.completed 
                      ? 'bg-green-500 dark:bg-green-600' 
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`}>
                    {subStep.completed ? (
                      <CheckCircle className="h-3 w-3 text-white" />
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full bg-white dark:bg-gray-300"></div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium truncate ${
                      subStep.completed 
                        ? 'text-gray-900 dark:text-gray-100' 
                            : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      {subStep.label}
                        </p>
                        {/* Completion note for signed steps */}
                        {subStep.key === 'ead_client_downloaded_signed' && subStep.completed && (subStep.data?.signed_at || subStep.data?.signature_data) && (
                          <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                            Client signature has been completed.
                          </p>
                        )}
                        {subStep.key === 'ead_preparer_downloaded_signed' && subStep.completed && (subStep.data?.signed_at || subStep.data?.signature_data) && (
                          <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                            Preparer signature has been completed.
                          </p>
                        )}
                        {/* Compact data display with copy */}
                        {subStep.key === 'ead_application_submitted' && subStep.data?.tracking_number && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-xs text-gray-500 dark:text-gray-400">Tracking:</span>
                            <span className="text-xs text-gray-700 dark:text-gray-300 font-mono">{subStep.data.tracking_number}</span>
                            <button
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(subStep.data.tracking_number)
                                  if (showToast) showToast('Tracking number copied!', 'success')
                                } catch {}
                              }}
                              className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded opacity-60 hover:opacity-100"
                              title="Copy tracking number"
                            >
                              <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                            </button>
                          </div>
                        )}
                        {subStep.key === 'ead_receipt_received' && subStep.data?.uscis_number && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-xs text-gray-500 dark:text-gray-400">USCIS:</span>
                            <span className="text-xs text-gray-700 dark:text-gray-300 font-mono">{subStep.data.uscis_number}</span>
                            <button
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(subStep.data.uscis_number)
                                  if (showToast) showToast('USCIS number copied!', 'success')
                                } catch {}
                              }}
                              className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded opacity-60 hover:opacity-100"
                              title="Copy USCIS number"
                            >
                              <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                            </button>
                          </div>
                        )}
                        {subStep.key === 'ead_card_mailed' && subStep.data?.tracking_number && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-xs text-gray-500 dark:text-gray-400">Tracking:</span>
                            <span className="text-xs text-gray-700 dark:text-gray-300 font-mono">{subStep.data.tracking_number}</span>
                            <button
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(subStep.data.tracking_number)
                                  if (showToast) showToast('Tracking number copied!', 'success')
                                } catch {}
                              }}
                              className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded opacity-60 hover:opacity-100"
                              title="Copy tracking number"
                            >
                              <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                            </button>
                          </div>
                        )}
                        {(subStep.key === 'app_paid' || subStep.key === 'app_step2_paid') && subStep.data?.amount && (
                          <div className="mt-0.5 space-y-0.5">
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-500 dark:text-gray-400">Payment:</span>
                              <span className="text-xs font-semibold text-green-600 dark:text-green-400 font-mono">{formatCurrency(subStep.data.amount)}</span>
                              <button
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(formatCurrency(subStep.data.amount))
                                    if (showToast) showToast('Payment amount copied!', 'success')
                                  } catch {}
                                }}
                                className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded opacity-60 hover:opacity-100"
                                title="Copy payment amount"
                              >
                                <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                              </button>
                            </div>
                            {subStep.data?.total_amount_paid && (
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-gray-500 dark:text-gray-400">Total:</span>
                                <span className="text-xs text-gray-600 dark:text-gray-400 font-mono">{formatCurrency(subStep.data.total_amount_paid)}</span>
                                <button
                                  onClick={async () => {
                                    try {
                                      await navigator.clipboard.writeText(formatCurrency(subStep.data.total_amount_paid))
                                      if (showToast) showToast('Total paid copied!', 'success')
                                    } catch {}
                                  }}
                                  className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded opacity-60 hover:opacity-100"
                                  title="Copy total paid"
                                >
                                  <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                        {/* Display verification results for ead_forms_verified */}
                        {subStep.key === 'ead_forms_verified' && subStep.data && (
                          <div className="mt-1.5 p-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-xs">
                            <div className="font-semibold text-blue-900 dark:text-blue-300 mb-0.5 text-xs">Verification:</div>
                            {subStep.data.i765Version && (
                              <div className="flex items-center gap-1 text-blue-800 dark:text-blue-200">
                                <span className="text-xs">I-765: {subStep.data.i765Version}</span>
                                <span className="text-xs">{subStep.data.i765Matched ? '✓' : '✗'}</span>
                                <button
                                  onClick={async () => {
                                    try {
                                      await navigator.clipboard.writeText(subStep.data.i765Version)
                                      if (showToast) showToast('I-765 version copied!', 'success')
                                    } catch {}
                                  }}
                                  className="p-0.5 hover:bg-blue-200 dark:hover:bg-blue-800 rounded opacity-60 hover:opacity-100 ml-auto"
                                  title="Copy I-765 version"
                                >
                                  <Copy className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                                </button>
                              </div>
                            )}
                            {subStep.data.g1145Version && (
                              <div className="flex items-center gap-1 text-blue-800 dark:text-blue-200">
                                <span className="text-xs">G-1145: {subStep.data.g1145Version}</span>
                                <span className="text-xs">{subStep.data.g1145Matched ? '✓' : '✗'}</span>
                                <button
                                  onClick={async () => {
                                    try {
                                      await navigator.clipboard.writeText(subStep.data.g1145Version)
                                      if (showToast) showToast('G-1145 version copied!', 'success')
                                    } catch {}
                                  }}
                                  className="p-0.5 hover:bg-blue-200 dark:hover:bg-blue-800 rounded opacity-60 hover:opacity-100 ml-auto"
                                  title="Copy G-1145 version"
                                >
                                  <Copy className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                                </button>
                              </div>
                            )}
                            {subStep.data.latestFee && (
                              <div className="flex items-center gap-1 text-blue-800 dark:text-blue-200">
                                <span className="text-xs">Fee: {subStep.data.latestFee}</span>
                                <span className="text-xs">{subStep.data.feeMatched ? '✓' : '✗'}</span>
                                <button
                                  onClick={async () => {
                                    try {
                                      await navigator.clipboard.writeText(subStep.data.latestFee)
                                      if (showToast) showToast('Filing fee copied!', 'success')
                                    } catch {}
                                  }}
                                  className="p-0.5 hover:bg-blue-200 dark:hover:bg-blue-800 rounded opacity-60 hover:opacity-100 ml-auto"
                                  title="Copy filing fee"
                                >
                                  <Copy className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                                </button>
                              </div>
                            )}
                            {subStep.data.message && (
                              <div className="mt-1 text-blue-700 dark:text-blue-300 whitespace-pre-line">
                                {(() => {
                                  let cleanedMessage = subStep.data.message
                                  // Fix garbled checkmark characters
                                  cleanedMessage = cleanedMessage.replace(/âœ"/g, '\u2713')
                                  cleanedMessage = cleanedMessage.replace(/\u00E2\u201C\u0153\u201D/g, '\u2713')
                                  // Fix garbled X mark characters
                                  cleanedMessage = cleanedMessage.replace(/âœ—/g, '\u2717')
                                  cleanedMessage = cleanedMessage.replace(/\u00E2\u201C\u0153\u2014/g, '\u2717')
                                  // Fix garbled warning characters
                                  cleanedMessage = cleanedMessage.replace(/âš /g, '\u26A0')
                                  cleanedMessage = cleanedMessage.replace(/\u00E2\u0161\u00A0/g, '\u26A0')
                                  return cleanedMessage
                                })()}
                              </div>
                            )}
                            {/* Display Service Center Information */}
                            {subStep.data.serviceCenter && (
                              <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
                                <div className="font-semibold text-blue-900 dark:text-blue-300 mb-2">Assigned Service Center</div>
                                <div className="text-blue-800 dark:text-blue-200 space-y-1">
                                  <div>
                                    <span className="font-medium">Receipt Number:</span> {subStep.data.serviceCenter.receiptNumber}
                                  </div>
                                  <div className="mt-1 mb-2 border-b-2 border-blue-300 dark:border-blue-600"></div>
                                  <div className="font-mono text-xs leading-relaxed whitespace-pre-line">
                                    {subStep.data.serviceCenter.address.name}{'\n'}
                                    Attn: {subStep.data.serviceCenter.address.attn}{'\n'}
                                    {subStep.data.serviceCenter.address.poBox && (
                                      <>
                                        {subStep.data.serviceCenter.address.poBox}{'\n'}
                                      </>
                                    )}
                                    {subStep.data.serviceCenter.address.city}, {subStep.data.serviceCenter.address.state} {subStep.data.serviceCenter.address.zip}
                                  </div>
                                </div>
                              </div>
                            )}
                            {/* Display Last Verification Date and Time */}
                            {(subStep.data.verified_at || subStep.data.date) && (
                              <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
                                <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300 text-xs">
                                  <Clock className="h-3 w-3 flex-shrink-0" />
                                  <span className="font-medium">Last verified:</span>
                                  <span>
                                    {(() => {
                                      const verifiedDate = subStep.data.verified_at || subStep.data.date
                                      if (!verifiedDate) return 'N/A'
                                      
                                      try {
                                        const date = new Date(verifiedDate)
                                        // Format: MM/DD/YYYY HH:MM AM/PM
                                        const dateStr = date.toLocaleDateString('en-US', { 
                                          month: '2-digit', 
                                          day: '2-digit', 
                                          year: 'numeric' 
                                        })
                                        const timeStr = date.toLocaleTimeString('en-US', { 
                                          hour: '2-digit', 
                                          minute: '2-digit',
                                          hour12: true 
                                        })
                                        return `${dateStr} at ${timeStr}`
                                      } catch {
                                        return formatDate(verifiedDate)
                                      }
                                    })()}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        {/* Download buttons for generated forms - only show in admin view */}
                        {subStep.key === 'ead_g1145_generated' && subStep.completed && isAdmin && (
                          <div className="mt-2 flex items-center gap-2">
                            <Button
                              onClick={async () => {
                                try {
                                  if (!application?.user_id) {
                                    if (showToast) showToast('Application user ID not found', 'error')
                                    return
                                  }
                                  
                                  if (showToast) showToast('Loading G-1145 form...', 'info')
                                  
                                  // Fetch user documents
                                  const docs = await userDocumentsAPI.getByUserId(application.user_id)
                                  
                                  // Find the latest G-1145 document (additional_g1145)
                                  const g1145Docs = docs.filter((doc: any) => doc.document_type === 'additional_g1145')
                                  
                                  if (g1145Docs.length === 0) {
                                    // If no uploaded/generated file, generate a new one
                                    if (!generateG1145Form) {
                                      if (showToast) showToast('No G-1145 form found and generation function not available', 'error')
                                      return
                                    }
                                    const pdfBlob = await generateG1145Form()
                                    const url = URL.createObjectURL(pdfBlob)
                                    
                                    if (setViewingPdfUrl && setViewingPdfName && setShowPdfModal) {
                                      setViewingPdfUrl(url)
                                      setViewingPdfName(`G-1145_${application?.first_name || 'Form'}_${application?.last_name || ''}_${new Date().toISOString().split('T')[0]}.pdf`)
                                      setShowPdfModal(true)
                                    }
                                    return
                                  }
                                  
                                  // Sort by created_at or uploaded_at (most recent first)
                                  const latestDoc = g1145Docs.sort((a: any, b: any) => {
                                    const dateA = new Date(a.created_at || a.uploaded_at || 0).getTime()
                                    const dateB = new Date(b.created_at || b.uploaded_at || 0).getTime()
                                    return dateB - dateA
                                  })[0] as unknown as { file_path: string; file_name?: string; created_at?: string; uploaded_at?: string }
                                  
                                  // Get signed URL for the file
                                  const signedUrl = await getSignedFileUrl(latestDoc.file_path, 3600)
                                  
                                  // Open PDF in modal
                                  if (setViewingPdfUrl && setViewingPdfName && setShowPdfModal) {
                                    setViewingPdfUrl(signedUrl)
                                    setViewingPdfName(latestDoc.file_name || 'G-1145.pdf')
                                    setShowPdfModal(true)
                                  }
                                } catch (error) {
                                  handleErrorSilently(error, { operation: 'openG1145', applicationId: application?.id })
                                  if (showToast) showToast('Failed to open G-1145 form', 'error')
                                }
                              }}
                              size="sm"
                              variant="outline"
                              className="text-xs"
                            >
                              <FileText className="h-3 w-3 mr-1" />
                              Open G-1145
                            </Button>
                            {subStep.data?.generated_at && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                Generated: {formatDate(subStep.data.generated_at)}
                              </span>
                            )}
                          </div>
                        )}
                        {subStep.key === 'ead_i765_generated' && subStep.completed && isAdmin && (
                          <div className="mt-2 flex items-center gap-2">
                            <Button
                              onClick={async () => {
                                try {
                                  if (!application?.user_id) {
                                    if (showToast) showToast('Application user ID not found', 'error')
                                    return
                                  }
                                  
                                  if (showToast) showToast('Loading I-765 form...', 'info')
                                  
                                  // Fetch user documents
                                  const docs = await userDocumentsAPI.getByUserId(application.user_id)
                                  
                                  // Find the latest I-765 document (additional_i765)
                                  const i765Docs = docs.filter((doc: any) => doc.document_type === 'additional_i765')
                                  
                                  if (i765Docs.length === 0) {
                                    // If no uploaded/generated file, generate a new one
                                    if (!generateI765Form) {
                                      if (showToast) showToast('No I-765 form found and generation function not available', 'error')
                                      return
                                    }
                                    const pdfBlob = await generateI765Form()
                                    const url = URL.createObjectURL(pdfBlob)
                                    
                                    if (setViewingPdfUrl && setViewingPdfName && setShowPdfModal) {
                                      setViewingPdfUrl(url)
                                      setViewingPdfName(`I-765_${application?.first_name || 'Form'}_${application?.last_name || ''}_${new Date().toISOString().split('T')[0]}.pdf`)
                                      setShowPdfModal(true)
                                    }
                                    return
                                  }
                                  
                                  // Sort by created_at or uploaded_at (most recent first)
                                  const latestDoc = i765Docs.sort((a: any, b: any) => {
                                    const dateA = new Date(a.created_at || a.uploaded_at || 0).getTime()
                                    const dateB = new Date(b.created_at || b.uploaded_at || 0).getTime()
                                    return dateB - dateA
                                  })[0] as unknown as { file_path: string; file_name?: string; created_at?: string; uploaded_at?: string }
                                  
                                  // Get signed URL for the file
                                  const signedUrl = await getSignedFileUrl(latestDoc.file_path, 3600)
                                  
                                  // Open PDF in modal
                                  if (setViewingPdfUrl && setViewingPdfName && setShowPdfModal) {
                                    setViewingPdfUrl(signedUrl)
                                    setViewingPdfName(latestDoc.file_name || 'I-765.pdf')
                                    setShowPdfModal(true)
                                  }
                                } catch (error) {
                                  handleErrorSilently(error, { operation: 'openI765', applicationId: application?.id })
                                  if (showToast) showToast('Failed to open I-765 form', 'error')
                                }
                              }}
                              size="sm"
                              variant="outline"
                              className="text-xs"
                            >
                              <FileText className="h-3 w-3 mr-1" />
                              Open I-765
                            </Button>
                            {subStep.data?.generated_at && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                Generated: {formatDate(subStep.data.generated_at)}
                              </span>
                            )}
                          </div>
                        )}
                        {subStep.key === 'ead_cover_letter_generated' && subStep.completed && isAdmin && (
                          <div className="mt-2 flex items-center gap-2">
                            <Button
                              onClick={async () => {
                                try {
                                  if (!generateCoverLetter) return
                                  const pdfBlob = await generateCoverLetter()
                                  const url = URL.createObjectURL(pdfBlob)
                                  
                                  // Open PDF in modal
                                  if (setViewingPdfUrl && setViewingPdfName && setShowPdfModal) {
                                    setViewingPdfUrl(url)
                                    setViewingPdfName(`Cover_Letter_${application?.first_name || 'Form'}_${application?.last_name || ''}_${new Date().toISOString().split('T')[0]}.pdf`)
                                    setShowPdfModal(true)
                                  }
                                } catch (error) {
                                  handleErrorSilently(error, { operation: 'openCoverLetter', applicationId: application?.id })
                                  if (showToast) showToast('Failed to open cover letter', 'error')
                                }
                              }}
                              size="sm"
                              variant="outline"
                              className="text-xs"
                            >
                              <FileText className="h-3 w-3 mr-1" />
                              Open Cover Letter
                            </Button>
                            {subStep.data?.generated_at && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                Generated: {formatDate(subStep.data.generated_at)}
                              </span>
                            )}
                          </div>
                        )}
                        {subStep.key === 'ead_documents_compiled' && subStep.completed && isAdmin && (
                          <div className="mt-2 flex items-center gap-2">
                            <Button
                              onClick={async () => {
                                try {
                                  // First, try to use signed_url from merge result (most direct)
                                  if (subStep.data?.signed_url) {
                                    try {
                                      // Verify the URL is accessible
                                      const testResponse = await fetch(subStep.data.signed_url, { method: 'HEAD' })
                                      if (testResponse.ok) {
                                        // Open PDF in modal
                                        if (setViewingPdfUrl && setViewingPdfName && setShowPdfModal) {
                                          setViewingPdfUrl(subStep.data.signed_url)
                                          const fileName = subStep.data.file_name || subStep.data.compiled_pdf_file_name || `EAD_Application_Package_${application?.first_name || 'Form'}_${application?.last_name || ''}_${new Date().toISOString().split('T')[0]}.pdf`
                                          setViewingPdfName(fileName)
                                          setShowPdfModal(true)
                                        }
                                        return
                                      }
                                    } catch (urlError: any) {
                                      console.warn('Failed to access signed_url, trying other methods:', urlError)
                                      // Fall through to try other methods
                                    }
                                  }
                                  
                                  // Try to get PDF from stored blob bytes (legacy method)
                                  if (subStep.data?.compiled_pdf_bytes) {
                                    try {
                                      const pdfBytes = new Uint8Array(subStep.data.compiled_pdf_bytes)
                                      const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' })
                                      const url = URL.createObjectURL(pdfBlob)
                                      
                                      // Open PDF in modal
                                      if (setViewingPdfUrl && setViewingPdfName && setShowPdfModal) {
                                        setViewingPdfUrl(url)
                                        const fileName = subStep.data.compiled_pdf_file_name || subStep.data.file_name || `EAD_Application_Package_${application?.first_name || 'Form'}_${application?.last_name || ''}_${new Date().toISOString().split('T')[0]}.pdf`
                                        setViewingPdfName(fileName)
                                        setShowPdfModal(true)
                                      }
                                      return
                                    } catch (bytesError: any) {
                                      console.warn('Failed to create blob from stored bytes:', bytesError)
                                      // Fall through to try other methods
                                    }
                                  }
                                  
                                  // Try to fetch from storage using file_path from merge result
                                  const filePath = subStep.data?.file_path || subStep.data?.compiled_pdf_path
                                  if (filePath) {
                                    try {
                                      // Fetch PDF from Supabase storage
                                      const signedUrl = await getSignedFileUrl(filePath, 3600)
                                      
                                      // Verify the URL is accessible
                                      const testResponse = await fetch(signedUrl, { method: 'HEAD' })
                                      if (!testResponse.ok) {
                                        throw new Error(`File not found in storage: ${testResponse.status}`)
                                      }
                                      
                                      // Open PDF in modal
                                      if (setViewingPdfUrl && setViewingPdfName && setShowPdfModal) {
                                        setViewingPdfUrl(signedUrl)
                                        const fileName = subStep.data.file_name || subStep.data.compiled_pdf_file_name || `EAD_Application_Package_${application?.first_name || 'Form'}_${application?.last_name || ''}_${new Date().toISOString().split('T')[0]}.pdf`
                                        setViewingPdfName(fileName)
                                        setShowPdfModal(true)
                                      }
                                      return
                                    } catch (storageError: any) {
                                      // If storage fetch fails, try compiling on the fly
                                      console.warn('Failed to fetch from storage, compiling on the fly:', storageError)
                                    }
                                  }
                                  
                                  // Fallback: show error if no stored version exists
                                  if (showToast) showToast('Compiled documents not found. Please merge documents first using the "Merge All Docs" button.', 'warning')
                                  return
                                } catch (error: any) {
                                  handleErrorSilently(error, { operation: 'openCompiledDocuments', applicationId: application?.id })
                                  const errorMessage = error?.message?.includes('not found') || error?.message?.includes('404') || error?.message?.includes('544')
                                    ? 'Compiled package file not found. Please merge documents again using the "Merge All Docs" button.'
                                    : error?.message || 'Failed to open compiled documents. Please try again or recompile the documents.'
                                  if (showToast) showToast(errorMessage, 'error')
                                }
                              }}
                              size="sm"
                              variant="outline"
                              className="text-xs"
                            >
                              <FileText className="h-3 w-3 mr-1" />
                              Open Package
                            </Button>
                            {(subStep.data?.compiled_at || subStep.data?.merged_at) && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                Compiled: {formatDate(subStep.data.compiled_at || subStep.data.merged_at)}
                              </span>
                            )}
                          </div>
                        )}
                        {/* Client Review and Sign */}
                        {subStep.key === 'ead_client_downloaded_signed' && (() => {
                          // Only show if documents have been compiled
                          const documentsCompiled = subSteps?.find(s => s.key === 'ead_documents_compiled')?.completed || false
                          // Check for signature in multiple ways: data, completion status, or storage file
                          const isSigned = subStep.completed || 
                                          subStep.data?.signed_at || 
                                          subStep.data?.signature_data ||
                                          subStep.data?.client_signed_pdf_path ||
                                          subStep.data?.client_signed_pdf_bytes ||
                                          subStep.data?.final_package_path
                          const documentName = `EAD_Application_Package_${application?.first_name || 'Form'}_${application?.last_name || ''}`
                          
                          return documentsCompiled ? (
                            <div className="mt-2 space-y-2">
                              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
                              <Button
                                onClick={async () => {
                                    if (loadingReviewFiles) return // Prevent multiple clicks
                                    try {
                                      setLoadingReviewFiles(true)
                                      
                                      // Find the compiled documents step to get stored PDF
                                      const compiledStep = subSteps?.find(s => s.key === 'ead_documents_compiled')
                                      
                                      // Check if compiled PDF is available in step data
                                      if (compiledStep?.completed) {
                                        // Try to get PDF from stored blob bytes first (most reliable)
                                        if (compiledStep?.data?.compiled_pdf_bytes) {
                                          try {
                                            const pdfBytes = new Uint8Array(compiledStep.data.compiled_pdf_bytes)
                                            const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' })
                                            setReviewPdfBlob(pdfBlob)
                                            setShowReviewModal(true)
                                            return
                                          } catch (bytesError: any) {
                                            console.warn('Failed to create blob from stored bytes:', bytesError)
                                            // Fall through to try other methods
                                          }
                                        }
                                        
                                        // Try to fetch from storage if path exists
                                        if (compiledStep?.data?.compiled_pdf_path) {
                                          try {
                                            // Fetch PDF from Supabase storage
                                            const signedUrl = await getSignedFileUrl(compiledStep.data.compiled_pdf_path, 3600)
                                            const response = await fetch(signedUrl)
                                            if (!response.ok) {
                                              throw new Error(`Failed to fetch compiled PDF: ${response.status} ${response.statusText}`)
                                            }
                                            const pdfBlob = await response.blob()
                                            setReviewPdfBlob(pdfBlob)
                                            setShowReviewModal(true)
                                            return
                                          } catch (storageError: any) {
                                            // If storage fetch fails, try compiling on the fly
                                            console.warn('Failed to fetch from storage, compiling on the fly:', storageError)
                                          }
                                        }
                                      }
                                      
                                      // Fallback: show error if no stored version exists
                                      if (showToast) showToast('Compiled document not found. Please merge documents first using the "Merge All Docs" button.', 'warning')
                                      setLoadingReviewFiles(false)
                                      return
                                    } catch (error: any) {
                                      handleErrorSilently(error, { operation: 'loadDocuments', applicationId: application?.id })
                                      const errorMessage = error?.message?.includes('not found') || error?.message?.includes('404')
                                        ? 'Compiled document not found. Please merge documents first using the "Merge All Docs" button.'
                                        : error?.message || 'Failed to load documents. Please try again or recompile the documents.'
                                      if (showToast) showToast(errorMessage, 'error')
                                    } finally {
                                      setLoadingReviewFiles(false)
                                    }
                                  }}
                                  size="sm"
                                  variant="outline"
                                  disabled={loadingReviewFiles}
                                  className="text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/20 dark:hover:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800 w-full sm:w-auto flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {loadingReviewFiles ? (
                                    <>
                                      <Loader2 className="h-3 w-3 mr-1 flex-shrink-0 animate-spin" />
                                      <span className="truncate">Loading...</span>
                                    </>
                                  ) : (
                                    <>
                                      <FileText className="h-3 w-3 mr-1 flex-shrink-0" />
                                      <span className="truncate">Review Completed Files</span>
                                    </>
                                  )}
                                </Button>
                                {!isSigned && (
                                  <Button
                                    onClick={() => {
                                      setSignatureDocumentName(documentName)
                                      setShowSignatureModal(true)
                                    }}
                                    size="sm"
                                    variant="outline"
                                    className="text-xs bg-green-50 hover:bg-green-100 text-green-700 border-green-300 dark:bg-green-900/20 dark:hover:bg-green-900/30 dark:text-green-300 dark:border-green-800 w-full sm:w-auto flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <PenTool className="h-3 w-3 mr-1 flex-shrink-0" />
                                    Sign Here
                                  </Button>
                                )}
                              {isSigned && isAdmin && (
                                <Button
                                  onClick={async () => {
                                    let sig = subStep.data?.signature_data
                                    
                                    // If signature_data is not available, try to load from storage
                                    if (!sig && application?.user_id) {
                                      try {
                                        const signaturePath = `${application.user_id}/ead_client_signature.png`
                                        const signatureUrl = await getSignedFileUrl(signaturePath, 3600)
                                        
                                        // Fetch the image and convert to data URL
                                        const response = await fetch(signatureUrl)
                                        const blob = await response.blob()
                                        const reader = new FileReader()
                                        sig = await new Promise<string>((resolve, reject) => {
                                          reader.onloadend = () => resolve(reader.result as string)
                                          reader.onerror = reject
                                          reader.readAsDataURL(blob)
                                        })
                                      } catch (error) {
                                        handleErrorSilently(error, { operation: 'loadClientSignatureFromStorage', applicationId: application?.id })
                                      }
                                    }
                                    
                                    if (!sig) {
                                      if (showToast) showToast('Signature image not available', 'warning')
                                      return
                                    }
                                    
                                    setSignaturePreviewDataUrl(sig)
                                    setSignaturePreviewTitle('Client Signature')
                                    setShowSignaturePreviewModal(true)
                                  }}
                                  size="sm"
                                  variant="outline"
                                  className="text-xs bg-white hover:bg-gray-50 text-blue-700 border-blue-200 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-blue-200 dark:border-blue-700 w-full sm:w-auto flex items-center justify-center"
                                >
                                  <Eye className="h-3 w-3 mr-1 flex-shrink-0" />
                                  View Sign
                                </Button>
                              )}
                              </div>
                              {isSigned && (
                                <div className="mt-2 p-2 sm:p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                  <p className="text-xs sm:text-sm text-green-800 dark:text-green-200 flex items-center gap-1 sm:gap-2 flex-wrap">
                                    <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                                    <span className="break-words">Client signature has been completed. Signed on {subStep.data?.signed_at ? formatDate(subStep.data.signed_at) : 'recently'}</span>
                                  </p>
                                </div>
                              )}
                            </div>
                          ) : null
                        })()}
                        {/* Preparer Review files and sign */}
                        {subStep.key === 'ead_preparer_downloaded_signed' && isAdmin && (() => {
                          // Check if client has signed documents - check multiple conditions
                          const clientSignedStep = subSteps?.find(s => s.key === 'ead_client_downloaded_signed')
                          const clientSigned = clientSignedStep?.completed || 
                                               clientSignedStep?.data?.client_signed_pdf_path || 
                                               clientSignedStep?.data?.client_signed_pdf_bytes ||
                                               clientSignedStep?.data?.signed_at ||
                                               clientSignedStep?.data?.signature_data ||
                                               clientSignedStep?.data?.final_package_path
                          // Also check for preparer signature in multiple ways
                          const isPreparerSigned = subStep.completed ||
                                                  subStep.data?.signed_at || 
                                                  subStep.data?.signature_data ||
                                                  subStep.data?.preparer_signed_pdf_path ||
                                                  subStep.data?.preparer_signed_pdf_bytes
                          const documentName = `Client_Signed_Complete_Files_${application?.first_name || 'Form'}_${application?.last_name || ''}`
                          
                          // Always show buttons if this step exists, but disable if client hasn't signed
                          return (
                            <div className="mt-2 space-y-2">
                              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
                                {!isPreparerSigned && (
                                  <Button
                                    onClick={() => {
                                      if (!clientSigned) {
                                        if (showToast) showToast('Client must sign documents first', 'warning')
                                        return
                                      }
                                      setSignatureDocumentName(documentName)
                                      setShowSignatureModal(true)
                                    }}
                                    size="sm"
                                    variant="outline"
                                    disabled={!clientSigned}
                                    className="text-xs bg-green-50 hover:bg-green-100 text-green-700 border-green-300 dark:bg-green-900/20 dark:hover:bg-green-900/30 dark:text-green-300 dark:border-green-800 w-full sm:w-auto flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <PenTool className="h-3 w-3 mr-1 flex-shrink-0" />
                                    Sign Here
                                  </Button>
                                )}
                                {isPreparerSigned && isAdmin && (
                                  <Button
                                    onClick={async () => {
                                      let sig = subStep.data?.signature_data
                                      
                                      // If signature_data is not available, try to load from storage
                                      if (!sig && application?.user_id) {
                                        try {
                                          const signaturePath = `${application.user_id}/ead_preparer_signature.png`
                                          const signatureUrl = await getSignedFileUrl(signaturePath, 3600)
                                          
                                          // Fetch the image and convert to data URL
                                          const response = await fetch(signatureUrl)
                                          const blob = await response.blob()
                                          const reader = new FileReader()
                                          sig = await new Promise<string>((resolve, reject) => {
                                            reader.onloadend = () => resolve(reader.result as string)
                                            reader.onerror = reject
                                            reader.readAsDataURL(blob)
                                          })
                                        } catch (error) {
                                          handleErrorSilently(error, { operation: 'loadPreparerSignatureFromStorage', applicationId: application?.id })
                                        }
                                      }
                                      
                                      if (!sig) {
                                        if (showToast) showToast('Signature image not available', 'warning')
                                        return
                                      }
                                      
                                      setSignaturePreviewDataUrl(sig)
                                      setSignaturePreviewTitle('Preparer Signature')
                                      setShowSignaturePreviewModal(true)
                                    }}
                                    size="sm"
                                    variant="outline"
                                    className="text-xs bg-white hover:bg-gray-50 text-blue-700 border-blue-200 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-blue-200 dark:border-blue-700 w-full sm:w-auto flex items-center justify-center"
                                  >
                                    <Eye className="h-3 w-3 mr-1 flex-shrink-0" />
                                    View Sign
                                  </Button>
                                )}
                              </div>
                              {!clientSigned && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  Waiting for client to sign documents first
                                </p>
                              )}
                              {isPreparerSigned && (
                                <div className="mt-2 p-2 sm:p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                  <p className="text-xs sm:text-sm text-green-800 dark:text-green-200 flex items-center gap-1 sm:gap-2 flex-wrap">
                                    <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                                    <span className="break-words">Preparer signature has been completed. Signed on {subStep.data?.signed_at ? formatDate(subStep.data.signed_at) : 'recently'}</span>
                                  </p>
                                </div>
                              )}
                            </div>
                          )
                        })()}
                        {/* Download Final Application Package */}
                        {subStep.key === 'ead_final_package_download' && isAdmin && (() => {
                          // Check if preparer has signed - check multiple conditions
                          const preparerSignedStep = subSteps?.find(s => s.key === 'ead_preparer_downloaded_signed')
                          const preparerSigned = preparerSignedStep?.completed || 
                                                 preparerSignedStep?.data?.signed_at || 
                                                 preparerSignedStep?.data?.signature_data ||
                                                 preparerSignedStep?.data?.preparer_signed_pdf_path ||
                                                 preparerSignedStep?.data?.preparer_signed_pdf_bytes
                          
                          // Check if client has signed
                          const clientSignedStep = subSteps?.find(s => s.key === 'ead_client_downloaded_signed')
                          const clientSigned = clientSignedStep?.completed || 
                                               clientSignedStep?.data?.signed_at || 
                                               clientSignedStep?.data?.signature_data ||
                                               clientSignedStep?.data?.client_signed_pdf_path ||
                                               clientSignedStep?.data?.client_signed_pdf_bytes
                          
                          // Check if merged documents exist
                          const compiledStep = subSteps?.find(s => s.key === 'ead_documents_compiled')
                          const documentsCompiled = compiledStep?.completed || false
                          
                          // Check if final package exists (either generated or uploaded)
                          const finalPackageExists = subStep.data?.final_package_path || subStep.completed
                          
                          return (
                            <div className="mt-2 space-y-2">
                              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  {!preparerSigned && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      Please wait for preparer to sign documents first
                                    </p>
                                  )}
                                  {!clientSigned && preparerSigned && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      Please wait for client to sign documents first
                                    </p>
                                  )}
                                  {!documentsCompiled && clientSigned && preparerSigned && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      Please merge documents first
                                    </p>
                                  )}
                                </div>
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                              {/* Generate Final Package Button */}
                              <Button
                                onClick={async () => {
                                  if (generatingFinalPackage) return
                                  if (!preparerSigned || !clientSigned || !documentsCompiled) {
                                    if (showToast) showToast('All signatures and merged documents are required', 'warning')
                                    return
                                  }
                                  
                                  setGeneratingFinalPackage(true)
                                  try {
                                    if (showToast) showToast('Generating final package with signatures...', 'info')
                                    
                                    // 1. Get merged document (try multiple methods with fallbacks)
                                    let mergedPdfBytes: Uint8Array | null = null
                                    
                                    // Method 1: Try signed_url first (but it might be expired)
                                    if (compiledStep?.data?.signed_url) {
                                      try {
                                        const response = await fetch(compiledStep.data.signed_url)
                                        if (response.ok) {
                                          const blob = await response.blob()
                                          mergedPdfBytes = new Uint8Array(await blob.arrayBuffer())
                                          console.log('✓ Fetched merged document from signed_url')
                                        } else {
                                          console.warn(`Signed URL returned ${response.status}, trying fallback methods...`)
                                        }
                                      } catch (err) {
                                        console.warn('Failed to fetch from signed_url, trying fallback methods:', err)
                                      }
                                    }
                                    
                                    // Method 2: Try file_path with fresh signed URL
                                    if (!mergedPdfBytes && compiledStep?.data?.file_path) {
                                      try {
                                        const signedUrl = await getSignedFileUrl(compiledStep.data.file_path, 3600)
                                        const response = await fetch(signedUrl)
                                        if (response.ok) {
                                          const blob = await response.blob()
                                          mergedPdfBytes = new Uint8Array(await blob.arrayBuffer())
                                          console.log('✓ Fetched merged document from file_path')
                                        } else {
                                          console.warn(`File path fetch returned ${response.status}, trying fallback methods...`)
                                        }
                                      } catch (err) {
                                        console.warn('Failed to fetch from file_path, trying fallback methods:', err)
                                      }
                                    }
                                    
                                    // Method 3: Try compiled_pdf_bytes (stored in database)
                                    if (!mergedPdfBytes && compiledStep?.data?.compiled_pdf_bytes) {
                                      try {
                                        mergedPdfBytes = new Uint8Array(compiledStep.data.compiled_pdf_bytes)
                                        console.log('✓ Using merged document from compiled_pdf_bytes')
                                      } catch (err) {
                                        console.warn('Failed to use compiled_pdf_bytes:', err)
                                      }
                                    }
                                    
                                    // Method 4: Try to fetch from storage using the file_path directly
                                    if (!mergedPdfBytes && compiledStep?.data?.file_path && application?.user_id) {
                                      try {
                                        // The file_path should be like: userId/merged_documents.pdf
                                        const filePath = compiledStep.data.file_path
                                        const signedUrl = await getSignedFileUrl(filePath, 3600)
                                        const response = await fetch(signedUrl)
                                        if (response.ok) {
                                          const blob = await response.blob()
                                          mergedPdfBytes = new Uint8Array(await blob.arrayBuffer())
                                          console.log('✓ Fetched merged document from storage using file_path')
                                        }
                                      } catch (err) {
                                        console.warn('Failed to fetch from storage using file_path:', err)
                                      }
                                    }
                                    
                                    if (!mergedPdfBytes || mergedPdfBytes.length === 0) {
                                      throw new Error('Merged document not found or could not be loaded. Please merge documents again using the "Merge All Docs" button.')
                                    }
                                    
                                    // 2. Load PDF with pdf-lib
                                    const pdfDoc = await PDFDocument.load(mergedPdfBytes)
                                    const pages = pdfDoc.getPages()
                                    
                                    // Document order: Cover Letter (page 0), G-1145 (page 1), Money Order (page 2), Form I-765 (starts at page 3)
                                    // Form I-765 page 4 = merged PDF page 6 (0-indexed: Cover Letter + G-1145 + Money Order + I-765 pages 1-3 = 6 pages, so page 4 is index 6)
                                    // Form I-765 page 6 = merged PDF page 8 (0-indexed: 6 + 2 more pages = index 8)
                                    const coverLetterPage = pages[0] // First page (Cover Letter)
                                    
                                    // Calculate Form I-765 page indices
                                    // Assuming: Cover Letter (1 page) + G-1145 (1 page) + Money Order (1 page) = 3 pages before I-765
                                    // Form I-765 page 4 = 3 (offset) + 4 - 1 = 6 (0-indexed)
                                    // Form I-765 page 6 = 3 (offset) + 6 - 1 = 8 (0-indexed)
                                    const pagesBeforeI765 = 3 // Cover Letter + G-1145 + Money Order
                                    const i765Page4Index = pagesBeforeI765 + 4 - 1 // Form I-765 page 4 (0-indexed: 6)
                                    const i765Page6Index = pagesBeforeI765 + 6 - 1 // Form I-765 page 6 (0-indexed: 8)
                                    
                                    // Ensure we have enough pages
                                    if (pages.length <= i765Page6Index) {
                                      console.warn(`PDF has ${pages.length} pages, expected at least ${i765Page6Index + 1} pages for Form I-765 page 6`)
                                    }
                                    
                                    const i765Page4 = pages.length > i765Page4Index ? pages[i765Page4Index] : null // Form I-765 page 4
                                    const i765Page6 = pages.length > i765Page6Index ? pages[i765Page6Index] : null // Form I-765 page 6
                                    
                                    // 3. Get client signature
                                    let clientSignatureImage: Uint8Array | null = null
                                    if (clientSignedStep?.data?.signature_data) {
                                      try {
                                        // Convert data URL to image bytes
                                        const dataUrl = clientSignedStep.data.signature_data
                                        if (dataUrl && typeof dataUrl === 'string') {
                                          const response = await fetch(dataUrl)
                                          if (!response.ok) {
                                            console.warn('Failed to fetch client signature from data URL:', response.status)
                                          } else {
                                            const blob = await response.blob()
                                            clientSignatureImage = new Uint8Array(await blob.arrayBuffer())
                                          }
                                        }
                                      } catch (err) {
                                        console.warn('Error processing client signature data URL:', err)
                                      }
                                    } else if (clientSignedStep?.data?.client_signed_pdf_path) {
                                      try {
                                        // Try to extract signature from signed PDF if available
                                        const signedUrl = await getSignedFileUrl(clientSignedStep.data.client_signed_pdf_path, 3600)
                                        const response = await fetch(signedUrl)
                                        if (response.ok) {
                                          const blob = await response.blob()
                                          clientSignatureImage = new Uint8Array(await blob.arrayBuffer())
                                        }
                                      } catch (err) {
                                        console.warn('Error fetching client signed PDF:', err)
                                      }
                                    }
                                    
                                    if (!clientSignatureImage) {
                                      console.warn('Client signature not found in expected format')
                                    }
                                    
                                    // 4. Get preparer signature
                                    let preparerSignatureImage: Uint8Array | null = null
                                    if (preparerSignedStep?.data?.signature_data) {
                                      try {
                                        // Convert data URL to image bytes
                                        const dataUrl = preparerSignedStep.data.signature_data
                                        if (dataUrl && typeof dataUrl === 'string') {
                                          const response = await fetch(dataUrl)
                                          if (!response.ok) {
                                            console.warn('Failed to fetch preparer signature from data URL:', response.status)
                                          } else {
                                            const blob = await response.blob()
                                            preparerSignatureImage = new Uint8Array(await blob.arrayBuffer())
                                          }
                                        }
                                      } catch (err) {
                                        console.warn('Error processing preparer signature data URL:', err)
                                      }
                                    } else if (preparerSignedStep?.data?.preparer_signed_pdf_path) {
                                      try {
                                        // Try to extract signature from signed PDF if available
                                        const signedUrl = await getSignedFileUrl(preparerSignedStep.data.preparer_signed_pdf_path, 3600)
                                        const response = await fetch(signedUrl)
                                        if (response.ok) {
                                          const blob = await response.blob()
                                          preparerSignatureImage = new Uint8Array(await blob.arrayBuffer())
                                        }
                                      } catch (err) {
                                        console.warn('Error fetching preparer signed PDF:', err)
                                      }
                                    }
                                    
                                    if (!preparerSignatureImage) {
                                      console.warn('Preparer signature not found in expected format')
                                    }
                                    
                                    // Validate that we have at least one signature
                                    if (!clientSignatureImage && !preparerSignatureImage) {
                                      throw new Error('No signatures found. Please ensure both client and preparer have signed their documents.')
                                    }
                                    
                                    // Helper function to embed signature image
                                    const embedSignatureImage = async (imageBytes: Uint8Array): Promise<any> => {
                                      try {
                                        return await pdfDoc.embedPng(imageBytes)
                                      } catch (e) {
                                        // Try JPEG if PNG fails
                                        try {
                                          return await pdfDoc.embedJpg(imageBytes)
                                        } catch (jpegErr) {
                                          console.error('Failed to embed image as PNG or JPEG:', jpegErr)
                                          throw new Error('Signature image format not supported. Please ensure signatures are in PNG or JPEG format.')
                                        }
                                      }
                                    }
                                    
                                    // 5. Place client signature on Cover Letter (page 0)
                                    if (clientSignatureImage && coverLetterPage) {
                                      try {
                                        const clientImage = await embedSignatureImage(clientSignatureImage)
                                        // Place signature at bottom of cover letter (typical location)
                                        coverLetterPage.drawImage(clientImage, {
                                          x: 100,
                                          y: 150,
                                          width: 120,
                                          height: 40,
                                        })
                                        console.log('✓ Client signature placed on cover letter')
                                      } catch (err: any) {
                                        console.error('Failed to embed client signature on cover letter:', err)
                                        throw new Error(`Failed to place client signature on cover letter: ${err?.message || 'Unknown error'}`)
                                      }
                                    } else if (clientSignatureImage && !coverLetterPage) {
                                      console.warn('Cover letter page not found, skipping client signature placement')
                                    }
                                    
                                    // 6. Place client signature on Form I-765 page 4 at "7.a. Applicant's Signature"
                                    if (clientSignatureImage && i765Page4) {
                                      try {
                                        const clientImage = await embedSignatureImage(clientSignatureImage)
                                        // "7.a. Applicant's Signature" is typically around x: 100-150, y: 200-250 on Form I-765 page 4
                                        i765Page4.drawImage(clientImage, {
                                          x: 120,
                                          y: 220,
                                          width: 120,
                                          height: 40,
                                        })
                                        console.log('✓ Client signature placed on Form I-765 page 4')
                                      } catch (err: any) {
                                        console.error('Failed to embed client signature on Form I-765 page 4:', err)
                                        throw new Error(`Failed to place client signature on Form I-765: ${err?.message || 'Unknown error'}`)
                                      }
                                    } else if (clientSignatureImage && !i765Page4) {
                                      console.warn(`Form I-765 page 4 not found (PDF has ${pages.length} pages, expected at least ${i765Page4Index + 1}), skipping client signature placement`)
                                    }
                                    
                                    // 7. Place preparer signature on Form I-765 page 6 at "8.a. Preparer's Signature"
                                    if (preparerSignatureImage && i765Page6) {
                                      try {
                                        const preparerImage = await embedSignatureImage(preparerSignatureImage)
                                        // "8.a. Preparer's Signature" is typically around x: 100-150, y: 200-250 on Form I-765 page 6
                                        i765Page6.drawImage(preparerImage, {
                                          x: 120,
                                          y: 220,
                                          width: 120,
                                          height: 40,
                                        })
                                        console.log('✓ Preparer signature placed on Form I-765 page 6')
                                      } catch (err: any) {
                                        console.error('Failed to embed preparer signature on Form I-765 page 6:', err)
                                        throw new Error(`Failed to place preparer signature on Form I-765: ${err?.message || 'Unknown error'}`)
                                      }
                                    } else if (preparerSignatureImage && !i765Page6) {
                                      console.warn(`Form I-765 page 6 not found (PDF has ${pages.length} pages, expected at least ${i765Page6Index + 1}), skipping preparer signature placement`)
                                    }
                                    
                                    // 6. Save final PDF
                                    let finalPdfBytes: Uint8Array
                                    try {
                                      finalPdfBytes = await pdfDoc.save()
                                      if (!finalPdfBytes || finalPdfBytes.length === 0) {
                                        throw new Error('Failed to generate PDF bytes')
                                      }
                                    } catch (saveErr: any) {
                                      throw new Error(`Failed to save PDF: ${saveErr?.message || 'Unknown error'}`)
                                    }
                                    
                                    // 7. Upload to storage (same path as upload button)
                                    if (!application?.user_id) {
                                      throw new Error('Application user ID is missing')
                                    }
                                    
                                    const clientName = `${application?.first_name || ''}_${application?.last_name || ''}`.trim() || 'Client'
                                    const dateStr = new Date().toISOString().split('T')[0]
                                    const fileName = `Final_Application_Package_${clientName}_${dateStr}.pdf`
                                    const filePath = `${application.user_id}/final_package.pdf`
                                    
                                    const { error: uploadError } = await supabase.storage
                                      .from('documents')
                                      .upload(filePath, finalPdfBytes, {
                                        contentType: 'application/pdf',
                                        cacheControl: '3600',
                                        upsert: true, // Overwrite if exists
                                      })
                                    
                                    if (uploadError) {
                                      throw new Error(`Failed to upload final package: ${uploadError.message}`)
                                    }
                                    
                                    // 8. Update timeline step
                                    if (onUpdateSubStep && application?.id) {
                                      await onUpdateSubStep('ead_final_package_download', 'completed', {
                                        date: new Date().toISOString(),
                                        generated_at: new Date().toISOString(),
                                        final_package_path: filePath,
                                        final_package_file_name: fileName,
                                        generated: true,
                                      })
                                    }
                                    
                                    if (showToast) showToast('Final package generated successfully with signatures', 'success')
                                  } catch (error: any) {
                                    console.error('Error generating final package:', error)
                                    handleErrorSilently(error, { operation: 'generateFinalPackage', applicationId: application?.id })
                                    
                                    // Provide more specific error messages
                                    let errorMessage = 'Failed to generate final package'
                                    if (error?.message) {
                                      errorMessage = error.message
                                    } else if (error instanceof Error) {
                                      errorMessage = error.message
                                    } else if (typeof error === 'string') {
                                      errorMessage = error
                                    }
                                    
                                    if (showToast) showToast(errorMessage, 'error')
                                  } finally {
                                    setGeneratingFinalPackage(false)
                                  }
                                }}
                                size="sm"
                                variant="outline"
                                disabled={!preparerSigned || !clientSigned || !documentsCompiled || generatingFinalPackage}
                                className="text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/20 dark:hover:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800 w-full sm:w-auto flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {generatingFinalPackage ? (
                                  <>
                                    <Loader2 className="h-3 w-3 mr-1 flex-shrink-0 animate-spin" />
                                    Generating...
                                  </>
                                ) : (
                                  <>
                                    <FileText className="h-3 w-3 mr-1 flex-shrink-0" />
                                    Generate Final Package
                                  </>
                                )}
                              </Button>
                              {/* Upload Button */}
                              <Button
                                onClick={() => {
                                  const input = document.createElement('input')
                                  input.type = 'file'
                                  input.accept = '.pdf'
                                  input.onchange = async (e) => {
                                    const file = (e.target as HTMLInputElement).files?.[0]
                                    if (!file || !application?.user_id) return
                                    
                                    try {
                                      if (showToast) showToast('Uploading final package...', 'info')
                                      
                                      const clientName = `${application?.first_name || ''}_${application?.last_name || ''}`.trim() || 'Client'
                                      const dateStr = new Date().toISOString().split('T')[0]
                                      const fileName = `Final_Application_Package_${clientName}_${dateStr}.pdf`
                                      const pdfFile = new File([file], fileName, { type: 'application/pdf' })
                                      
                                      // Upload to documents folder (same path as generate)
                                      const filePath = `${application.user_id}/final_package.pdf`
                                      const { error: uploadError } = await supabase.storage
                                        .from('documents')
                                        .upload(filePath, pdfFile, {
                                          cacheControl: '3600',
                                          upsert: true, // Overwrite if exists
                                        })
                                      
                                      if (uploadError) {
                                        handleErrorSilently(uploadError, { operation: 'uploadFinalPackage', applicationId: application?.id })
                                        if (showToast) showToast('Failed to upload final package', 'error')
                                      } else {
                                        // Update timeline step
                                        if (onUpdateSubStep && application?.id) {
                                          try {
                                            await onUpdateSubStep('ead_final_package_download', 'completed', {
                                              date: new Date().toISOString(),
                                              uploaded_at: new Date().toISOString(),
                                              final_package_path: filePath,
                                              final_package_file_name: fileName,
                                              uploaded: true,
                                            })
                                          } catch (error) {
                                            handleErrorSilently(error, { operation: 'updateFinalPackageUpload', applicationId: application?.id })
                                          }
                                        }
                                        if (showToast) showToast('Final package uploaded successfully', 'success')
                                      }
                                    } catch (error) {
                                      handleErrorSilently(error, { operation: 'uploadFinalPackage', applicationId: application?.id })
                                      if (showToast) showToast('Failed to upload final package', 'error')
                                    }
                                  }
                                  input.click()
                                }}
                                size="sm"
                                variant="outline"
                                className="text-xs bg-green-50 hover:bg-green-100 text-green-700 border-green-300 dark:bg-green-900/20 dark:hover:bg-green-900/30 dark:text-green-300 dark:border-green-800 w-full sm:w-auto flex items-center justify-center"
                              >
                                <Upload className="h-3 w-3 mr-1 flex-shrink-0" />
                                Upload
                              </Button>
                              {/* Open/View Button */}
                              <Button
                                onClick={async () => {
                                  if (!finalPackageExists) {
                                    if (showToast) showToast('Please generate or upload final package first', 'warning')
                                    return
                                  }
                                  try {
                                    let pdfUrl: string
                                    let fileName: string
                                    
                                    // Try to use final package file
                                    if (subStep.data?.final_package_path) {
                                      try {
                                        const signedUrl = await getSignedFileUrl(subStep.data.final_package_path, 3600)
                                        // Verify the URL is accessible
                                        const testResponse = await fetch(signedUrl, { method: 'HEAD' })
                                        if (testResponse.ok) {
                                          pdfUrl = signedUrl
                                          fileName = subStep.data.final_package_file_name || `Final_EAD_Application_Package_${application?.first_name || 'Form'}_${application?.last_name || ''}_${new Date().toISOString().split('T')[0]}.pdf`
                                        } else {
                                          throw new Error('Failed to fetch final package from storage')
                                        }
                                      } catch (error) {
                                        handleErrorSilently(error, { operation: 'fetchFinalPackage', applicationId: application?.id })
                                        if (showToast) showToast('Final package not found', 'error')
                                        return
                                      }
                                    } else {
                                      if (showToast) showToast('Final package not found', 'error')
                                      return
                                    }
                                    
                                    // Open PDF in modal
                                    if (setViewingPdfUrl && setViewingPdfName && setShowPdfModal) {
                                      setViewingPdfUrl(pdfUrl)
                                      setViewingPdfName(fileName)
                                      setShowPdfModal(true)
                                    } else {
                                      // Fallback to direct download if modal not available
                                      const response = await fetch(pdfUrl)
                                      const pdfBlob = await response.blob()
                                      const url = URL.createObjectURL(pdfBlob)
                                      const link = document.createElement('a')
                                      link.href = url
                                      link.download = fileName
                                      document.body.appendChild(link)
                                      link.click()
                                      document.body.removeChild(link)
                                      URL.revokeObjectURL(url)
                                    }
                                  } catch (error) {
                                    handleErrorSilently(error, { operation: 'openFinalPackage', applicationId: application?.id })
                                    if (showToast) showToast('Failed to open final package', 'error')
                                  }
                                }}
                                size="sm"
                                variant="outline"
                                disabled={!finalPackageExists}
                                className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800 w-full sm:w-auto flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <Eye className="h-3 w-3 mr-1 flex-shrink-0" />
                                Open Final Application Package
                              </Button>
                              {subStep.data?.downloaded_at && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  Downloaded: {formatDate(subStep.data.downloaded_at)}
                                </span>
                              )}
                                </div>
                              </div>
                            </div>
                          )
                        })()}
                        {subStep.date && 
                         subStep.key !== 'official_docs_submitted' && 
                         subStep.key !== 'letter_submitted' && 
                         subStep.key !== 'mandatory_courses' &&
                         subStep.key !== 'form1_submitted' &&
                         subStep.key !== 'nclex_eligibility_approved' &&
                         subStep.key !== 'pearson_account_created' &&
                         subStep.key !== 'ead_forms_verified' && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                        {formatDate(subStep.date)}
                      </p>
                    )}
                  </div>
                      <div className="flex items-center gap-2">
                        {/* Generate Letter button for letter_generated */}
                        {subStep.key === 'letter_generated' && showGenerateLetter && (
                  <Button
                            onClick={async () => {
                      if (!application) return
                      
                              try {
                      // Get current date
                      const currentDate = new Date().toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })

                      // Get client full name
                      const clientFullName = `${application.first_name}${application.middle_name ? ` ${application.middle_name}` : ''} ${application.last_name}`.trim()

                      // Get nursing school info
                      const schoolName = application.nursing_school || 'Nursing School'
                      const schoolCity = application.nursing_school_city || ''
                      const schoolProvince = application.nursing_school_province || ''
                      const schoolCountry = application.nursing_school_country || ''

                      // Create letter HTML for printing/PDF
                      const letterHTML = `
                        <!DOCTYPE html>
                        <html>
                          <head>
                            <title>Official Letter - ${clientFullName}</title>
                            <meta charset="UTF-8">
                            <style>
                              * {
                                margin: 0;
                                padding: 0;
                                box-sizing: border-box;
                              }
                              @page {
                                size: letter;
                                margin: 0;
                              }
                              @media screen {
                                body {
                                  display: flex;
                                  justify-content: center;
                                  align-items: flex-start;
                                  min-height: 100vh;
                                  background: #f3f4f6;
                                  padding: 10px;
                                }
                                .letter-container {
                                  background: white;
                                  box-shadow: 0 10px 40px rgba(0,0,0,0.3);
                                  width: 100%;
                                  max-width: 8.5in;
                                  min-height: 11in;
                                  margin: 0 auto;
                                }
                              }
                              @media screen and (max-width: 768px) {
                                body {
                                  padding: 5px;
                                }
                                .letter-container {
                                  width: 100%;
                                  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                                }
                                .letter-header-gradient {
                                  padding: 0.5em 0.5em !important;
                                  flex-direction: column;
                                  gap: 0.5em;
                                }
                                .letter-header-left {
                                  flex-direction: column;
                                  text-align: center;
                                  gap: 0.5em;
                                }
                                .letter-logo {
                                  width: 40px;
                                  height: 40px;
                                }
                                .letter-company-name {
                                  font-size: 16pt !important;
                                }
                                .letter-company-tagline {
                                  font-size: 8pt !important;
                                }
                                .letter-content-wrapper {
                                  padding: 0.4in 0.5em !important;
                                }
                                .letter-footer-gradient {
                                  padding: 0.4em 0.5em !important;
                                  font-size: 7pt !important;
                                }
                                .letter-footer-content {
                                  flex-direction: column;
                                  gap: 0.3em;
                                }
                                .print-button {
                                  position: fixed;
                                  bottom: 20px;
                                  right: 20px;
                                  top: auto;
                                  padding: 10px 20px;
                                  font-size: 12px;
                                }
                              }
                              @media screen and (max-width: 480px) {
                                .letter-content-wrapper {
                                  padding: 0.3in 0.4em !important;
                                }
                                body {
                                  font-size: 11pt;
                                }
                                .letter-body {
                                  font-size: 10pt !important;
                                }
                              }
                              @media print {
                                body {
                                  margin: 0;
                                  padding: 0;
                                  background: white;
                                }
                                .letter-container {
                                  width: 100%;
                                  box-shadow: none;
                                }
                                .print-button {
                                  display: none;
                                }
                                .letter-header-gradient {
                                  background: linear-gradient(135deg, #dc2626 0%, #991b1b 50%, #7f1d1d 100%) !important;
                                  -webkit-print-color-adjust: exact;
                                  print-color-adjust: exact;
                                }
                                .letter-footer-gradient {
                                  background: linear-gradient(135deg, #dc2626 0%, #991b1b 50%, #7f1d1d 100%) !important;
                                  -webkit-print-color-adjust: exact;
                                  print-color-adjust: exact;
                                }
                              }
                              body {
                                font-family: 'Times New Roman', serif;
                                font-size: 12pt;
                                line-height: 1.6;
                                color: #000;
                              }
                              .letter-container {
                                width: 100%;
                                max-width: 8.5in;
                                min-height: 11in;
                                padding: 0;
                                margin: 0 auto;
                                background: white;
                                display: flex;
                                flex-direction: column;
                              }
                              .print-button {
                                position: fixed;
                                top: 20px;
                                right: 20px;
                                padding: 12px 24px;
                                background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
                                color: white;
                                border: none;
                                border-radius: 6px;
                                cursor: pointer;
                                font-size: 14px;
                                font-weight: 500;
                                z-index: 1000;
                                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                              }
                              .print-button:hover {
                                background: linear-gradient(135deg, #b91c1c 0%, #7f1d1d 100%);
                                transform: translateY(-1px);
                                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                              }
                              .letter-header-gradient {
                                background: linear-gradient(135deg, #dc2626 0%, #991b1b 50%, #7f1d1d 100%);
                                padding: 0.6em 1in;
                                color: white;
                                display: flex;
                                align-items: center;
                                justify-content: space-between;
                                border-bottom: 2px solid rgba(255,255,255,0.2);
                              }
                              .letter-header-left {
                                display: flex;
                                align-items: center;
                                gap: 0.8em;
                              }
                              .letter-logo {
                                width: 50px;
                                height: 50px;
                                object-fit: contain;
                                background: white;
                                padding: 6px;
                                border-radius: 6px;
                              }
                              .letter-company-info {
                                display: flex;
                                flex-direction: column;
                              }
                              .letter-company-name {
                                font-size: 20pt;
                                font-weight: bold;
                                margin-bottom: 0;
                                letter-spacing: 1px;
                                line-height: 1;
                              }
                              .letter-company-tagline {
                                font-size: 9pt;
                                opacity: 0.9;
                                font-style: italic;
                                margin-top: 0;
                                line-height: 1.1;
                              }
                              .letter-content-wrapper {
                                padding: 0.6in 1in;
                                flex: 1;
                                display: flex;
                                flex-direction: column;
                                justify-content: center;
                              }
                              .letter-recipient {
                                margin-bottom: 1em;
                                margin-top: 0.3em;
                                line-height: 1.4;
                              }
                              .letter-date {
                                margin-bottom: 0.8em;
                                text-align: right;
                              }
                              .letter-salutation {
                                margin-bottom: 0.6em;
                              }
                              .letter-body {
                                text-align: justify;
                                margin-bottom: 0.8em;
                                line-height: 1.4;
                                font-size: 11pt;
                              }
                              .letter-body p {
                                margin-bottom: 0.5em;
                                text-indent: 0;
                              }
                              .letter-list {
                                margin: 0.5em 0 0.5em 2em;
                                line-height: 1.5;
                              }
                              .letter-email-info {
                                margin: 0.8em 0 0.8em 3em;
                                line-height: 1.4;
                                font-family: 'Courier New', monospace;
                                font-size: 9pt;
                              }
                              .letter-closing {
                                margin-top: 1em;
                              }
                              .letter-signature {
                                margin-top: 1.2em;
                                line-height: 1.4;
                              }
                              .letter-signature-name {
                                font-weight: bold;
                                margin-bottom: 0.2em;
                              }
                              .letter-on-behalf {
                                margin-top: 1em;
                                padding-top: 0.8em;
                                border-top: 1px solid #ddd;
                                line-height: 1.4;
                              }
                              .letter-on-behalf-title {
                                font-weight: bold;
                                margin-bottom: 0.2em;
                              }
                              .letter-footer-gradient {
                                background: linear-gradient(135deg, #dc2626 0%, #991b1b 50%, #7f1d1d 100%);
                                padding: 0.5em 1in;
                                color: white;
                                font-size: 8pt;
                                text-align: center;
                                border-top: 2px solid rgba(255,255,255,0.2);
                                margin-top: auto;
                              }
                              .letter-footer-content {
                                display: flex;
                                justify-content: center;
                                align-items: center;
                                gap: 0.5em;
                                flex-wrap: wrap;
                              }
                              .letter-footer-separator {
                                margin: 0 0.3em;
                              }
                            </style>
                          </head>
                          <body>
                            <button class="print-button" onclick="window.print()">Download as PDF</button>
                            
                            <div class="letter-container">
                              <!-- Official Header -->
                              <div class="letter-header-gradient">
                                <div class="letter-header-left">
                                  <img src="${window.location.origin}/gritsync_logo.png" alt="GritSync Logo" class="letter-logo" onerror="this.style.display='none'">
                                  <div class="letter-company-info">
                                    <div class="letter-company-name">GRITSYNC</div>
                                    <div class="letter-company-tagline">Business Consultancy Services</div>
                                  </div>
                                </div>
                              </div>
                              
                              <div class="letter-content-wrapper">
                                <!-- Recipient Address -->
                                <div class="letter-recipient">
                                  <div>${schoolName}</div>
                                  <div>${schoolCity}${schoolCity && schoolProvince ? ', ' : ''}${schoolProvince}</div>
                                  <div>${schoolCountry}</div>
                                </div>
                                
                                <!-- Date -->
                                <div class="letter-date">
                                  ${currentDate}
                                </div>
                                
                                <!-- Salutation -->
                                <div class="letter-salutation">
                                  Dear Sir/Madam:
                                </div>
                                
                                <!-- Body -->
                                <div class="letter-body">
                                  <p>
                                    Greetings from GritSync Business Consultancy Services.
                                  </p>
                                  
                                  <p>
                                    We are writing on behalf of our client, <strong>${clientFullName}</strong>, who is currently applying for the NCLEX-RN under the New York Board of Nursing. To facilitate this application, we kindly request an official copy of the following documents:
                                  </p>
                                  
                                  <div class="letter-list">
                                    A. FORM 2F (Form Attached)<br>
                                    B. Transcript of Records<br>
                                    C. Related Learning Experience
                                  </div>
                                  
                                  <p>
                                    Please scan and send these documents via EMAIL using your OFFICIAL EMAIL address (e.g., universityregistrar@school.edu.ph).
                                  </p>
                                  
                                  <div class="letter-email-info">
                                    TO: DPLSEduc@nysed.gov ; OPUNIT4@nysed.gov<br>
                                    BCC: ${application.email} ; office@gritsync.com
                                  </div>
                                  
                                  <p>
                                    Your prompt attention to this request is greatly appreciated as it will significantly aid in the timely processing of our client's application.
                                  </p>
                                  
                                  <p>
                                    Thank you for your kind consideration and cooperation.
                                  </p>
                                </div>
                                
                                <!-- Closing -->
                                <div class="letter-closing">
                                  Sincerely,
                                </div>
                                
                                <!-- Signature Block -->
                                <div class="letter-signature">
                                  <div class="letter-signature-name">JJ Cantila, BSN, CADRN, USRN</div>
                                  <div>Program Advisor, GritSync</div>
                                  <div>office@gritsync.com</div>
                                  <div>${phoneNumber.replace(/\D/g, '')}</div>
                                </div>
                                
                                <!-- On Behalf Of -->
                                <div class="letter-on-behalf">
                                  <div class="letter-on-behalf-title">On behalf of:</div>
                                  <div>${clientFullName}</div>
                                  <div>${application.email}</div>
                                  <div>${application.mobile_number}</div>
                                </div>
                              </div>
                              
                              <!-- Official Footer -->
                              <div class="letter-footer-gradient">
                                <div class="letter-footer-content">
                                  <span>GritSync</span>
                                  <span class="letter-footer-separator">/</span>
                                  <span>office@gritsync.com</span>
                                  <span class="letter-footer-separator">/</span>
                                  <span>${phoneNumber.replace(/\D/g, '')}</span>
                                  <span class="letter-footer-separator">/</span>
                                  <span>NCLEX Application Processing</span>
                                </div>
                              </div>
                            </div>
                          </body>
                        </html>
                      `

                      // Open new tab with letter
                      const printWindow = window.open('', '_blank')
                      if (printWindow) {
                        printWindow.document.write(letterHTML)
                        printWindow.document.close()
                                  
                                  // Mark letter_generated step as completed
                                  if (onUpdateSubStep && application?.id) {
                                    try {
                                      await onUpdateSubStep('letter_generated', 'completed', {
                                        date: new Date().toISOString(),
                                        generated_at: new Date().toISOString()
                                      })
                                    } catch (error) {
                                      handleErrorSilently(error, { operation: 'updateTimelineStep', applicationId: application?.id })
                                    }
                                  }
                                } else {
                                  alert('Please allow pop-ups for this site to generate the letter.')
                                }
                              } catch (error) {
                                handleErrorSilently(error, { operation: 'generateLetter', applicationId: application?.id })
                                alert('An error occurred while generating the letter. Please try again.')
                              }
                            }}
                    size="sm"
                            className="bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-600 dark:bg-yellow-600 dark:hover:bg-yellow-700 dark:border-yellow-700"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Generate Letter for school
                  </Button>
                        )}
                        {/* Date picker for app_created */}
                        {subStep.key === 'app_created' && isAdmin && (
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Date Created</label>
                            <Input
                              type="date"
                              value={subStep.date ? subStep.date.split('T')[0] : ''}
                              onChange={async (e) => {
                                const dateValue = e.target.value
                                if (dateValue && onUpdateSubStep && application?.id) {
                                  try {
                                    // Create date at noon local time to avoid timezone issues
                                    const dateObj = new Date(dateValue)
                                    dateObj.setHours(12, 0, 0, 0)
                                    await onUpdateSubStep('app_created', 'completed', {
                                      date: dateObj.toISOString(),
                                      created_date: dateObj.toISOString()
                                    })
                                  } catch (error) {
                                    handleErrorSilently(error, { operation: 'updateAppCreatedDate', applicationId: application?.id })
                                  }
                                } else if (!dateValue && onUpdateSubStep && application?.id) {
                                  await onUpdateSubStep('app_created', 'pending', {})
                                }
                              }}
                              className="w-40 text-xs"
                              placeholder="Select date"
                              title="Select date when application was created"
                            />
                          </div>
                        )}
                        {/* Date picker for documents_submitted */}
                        {subStep.key === 'documents_submitted' && isAdmin && (
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Date Documents Submitted</label>
                            <Input
                              type="date"
                              value={subStep.date ? subStep.date.split('T')[0] : ''}
                              onChange={async (e) => {
                                const dateValue = e.target.value
                                if (dateValue && onUpdateSubStep && application?.id) {
                                  try {
                                    // Create date at noon local time to avoid timezone issues
                                    const dateObj = new Date(dateValue)
                                    dateObj.setHours(12, 0, 0, 0)
                                    await onUpdateSubStep('documents_submitted', 'completed', {
                                      date: dateObj.toISOString(),
                                      submitted_date: dateObj.toISOString()
                                    })
                                  } catch (error) {
                                    handleErrorSilently(error, { operation: 'updateDocumentsSubmittedDate', applicationId: application?.id })
                                  }
                                } else if (!dateValue && onUpdateSubStep && application?.id) {
                                  await onUpdateSubStep('documents_submitted', 'pending', {})
                                }
                              }}
                              className="w-40 text-xs"
                              placeholder="Select date"
                              title="Select date when required documents were submitted"
                            />
                          </div>
                        )}
                        {/* Date picker for letter_submitted */}
                        {subStep.key === 'letter_submitted' && (
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Date Request Letter Submitted</label>
                            <Input
                              type="date"
                              value={subStep.date ? subStep.date.split('T')[0] : ''}
                              onChange={async (e) => {
                                const dateValue = e.target.value
                                if (dateValue && onUpdateSubStep && application?.id) {
                                  try {
                                    // Create date at noon local time to avoid timezone issues
                                    const dateObj = new Date(dateValue)
                                    dateObj.setHours(12, 0, 0, 0)
                                    await onUpdateSubStep('letter_submitted', 'completed', {
                                      date: dateObj.toISOString(),
                                      submitted_date: dateObj.toISOString()
                                    })
                                  } catch (error) {
                                    handleErrorSilently(error, { operation: 'updateLetterSubmittedDate', applicationId: application?.id })
                                  }
                                } else if (dateValue && onUpdateSubStep && application?.id) {
                                  // If date is cleared, mark as pending
                                  await onUpdateSubStep('letter_submitted', 'pending', {})
                                }
                              }}
                              className="w-40 text-xs"
                              placeholder="Select date"
                              title="Select date when letter was submitted to school"
                            />
                          </div>
                        )}
                        {/* Date picker for mandatory_courses */}
                        {subStep.key === 'mandatory_courses' && isAdmin && (
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Date Completed</label>
                            <Input
                              type="date"
                              value={subStep.date ? subStep.date.split('T')[0] : ''}
                              onChange={async (e) => {
                                const dateValue = e.target.value
                                if (dateValue && onUpdateSubStep && application?.id) {
                                  try {
                                    // Create date at noon local time to avoid timezone issues
                                    const dateObj = new Date(dateValue)
                                    dateObj.setHours(12, 0, 0, 0)
                                    await onUpdateSubStep('mandatory_courses', 'completed', {
                                      date: dateObj.toISOString(),
                                      completed_date: dateObj.toISOString()
                                    })
                                  } catch (error) {
                                    handleErrorSilently(error, { operation: 'updateMandatoryCoursesDate', applicationId: application?.id })
                                  }
                                } else if (dateValue && onUpdateSubStep && application?.id) {
                                  await onUpdateSubStep('mandatory_courses', 'pending', {})
                                }
                              }}
                              className="w-40 text-xs"
                              placeholder="Select date"
                              title="Select date when mandatory courses were completed"
                            />
                          </div>
                        )}
                        {/* Form 1 Application Reference Number and Date */}
                        {subStep.key === 'form1_submitted' && isAdmin && (
                          <div className="flex items-center gap-2">
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Application Reference Number</label>
                              <Input
                                type="text"
                                value={form1RefNumber}
                                onChange={(e) => setForm1RefNumber(e.target.value)}
                                placeholder="Enter reference number..."
                                className="w-48 text-xs"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Date Submitted</label>
                              <Input
                                type="date"
                                value={form1Date}
                                onChange={(e) => setForm1Date(e.target.value)}
                                placeholder="Select date"
                                className="w-40 text-xs"
                                title="Select date when Form 1 was submitted"
                              />
                            </div>
                  <Button
                              onClick={async () => {
                                if (!onUpdateSubStep || !application?.id) return
                                setSavingForm1(true)
                                try {
                                  const saveData: any = {}
                                  if (form1Date) {
                                    // Create date at noon local time to avoid timezone issues
                                    const dateObj = new Date(form1Date)
                                    dateObj.setHours(12, 0, 0, 0)
                                    saveData.date = dateObj.toISOString()
                                    saveData.submitted_date = dateObj.toISOString()
                                  }
                                  if (form1RefNumber) {
                                    saveData.reference_number = form1RefNumber
                                    saveData.ref_number = form1RefNumber
                                  }
                                  await onUpdateSubStep('form1_submitted', (form1Date || form1RefNumber) ? 'completed' : 'pending', saveData)
                                } catch (error) {
                                  handleErrorSilently(error, { operation: 'saveForm1Data', applicationId: application?.id })
                                } finally {
                                  setSavingForm1(false)
                                }
                              }}
                              disabled={savingForm1}
                    size="sm"
                              className="mt-5"
                  >
                              {savingForm1 ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              )}
                        {/* Date picker for nclex_eligibility_approved */}
                        {subStep.key === 'nclex_eligibility_approved' && isAdmin && (
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Date of Approval</label>
                      <Input
                              type="date"
                              value={subStep.date ? subStep.date.split('T')[0] : ''}
                              onChange={async (e) => {
                                const dateValue = e.target.value
                                if (dateValue && onUpdateSubStep && application?.id) {
                                  try {
                                    // Create date at noon local time to avoid timezone issues
                                    const dateObj = new Date(dateValue)
                                    dateObj.setHours(12, 0, 0, 0)
                                    await onUpdateSubStep('nclex_eligibility_approved', 'completed', {
                                      date: dateObj.toISOString(),
                                      approved_date: dateObj.toISOString()
                                    })
                                  } catch (error) {
                                    handleErrorSilently(error, { operation: 'updateNCLEXEligibilityApprovedDate', applicationId: application?.id })
                                  }
                                } else if (dateValue && onUpdateSubStep && application?.id) {
                                  await onUpdateSubStep('nclex_eligibility_approved', 'pending', {})
                                }
                              }}
                              className="w-40 text-xs"
                              placeholder="Select date"
                              title="Select date when NCLEX eligibility was approved"
                            />
                          </div>
                        )}
                        {/* EAD Application Submitted - Tracking Number */}
                        {subStep.key === 'ead_application_submitted' && isAdmin && (
                          <div className="flex items-center gap-2">
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Tracking #</label>
                              <Input
                                type="text"
                                value={eadTrackingNumber}
                                onChange={(e) => setEadTrackingNumber(e.target.value)}
                                placeholder="Enter tracking number..."
                                className="w-48 text-xs"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Date Submitted</label>
                              <Input
                                type="date"
                                value={subStep.date ? subStep.date.split('T')[0] : ''}
                                onChange={async (e) => {
                                  const dateValue = e.target.value
                                  if (dateValue && onUpdateSubStep && application?.id) {
                                    try {
                                      const dateObj = new Date(dateValue)
                                      dateObj.setHours(12, 0, 0, 0)
                                      const saveData: any = {
                                        date: dateObj.toISOString(),
                                        submitted_date: dateObj.toISOString()
                                      }
                                      if (eadTrackingNumber) {
                                        saveData.tracking_number = eadTrackingNumber
                                        saveData.tracking = eadTrackingNumber
                                      }
                                      await onUpdateSubStep('ead_application_submitted', 'completed', saveData)
                                    } catch (error) {
                                      handleErrorSilently(error, { operation: 'updateEADApplicationSubmitted', applicationId: application?.id })
                                    }
                                  } else if (!dateValue && onUpdateSubStep && application?.id) {
                                    await onUpdateSubStep('ead_application_submitted', 'pending', {})
                                  }
                                }}
                                className="w-40 text-xs"
                                placeholder="Select date"
                                title="Select date when EAD application was submitted"
                              />
                            </div>
                            <Button
                              onClick={async () => {
                                if (!onUpdateSubStep || !application?.id) return
                                setSavingEadData(true)
                                try {
                                  const saveData: any = {}
                                  if (subStep.date) {
                                    saveData.date = subStep.date
                                    saveData.submitted_date = subStep.date
                                  }
                                  if (eadTrackingNumber) {
                                    saveData.tracking_number = eadTrackingNumber
                                    saveData.tracking = eadTrackingNumber
                                  }
                                  await onUpdateSubStep('ead_application_submitted', (subStep.date || eadTrackingNumber) ? 'completed' : 'pending', saveData)
                                } catch (error) {
                                  handleErrorSilently(error, { operation: 'saveEADApplicationSubmittedData', applicationId: application?.id })
                                } finally {
                                  setSavingEadData(false)
                                }
                              }}
                              disabled={savingEadData}
                              size="sm"
                              className="mt-5"
                            >
                              {savingEadData ? 'Saving...' : 'Save'}
                            </Button>
                          </div>
                        )}
                        {/* EAD Receipt Received - USCIS Number */}
                        {subStep.key === 'ead_receipt_received' && isAdmin && (
                          <div className="flex items-center gap-2">
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">USCIS #</label>
                              <Input
                                type="text"
                                value={eadUscisNumber}
                                onChange={(e) => setEadUscisNumber(e.target.value)}
                                placeholder="Enter USCIS number..."
                                className="w-48 text-xs"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Date Received</label>
                              <Input
                                type="date"
                                value={subStep.date ? subStep.date.split('T')[0] : ''}
                                onChange={async (e) => {
                                  const dateValue = e.target.value
                                  if (dateValue && onUpdateSubStep && application?.id) {
                                    try {
                                      const dateObj = new Date(dateValue)
                                      dateObj.setHours(12, 0, 0, 0)
                                      const saveData: any = {
                                        date: dateObj.toISOString(),
                                        received_date: dateObj.toISOString()
                                      }
                                      if (eadUscisNumber) {
                                        saveData.uscis_number = eadUscisNumber
                                        saveData.uscis = eadUscisNumber
                                      }
                                      await onUpdateSubStep('ead_receipt_received', 'completed', saveData)
                                    } catch (error) {
                                      handleErrorSilently(error, { operation: 'updateEADReceiptReceived', applicationId: application?.id })
                                    }
                                  } else if (!dateValue && onUpdateSubStep && application?.id) {
                                    await onUpdateSubStep('ead_receipt_received', 'pending', {})
                                  }
                                }}
                                className="w-40 text-xs"
                                placeholder="Select date"
                                title="Select date when receipt notice was received"
                              />
                            </div>
                            <Button
                              onClick={async () => {
                                if (!onUpdateSubStep || !application?.id) return
                                setSavingEadData(true)
                                try {
                                  const saveData: any = {}
                                  if (subStep.date) {
                                    saveData.date = subStep.date
                                    saveData.received_date = subStep.date
                                  }
                                  if (eadUscisNumber) {
                                    saveData.uscis_number = eadUscisNumber
                                    saveData.uscis = eadUscisNumber
                                  }
                                  await onUpdateSubStep('ead_receipt_received', (subStep.date || eadUscisNumber) ? 'completed' : 'pending', saveData)
                                } catch (error) {
                                  handleErrorSilently(error, { operation: 'saveEADReceiptReceivedData', applicationId: application?.id })
                                } finally {
                                  setSavingEadData(false)
                                }
                              }}
                              disabled={savingEadData}
                              size="sm"
                              className="mt-5"
                            >
                              {savingEadData ? 'Saving...' : 'Save'}
                            </Button>
                          </div>
                        )}
                        {/* EAD Card Mailed - Tracking Number */}
                        {subStep.key === 'ead_card_mailed' && isAdmin && (
                          <div className="flex items-center gap-2">
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Tracking #</label>
                              <Input
                                type="text"
                                value={eadCardTrackingNumber}
                                onChange={(e) => setEadCardTrackingNumber(e.target.value)}
                                placeholder="Enter tracking number..."
                                className="w-48 text-xs"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Date Mailed</label>
                              <Input
                                type="date"
                                value={subStep.date ? subStep.date.split('T')[0] : ''}
                                onChange={async (e) => {
                                  const dateValue = e.target.value
                                  if (dateValue && onUpdateSubStep && application?.id) {
                                    try {
                                      const dateObj = new Date(dateValue)
                                      dateObj.setHours(12, 0, 0, 0)
                                      const saveData: any = {
                                        date: dateObj.toISOString(),
                                        mailed_date: dateObj.toISOString()
                                      }
                                      if (eadCardTrackingNumber) {
                                        saveData.tracking_number = eadCardTrackingNumber
                                        saveData.tracking = eadCardTrackingNumber
                                      }
                                      await onUpdateSubStep('ead_card_mailed', 'completed', saveData)
                                    } catch (error) {
                                      handleErrorSilently(error, { operation: 'updateEADCardMailed', applicationId: application?.id })
                                    }
                                  } else if (!dateValue && onUpdateSubStep && application?.id) {
                                    await onUpdateSubStep('ead_card_mailed', 'pending', {})
                                  }
                                }}
                                className="w-40 text-xs"
                                placeholder="Select date"
                                title="Select date when card was mailed"
                              />
                            </div>
                            <Button
                              onClick={async () => {
                                if (!onUpdateSubStep || !application?.id) return
                                setSavingEadData(true)
                                try {
                                  const saveData: any = {}
                                  if (subStep.date) {
                                    saveData.date = subStep.date
                                    saveData.mailed_date = subStep.date
                                  }
                                  if (eadCardTrackingNumber) {
                                    saveData.tracking_number = eadCardTrackingNumber
                                    saveData.tracking = eadCardTrackingNumber
                                  }
                                  await onUpdateSubStep('ead_card_mailed', (subStep.date || eadCardTrackingNumber) ? 'completed' : 'pending', saveData)
                                } catch (error) {
                                  handleErrorSilently(error, { operation: 'saveEADCardMailedData', applicationId: application?.id })
                                } finally {
                                  setSavingEadData(false)
                                }
                              }}
                              disabled={savingEadData}
                              size="sm"
                              className="mt-5"
                            >
                              {savingEadData ? 'Saving...' : 'Save'}
                            </Button>
                          </div>
                        )}
                        {/* Date picker for pearson_account_created */}
                        {subStep.key === 'pearson_account_created' && isAdmin && (
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Date Account Created</label>
                            <Input
                              type="date"
                              value={subStep.date ? subStep.date.split('T')[0] : ''}
                              onChange={async (e) => {
                                const dateValue = e.target.value
                                if (dateValue && onUpdateSubStep && application?.id) {
                                  try {
                                    // Create date at noon local time to avoid timezone issues
                                    const dateObj = new Date(dateValue)
                                    dateObj.setHours(12, 0, 0, 0)
                                    await onUpdateSubStep('pearson_account_created', 'completed', {
                                      date: dateObj.toISOString(),
                                      created_date: dateObj.toISOString()
                                    })
                                  } catch (error) {
                                    handleErrorSilently(error, { operation: 'updatePearsonAccountCreatedDate', applicationId: application?.id })
                                  }
                                } else if (dateValue && onUpdateSubStep && application?.id) {
                                  await onUpdateSubStep('pearson_account_created', 'pending', {})
                                }
                              }}
                              className="w-40 text-xs"
                              placeholder="Select date"
                              title="Select date when Pearson VUE account was created"
                            />
                    </div>
                  )}
                        {/* Date picker for att_requested */}
                        {subStep.key === 'att_requested' && isAdmin && (
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Date ATT Request Submitted</label>
                        <Input
                          type="date"
                              value={subStep.date ? subStep.date.split('T')[0] : ''}
                              onChange={async (e) => {
                                const dateValue = e.target.value
                                if (dateValue && onUpdateSubStep && application?.id) {
                                  try {
                                    // Create date at noon local time to avoid timezone issues
                                    const dateObj = new Date(dateValue)
                                    dateObj.setHours(12, 0, 0, 0)
                                    await onUpdateSubStep('att_requested', 'completed', {
                                      date: dateObj.toISOString(),
                                      submitted_date: dateObj.toISOString()
                                    })
                                  } catch (error) {
                                    handleErrorSilently(error, { operation: 'updateATTRequestSubmittedDate', applicationId: application?.id })
                                  }
                                } else if (!dateValue && onUpdateSubStep && application?.id) {
                                  await onUpdateSubStep('att_requested', 'pending', {})
                                }
                              }}
                              className="w-40 text-xs"
                              placeholder="Select date"
                              title="Select date when ATT request was submitted"
                            />
                          </div>
                        )}
                        {/* Date picker for official_docs_submitted */}
                        {subStep.key === 'official_docs_submitted' && (
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Date Official Docs Sent</label>
                            <Input
                              type="date"
                              value={subStep.date ? subStep.date.split('T')[0] : ''}
                              onChange={async (e) => {
                                const dateValue = e.target.value
                                if (dateValue && onUpdateSubStep && application?.id) {
                                  try {
                                    // Create date at noon local time to avoid timezone issues
                                    const dateObj = new Date(dateValue)
                                    dateObj.setHours(12, 0, 0, 0)
                                    await onUpdateSubStep('official_docs_submitted', 'completed', {
                                      date: dateObj.toISOString(),
                                      sent_to_bon_date: dateObj.toISOString()
                                    })
                                  } catch (error) {
                                    handleErrorSilently(error, { operation: 'updateOfficialDocumentsDate', applicationId: application?.id })
                                  }
                                } else if (dateValue && onUpdateSubStep && application?.id) {
                                  // If date is cleared, mark as pending
                                  await onUpdateSubStep('official_docs_submitted', 'pending', {})
                                }
                              }}
                              className="w-40 text-xs"
                              placeholder="Select date"
                              title="Select date when documents were sent to BON"
                            />
                      </div>
                        )}
                        {/* ATT Code and Expiry Date for ATT received */}
                        {subStep.key === 'att_received' && isAdmin && (
                      <div className="flex items-center gap-2">
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">ATT Code</label>
                        <Input
                          type="text"
                                value={attCodeValue}
                                onChange={(e) => setAttCodeValue(e.target.value)}
                                placeholder="Enter ATT code..."
                                className="w-40 text-xs"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Expiry Date</label>
                              <Input
                                type="date"
                                value={attExpiryDate}
                                onChange={(e) => setAttExpiryDate(e.target.value)}
                                placeholder="Select expiry date"
                                className="w-40 text-xs"
                              />
                            </div>
                            <Button
                              onClick={async () => {
                                if (!onUpdateSubStep || !application?.id) return
                                setSavingAttNotes(true)
                                try {
                                  // Create date at noon local time to avoid timezone issues
                                  let expiryDateISO = null
                                  if (attExpiryDate) {
                                    const dateObj = new Date(attExpiryDate)
                                    dateObj.setHours(12, 0, 0, 0)
                                    expiryDateISO = dateObj.toISOString()
                                  }
                                  // Mark as completed if both ATT code and expiry date are provided
                                  const isCompleted = !!(attCodeValue && attExpiryDate)
                                  
                                  await onUpdateSubStep('att_received', isCompleted ? 'completed' : 'pending', {
                                    code: attCodeValue,
                                    att_code: attCodeValue,
                                    expiry_date: expiryDateISO,
                                    att_expiry_date: expiryDateISO,
                                    ...(subStep.date ? { date: subStep.date } : {})
                                  })
                                } catch (error) {
                                  handleErrorSilently(error, { operation: 'saveATTCodeAndExpiryDate', applicationId: application?.id })
                                } finally {
                                  setSavingAttNotes(false)
                                }
                              }}
                              disabled={savingAttNotes}
                              size="sm"
                              className="mt-5"
                            >
                              {savingAttNotes ? 'Saving...' : 'Save'}
                          </Button>
                      </div>
                        )}
                        {/* Date picker for ead_card_received */}
                        {subStep.key === 'ead_card_received' && isAdmin && (
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Card Received Date</label>
                            <Input
                              type="date"
                              value={subStep.date ? subStep.date.split('T')[0] : ''}
                              onChange={async (e) => {
                                const dateValue = e.target.value
                                if (dateValue && onUpdateSubStep && application?.id) {
                                  try {
                                    // Create date at noon local time to avoid timezone issues
                                    const dateObj = new Date(dateValue)
                                    dateObj.setHours(12, 0, 0, 0)
                                    await onUpdateSubStep('ead_card_received', 'completed', {
                                      date: dateObj.toISOString(),
                                      received_date: dateObj.toISOString()
                                    })
                                  } catch (error) {
                                    handleErrorSilently(error, { operation: 'updateCardReceivedDate', applicationId: application?.id })
                                  }
                                } else if (!dateValue && onUpdateSubStep && application?.id) {
                                  await onUpdateSubStep('ead_card_received', 'pending', {})
                                }
                              }}
                              className="w-40 text-xs"
                              placeholder="Select date"
                              title="Select date when card was received"
                            />
                          </div>
                        )}
                        {/* Date picker for ead_ssn_received */}
                        {subStep.key === 'ead_ssn_received' && isAdmin && (
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">SSN Card Received Date</label>
                            <Input
                              type="date"
                              value={subStep.date ? subStep.date.split('T')[0] : ''}
                              onChange={async (e) => {
                                const dateValue = e.target.value
                                if (dateValue && onUpdateSubStep && application?.id) {
                                  try {
                                    // Create date at noon local time to avoid timezone issues
                                    const dateObj = new Date(dateValue)
                                    dateObj.setHours(12, 0, 0, 0)
                                    await onUpdateSubStep('ead_ssn_received', 'completed', {
                                      date: dateObj.toISOString(),
                                      received_date: dateObj.toISOString()
                                    })
                                  } catch (error) {
                                    handleErrorSilently(error, { operation: 'updateSSNCardReceivedDate', applicationId: application?.id })
                                  }
                                } else if (!dateValue && onUpdateSubStep && application?.id) {
                                  await onUpdateSubStep('ead_ssn_received', 'pending', {})
                                }
                              }}
                              className="w-40 text-xs"
                              placeholder="Select date"
                              title="Select date when SSN card was received"
                            />
                          </div>
                        )}
                        {/* Exam Date, Time, and Location for exam_date_booked */}
                        {subStep.key === 'exam_date_booked' && isAdmin && (
                      <div className="flex items-center gap-2">
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Exam Date</label>
                              <Input
                                type="date"
                                value={examDateValue}
                                onChange={(e) => setExamDateValue(e.target.value)}
                                placeholder="Select exam date"
                                className="w-40 text-xs"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Exam Time</label>
                        <Input
                          type="time"
                                value={examTimeValue}
                                onChange={(e) => setExamTimeValue(e.target.value)}
                                placeholder="Select exam time"
                                className="w-40 text-xs"
                              />
                      </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Location</label>
                              <Select
                                value={examLocationValue}
                                onChange={(e) => setExamLocationValue(e.target.value)}
                                className="w-40 text-xs"
                                options={[
                                  { value: '', label: 'Select location' },
                                  { value: 'Alabang', label: 'Alabang' },
                                  { value: 'Makati', label: 'Makati' }
                                ]}
                              />
                    </div>
                            <Button
                              onClick={async () => {
                                if (!onUpdateSubStep || !application?.id) return
                                setSavingExamDetails(true)
                                try {
                                  // Create date at noon local time to avoid timezone issues
                                  let examDateISO = null
                                  if (examDateValue) {
                                    const dateObj = new Date(examDateValue)
                                    dateObj.setHours(12, 0, 0, 0)
                                    examDateISO = dateObj.toISOString()
                                  }
                                  // Mark as completed if all three fields (date, time, location) are provided
                                  const isCompleted = !!(examDateValue && examTimeValue && examLocationValue)
                                  
                                  await onUpdateSubStep('exam_date_booked', isCompleted ? 'completed' : 'pending', {
                                    date: examDateISO,
                                    time: examTimeValue || null,
                                    location: examLocationValue || null,
                                    exam_date: examDateISO,
                                    exam_time: examTimeValue || null,
                                    exam_location: examLocationValue || null
                                  })
                                } catch (error) {
                                  handleErrorSilently(error, { operation: 'saveExamDetails', applicationId: application?.id })
                                } finally {
                                  setSavingExamDetails(false)
                                }
                              }}
                              disabled={savingExamDetails}
                              size="sm"
                              className="mt-5"
                            >
                              {savingExamDetails ? 'Saving...' : 'Save'}
                            </Button>
                          </div>
                        )}
                        {/* Exam Result dropdown for exam_result sub-step */}
                        {subStep.key === 'exam_result' && isAdmin && (
                          <div className="flex items-center gap-2">
                            <div className="flex flex-col gap-1">
                              <Select
                                value={examResult}
                                onChange={(e) => setExamResult(e.target.value)}
                                options={[
                                  { value: '', label: 'Select result' },
                                  { value: 'pass', label: 'Passed' },
                                  { value: 'failed', label: 'Failed' }
                                ]}
                                className="w-40 text-xs"
                              />
                            </div>
                            {examResult && (
                              <Button
                                onClick={async () => {
                                  if (!onUpdateStep) {
                                    handleErrorSilently(new Error('onUpdateStep is not available'), { operation: 'saveExamResult', applicationId: application?.id })
                                    return
                                  }
                                  if (!application?.id) {
                                    handleErrorSilently(new Error('Application ID is not available'), { operation: 'saveExamResult' })
                                    return
                                  }
                                  setSavingResult(true)
                                  try {
                                    const status = examResult === 'pass' ? 'completed' : 'pending'
                                    const saveData = {
                                      result: examResult,
                                      result_date: new Date().toISOString()
                                    }
                                    await onUpdateStep(status, saveData)
                                    // Success message is handled in onUpdateStep
                                  } catch (error: any) {
                                    handleErrorSilently(error, { operation: 'saveExamResult', applicationId: application?.id })
                                    // Error message is handled in onUpdateStep
                                  } finally {
                                    setSavingResult(false)
                                  }
                                }}
                                disabled={savingResult || !examResult}
                                size="sm"
                              >
                                {savingResult ? 'Saving...' : 'Save'}
                              </Button>
                            )}
                          </div>
                        )}
                        {/* Action buttons for EAD Documents Review sub-steps */}
                        {subStep.hasActionButton && subStep.key === 'ead_forms_verified' && isAdmin && (
                          <Button
                            onClick={async () => {
                              if (!onUpdateSubStep || !application?.id) return
                              try {
                                if (showToast) showToast('Verifying latest forms from USCIS...', 'info')
                                if (!verifyUSCISForms) {
                                  if (showToast) showToast('Verification function not available', 'error')
                                  return
                                }
                                const verificationResult = await verifyUSCISForms()
                                
                                await onUpdateSubStep('ead_forms_verified', 'completed', {
                                  date: new Date().toISOString(),
                                  verified_at: new Date().toISOString(),
                                  matched: verificationResult.matched,
                                  g1145Version: verificationResult.g1145Version,
                                  i765Version: verificationResult.i765Version,
                                  message: verificationResult.message,
                                  serviceCenter: verificationResult.serviceCenter
                                })
                                
                                if (showToast) showToast(verificationResult.message, verificationResult.matched ? 'success' : 'warning')
                              } catch (error) {
                                handleErrorSilently(error, { operation: 'verifyForms', applicationId: application?.id })
                                if (showToast) showToast('Failed to verify forms', 'error')
                              }
                            }}
                            size="sm"
                            variant="outline"
                            className="text-xs"
                          >
                            {subStep.actionButtonLabel || 'Verify'}
                          </Button>
                        )}
                        {subStep.hasActionButton && subStep.key === 'ead_g1145_generated' && isAdmin && (
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Download Clean Form Button */}
                            <Button
                              onClick={async (e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                try {
                                  if (showToast) showToast('Opening G-1145 form...', 'info')
                                  
                                  // Use local file from public/USCIS Files
                                  const formPath = '/USCIS Files/g-1145.pdf'
                                  
                                  // Open in new tab (current tab stays on timeline)
                                  window.open(formPath, '_blank', 'noopener,noreferrer')
                                  
                                  if (showToast) showToast('G-1145 form opened in new tab', 'success')
                                } catch (error) {
                                  handleErrorSilently(error, { operation: 'openG1145', applicationId: application?.id })
                                  if (showToast) showToast('Failed to open G-1145 form', 'error')
                                }
                              }}
                              size="sm"
                              variant="outline"
                              className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800"
                            >
                              <Download className="h-3 w-3 mr-1" />
                              Download
                            </Button>
                            
                            {/* Upload Filled Form Button */}
                            <Button
                              onClick={() => {
                                const input = document.createElement('input')
                                input.type = 'file'
                                input.accept = '.pdf'
                                input.onchange = async (e) => {
                                  const file = (e.target as HTMLInputElement).files?.[0]
                                  if (!file || !application?.user_id) return
                                  
                                  try {
                                    if (showToast) showToast('Uploading filled G-1145 form...', 'info')
                                    
                                    const clientName = `${application?.first_name || ''}_${application?.last_name || ''}`.trim() || 'Client'
                                    const dateStr = new Date().toISOString().split('T')[0]
                                    const fileName = `Form G-1145 - ${clientName} - ${dateStr}.pdf`
                                    const pdfFile = new File([file], fileName, { type: 'application/pdf' })
                                    
                                    // Upload to documents/additional - use same document type to overwrite
                                    await userDocumentsAPI.uploadForUser(application.user_id, 'additional_g1145', pdfFile)
                                    
                                    if (showToast) showToast('Filled G-1145 form uploaded to Additional Documents successfully', 'success')
                                  } catch (error) {
                                    handleErrorSilently(error, { operation: 'uploadFilledG1145', applicationId: application?.id })
                                    if (showToast) showToast('Failed to upload filled G-1145 form', 'error')
                                  }
                                }
                                input.click()
                              }}
                              size="sm"
                              variant="outline"
                              className="text-xs bg-green-50 hover:bg-green-100 text-green-700 border-green-300 dark:bg-green-900/20 dark:hover:bg-green-900/30 dark:text-green-300 dark:border-green-800"
                            >
                              <Upload className="h-3 w-3 mr-1" />
                              Upload
                            </Button>
                            
                            <Button
                              onClick={async () => {
                                if (!onUpdateSubStep || !application?.id || !application?.user_id) return;
                                try {
                                  if (showToast) showToast('Generating G-1145 form...', 'info')
                                  if (!generateG1145Form) {
                                    if (showToast) showToast('Generation function not available', 'error')
                                    return
                                  }
                                  const pdfBlob = await generateG1145Form()
                                  
                                  // Create descriptive filename: Form G-1145 - [Client Name] - [Date].pdf
                                  const clientName = `${application?.first_name || ''}_${application?.last_name || ''}`.trim() || 'Client'
                                  const dateStr = new Date().toISOString().split('T')[0]
                                  const fileName = `Form G-1145 - ${clientName} - ${dateStr}.pdf`
                                  const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' })
                                  
                                  // Save to documents/additional with unique document type to prevent overwriting
                                  await userDocumentsAPI.uploadForUser(application.user_id, 'additional_g1145', pdfFile)
                                  
                                  // Also download the PDF
                                  const url = URL.createObjectURL(pdfBlob)
                                  const link = document.createElement('a')
                                  link.href = url
                                  link.download = fileName
                                  document.body.appendChild(link)
                                  link.click()
                                  document.body.removeChild(link)
                                  URL.revokeObjectURL(url)
                                  
                                  await onUpdateSubStep('ead_g1145_generated', 'completed', {
                                    date: new Date().toISOString(),
                                    generated_at: new Date().toISOString(),
                                    file_name: fileName,
                                    saved_to_additional: true
                                  })
                                  if (showToast) showToast('G-1145 form generated, saved to Additional Documents, and downloaded successfully', 'success')
                                } catch (error) {
                                  handleErrorSilently(error, { operation: 'generateG1145', applicationId: application?.id })
                                  if (showToast) showToast('Failed to generate G-1145 form', 'error')
                                }
                              }}
                              size="sm"
                              variant="outline"
                              className="text-xs"
                            >
                              {subStep.actionButtonLabel || 'Generate G-1145'}
                            </Button>
                          </div>
                        )}
                        {subStep.hasActionButton && subStep.key === 'ead_i765_generated' && isAdmin && (
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Download Clean Form Button */}
                            <Button
                              onClick={async (e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                try {
                                  if (showToast) showToast('Opening I-765 form...', 'info')
                                  
                                  // Use local file from public/USCIS Files
                                  const formPath = '/USCIS Files/i-765.pdf'
                                  
                                  // Open in new tab (current tab stays on timeline)
                                  window.open(formPath, '_blank', 'noopener,noreferrer')
                                  
                                  if (showToast) showToast('I-765 form opened in new tab', 'success')
                                } catch (error) {
                                  handleErrorSilently(error, { operation: 'openI765', applicationId: application?.id })
                                  if (showToast) showToast('Failed to open I-765 form', 'error')
                                }
                              }}
                              size="sm"
                              variant="outline"
                              className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800"
                            >
                              <Download className="h-3 w-3 mr-1" />
                              Download
                            </Button>
                            
                            {/* Upload Filled Form Button */}
                            <Button
                              onClick={() => {
                                const input = document.createElement('input')
                                input.type = 'file'
                                input.accept = '.pdf'
                                input.onchange = async (e) => {
                                  const file = (e.target as HTMLInputElement).files?.[0]
                                  if (!file || !application?.user_id) return
                                  
                                  try {
                                    if (showToast) showToast('Uploading filled I-765 form...', 'info')
                                    
                                    const clientName = `${application?.first_name || ''}_${application?.last_name || ''}`.trim() || 'Client'
                                    const dateStr = new Date().toISOString().split('T')[0]
                                    const fileName = `Form I-765 - ${clientName} - ${dateStr}.pdf`
                                    const pdfFile = new File([file], fileName, { type: 'application/pdf' })
                                    
                                    // Upload to documents/additional - use same document type to overwrite
                                    await userDocumentsAPI.uploadForUser(application.user_id, 'additional_i765', pdfFile)
                                    
                                    if (showToast) showToast('Filled I-765 form uploaded to Additional Documents successfully', 'success')
                                  } catch (error) {
                                    handleErrorSilently(error, { operation: 'uploadFilledI765', applicationId: application?.id })
                                    if (showToast) showToast('Failed to upload filled I-765 form', 'error')
                                  }
                                }
                                input.click()
                              }}
                              size="sm"
                              variant="outline"
                              className="text-xs bg-green-50 hover:bg-green-100 text-green-700 border-green-300 dark:bg-green-900/20 dark:hover:bg-green-900/30 dark:text-green-300 dark:border-green-800"
                            >
                              <Upload className="h-3 w-3 mr-1" />
                              Upload
                            </Button>
                            
                            <Button
                              onClick={async () => {
                                if (!onUpdateSubStep || !application?.id || !application?.user_id) return
                                try {
                                  if (showToast) showToast('Generating I-765 form...', 'info')
                                  if (!generateI765Form) {
                                    if (showToast) showToast('Generation function not available', 'error')
                                    return
                                  }
                                  const pdfBlob = await generateI765Form()
                                  
                                  // Create descriptive filename: Form I-765 - [Client Name] - [Date].pdf
                                  const clientName = `${application?.first_name || ''}_${application?.last_name || ''}`.trim() || 'Client'
                                  const dateStr = new Date().toISOString().split('T')[0]
                                  const fileName = `Form I-765 - ${clientName} - ${dateStr}.pdf`
                                  const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' })
                                  
                                  // Save to documents/additional with unique document type to prevent overwriting
                                  await userDocumentsAPI.uploadForUser(application.user_id, 'additional_i765', pdfFile)
                                  
                                  // Also download the PDF
                                  const url = URL.createObjectURL(pdfBlob)
                                  const link = document.createElement('a')
                                  link.href = url
                                  link.download = fileName
                                  document.body.appendChild(link)
                                  link.click()
                                  document.body.removeChild(link)
                                  URL.revokeObjectURL(url)
                                  
                                  await onUpdateSubStep('ead_i765_generated', 'completed', {
                                    date: new Date().toISOString(),
                                    generated_at: new Date().toISOString(),
                                    file_name: fileName,
                                    saved_to_additional: true
                                  })
                                  if (showToast) showToast('I-765 form generated, saved to Additional Documents, and downloaded successfully', 'success')
                                } catch (error) {
                                  handleErrorSilently(error, { operation: 'generateI765', applicationId: application?.id })
                                  if (showToast) showToast('Failed to generate I-765 form', 'error')
                                }
                              }}
                              size="sm"
                              variant="outline"
                              className="text-xs"
                            >
                              {subStep.actionButtonLabel || 'Generate I-765'}
                            </Button>
                          </div>
                        )}
                        {subStep.hasActionButton && subStep.key === 'ead_cover_letter_generated' && isAdmin && (
                          <Button
                            onClick={async () => {
                              if (!onUpdateSubStep || !application?.id || !application?.user_id) return
                              try {
                                if (showToast) showToast('Generating cover letter...', 'info')
                                if (!generateCoverLetter) {
                                  if (showToast) showToast('Generation function not available', 'error')
                                  return
                                }
                                const pdfBlob = await generateCoverLetter()
                                
                                // Create descriptive filename: Cover Letter - [Client Name] - [Date].pdf
                                const clientName = `${application?.first_name || ''}_${application?.last_name || ''}`.trim() || 'Client'
                                const dateStr = new Date().toISOString().split('T')[0]
                                const fileName = `Cover Letter - ${clientName} - ${dateStr}.pdf`
                                const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' })
                                
                                // Save to documents/additional with unique document type to prevent overwriting
                                await userDocumentsAPI.uploadForUser(application.user_id, 'additional_cover_letter', pdfFile)
                                
                                // Also download the PDF
                                const url = URL.createObjectURL(pdfBlob)
                                const link = document.createElement('a')
                                link.href = url
                                link.download = fileName
                                document.body.appendChild(link)
                                link.click()
                                document.body.removeChild(link)
                                URL.revokeObjectURL(url)
                                
                                // Save to documents/additional (this creates the document entry automatically)
                                
                                await onUpdateSubStep('ead_cover_letter_generated', 'completed', {
                                  date: new Date().toISOString(),
                                  generated_at: new Date().toISOString(),
                                  file_name: fileName,
                                  saved_to_additional: true
                                })
                                if (showToast) showToast('Cover letter generated, saved to Additional Documents, and downloaded successfully', 'success')
                              } catch (error) {
                                handleErrorSilently(error, { operation: 'generateCoverLetter', applicationId: application?.id })
                                if (showToast) showToast('Failed to generate cover letter', 'error')
                              }
                            }}
                            size="sm"
                            variant="outline"
                            className="text-xs"
                          >
                            {subStep.actionButtonLabel || 'Generate Cover Letter'}
                          </Button>
                        )}
                        {subStep.hasActionButton && subStep.key === 'ead_documents_compiled' && isAdmin && (
                          <Button
                            onClick={async () => {
                              if (!onUpdateSubStep || !application?.id) return
                              if (compilingDocuments) return // Prevent multiple clicks
                              try {
                                setCompilingDocuments(true)
                                if (showToast) showToast('Merging all documents...', 'info')
                                
                                // Call merge-documents edge function
                                const { data, error } = await supabase.functions.invoke('merge-documents', {
                                  body: {
                                    application_id: application.id,
                                  },
                                })

                                if (error) {
                                  console.error('Merge documents error:', error)
                                  throw new Error(error.message || 'Failed to merge documents')
                                }

                                if (!data || !data.success) {
                                  throw new Error(data?.error || 'Failed to merge documents: Invalid response')
                                }

                                // Show success message with details
                                const processedCount = data.processed_documents?.length || 0
                                const skippedCount = data.skipped_documents?.length || 0
                                const fileSizeMB = data.file_size_mb || 0
                                
                                let successMessage = `Successfully merged ${processedCount} document${processedCount !== 1 ? 's' : ''}`
                                if (skippedCount > 0) {
                                  successMessage += ` (${skippedCount} skipped)`
                                }
                                successMessage += `. File size: ${fileSizeMB.toFixed(2)}MB`
                                
                                if (showToast) showToast(successMessage, 'success')

                                // Update sub-step with merge information
                                if (onUpdateSubStep) {
                                  await onUpdateSubStep('ead_documents_compiled', 'completed', {
                                    merged_at: new Date().toISOString(),
                                    file_path: data.file_path,
                                    file_name: data.file_name,
                                    file_size: data.file_size,
                                    file_size_mb: data.file_size_mb,
                                    processed_documents: data.processed_documents,
                                    skipped_documents: data.skipped_documents,
                                    signed_url: data.signed_url,
                                  })
                                }

                                // If there's a signed URL, optionally open it
                                if (data.signed_url && setViewingPdfUrl && setViewingPdfName && setShowPdfModal) {
                                  setViewingPdfUrl(data.signed_url)
                                  setViewingPdfName(data.file_name || 'Merged Documents.pdf')
                                  setShowPdfModal(true)
                                }
                              } catch (error: any) {
                                handleErrorSilently(error, { operation: 'compileDocuments', applicationId: application?.id })
                                
                                // Provide more specific error messages
                                const errorMessage = error instanceof Error ? error.message : String(error)
                                
                                if (errorMessage.includes('timed out') || errorMessage.includes('timeout')) {
                                  if (showToast) {
                                    showToast(
                                      'Merging is taking longer than expected. The job may still be processing on the server. Please check back in a few moments.',
                                      'warning'
                                    )
                                  }
                                } else if (errorMessage.includes('No documents') || errorMessage.includes('documents found')) {
                                  if (showToast) {
                                    showToast(
                                      'No documents found to merge. Please ensure documents are uploaded before merging.',
                                      'error'
                                    )
                                  }
                                } else if (errorMessage.includes('network') || errorMessage.includes('Failed to fetch')) {
                                  if (showToast) {
                                    showToast(
                                      'Network error occurred. Please check your connection and try again.',
                                      'error'
                                    )
                                  }
                                } else {
                                  // Generic error message
                                  if (showToast) {
                                    showToast(
                                      errorMessage || 'Failed to merge documents. Please try again.',
                                      'error'
                                    )
                                  }
                                }
                              } finally {
                                // Always reset compiling state, even on error
                                setCompilingDocuments(false)
                              }
                            }}
                            size="sm"
                            variant="outline"
                            className="text-xs"
                            disabled={compilingDocuments}
                          >
                            {compilingDocuments ? (
                              <>
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                Merging...
                              </>
                            ) : (
                              subStep.actionButtonLabel || 'Merge All Docs'
                            )}
                          </Button>
                        )}
                        {/* Request via Email button for employer verification letter */}
                        {subStep.key === 'ead_employer_verification_requested' && user && navigate && (
                          <Button
                            onClick={async () => {
                              if (generatingEmail) return // Prevent multiple clicks
                              setGeneratingEmail(true)
                              try {
                                // Generate email template with application data
                                // Applicant is the one requesting (the EAD applicant)
                                const applicantName = application ? `${application.first_name || ''} ${application.middle_name || ''} ${application.last_name || ''}`.trim() : '[YOUR NAME HERE]'
                                // Spouse is the employee at Insight Global LLC - use saved spouse_name from application
                                const spouseNameValue = application?.spouse_name || (application?.spouse_first_name && application?.spouse_last_name 
                                  ? `${application.spouse_first_name || ''} ${application.spouse_middle_name || ''} ${application.spouse_last_name || ''}`.trim()
                                  : '') || '[YOUR SPOUSE NAME HERE]'
                                const spouseEmail = application?.spouse_email || '[SPOUSE EMAIL HERE]'
                                const spouseContactNumber = application?.spouse_contact_number || '[SPOUSE CONTACT NUMBER HERE]'
                                const mobile = application?.mobile_number || application?.mobile || application?.phone || '[YOUR MOBILE HERE]'
                                
                                // Get GritSync email from processing accounts
                                let gritsyncEmail = ''
                                if (application?.id) {
                                  try {
                                    const processingAccounts = await processingAccountsAPI.getByApplication(application.id)
                                    const gritsyncAccount = (processingAccounts || []).find((acc: any) => acc.account_type === 'gritsync') as { account_type: string; email?: string } | undefined
                                    if (gritsyncAccount?.email) {
                                      gritsyncEmail = gritsyncAccount.email
                                    }
                                  } catch (error) {
                                    handleErrorSilently(error, { operation: 'fetchGritSyncEmail', applicationId: application?.id })
                                  }
                                }
                                
                                // Fallback to generating email if not found
                                if (!gritsyncEmail && application) {
                                  const firstName = application.first_name || ''
                                  const middleName = application.middle_name || null
                                  const lastName = application.last_name || ''
                                  if (firstName && lastName) {
                                    // Generate email: firstInitial + middleInitial + lastName@gritsync.com
                                    const firstInitial = firstName.trim().charAt(0).toLowerCase()
                                    const middleInitial = middleName ? middleName.trim().charAt(0).toLowerCase() : ''
                                    const lastNameClean = lastName.trim().toLowerCase().replace(/[^a-z]/g, '')
                                    gritsyncEmail = middleInitial 
                                      ? `${firstInitial}${middleInitial}${lastNameClean}@gritsync.com`
                                      : `${firstInitial}${lastNameClean}@gritsync.com`
                                  }
                                }
                                
                                const applicantEmail = gritsyncEmail || user?.email || application?.email || '[YOUR EMAIL HERE]'
                                const clientEmail = application?.email || user?.email || '[CLIENT EMAIL HERE]'
                                
                                // Check if required fields are missing
                                if (applicantName === '[YOUR NAME HERE]' || spouseNameValue === '[YOUR SPOUSE NAME HERE]' || spouseEmail === '[SPOUSE EMAIL HERE]' || spouseContactNumber === '[SPOUSE CONTACT NUMBER HERE]' || applicantEmail === '[YOUR EMAIL HERE]' || mobile === '[YOUR MOBILE HERE]') {
                                  if (showToast) showToast('Please ensure all required fields (name, spouse name, spouse email, spouse contact number, email, mobile) are filled in the application details.', 'warning')
                                  return
                                }
                                
                                // Different handling for admin vs user view
                                if (isAdmin) {
                                  // Admin view: GritSync requesting to IGH on behalf of client
                                  // Get template from database
                                  const adminTemplate = await getRenderedTemplate(
                                    'employer-verification-letter-request-admin',
                                    {
                                      APPLICANT_NAME: applicantName,
                                      SPOUSE_NAME: spouseNameValue,
                                      SPOUSE_EMAIL: spouseEmail,
                                      SPOUSE_CONTACT_NUMBER: spouseContactNumber,
                                      APPLICANT_EMAIL: applicantEmail,
                                      APPLICANT_PHONE: mobile,
                                    }
                                  )
                                  
                                  if (!adminTemplate) {
                                    if (showToast) showToast('Error loading email template. Please try again.', 'error')
                                    return
                                  }
                                  
                                  const adminHtmlTemplate = adminTemplate.html
                                  const adminEmailBody = adminTemplate.text || adminTemplate.html
                                  
                                  // Generate PDF from HTML template for admin
                                  const tempDiv = document.createElement('div')
                                  tempDiv.style.position = 'absolute'
                                  tempDiv.style.left = '-9999px'
                                  tempDiv.style.width = '8.5in' // 8.5 inches for letter size
                                  tempDiv.style.padding = '1in'
                                  tempDiv.style.backgroundColor = 'white'
                                  tempDiv.style.fontFamily = 'Times New Roman, Times, serif'
                                  tempDiv.style.fontSize = '11pt'
                                  tempDiv.style.lineHeight = '1.6'
                                  tempDiv.style.color = '#000'
                                  tempDiv.innerHTML = sanitizeHTML(adminHtmlTemplate)
                                  document.body.appendChild(tempDiv)
                                  
                                  try {
                                    // Wait for fonts and images to load
                                    await new Promise(resolve => setTimeout(resolve, 300))
                                    
                                    // Enhanced PDF generation with better quality
                                    const canvas = await html2canvas(tempDiv, {
                                      backgroundColor: '#ffffff',
                                      scale: 3, // Increased scale for better quality
                                      logging: false,
                                      useCORS: true,
                                      allowTaint: false,
                                      removeContainer: false,
                                      width: tempDiv.offsetWidth,
                                      height: tempDiv.scrollHeight,
                                      windowWidth: tempDiv.offsetWidth,
                                      windowHeight: tempDiv.scrollHeight,
                                      imageTimeout: 15000,
                                      onclone: (clonedDoc) => {
                                        // Ensure styles are preserved in the cloned document
                                        const clonedElement = clonedDoc.querySelector('.email-container')
                                        if (clonedElement) {
                                          (clonedElement as HTMLElement).style.width = '100%'
                                        }
                                      }
                                    })
                                    
                                    // Convert to high-quality image
                                    const imgData = canvas.toDataURL('image/png', 1.0)
                                    
                                    // Create PDF with proper dimensions (Letter size: 8.5" x 11" = 612pt x 792pt)
                                    const pdf = new jsPDF({
                                      orientation: 'portrait',
                                      unit: 'pt',
                                      format: 'letter',
                                      compress: true
                                    })
                                    
                                    const pdfWidth = pdf.internal.pageSize.getWidth()
                                    const pdfHeight = pdf.internal.pageSize.getHeight()
                                    const imgWidth = pdfWidth
                                    const imgHeight = (canvas.height * pdfWidth) / canvas.width
                                    
                                    // Add image to PDF, handling multi-page if needed
                                    let heightLeft = imgHeight
                                    let position = 0
                                    
                                    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
                                    heightLeft -= pdfHeight
                                    
                                    // Add additional pages if content exceeds one page
                                    while (heightLeft > 0) {
                                      position = heightLeft - imgHeight
                                      pdf.addPage()
                                      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
                                      heightLeft -= pdfHeight
                                    }
                                    
                                    document.body.removeChild(tempDiv)
                                    
                                    const pdfBlob = pdf.output('blob')
                                    const pdfFile = new File([pdfBlob], `Employer_Verification_Letter_Request_${applicantName.replace(/\s+/g, '_')}.pdf`, { type: 'application/pdf' })
                                    
                                    // Mark step as completed
                                    if (onUpdateSubStep && application?.id) {
                                      try {
                                        await onUpdateSubStep('ead_employer_verification_requested', 'completed', {
                                          ...subStep.data,
                                          date: new Date().toISOString(),
                                          requested_at: new Date().toISOString(),
                                          requested_by: isAdmin ? 'admin' : 'client',
                                        })
                                      } catch (error) {
                                        handleErrorSilently(error, { operation: 'updateEmployerVerificationStep', applicationId: application?.id })
                                      }
                                    }
                                    
                                    // Navigate to admin emails with GritSync as sender
                                    navigate('/admin/emails', {
                                      state: {
                                        composeEmail: {
                                          from: 'info@gritsync.com',
                                          fromName: 'GritSync Information',
                                          to: 'humanresources@insightglobal.com; Jay.Cowart@insightglobal.com',
                                          cc: `${clientEmail}${spouseEmail ? `; ${spouseEmail}` : ''}`,
                                          replyTo: 'info@gritsync.com',
                                          subject: adminTemplate.subject,
                                          body: adminEmailBody,
                                          htmlBody: adminHtmlTemplate,
                                          attachment: pdfFile
                                        }
                                      }
                                    })
                                  } catch (error) {
                                    if (document.body.contains(tempDiv)) {
                                      document.body.removeChild(tempDiv)
                                    }
                                    handleErrorSilently(error, { operation: 'generatePDF', applicationId: application?.id })
                                    if (showToast) showToast('Error generating PDF. Navigating to email composer without attachment.', 'warning')
                                    
                                    // Mark step as completed (fallback if PDF generation failed)
                                    if (onUpdateSubStep && application?.id) {
                                      try {
                                        await onUpdateSubStep('ead_employer_verification_requested', 'completed', {
                                          ...subStep.data,
                                          date: new Date().toISOString(),
                                          requested_at: new Date().toISOString(),
                                          requested_by: isAdmin ? 'admin' : 'client',
                                        })
                                      } catch (error) {
                                        handleErrorSilently(error, { operation: 'updateEmployerVerificationStep', applicationId: application?.id })
                                      }
                                    }
                                    
                                    if (navigate) navigate('/admin/emails', {
                                      state: {
                                        composeEmail: {
                                          from: 'info@gritsync.com',
                                          fromName: 'GritSync Information',
                                          to: 'humanresources@insightglobal.com; Jay.Cowart@insightglobal.com',
                                          cc: `${clientEmail}${spouseEmail ? `; ${spouseEmail}` : ''}`,
                                          replyTo: 'info@gritsync.com',
                                          subject: adminTemplate.subject,
                                          body: adminEmailBody,
                                          htmlBody: adminHtmlTemplate
                                        }
                                      }
                                    })
                                  }
                                } else {
                                  // User view: Client requesting directly
                                  // Get template from database
                                  const clientTemplate = await getRenderedTemplate(
                                    'employer-verification-letter-request-client',
                                    {
                                      APPLICANT_NAME: applicantName,
                                      SPOUSE_NAME: spouseNameValue,
                                      SPOUSE_EMAIL: spouseEmail,
                                      SPOUSE_CONTACT_NUMBER: spouseContactNumber,
                                      APPLICANT_EMAIL: applicantEmail,
                                      APPLICANT_PHONE: mobile,
                                    }
                                  )
                                  
                                  if (!clientTemplate) {
                                    if (showToast) showToast('Error loading email template. Please try again.', 'error')
                                    return
                                  }
                                  
                                  const htmlTemplate = clientTemplate.html
                                  const emailBody = clientTemplate.text || clientTemplate.html
                                  
                                  // Generate PDF from HTML template
                                  const tempDiv = document.createElement('div')
                                  tempDiv.style.position = 'absolute'
                                  tempDiv.style.left = '-9999px'
                                  tempDiv.style.width = '8.5in' // 8.5 inches for letter size
                                  tempDiv.style.padding = '1in'
                                  tempDiv.style.backgroundColor = 'white'
                                  tempDiv.style.fontFamily = 'Times New Roman, Times, serif'
                                  tempDiv.style.fontSize = '11pt'
                                  tempDiv.style.lineHeight = '1.6'
                                  tempDiv.style.color = '#000'
                                  tempDiv.innerHTML = sanitizeHTML(htmlTemplate)
                                  document.body.appendChild(tempDiv)
                                  
                                  try {
                                    // Wait for fonts and images to load
                                    await new Promise(resolve => setTimeout(resolve, 300))
                                    
                                    // Enhanced PDF generation with better quality
                                    const canvas = await html2canvas(tempDiv, {
                                      backgroundColor: '#ffffff',
                                      scale: 3, // Increased scale for better quality
                                      logging: false,
                                      useCORS: true,
                                      allowTaint: false,
                                      removeContainer: false,
                                      width: tempDiv.offsetWidth,
                                      height: tempDiv.scrollHeight,
                                      windowWidth: tempDiv.offsetWidth,
                                      windowHeight: tempDiv.scrollHeight,
                                      imageTimeout: 15000,
                                      onclone: (clonedDoc) => {
                                        // Ensure styles are preserved in the cloned document
                                        const clonedElement = clonedDoc.querySelector('.email-container')
                                        if (clonedElement) {
                                          (clonedElement as HTMLElement).style.width = '100%'
                                        }
                                      }
                                    })
                                    
                                    // Convert to high-quality image
                                    const imgData = canvas.toDataURL('image/png', 1.0)
                                    
                                    // Create PDF with proper dimensions (Letter size: 8.5" x 11" = 612pt x 792pt)
                                    const pdf = new jsPDF({
                                      orientation: 'portrait',
                                      unit: 'pt',
                                      format: 'letter',
                                      compress: true
                                    })
                                    
                                    const pdfWidth = pdf.internal.pageSize.getWidth()
                                    const pdfHeight = pdf.internal.pageSize.getHeight()
                                    const imgWidth = pdfWidth
                                    const imgHeight = (canvas.height * pdfWidth) / canvas.width
                                    
                                    // Add image to PDF, handling multi-page if needed
                                    let heightLeft = imgHeight
                                    let position = 0
                                    
                                    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
                                    heightLeft -= pdfHeight
                                    
                                    // Add additional pages if content exceeds one page
                                    while (heightLeft > 0) {
                                      position = heightLeft - imgHeight
                                      pdf.addPage()
                                      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
                                      heightLeft -= pdfHeight
                                    }
                                    
                                    // Clean up
                                    document.body.removeChild(tempDiv)
                                    
                                    // Convert PDF to blob for attachment
                                    const pdfBlob = pdf.output('blob')
                                    const pdfFile = new File([pdfBlob], `Employer_Verification_Letter_Request_${applicantName.replace(/\s+/g, '_')}.pdf`, { type: 'application/pdf' })
                                    
                                    // Mark step as completed
                                    if (onUpdateSubStep && application?.id) {
                                      try {
                                        await onUpdateSubStep('ead_employer_verification_requested', 'completed', {
                                          ...subStep.data,
                                          date: new Date().toISOString(),
                                          requested_at: new Date().toISOString(),
                                          requested_by: isAdmin ? 'admin' : 'client',
                                        })
                                      } catch (error) {
                                        handleErrorSilently(error, { operation: 'updateEmployerVerificationStep', applicationId: application?.id })
                                      }
                                    }
                                    
                                    // Navigate to client emails with pre-filled compose data and PDF attachment
                                    // Move CC to TO (both emails in TO field)
                                    navigate('/client/emails', {
                                      state: {
                                        composeEmail: {
                                          to: 'humanresources@insightglobal.com; Jay.Cowart@insightglobal.com',
                                          replyTo: spouseEmail,
                                          subject: clientTemplate.subject,
                                          body: emailBody,
                                          htmlBody: htmlTemplate, // Include HTML version
                                          attachment: pdfFile
                                        }
                                      }
                                    })
                                  } catch (error) {
                                    // Clean up on error
                                    if (document.body.contains(tempDiv)) {
                                      document.body.removeChild(tempDiv)
                                    }
                                    handleErrorSilently(error, { operation: 'generatePDF', applicationId: application?.id })
                                    if (showToast) showToast('Error generating PDF. Navigating to email composer without attachment.', 'warning')
                                    
                                    // Mark step as completed (fallback if PDF generation failed)
                                    if (onUpdateSubStep && application?.id) {
                                      try {
                                        await onUpdateSubStep('ead_employer_verification_requested', 'completed', {
                                          ...subStep.data,
                                          date: new Date().toISOString(),
                                          requested_at: new Date().toISOString(),
                                          requested_by: isAdmin ? 'admin' : 'client',
                                        })
                                      } catch (error) {
                                        handleErrorSilently(error, { operation: 'updateEmployerVerificationStep', applicationId: application?.id })
                                      }
                                    }
                                    
                                    // Navigate without attachment if PDF generation fails
                                    // Move CC to TO (both emails in TO field)
                                    if (navigate) navigate('/client/emails', {
                                      state: {
                                        composeEmail: {
                                          to: 'humanresources@insightglobal.com; Jay.Cowart@insightglobal.com',
                                          replyTo: spouseEmail,
                                          subject: clientTemplate.subject,
                                          body: emailBody,
                                          htmlBody: htmlTemplate
                                        }
                                      }
                                    })
                                  }
                                }
                              } catch (error) {
                                handleErrorSilently(error, { operation: 'prepareEmail', applicationId: application?.id })
                                if (showToast) showToast('Error preparing email. Please try again.', 'error')
                              } finally {
                                setGeneratingEmail(false)
                              }
                            }}
                            size="sm"
                            variant="outline"
                            className="text-xs"
                          >
                            {isAdmin ? 'Admin Request via Email' : 'Request via Email'}
                          </Button>
                        )}
                        {isAdmin && (
                          <button
                            onClick={() => handleSubStepToggle(subStep.key, subStep.completed)}
                            className="text-xs px-3 py-1.5 rounded-md font-medium transition-colors opacity-0 group-hover:opacity-100 bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 border border-primary-200 dark:border-primary-800"
                          >
                            {subStep.completed ? 'Mark pending' : 'Mark complete'}
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Show formatted date below for sub-steps with date pickers */}
                    {subStep.key === 'letter_submitted' && subStep.date && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Submitted: {formatDate(subStep.date)}
                      </p>
                    )}
                    {subStep.key === 'mandatory_courses' && subStep.date && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Completed: {formatDate(subStep.date)}
                      </p>
                    )}
                    {subStep.key === 'form1_submitted' && subStep.date && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Submitted: {formatDate(subStep.date)}
                      </p>
                    )}
                    {subStep.key === 'nclex_eligibility_approved' && subStep.date && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Approved: {formatDate(subStep.date)}
                      </p>
                    )}
                    {subStep.key === 'pearson_account_created' && subStep.date && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Created: {formatDate(subStep.date)}
                      </p>
                    )}
                    {subStep.key === 'official_docs_submitted' && subStep.date && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Submitted: {formatDate(subStep.date)}
                      </p>
                    )}
                    {subStep.key === 'ead_card_received' && subStep.date && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Received: {formatDate(subStep.date)}
                      </p>
                    )}
                    {subStep.key === 'ead_ssn_received' && subStep.date && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Received: {formatDate(subStep.date)}
                      </p>
                    )}
                    
                    {/* Display all admin changes in bullet form */}
                    {subStep.data && Object.keys(subStep.data).length > 0 && (() => {
                      // Helper to format date from ISO string to match date picker format
                      // This extracts the date part (YYYY-MM-DD) and formats it without timezone conversion
                      const formatDateFromISO = (isoString: string): string => {
                        if (!isoString) return ''
                        // Extract date part (YYYY-MM-DD) from ISO string
                        const datePart = isoString.split('T')[0]
                        if (!datePart || !/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
                          // Fallback to regular formatDate if format is unexpected
                          return formatDate(isoString)
                        }
                        const [year, month, day] = datePart.split('-')
                        // Format directly from the date parts to avoid timezone conversion
                        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December']
                        const monthName = monthNames[parseInt(month) - 1]
                        const dayNum = parseInt(day)
                        return `${monthName} ${dayNum}, ${year}`
                      }
                      
                      // Helper to check if dates are the same (to avoid duplicates)
                      const datesEqual = (date1: string, date2: string) => {
                        if (!date1 || !date2) return false
                        // Compare just the date part (YYYY-MM-DD)
                        const date1Part = date1.split('T')[0]
                        const date2Part = date2.split('T')[0]
                        return date1Part === date2Part
                      }
                      
                      // Collect all items to display
                      const items: Array<{ label: string; value: string }> = []
                      
                      // Show the date that matches what's in the date picker first
                      // The date picker shows subStep.date which is subStep.data.date
                      if (subStep.date && subStep.data && subStep.data.date) {
                        // Match the date picker's label based on the step key
                        if (subStep.key === 'app_created') {
                          items.push({ label: 'Date Created', value: formatDateFromISO(subStep.date) })
                        } else if (subStep.key === 'documents_submitted') {
                          items.push({ label: 'Date Documents Submitted', value: formatDateFromISO(subStep.date) })
                        } else if (subStep.key === 'letter_submitted') {
                          items.push({ label: 'Date Request Letter Submitted', value: formatDateFromISO(subStep.date) })
                        } else if (subStep.key === 'mandatory_courses') {
                          items.push({ label: 'Date Completed', value: formatDateFromISO(subStep.date) })
                        } else if (subStep.key === 'form1_submitted') {
                          items.push({ label: 'Date Submitted', value: formatDateFromISO(subStep.date) })
                        } else if (subStep.key === 'nclex_eligibility_approved') {
                          items.push({ label: 'Date of Approval', value: formatDateFromISO(subStep.date) })
                        } else if (subStep.key === 'pearson_account_created') {
                          items.push({ label: 'Date Account Created', value: formatDateFromISO(subStep.date) })
                        } else if (subStep.key === 'att_requested') {
                          items.push({ label: 'Date ATT Request Submitted', value: formatDateFromISO(subStep.date) })
                        } else if (subStep.key === 'official_docs_submitted') {
                          items.push({ label: 'Date Official Docs Sent', value: formatDateFromISO(subStep.date) })
                        } else if (subStep.key === 'ead_card_received') {
                          items.push({ label: 'Card Received Date', value: formatDateFromISO(subStep.date) })
                        } else if (subStep.key === 'ead_ssn_received') {
                          items.push({ label: 'SSN Card Received Date', value: formatDateFromISO(subStep.date) })
                        }
                      }
                      
                      // Show other specific dates only if they're different from the main date
                      if (subStep.data.submitted_date && subStep.key === 'letter_submitted' && !datesEqual(subStep.data.submitted_date, subStep.date || '')) {
                        items.push({ label: 'Submitted Date', value: formatDateFromISO(subStep.data.submitted_date) })
                      }
                      
                      if (subStep.data.completed_date && subStep.key === 'mandatory_courses' && !datesEqual(subStep.data.completed_date, subStep.date || '')) {
                        items.push({ label: 'Completed Date', value: formatDateFromISO(subStep.data.completed_date) })
                      }
                      
                      if (subStep.data.approved_date && subStep.key === 'nclex_eligibility_approved' && !datesEqual(subStep.data.approved_date, subStep.date || '')) {
                        items.push({ label: 'Approved Date', value: formatDateFromISO(subStep.data.approved_date) })
                      }
                      
                      if (subStep.data.created_date && subStep.key === 'pearson_account_created' && !datesEqual(subStep.data.created_date, subStep.date || '')) {
                        items.push({ label: 'Created Date', value: formatDateFromISO(subStep.data.created_date) })
                      }
                      if (subStep.data.submitted_date && subStep.key === 'att_requested' && !datesEqual(subStep.data.submitted_date, subStep.date || '')) {
                        items.push({ label: 'Submitted Date', value: formatDateFromISO(subStep.data.submitted_date) })
                      }
                      
                      if (subStep.data.sent_to_bon_date && subStep.key === 'official_docs_submitted' && !datesEqual(subStep.data.sent_to_bon_date, subStep.date || '')) {
                        items.push({ label: 'Sent to BON Date', value: formatDateFromISO(subStep.data.sent_to_bon_date) })
                      }
                      
                      if (subStep.data.generated_at && subStep.key === 'letter_generated' && !datesEqual(subStep.data.generated_at, subStep.date || '')) {
                        items.push({ label: 'Generated At', value: formatDateFromISO(subStep.data.generated_at) })
                      }
                      
                      // Reference number
                      if (subStep.data.reference_number) {
                        items.push({ label: 'Reference Number', value: subStep.data.reference_number })
                      } else if (subStep.data.ref_number) {
                        items.push({ label: 'Reference Number', value: subStep.data.ref_number })
                      }
                      
                      // EAD Tracking Number
                      if (subStep.data.tracking_number) {
                        items.push({ label: 'Tracking #', value: subStep.data.tracking_number })
                      } else if (subStep.data.tracking) {
                        items.push({ label: 'Tracking #', value: subStep.data.tracking })
                      }
                      
                      // EAD USCIS Number
                      if (subStep.data.uscis_number) {
                        items.push({ label: 'USCIS #', value: subStep.data.uscis_number })
                      } else if (subStep.data.uscis) {
                        items.push({ label: 'USCIS #', value: subStep.data.uscis })
                      }
                      
                      // ATT Code
                      if (subStep.data.code) {
                        items.push({ label: 'ATT Code', value: subStep.data.code })
                      } else if (subStep.data.att_code) {
                        items.push({ label: 'ATT Code', value: subStep.data.att_code })
                      }
                      
                      // Expiry Date
                      if (subStep.data.expiry_date) {
                        items.push({ label: 'Expiry Date', value: formatDateFromISO(subStep.data.expiry_date) })
                      } else if (subStep.data.att_expiry_date) {
                        items.push({ label: 'Expiry Date', value: formatDateFromISO(subStep.data.att_expiry_date) })
                      }
                      
                      // Exam details
                      if (subStep.data.exam_date) {
                        items.push({ label: 'Exam Date', value: formatDateFromISO(subStep.data.exam_date) })
                      } else if (subStep.data.date && subStep.key === 'exam_date_booked') {
                        items.push({ label: 'Exam Date', value: formatDateFromISO(subStep.data.date) })
                      }
                      
                      if (subStep.data.exam_time) {
                        items.push({ label: 'Exam Time', value: subStep.data.exam_time })
                      } else if (subStep.data.time) {
                        items.push({ label: 'Exam Time', value: subStep.data.time })
                      }
                      
                      if (subStep.data.exam_location) {
                        items.push({ label: 'Location', value: subStep.data.exam_location })
                      } else if (subStep.data.location) {
                        items.push({ label: 'Location', value: subStep.data.location })
                      }
                      
                      // Result
                      if (subStep.data.result) {
                        const resultText = subStep.data.result === 'pass' ? 'Passed' : subStep.data.result === 'failed' ? 'Failed' : subStep.data.result
                        items.push({ label: 'Result', value: resultText })
                      }
                      
                      if (subStep.data.result_date) {
                        items.push({ label: 'Result Date', value: formatDateFromISO(subStep.data.result_date) })
                      }
                      
                      // Amount
                      if (subStep.data.amount) {
                        items.push({ label: 'Amount', value: formatCurrency(subStep.data.amount) })
                      }
                      
                      // Only show if there are items to display
                      if (items.length === 0) return null
                      
                      return (
                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Admin Updates:</p>
                          <ul className="space-y-1.5">
                            {items.map((item, idx) => (
                              <li key={idx} className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-2">
                                <span className="text-primary-600 dark:text-primary-400 mt-0.5">•</span>
                                <span><strong>{item.label}:</strong> {item.value}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              ))}

              {/* Exam Result Messages for Step 8 */}
              {stepNumber === 8 && examResult && (
                <div className="mt-4">
                  {examResult === 'pass' && (
                    <div className="p-6 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/20 border-2 border-green-200 dark:border-green-800 rounded-xl shadow-lg">
                      <p className="text-xl text-green-800 dark:text-green-300 font-bold mb-3 flex items-center gap-2">
                        ðŸŽ‰ Congratulations from GritSync! ðŸŽ‰
                      </p>
                      <p className="text-base text-green-700 dark:text-green-400 leading-relaxed mb-3">
                        Dear {application?.first_name || 'Valued Client'},
                      </p>
                      <p className="text-sm text-green-700 dark:text-green-400 leading-relaxed mb-2">
                        We at GritSync are absolutely thrilled to celebrate this incredible achievement with you! Passing the NCLEX exam is a monumental milestone that reflects your unwavering dedication, perseverance, and commitment to your nursing career.
                      </p>
                      <p className="text-sm text-green-700 dark:text-green-400 leading-relaxed mb-2">
                        Your journey with us has been remarkable, and we are honored to have been part of this significant moment in your professional life. This success is not just a test resultâ€”it's a testament to your hard work, resilience, and the bright future ahead of you as a licensed nurse.
                      </p>
                      <p className="text-sm text-green-700 dark:text-green-400 leading-relaxed">
                        From all of us at GritSync, congratulations on this outstanding accomplishment! We're excited to see where your nursing career takes you next. You've earned this success, and we couldn't be prouder!
                      </p>
                      <p className="text-sm text-green-700 dark:text-green-400 leading-relaxed mt-3 font-semibold">
                        Warm regards,<br />
                        The GritSync Team
                      </p>
                    </div>
                  )}
                  {examResult === 'failed' && (
                    <div className="p-6 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-800/20 border-2 border-orange-200 dark:border-orange-800 rounded-xl shadow-lg">
                      <p className="text-xl text-orange-800 dark:text-orange-300 font-bold mb-3 flex items-center gap-2">
                        ðŸ’ª Keep Going - A Message from GritSync
                      </p>
                      <p className="text-base text-orange-700 dark:text-orange-400 leading-relaxed mb-3">
                        Dear {application?.first_name || 'Valued Client'},
                      </p>
                      <p className="text-sm text-orange-700 dark:text-orange-400 leading-relaxed mb-2">
                        We know this result wasn't what you hoped for, and we want you to know that the entire GritSync team is here to support you. This moment does not define your journeyâ€”it's simply a stepping stone on your path to success.
                      </p>
                      <p className="text-sm text-orange-700 dark:text-orange-400 leading-relaxed mb-2">
                        Many of the most successful nurses we've worked with have faced this challenge. What sets them apart is their determination to learn, grow, and try again. You've already shown incredible strength by getting this far, and we believe in your ability to overcome this obstacle.
                      </p>
                      <p className="text-sm text-orange-700 dark:text-orange-400 leading-relaxed mb-2">
                        At GritSync, we're committed to helping you succeed. Take this time to review your preparation, identify areas for improvement, and know that we're here to support you every step of the way in your next attempt.
                      </p>
                      <p className="text-sm text-orange-700 dark:text-orange-400 leading-relaxed">
                        Remember: setbacks are setups for comebacks. Your nursing career is still ahead of you, and we're confident that with continued dedication and our support, you will achieve your goal.
                      </p>
                      <p className="text-sm text-orange-700 dark:text-orange-400 leading-relaxed mt-3 font-semibold">
                        We believe in you,<br />
                        The GritSync Team
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Instructions for Step 2 */}
              {stepNumber === 2 && showGenerateLetter && (
                <div className="mt-4 p-5 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <h4 className="font-bold text-base text-gray-900 dark:text-gray-100">Instructions</h4>
                  </div>
                  <ol className="list-decimal list-inside space-y-3 text-sm text-gray-700 dark:text-gray-300 ml-2">
                    <li className="leading-relaxed">Download letter for school and FORM 2F</li>
                    <li className="leading-relaxed">Fill up 1-7 section in form2f</li>
                    <li className="leading-relaxed">Go to your school's registrar and submit both forms</li>
                    <li className="leading-relaxed">Don't forget to bring about 1,500php for school fees</li>
                    <li className="leading-relaxed">Reiterate to submit all documents via email based on what stated on the letter for school</li>
                  </ol>
                </div>
              )}

              {/* Download Form 2F Button for Step 2 */}
              {stepNumber === 2 && showGenerateLetter && (
                <div className="mt-4 flex gap-2 flex-wrap">
                    <Button
                    onClick={() => {
                      window.open('https://www.op.nysed.gov/sites/op/files/2023-03/nurse2f.pdf', '_blank')
                    }}
                    variant="outline"
                      size="sm"
                    >
                    <Download className="h-4 w-4 mr-2" />
                    DOWNLOAD FORM 2F
                    </Button>
                </div>
              )}

            </div>
          )}
            </div>
          </div>
        </div>
      </div>

      {/* PDF Viewer Modal */}
      {showPdfModal && viewingPdfUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-6xl h-[90vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {viewingPdfName}
              </h3>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!viewingPdfUrl || !viewingPdfName) return
                    const link = document.createElement('a')
                    link.href = viewingPdfUrl
                    link.download = viewingPdfName
                    document.body.appendChild(link)
                    link.click()
                    document.body.removeChild(link)
                  }}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (setShowPdfModal) setShowPdfModal(false)
                    if (viewingPdfUrl) {
                      URL.revokeObjectURL(viewingPdfUrl)
                    }
                    if (setViewingPdfUrl) setViewingPdfUrl(null)
                    if (setViewingPdfName) setViewingPdfName('')
                  }}
                >
                  Close
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <iframe
                src={viewingPdfUrl}
                className="w-full h-full"
                title={viewingPdfName}
              />
            </div>
          </div>
        </div>
      )}

      {/* PDF Review Modal */}
      <PDFReviewModal
        isOpen={showReviewModal}
        onClose={() => {
          setShowReviewModal(false)
          setReviewPdfBlob(null)
        }}
        onReviewComplete={async () => {
          // setHasReviewed removed - no longer needed(true)
          setShowReviewModal(false)
          // Mark as reviewed - handle errors gracefully
          if (onUpdateSubStep && application?.id) {
            try {
              await onUpdateSubStep('ead_client_downloaded_signed', 'pending', {
                reviewed_at: new Date().toISOString()
              })
            } catch (error: any) {
              // Log error but don't fail - review is still complete
              handleErrorSilently(error, { operation: 'updateTimelineStep', context: 'review_complete', applicationId: application?.id })
            }
          }
          if (showToast) showToast('Documents reviewed. You can now proceed to sign.', 'success')
        }}
        pdfBlob={reviewPdfBlob}
        documentName={signatureDocumentName}
      />

      {/* Preparer Preview Modal */}
      <PDFReviewModal
        isOpen={showPreparerPreviewModal}
        onClose={() => {
          setShowPreparerPreviewModal(false)
          setPreparerPreviewPdfBlob(null)
        }}
        onReviewComplete={async () => {
          setShowPreparerPreviewModal(false)
          if (showToast) showToast('Documents reviewed. You can now proceed to sign.', 'success')
        }}
        pdfBlob={preparerPreviewPdfBlob}
        documentName="Client Signed Complete Files"
      />

      {/* Signature Preview Modal */}
      {showSignaturePreviewModal && signaturePreviewDataUrl && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <PenTool className="h-5 w-5" />
                {signaturePreviewTitle || 'Signature'}
              </h3>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const link = document.createElement('a')
                    link.href = signaturePreviewDataUrl
                    link.download = `${(signaturePreviewTitle || 'signature').replace(/\s+/g, '_')}.png`
                    document.body.appendChild(link)
                    link.click()
                    document.body.removeChild(link)
                  }}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowSignaturePreviewModal(false)
                    setSignaturePreviewDataUrl(null)
                    setSignaturePreviewTitle('')
                  }}
                >
                  Close
                </Button>
              </div>
            </div>
            <div className="flex-1 bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
              <div className="w-full h-full max-h-[70vh] flex items-center justify-center">
                <img
                  src={signaturePreviewDataUrl}
                  alt="Signature"
                  className="max-w-full max-h-full object-contain bg-transparent"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Signature Modal */}
      <SignatureModal
        isOpen={showSignatureModal}
        onClose={() => setShowSignatureModal(false)}
        isAlreadySigned={
          signatureDocumentName.includes('Client_Signed')
            ? (subSteps?.find(s => s.key === 'ead_preparer_downloaded_signed')?.data?.signed_at || subSteps?.find(s => s.key === 'ead_preparer_downloaded_signed')?.data?.signature_data) ? true : false
            : (subSteps?.find(s => s.key === 'ead_client_downloaded_signed')?.data?.signed_at || subSteps?.find(s => s.key === 'ead_client_downloaded_signed')?.data?.signature_data) ? true : false
        }
        onSignatureComplete={async (signatureDataUrl) => {
          setShowSignatureModal(false)
          // Show loading animation immediately
          setShowSignatureSuccess(true)
          
          try {
            // Determine if this is client or preparer signing
            const isPreparerSigning = signatureDocumentName.includes('Client_Signed')
            
            if (isPreparerSigning) {
              // Preparer signing - just capture and save signature (no PDF signing)
              if (!application?.user_id) {
                throw new Error('Application user ID is required')
              }
              
              // Save preparer signature image (transparent PNG) to storage
              try {
                // Validate signature data URL
                if (!signatureDataUrl || typeof signatureDataUrl !== 'string' || !signatureDataUrl.startsWith('data:image')) {
                  console.warn('Invalid signature data URL format for preparer signature')
                  throw new Error('Invalid signature format')
                }
                
                // Convert signature data URL to blob (already PNG format with transparency)
                const response = await fetch(signatureDataUrl)
                if (!response.ok) {
                  throw new Error(`Failed to fetch signature data: ${response.status}`)
                }
                
                let signatureBlob = await response.blob()
                // Ensure it's PNG format (data URLs from signature pad are PNG with transparency)
                if (!signatureBlob.type || !signatureBlob.type.includes('image')) {
                  // If blob type is wrong, create new blob with correct type
                  signatureBlob = new Blob([signatureBlob], { type: 'image/png' })
                }
                
                // Save as PNG to preserve transparency (JPG doesn't support transparency)
                let signatureFile = new File([signatureBlob], 'ead_preparer_signature.png', { type: 'image/png' })
                
                // Compress signature image before upload
                try {
                  const { compressDocument } = await import('@/lib/document-compression')
                  signatureFile = await compressDocument(signatureFile, {
                    maxWidth: 800,
                    maxHeight: 300,
                    quality: 0.9, // High quality for signatures
                    maxFileSizeMB: 0,
                  })
                } catch (compressionError) {
                  console.warn('Signature compression failed, using original:', compressionError)
                }
                
                const signatureFilePath = `${application.user_id}/ead_preparer_signature.png`
                
                // Upload to Supabase storage - admins can upload to any user's folder (Policy 5)
                const { error: signatureUploadError } = await supabase.storage
                  .from('documents')
                  .upload(signatureFilePath, signatureFile, {
                    cacheControl: '3600',
                    upsert: true, // Allow overwriting existing signatures
                  })
                
                if (signatureUploadError) {
                  // Log error but don't block signing process
                  console.error('Failed to upload preparer signature image:', signatureUploadError)
                  handleErrorSilently(signatureUploadError, { 
                    operation: 'uploadPreparerSignatureImage', 
                    applicationId: application?.id, 
                    severity: 'low',
                    context: { filePath: signatureFilePath, userId: application.user_id }
                  })
                } else {
                  console.log('Preparer signature image saved successfully:', signatureFilePath)
                }
              } catch (signatureErr: any) {
                // Log error but continue - signature is still saved in timeline data
                console.error('Error saving preparer signature image:', signatureErr)
                handleErrorSilently(signatureErr, { 
                  operation: 'uploadPreparerSignatureImage', 
                  context: 'exception', 
                  applicationId: application?.id, 
                  severity: 'low' 
                })
              }

              // Save preparer signature - handle errors gracefully
              if (onUpdateSubStep && application?.id) {
                try {
                  await onUpdateSubStep('ead_preparer_downloaded_signed', 'completed', {
                    date: new Date().toISOString(),
                    signed_at: new Date().toISOString(),
                    signature_data: signatureDataUrl,
                    document_name: signatureDocumentName,
                  })
                } catch (error: any) {
                  // Log error but don't fail - signing is still complete
                  handleErrorSilently(error, { operation: 'updateTimelineStep', context: 'preparer_signing_complete', applicationId: application?.id })
                }
              }
              
              // Success animation will be shown (already set above)
            } else {
              // Client signing - just capture and save signature (no PDF signing)
              if (!application?.user_id) {
                throw new Error('Application user ID is required')
              }
              
              // Save client signature image (transparent PNG) to storage
              try {
                // Validate signature data URL
                if (!signatureDataUrl || typeof signatureDataUrl !== 'string' || !signatureDataUrl.startsWith('data:image')) {
                  console.warn('Invalid signature data URL format for client signature')
                  throw new Error('Invalid signature format')
                }
                
                // Convert signature data URL to blob
                const response = await fetch(signatureDataUrl)
                if (!response.ok) {
                  throw new Error(`Failed to fetch signature data: ${response.status}`)
                }
                
                let signatureBlob = await response.blob()
                // Ensure it's PNG format
                if (!signatureBlob.type || !signatureBlob.type.includes('image')) {
                  signatureBlob = new Blob([signatureBlob], { type: 'image/png' })
                }
                
                // Save as PNG to preserve transparency
                let signatureFile = new File([signatureBlob], 'ead_client_signature.png', { type: 'image/png' })
                
                // Compress signature image before upload
                try {
                  const { compressDocument } = await import('@/lib/document-compression')
                  signatureFile = await compressDocument(signatureFile, {
                    maxWidth: 800,
                    maxHeight: 300,
                    quality: 0.9,
                    maxFileSizeMB: 0,
                  })
                } catch (compressionError) {
                  console.warn('Signature compression failed, using original:', compressionError)
                }
                
                const signatureFilePath = `${application.user_id}/ead_client_signature.png`
                
                // Upload to Supabase storage
                const { error: signatureUploadError } = await supabase.storage
                  .from('documents')
                  .upload(signatureFilePath, signatureFile, {
                    cacheControl: '3600',
                    upsert: true,
                  })
                
                if (signatureUploadError) {
                  console.error('Failed to upload client signature image:', signatureUploadError)
                  handleErrorSilently(signatureUploadError, { 
                    operation: 'uploadClientSignatureImage', 
                    applicationId: application?.id, 
                    severity: 'low',
                  })
                } else {
                  console.log('Client signature image saved successfully:', signatureFilePath)
                }
              } catch (signatureErr: any) {
                console.error('Error saving client signature image:', signatureErr)
                handleErrorSilently(signatureErr, { 
                  operation: 'uploadClientSignatureImage', 
                  context: 'exception', 
                  applicationId: application?.id, 
                  severity: 'low' 
                })
              }
              
              // Update timeline step with signature info (no PDF data)
              if (onUpdateSubStep) {
                try {
                  // Get existing step data to preserve it
                  const existingStep = subSteps?.find(s => s.key === 'ead_client_downloaded_signed')
                  
                  await onUpdateSubStep('ead_client_downloaded_signed', 'completed', {
                    ...existingStep?.data, // Preserve existing data
                    signed_at: new Date().toISOString(),
                    signature_data: signatureDataUrl,
                    document_name: signatureDocumentName,
                    date: new Date().toISOString(), // Add date for timeline display
                  })
                  
                  console.log('Client signing step updated successfully')
                } catch (error: any) {
                  console.error('Error updating client signing step:', error)
                  handleErrorSilently(error, { operation: 'updateTimelineStep', context: 'client_signing_complete', applicationId: application?.id })
                  // Show error to user
                  if (showToast) {
                    showToast('Signature saved but failed to update step status. Please refresh the page.', 'warning')
                  }
                }
              } else {
                console.warn('onUpdateSubStep is not available')
              }
              
              // Success animation will be shown (already set above)
            }
          } catch (error) {
            handleErrorSilently(error, { operation: 'signDocuments', applicationId: application?.id })
            if (showToast) showToast('Failed to sign documents: ' + (error instanceof Error ? error.message : 'Unknown error'), 'error')
            setShowSignatureSuccess(false)
          }
        }}
        applicationId={application?.id}
        documentName={signatureDocumentName}
      />

      {/* Signature Success Animation - Shows loading then success */}
      {showSignatureSuccess && (
        <SignatureSuccessAnimation
          onComplete={() => {
            setShowSignatureSuccess(false)
            if (showToast) {
              const isPreparer = signatureDocumentName.includes('Client_Signed')
              showToast(
                isPreparer 
                  ? 'Preparer signature added successfully! You can now download the final package.' 
                  : 'Documents signed successfully! Your signed documents have been uploaded. The preparer will now review and sign.',
                'success'
              )
            }
          }}
          message={
            signatureDocumentName.includes('Client_Signed')
              ? 'Preparer signature added successfully! Final package is ready for download.'
              : 'Documents signed successfully! Your signed documents have been uploaded and are ready for preparer review.'
          }
          loadingDuration={2500}
          successDuration={3000}
        />
      )}
    </div>
  )
}
