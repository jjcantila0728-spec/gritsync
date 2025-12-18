/**
 * AI-Powered Newsletter Builder Component
 * Create newsletters with AI assistance and schedule them
 */

import { useState } from 'react'
import { 
  Wand2, 
  Calendar,
  Users,
  Eye,
  Save,
  X,
  Sparkles,
  Mail,
  Type,
  Clock,
  CheckCircle2,
  Loader2
} from 'lucide-react'
import { emailCampaignsAPI } from '@/lib/email-campaigns-api'
import { emailQueueAPI } from '@/lib/email-queue-api'
import { cn, sanitizeHTML } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

interface NewsletterBuilderProps {
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void
  onClose: () => void
  onSuccess: () => void
}

interface NewsletterData {
  name: string
  subject: string
  preheader: string
  content: string
  campaign_type: 'newsletter' | 'broadcast'
  recipient_type: 'subscribers' | 'users' | 'custom'
  scheduled_for?: string
  focus: string
  topics: string[]
}

type NewsletterStep = 'details' | 'content' | 'recipients' | 'schedule' | 'preview'

const topicOptions = [
  { id: 'nclex-success', label: 'NCLEX Success Stories' },
  { id: 'community-care', label: 'Community & Care Stories' },
  { id: 'platform-update', label: 'Platform & Feature Updates' },
  { id: 'study-strategies', label: 'Study Strategies & Tools' },
  { id: 'wellness-habits', label: 'Wellness & Resilience Tips' },
]

const templateLibrary = [
  {
    id: 'professional',
    label: 'Professional Pulse',
    title: 'Executive MVP',
    description: 'Structured hero, highlight cards, CTA',
    accent: 'bg-gradient-to-r from-purple-600 to-blue-600',
  },
  {
    id: 'modern',
    label: 'Modern Momentum',
    title: 'Gradient MVP Story',
    description: 'Bold hero, status highlights, CTA',
    accent: 'bg-gradient-to-r from-emerald-500 to-teal-500',
  },
  {
    id: 'minimal',
    label: 'Minimal Spotlight',
    title: 'Calm MVP Focus',
    description: 'Clean serif, whitespace, subtle details',
    accent: 'bg-gradient-to-r from-slate-200 to-slate-100',
  },
] as const

type TemplateKey = (typeof templateLibrary)[number]['id']

const topicLabelMap = topicOptions.reduce<Record<string, string>>((acc, option) => {
  acc[option.id] = option.label
  return acc
}, {})

const newsletterSteps: NewsletterStep[] = ['details', 'content', 'recipients', 'schedule', 'preview']

