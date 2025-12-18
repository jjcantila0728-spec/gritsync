/**
 * EmailPreview - Shared component for rendering sanitized HTML email content
 * Used across admin inbox, client inbox, and compose modal
 * Uses iframe with srcDoc (like EmailTemplatesManager) to properly render email HTML with styles
 */

import { sanitizeHTML } from '@/lib/utils'
import { Mail } from 'lucide-react'

interface EmailPreviewProps {
  html?: string
  text?: string
  className?: string
  emptyMessage?: string
}

export function EmailPreview({ 
  html, 
  text, 
  className = '', 
  emptyMessage = 'No content available'
}: EmailPreviewProps) {
  // Prioritize HTML content, fallback to text
  const content = html || text

  if (!content) {
    return (
      <div className={`flex flex-col items-center justify-center h-full text-center p-6 ${className}`}>
        <Mail className="h-16 w-16 text-gray-300 dark:text-gray-600 mb-4" />
        <p className="text-gray-500 dark:text-gray-400 text-sm">{emptyMessage}</p>
      </div>
    )
  }

  // If we have HTML, render it in an iframe with srcDoc (like EmailTemplatesManager does)
  // This ensures all styles are preserved and rendered correctly
  if (html) {
    // Sanitize HTML with email template mode to preserve styles
    const sanitized = sanitizeHTML(html, { allowEmailTemplates: true })
    
    // Wrap in a proper HTML document structure for iframe rendering
    const htmlDocument = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body {
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      }
      * {
        box-sizing: border-box;
      }
    </style>
  </head>
  <body>
    ${sanitized}
  </body>
</html>`

    return (
      <div className={`overflow-auto ${className}`} style={{ position: 'relative', width: '100%', height: '100%' }}>
        <iframe
          srcDoc={htmlDocument}
          className="w-full h-full border-0"
          style={{
            minHeight: '400px',
            backgroundColor: '#ffffff'
          }}
          title="Email Preview"
          sandbox="allow-same-origin"
        />
      </div>
    )
  }

  // Otherwise render plain text with whitespace preserved
  return (
    <div className={`whitespace-pre-wrap text-gray-900 dark:text-gray-100 overflow-auto ${className}`}>
      {text}
    </div>
  )
}

