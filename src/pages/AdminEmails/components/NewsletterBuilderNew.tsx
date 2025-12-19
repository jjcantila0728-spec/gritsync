import { useState } from 'react'
import { 
  Wand2, 
  Send,
  Eye,
  Loader2,
  Mail,
  Users,
  Image as ImageIcon,
  FileText,
  Check
} from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { cn } from '@/lib/utils'

interface NewsletterBuilderNewProps {
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void
  onClose?: () => void
  onSuccess?: () => void
}

interface NewsletterSection {
  heading: string
  content: string
  imagePrompt?: string
  imageBase64?: string
}

interface GeneratedNewsletter {
  subject: string
  preheader: string
  sections: NewsletterSection[]
  html: string
}

export function NewsletterBuilderNew({ showToast, onClose, onSuccess }: NewsletterBuilderNewProps) {
  const [topic, setTopic] = useState('')
  const [additionalContext, setAdditionalContext] = useState('')
  const [generateImages, setGenerateImages] = useState(true)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [newsletter, setNewsletter] = useState<GeneratedNewsletter | null>(null)
  const [sendToAll, setSendToAll] = useState(true)
  const [customEmails, setCustomEmails] = useState('')
  const [showPreview, setShowPreview] = useState(false)

  const handleGenerate = async () => {
    if (!topic.trim()) {
      showToast('Please enter a topic for the newsletter', 'warning')
      return
    }

    setLoading(true)
    try {
      const result = await apiClient.post<GeneratedNewsletter>('/newsletter-generator/generate', {
        topic: topic.trim(),
        additionalContext: additionalContext.trim() || undefined,
        generateImages
      })
      
      setNewsletter(result)
      setShowPreview(true)
      showToast('Newsletter generated successfully!', 'success')
    } catch (error: any) {
      console.error('Newsletter generation error:', error)
      showToast(error.message || 'Failed to generate newsletter', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handlePreviewOnly = async () => {
    if (!topic.trim()) {
      showToast('Please enter a topic for the newsletter', 'warning')
      return
    }

    setLoading(true)
    try {
      const result = await apiClient.post<GeneratedNewsletter>('/newsletter-generator/preview', {
        topic: topic.trim(),
        additionalContext: additionalContext.trim() || undefined
      })
      
      setNewsletter(result)
      setShowPreview(true)
      showToast('Preview generated (no images)', 'success')
    } catch (error: any) {
      console.error('Preview generation error:', error)
      showToast(error.message || 'Failed to generate preview', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSend = async () => {
    if (!newsletter) {
      showToast('Please generate a newsletter first', 'warning')
      return
    }

    setSending(true)
    try {
      const recipientEmails = sendToAll 
        ? undefined 
        : customEmails.split(/[,;\n]/).map(e => e.trim()).filter(e => e)

      const result = await apiClient.post<{ message: string; sent: number; failed: number }>('/newsletter-generator/send', {
        subject: newsletter.subject,
        htmlContent: newsletter.html,
        sendToAll,
        recipientEmails
      })
      
      showToast(result.message, 'success')
      onSuccess?.()
      onClose?.()
    } catch (error: any) {
      console.error('Newsletter send error:', error)
      showToast(error.message || 'Failed to send newsletter', 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-red-600 to-red-800 text-white p-6 rounded-lg">
        <div className="flex items-center gap-3 mb-2">
          <Wand2 className="h-8 w-8" />
          <h2 className="text-2xl font-bold">AI Newsletter Generator</h2>
        </div>
        <p className="text-red-100">
          Generate professional newsletters with AI-powered content and images
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-red-600" />
              Newsletter Content
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Topic / Theme <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-red-500"
                  placeholder="e.g., NCLEX Success Tips for December, Holiday Special Offers"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Additional Context (Optional)
                </label>
                <textarea
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-red-500"
                  placeholder="Add specific details, announcements, or focus areas..."
                />
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={generateImages}
                    onChange={(e) => setGenerateImages(e.target.checked)}
                    className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1">
                    <ImageIcon className="h-4 w-4" />
                    Generate AI Images (slower but more engaging)
                  </span>
                </label>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleGenerate}
                  disabled={loading || !topic.trim()}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-white font-medium transition',
                    loading || !topic.trim()
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900'
                  )}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-5 w-5" />
                      Generate Newsletter
                    </>
                  )}
                </button>

                <button
                  onClick={handlePreviewOnly}
                  disabled={loading || !topic.trim()}
                  className={cn(
                    'px-4 py-3 rounded-lg border font-medium transition',
                    loading || !topic.trim()
                      ? 'border-gray-300 text-gray-400 cursor-not-allowed'
                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  )}
                >
                  <Eye className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-red-600" />
              Recipients
            </h3>

            <div className="space-y-4">
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={sendToAll}
                    onChange={() => setSendToAll(true)}
                    className="text-red-600 focus:ring-red-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">All Active Subscribers</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={!sendToAll}
                    onChange={() => setSendToAll(false)}
                    className="text-red-600 focus:ring-red-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Custom List</span>
                </label>
              </div>

              {!sendToAll && (
                <textarea
                  value={customEmails}
                  onChange={(e) => setCustomEmails(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-red-500"
                  placeholder="Enter email addresses (comma or newline separated)"
                />
              )}

              <button
                onClick={handleSend}
                disabled={sending || !newsletter}
                className={cn(
                  'w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-white font-medium transition',
                  sending || !newsletter
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700'
                )}
              >
                {sending ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-5 w-5" />
                    Send Newsletter
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Mail className="h-5 w-5 text-red-600" />
              Preview
            </h3>
            {newsletter && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <Check className="h-4 w-4" />
                Ready to send
              </span>
            )}
          </div>
          
          <div className="h-[600px] overflow-auto">
            {newsletter ? (
              showPreview && newsletter.html ? (
                <iframe
                  srcDoc={newsletter.html}
                  className="w-full h-full border-0"
                  title="Newsletter Preview"
                  sandbox="allow-same-origin"
                />
              ) : (
                <div className="p-6 space-y-4">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Subject</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">{newsletter.subject}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Preheader</p>
                    <p className="text-gray-700 dark:text-gray-300">{newsletter.preheader}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Sections</p>
                    {newsletter.sections.map((section, idx) => (
                      <div key={idx} className="mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <h4 className="font-semibold text-gray-900 dark:text-white">{section.heading}</h4>
                        <div className="text-sm text-gray-600 dark:text-gray-300 mt-2" 
                             dangerouslySetInnerHTML={{ __html: section.content }} />
                      </div>
                    ))}
                  </div>
                </div>
              )
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                <div className="text-center">
                  <Wand2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Generate a newsletter to see preview</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default NewsletterBuilderNew