export function NewsletterBuilder({ showToast, onClose, onSuccess }: NewsletterBuilderProps) {
  const [step, setStep] = useState<'details' | 'content' | 'recipients' | 'schedule' | 'preview'>('details')
  const [loading, setLoading] = useState(false)
  const [aiGenerating, setAiGenerating] = useState(false)
  
  const [newsletter, setNewsletter] = useState<NewsletterData>({
    name: '',
    subject: '',
    preheader: '',
    content: '',
    campaign_type: 'newsletter',
    recipient_type: 'subscribers',
    focus: '',
    topics: [],
  })

  const [aiPrompt, setAiPrompt] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<string>('professional')

  const getTopicLabel = (topicId: string) => topicLabelMap[topicId] || topicId

  const toggleTopic = (topicId: string) => {
    setNewsletter((prev) => {
      const hasTopic = prev.topics.includes(topicId)
      const nextTopics = hasTopic
        ? prev.topics.filter((topic) => topic !== topicId)
        : [...prev.topics, topicId].slice(-3)

      return { ...prev, topics: nextTopics }
    })
  }

  const ensureNewsletterName = () => {
    setNewsletter((prev) => {
      const currentName = prev.name?.trim()
      if (currentName) return prev

      const baseTopic = prev.topics[0] ? getTopicLabel(prev.topics[0]) : ''
      const base = prev.focus?.trim() || baseTopic || 'MVP Newsletter'
      return { ...prev, name: `${base} · ${new Date().toLocaleDateString()}` }
    })
  }

  const goToStep = (target: NewsletterStep) => {
    ensureNewsletterName()
    setStep(target)
  }

  const goToNextStep = () => {
    const currentIndex = newsletterSteps.findIndex((s) => s === step)
    if (currentIndex < newsletterSteps.length - 1) {
      goToStep(newsletterSteps[currentIndex + 1])
    }
  }

  const goToPreviousStep = () => {
    const currentIndex = newsletterSteps.findIndex((s) => s === step)
    if (currentIndex > 0) {
      goToStep(newsletterSteps[currentIndex - 1])
    }
  }

  const generateAIContent = async () => {
    if (!aiPrompt.trim()) {
      showToast('Please enter a prompt for AI generation', 'warning')
      return
    }

    setAiGenerating(true)
    try {
      const { data, error } = await supabase.functions.invoke('ai-newsletter-builder', {
        body: JSON.stringify({
          prompt: aiPrompt.trim(),
          focus: newsletter.focus.trim(),
          topics: newsletter.topics,
          template: selectedTemplate as TemplateKey,
        }),
      })

      if (error) {
        throw error
      }

      const payload = typeof data === 'string' ? JSON.parse(data) : data
      const subjectValue = payload.subject?.trim() || newsletter.subject.trim() || 'Nurses at GritSync Update'
      const nameValue = newsletter.name.trim() || subjectValue
      const preheaderValue = payload.preheader?.trim() || newsletter.preheader.trim() || payload.focus || newsletter.focus

      setNewsletter((prev) => ({
        ...prev,
        content: payload.html || prev.content,
        subject: subjectValue,
        name: nameValue,
        preheader: preheaderValue,
        focus: payload.focus || prev.focus,
      }))

      showToast('AI content generated successfully!', 'success')
      setStep('content')
    } catch (error: any) {
      console.error('Error generating AI content:', error)
      showToast(error.message || 'Failed to generate AI content', 'error')
    } finally {
      setAiGenerating(false)
    }
  }

  const handleSaveDraft = async () => {
    setLoading(true)
    try {
      const nameValue = newsletter.name.trim() || `MVP Newsletter ${new Date().toLocaleDateString()}`
      const subjectValue = newsletter.subject.trim() || nameValue
      const descriptionParts = [
        newsletter.preheader.trim(),
        newsletter.focus ? `Focus: ${newsletter.focus}` : '',
        newsletter.topics.length > 0 ? `Topics: ${newsletter.topics.map(getTopicLabel).join(', ')}` : '',
      ].filter(Boolean)
      const descriptionValue = descriptionParts.join(' · ') || 'MVP newsletter draft'

      await emailCampaignsAPI.create({
        name: nameValue,
        subject: subjectValue,
        body_html: newsletter.content,
        body_text: stripHtml(newsletter.content),
        description: descriptionValue,
        campaign_type: newsletter.campaign_type,
        recipient_type: newsletter.recipient_type,
        status: 'draft',
      })
      
      showToast('Newsletter saved as draft', 'success')
      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('Error saving draft:', error)
      showToast(error.message || 'Failed to save draft', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSchedule = async () => {
    if (!newsletter.scheduled_for) {
      showToast('Please select a schedule date and time', 'warning')
      return
    }

    setLoading(true)
    try {
      const nameValue = newsletter.name.trim() || `MVP Newsletter ${new Date().toLocaleDateString()}`
      const subjectValue = newsletter.subject.trim() || nameValue
      const descriptionParts = [
        newsletter.preheader.trim(),
        newsletter.focus ? `Focus: ${newsletter.focus}` : '',
        newsletter.topics.length > 0 ? `Topics: ${newsletter.topics.map(getTopicLabel).join(', ')}` : '',
      ].filter(Boolean)
      const descriptionValue = descriptionParts.join(' · ') || 'Scheduled MVP newsletter'

      // Create campaign
      const campaign = await emailCampaignsAPI.create({
        name: nameValue,
        subject: subjectValue,
        body_html: newsletter.content,
        body_text: stripHtml(newsletter.content),
        description: descriptionValue,
        campaign_type: newsletter.campaign_type,
        recipient_type: newsletter.recipient_type,
        status: 'scheduled',
        scheduled_for: newsletter.scheduled_for,
      })

      // Get recipients based on type
      // This would fetch from subscribers API or users API
      const recipients = await getRecipients()

      // Schedule emails in queue
      for (const recipient of recipients) {
        await emailQueueAPI.schedule({
          recipient_email: recipient.email,
          recipient_name: recipient.name,
          recipient_user_id: recipient.user_id,
          subject: newsletter.subject,
          body_html: newsletter.content,
          body_text: stripHtml(newsletter.content),
          scheduled_for: newsletter.scheduled_for,
          email_type: 'marketing',
          email_category: 'general',
          metadata: {
            campaign_id: campaign.id,
            campaign_name: newsletter.name,
          },
          tags: [newsletter.campaign_type, 'newsletter'],
        })
      }

      showToast(`Newsletter scheduled for ${new Date(newsletter.scheduled_for).toLocaleString()}`, 'success')
      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('Error scheduling newsletter:', error)
      showToast(error.message || 'Failed to schedule newsletter', 'error')
    } finally {
      setLoading(false)
    }
  }

  const getRecipients = async () => {
    // Placeholder - implement actual recipient fetching
    // This would query subscribers or users based on type
    return [
      { email: 'subscriber@example.com', name: 'Test Subscriber', user_id: null }
    ]
  }

  const stripHtml = (html: string): string => {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  }

  const renderStepContent = () => {
    switch (step) {
    case 'details':
      return (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Newsletter Name
            </label>
            <input
              type="text"
              value={newsletter.name}
              onChange={(e) => setNewsletter({ ...newsletter, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              placeholder="e.g., MVP Monthly Roundtable - December"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Campaign Type
            </label>
            <select
              value={newsletter.campaign_type}
              onChange={(e) => setNewsletter({ ...newsletter, campaign_type: e.target.value as any })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            >
              <option value="newsletter">Newsletter</option>
              <option value="broadcast">Broadcast</option>
            </select>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-6 space-y-5">
            <div className="flex items-start gap-3">
              <Sparkles className="h-6 w-6 text-purple-500" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  AI-Powered MVP Content Suite
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  The AI is tuned to deliver MVP-ready newsletters with curated topics and intentional focus.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Describe your newsletter
              </label>
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                placeholder="Example: Highlight NCLEX success stories, community resources, and new support tools."
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                This prompt guides the MVP design generation. Mention tone, topics, or focus ideas.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <p>Topics (up to 3)</p>
                  <span>{newsletter.topics.length}/3 selected</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {topicOptions.map((topic) => {
                    const isActive = newsletter.topics.includes(topic.id)
                    return (
                      <button
                        key={topic.id}
                        type="button"
                        onClick={() => toggleTopic(topic.id)}
                        className={cn(
                          'px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border',
                          isActive
                            ? 'bg-primary-600 border-primary-600 text-white'
                            : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-primary-500'
                        )}
                      >
                        {topic.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Focus Statement
                </label>
                <input
                  type="text"
                  value={newsletter.focus}
                  onChange={(e) => setNewsletter({ ...newsletter, focus: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="Describe the main focus, e.g., Clinical insights for NCLEX"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  This sentence directs the AI toward a single narrative thread.
                </p>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Sample MVP Designs</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {templateLibrary.map((template) => {
                  const isActive = selectedTemplate === template.id
                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => setSelectedTemplate(template.id)}
                      className={cn(
                        'rounded-2xl border px-4 py-3 text-left transition-shadow',
                        isActive
                          ? 'border-primary-500 shadow-lg'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900',
                        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500'
                      )}
                    >
                      <div className={cn('h-1.5 w-16 rounded-full', template.accent)} />
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mt-3">{template.title}</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{template.description}</p>
                      <span className="mt-3 inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
                        <span className="h-1 w-1 rounded-full bg-primary-500" />
                        MVP ready
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <blockquote className="rounded-2xl border border-dashed border-primary-200 dark:border-primary-800 bg-primary-50/60 dark:bg-primary-900/40 p-4 text-xs text-primary-700 dark:text-primary-200">
                AI will deliver the full HTML design shown in the content preview tab, styled for MVP clarity and polish.
              </blockquote>
            </div>

            <div>
              <button
                onClick={generateAIContent}
                disabled={aiGenerating}
                className={cn(
                  'w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-white font-medium transition',
                  aiGenerating
                    ? 'bg-primary-400 cursor-wait'
                    : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700'
                )}
              >
                {aiGenerating ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Generating with AI...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-5 w-5" />
                    Generate Content with AI
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )

    case 'content': {
      const sanitizedPreview = newsletter.content ? sanitizeHTML(newsletter.content) : ''
      return (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Subject Line
            </label>
            <input
              type="text"
              value={newsletter.subject}
              onChange={(e) => setNewsletter({ ...newsletter, subject: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              placeholder="Enter email subject"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Preheader Text
            </label>
            <input
              type="text"
              value={newsletter.preheader}
              onChange={(e) => setNewsletter({ ...newsletter, preheader: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              placeholder="Preview text shown in inbox"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email Content (HTML)
              </label>
              <textarea
                value={newsletter.content}
                onChange={(e) => setNewsletter({ ...newsletter, content: e.target.value })}
                rows={15}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white font-mono text-sm resize-none"
                placeholder="<html>...</html>"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-100">Live Design Preview</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Watch the actual MVP design render as you edit content.
                  </p>
                </div>
                <span className="text-xs uppercase tracking-wide text-primary-600 dark:text-primary-300">MVP</span>
              </div>

              <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 h-[320px] overflow-hidden">
                {sanitizedPreview ? (
                  <div
                    className="h-full overflow-auto p-4 text-[14px] text-gray-900 dark:text-gray-100"
                    dangerouslySetInnerHTML={{ __html: sanitizedPreview }}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center p-6 text-xs text-gray-500 dark:text-gray-400">
                    Generate content or paste HTML to preview the actual MVP layout.
                  </div>
                )}
              </div>

              <div className="text-xs text-gray-500 dark:text-gray-400">
                <p className="font-semibold text-gray-700 dark:text-gray-100">Focus</p>
                <p>{newsletter.focus || 'General MVP focus'}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {newsletter.topics.length > 0 ? (
                    newsletter.topics.map((topicId) => (
                      <span
                        key={topicId}
                        className="inline-flex items-center rounded-full border border-gray-200 px-2 py-1 text-[11px] font-medium text-gray-600 dark:border-gray-700 dark:text-gray-300"
                      >
                        {getTopicLabel(topicId)}
                      </span>
                    ))
                  ) : (
                    <span className="text-[11px] font-medium text-gray-400">Topics will appear here</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    }

      case 'recipients':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Send To
              </label>
              <select
                value={newsletter.recipient_type}
                onChange={(e) => setNewsletter({ ...newsletter, recipient_type: e.target.value as any })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              >
                <option value="subscribers">All Subscribers</option>
                <option value="users">All Users</option>
                <option value="custom">Custom List</option>
              </select>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <strong>Estimated Recipients:</strong> 150 contacts
              </p>
            </div>
          </div>
        )

      case 'schedule':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Schedule Date & Time
              </label>
              <input
                type="datetime-local"
                value={newsletter.scheduled_for || ''}
                onChange={(e) => setNewsletter({ ...newsletter, scheduled_for: e.target.value })}
                min={new Date().toISOString().slice(0, 16)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-green-900 dark:text-green-100">
                  <p className="font-medium mb-1">Newsletter will be sent to /scheduled queue</p>
                  <p className="text-green-700 dark:text-green-200">
                    Your newsletter will be queued and sent at the scheduled time. You can monitor it in the Scheduled tab.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )

      case 'preview':
        return (
          <div className="space-y-6">
            <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Subject:</h3>
              <p className="text-gray-700 dark:text-gray-300">{newsletter.subject}</p>
            </div>

            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Preview</p>
              </div>
              <div 
                className="p-6 bg-white dark:bg-gray-900 max-h-96 overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: newsletter.content }}
              />
            </div>
          </div>
        )

      default:
        return null
    }
  }

  const steps = [
    { id: 'details', label: 'Details & AI', icon: Sparkles },
    { id: 'content', label: 'Content', icon: Type },
    { id: 'recipients', label: 'Recipients', icon: Users },
    { id: 'schedule', label: 'Schedule', icon: Calendar },
    { id: 'preview', label: 'Preview', icon: Eye },
  ]

  const currentStepIndex = steps.findIndex(s => s.id === step)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Mail className="h-6 w-6 text-primary-600" />
              AI Newsletter Builder
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Create beautiful newsletters with AI assistance
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            {steps.map((s, index) => {
              const Icon = s.icon
              const isActive = s.id === step
              const isCompleted = index < currentStepIndex
              
              return (
                <div key={s.id} className="flex items-center flex-1">
                  <button
                    onClick={() => goToStep(s.id as NewsletterStep)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors",
                      isActive && "bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300",
                      isCompleted && "text-green-600 dark:text-green-400",
                      !isActive && !isCompleted && "text-gray-500 dark:text-gray-400"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-sm font-medium hidden sm:inline">{s.label}</span>
                  </button>
                  {index < steps.length - 1 && (
                    <div className={cn(
                      "flex-1 h-0.5 mx-2",
                      isCompleted ? "bg-green-500" : "bg-gray-300 dark:bg-gray-700"
                    )} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {renderStepContent()}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex gap-3">
            {currentStepIndex > 0 && (
              <button
                onClick={goToPreviousStep}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                ← Previous
              </button>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSaveDraft}
              disabled={loading}
              className={cn(
                'flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg transition-colors',
                loading
                  ? 'opacity-50 cursor-wait bg-transparent'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700'
              )}
            >
              <Save className="h-4 w-4" />
              Save Draft
            </button>

            {currentStepIndex < steps.length - 1 ? (
              <button
                onClick={goToNextStep}
                disabled={loading}
                className={cn(
                  'px-6 py-2 text-white rounded-lg transition-colors font-medium',
                  loading
                    ? 'bg-primary-400 cursor-wait'
                    : 'bg-primary-600 hover:bg-primary-700'
                )}
              >
                Next →
              </button>
            ) : (
              <button
                onClick={handleSchedule}
                disabled={loading || !newsletter.scheduled_for}
                className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Scheduling...
                  </>
                ) : (
                  <>
                    <Clock className="h-4 w-4" />
                    Schedule Newsletter
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

