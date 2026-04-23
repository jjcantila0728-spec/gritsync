import React, { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Mail, Eye, Send } from 'lucide-react'
import * as EmailTemplates from '@/lib/email-templates'
import { sendEmail } from '@/lib/email-service'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/contexts/AuthContext'

interface TemplateDemo {
  id: string
  name: string
  description: string
  generate: () => Promise<{ subject: string; html: string }>
}

export function EmailTemplatePreview() {
  const { showToast } = useToast()
  const { user } = useAuth()
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [previewHtml, setPreviewHtml] = useState<string>('')
  const [sending, setSending] = useState(false)

  const templates: TemplateDemo[] = [
    {
      id: 'forgot-password',
      name: '🔐 Forgot Password',
      description: 'Password reset email with secure link',
      generate: () => EmailTemplates.createForgotPasswordEmail({
        userName: user?.user_metadata?.full_name || 'John Doe',
        resetLink: 'https://gritsync.com/reset-password?token=sample-token',
        expiryTime: '1 hour'
      })
    },
    {
      id: 'payment-receipt',
      name: '✅ Payment Receipt',
      description: 'Professional payment confirmation with details',
      generate: () => EmailTemplates.createPaymentReceiptEmail({
        userName: user?.user_metadata?.full_name || 'John Doe',
        amount: 500.00,
        currency: 'USD',
        transactionId: 'TXN123456789',
        paymentDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        description: 'NCLEX Processing Service - Application #APP001',
        items: [
          { name: 'NCLEX Application Fee', amount: 350.00 },
          { name: 'Document Processing', amount: 100.00 },
          { name: 'Express Service', amount: 50.00 }
        ],
        receiptUrl: 'https://gritsync.com/receipts/TXN123456789'
      })
    },
    {
      id: 'timeline-update',
      name: '📋 Timeline Update',
      description: 'Application status and timeline updates',
      generate: () => EmailTemplates.createTimelineUpdateEmail({
        userName: user?.user_metadata?.full_name || 'John Doe',
        applicationId: 'APP001',
        updateTitle: 'Documents Verified',
        updateMessage: 'Your submitted documents have been verified and approved. We are now processing your application.',
        newStatus: 'In Review',
        actionUrl: 'https://gritsync.com/applications/APP001',
        timeline: [
          { date: 'Jan 15, 2024', title: 'Application Submitted', completed: true },
          { date: 'Jan 16, 2024', title: 'Payment Received', completed: true },
          { date: 'Jan 18, 2024', title: 'Documents Verified', completed: true },
          { date: 'Pending', title: 'Under Review', completed: false },
          { date: 'Pending', title: 'Approved', completed: false }
        ]
      })
    },
    {
      id: 'missing-documents',
      name: '📄 Missing Documents',
      description: 'Reminder for required document uploads',
      generate: () => EmailTemplates.createMissingDocumentEmail({
        userName: user?.user_metadata?.full_name || 'John Doe',
        applicationId: 'APP001',
        missingDocuments: [
          { name: 'Passport Copy', description: 'Clear scan of all pages', required: true },
          { name: 'Academic Transcript', description: 'Official transcript from your institution', required: true },
          { name: 'Professional License', description: 'Current nursing license', required: false }
        ],
        deadline: 'January 30, 2024',
        uploadUrl: 'https://gritsync.com/applications/APP001/documents'
      })
    },
    {
      id: 'missing-details',
      name: '✏️ Missing Profile Details',
      description: 'Profile completion reminder',
      generate: () => EmailTemplates.createMissingDetailsEmail({
        userName: user?.user_metadata?.full_name || 'John Doe',
        missingFields: [
          { fieldName: 'Phone Number', description: 'Required for application verification' },
          { fieldName: 'Date of Birth', description: 'Must match your official documents' },
          { fieldName: 'Current Address', description: 'Your residential address' }
        ],
        profileUrl: 'https://gritsync.com/my-details',
        isUrgent: false
      })
    },
    {
      id: 'school-letter',
      name: '🎓 School Letter',
      description: 'Generated school verification letter',
      generate: () => EmailTemplates.createSchoolLetterEmail({
        userName: user?.user_metadata?.full_name || 'John Doe',
        schoolName: 'University of California',
        letterUrl: 'https://gritsync.com/letters/LETTER123.pdf',
        applicationId: 'APP001',
        instructions: `1. Download the letter from the link above
2. Print the letter on official letterhead
3. Submit to the admissions office
4. Keep a copy for your records`
      })
    },
    {
      id: 'full-instructions',
      name: '📚 Full Instructions',
      description: 'Complete application process guide',
      generate: () => EmailTemplates.createFullInstructionsEmail({
        userName: user?.user_metadata?.full_name || 'John Doe',
        applicationId: 'APP001',
        serviceType: 'NCLEX Processing',
        steps: [
          {
            stepNumber: 1,
            title: 'Complete Your Profile',
            description: 'Fill in all required personal information including contact details, address, and emergency contacts.',
            dueDate: 'Within 3 days'
          },
          {
            stepNumber: 2,
            title: 'Upload Required Documents',
            description: 'Submit clear copies of your passport, academic transcripts, and professional licenses.',
            dueDate: 'Within 7 days'
          },
          {
            stepNumber: 3,
            title: 'Payment Processing',
            description: 'Complete the payment for your selected service package.',
            dueDate: 'Within 5 days'
          },
          {
            stepNumber: 4,
            title: 'Document Verification',
            description: 'Our team will verify all your submitted documents. You will receive updates via email.',
            dueDate: '5-7 business days'
          },
          {
            stepNumber: 5,
            title: 'Application Submission',
            description: 'We will submit your application to the relevant authorities on your behalf.',
            dueDate: '2-3 business days after verification'
          }
        ],
        resourcesUrl: 'https://gritsync.com/resources'
      })
    },
    {
      id: 'welcome',
      name: '🎉 Welcome Email',
      description: 'New user welcome message',
      generate: () => EmailTemplates.createWelcomeEmail({
        userName: user?.user_metadata?.full_name || 'John Doe',
        userEmail: user?.email || 'user@example.com',
        dashboardUrl: 'https://gritsync.com/dashboard'
      })
    },
    {
      id: 'email-verification',
      name: '✉️ Email Verification',
      description: 'Email verification link for new accounts',
      generate: () => EmailTemplates.createEmailVerificationEmail({
        userName: user?.user_metadata?.full_name || 'John Doe',
        userEmail: user?.email || 'user@example.com',
        verificationLink: 'https://gritsync.com/verify-email?token=sample-token',
        expiryTime: '24 hours'
      })
    },
    {
      id: 'application-approved',
      name: '🎉 Application Approved',
      description: 'Congratulations email when application is approved',
      generate: () => EmailTemplates.createApplicationApprovedEmail({
        userName: user?.user_metadata?.full_name || 'John Doe',
        applicationId: 'APP001',
        serviceType: 'NCLEX Processing',
        approvalDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        nextSteps: [
          'Wait for your official documents',
          'Schedule your exam date',
          'Prepare for your NCLEX exam'
        ],
        applicationUrl: 'https://gritsync.com/applications/APP001',
        certificateUrl: 'https://gritsync.com/certificates/APP001'
      })
    },
    {
      id: 'application-rejected',
      name: '⚠️ Application Rejected',
      description: 'Notification when application cannot be approved',
      generate: () => EmailTemplates.createApplicationRejectedEmail({
        userName: user?.user_metadata?.full_name || 'John Doe',
        applicationId: 'APP001',
        serviceType: 'NCLEX Processing',
        rejectionDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        reason: 'Some required documents were missing or incomplete. Please review the requirements and resubmit.',
        appealProcess: 'If you believe this decision was made in error, you may appeal by contacting our support team within 30 days.',
        applicationUrl: 'https://gritsync.com/applications/APP001',
        supportContact: 'support@gritsync.com'
      })
    },
    {
      id: 'document-approved',
      name: '✅ Document Approved',
      description: 'Notification when a document is approved',
      generate: () => EmailTemplates.createDocumentApprovedEmail({
        userName: user?.user_metadata?.full_name || 'John Doe',
        applicationId: 'APP001',
        documentName: 'Passport Copy',
        approvedDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        approvedBy: 'Admin Team',
        applicationUrl: 'https://gritsync.com/applications/APP001',
        notes: 'All pages are clear and legible. Document meets all requirements.'
      })
    },
    {
      id: 'document-rejected',
      name: '⚠️ Document Rejected',
      description: 'Notification when a document needs revision',
      generate: () => EmailTemplates.createDocumentRejectedEmail({
        userName: user?.user_metadata?.full_name || 'John Doe',
        applicationId: 'APP001',
        documentName: 'Academic Transcript',
        rejectionDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        rejectionReason: 'The document is not clear enough. Please upload a higher resolution scan or ensure all text is legible.',
        requiredActions: [
          'Upload a clearer, higher resolution scan',
          'Ensure all pages are included',
          'Make sure the document is not cut off or cropped'
        ],
        uploadUrl: 'https://gritsync.com/applications/APP001/documents',
        reviewedBy: 'Admin Team'
      })
    }
  ]

  const handlePreview = async (template: TemplateDemo) => {
    setSelectedTemplate(template.id)
    const { html } = await template.generate()
    setPreviewHtml(html)
  }

  const handleSendTest = async (template: TemplateDemo) => {
    if (!user?.email) {
      showToast('Please login to send test emails', 'error')
      return
    }

    setSending(true)
    try {
      const { subject, html } = await template.generate()
      const success = await sendEmail({
        to: user.email,
        subject: `[TEST] ${subject}`,
        html
      })

      if (success) {
        showToast(`Test email sent to ${user.email}`, 'success')
      } else {
        showToast('Failed to send test email', 'error')
      }
    } catch (error: any) {
      showToast(error.message || 'Failed to send test email', 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="p-3 sm:p-4 md:p-5 space-y-4">
      <div>
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Email Template Preview
        </h2>
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
          Preview and test all email templates
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Template List */}
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Available Templates
          </h3>
          {templates.map((template) => (
            <Card key={template.id} className="p-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                    {template.name}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {template.description}
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handlePreview(template)}
                  className="flex-1"
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Preview
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleSendTest(template)}
                  disabled={sending}
                  className="flex-1"
                >
                  <Send className="h-4 w-4 mr-1" />
                  {sending ? 'Sending...' : 'Send Test'}
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {/* Preview Panel */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <Card className="p-3">
            <div className="flex items-center gap-2 mb-3">
              <Mail className="h-4 w-4 text-primary-600 dark:text-primary-400" />
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Email Preview
              </h3>
            </div>
            {previewHtml ? (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <iframe
                  srcDoc={previewHtml}
                  className="w-full"
                  style={{ height: '500px' }}
                  title="Email Preview"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-center">
                <Mail className="h-12 w-12 sm:h-16 sm:w-16 text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Select a template to preview
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

