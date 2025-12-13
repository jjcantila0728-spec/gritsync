// Declare Deno global for TypeScript
declare const Deno: {
  env: {
    get(key: string): string | undefined
  }
}

// @ts-ignore - Deno URL imports
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore - Deno URL imports
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_URL = 'https://api.resend.com'

interface InboxListOptions {
  limit?: number
  after?: string
  before?: string
  to?: string
}

interface InboxRequestBody {
  action?: 'list' | 'get' | 'delete' | 'list-attachments' | 'get-attachment'
  options?: InboxListOptions
  emailId?: string
  attachmentId?: string
}

async function getResendApiKey(supabaseClient: any): Promise<string> {
  const { data: emailSettings } = await supabaseClient
    .from('settings')
    .select('key, value')
    .in('key', ['resendApiKey'])

  const settingsMap: Record<string, string> = {}
  emailSettings?.forEach((setting: any) => {
    if (setting && typeof setting === 'object' && 'key' in setting && 'value' in setting) {
      // @ts-ignore
      settingsMap[setting.key] = setting.value
    }
  })

  return settingsMap.resendApiKey || Deno.env.get('RESEND_API_KEY') || ''
}

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    )

    let body: InboxRequestBody
    try {
      const raw = await req.json()
      body = (raw || {}) as InboxRequestBody
    } catch {
      body = {}
    }

    const action = body.action || 'list'
    const apiKey = await getResendApiKey(supabaseClient)

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: 'Resend API key not configured',
          message: 'Please configure Resend in Admin Settings > Notifications.',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        },
      )
    }

    /**
     * LIST - List received emails
     * Reference: https://resend.com/docs/api-reference/emails/list-received-emails
     */
    if (action === 'list') {
      const params = new URLSearchParams()
      const options = body.options || {}

      // Validate limit (1-100)
      if (options.limit) {
        const limit = Number(options.limit)
        if (limit < 1 || limit > 100) {
          return new Response(
            JSON.stringify({
              error: 'Limit must be between 1 and 100',
            }),
            {
              status: 400,
              headers: {
                'Content-Type': 'application/json',
                ...corsHeaders,
              },
            },
          )
        }
        params.append('limit', limit.toString())
      }

      // Validate pagination (cannot use both after and before)
      if (options.after && options.before) {
        return new Response(
          JSON.stringify({
            error: 'Cannot use both "after" and "before" parameters',
          }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          },
        )
      }

      if (options.after) {
        params.append('after', options.after)
      }
      if (options.before) {
        params.append('before', options.before)
      }
      if (options.to) {
        params.append('to', options.to)
      }

      const queryString = params.toString()
      const url = `${RESEND_API_URL}/emails/receiving${queryString ? `?${queryString}` : ''}`

      console.log('Fetching from Resend:', { url, queryString })

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      })

      const text = await response.text()

      if (!response.ok) {
        console.error('Resend inbox API error:', {
          status: response.status,
          statusText: response.statusText,
          body: text,
        })

        return new Response(
          JSON.stringify({
            error: 'Failed to fetch received emails from Resend',
            status: response.status,
            statusText: response.statusText,
            details: text,
          }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          },
        )
      }

      let data: unknown
      try {
        data = JSON.parse(text)
      } catch {
        data = text
      }

      // Debug logging
      console.log('Resend LIST Response:', {
        dataType: typeof data,
        hasData: data && typeof data === 'object' && 'data' in data,
        dataLength: data && typeof data === 'object' && 'data' in data && Array.isArray((data as any).data) ? (data as any).data.length : 'N/A',
      })

      return new Response(JSON.stringify(data), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      })
    }

    /**
     * GET - Retrieve a single received email
     * Reference: https://resend.com/docs/api-reference/emails/retrieve-received-email
     */
    if (action === 'get') {
      const emailId = body.emailId
      
      console.log('GET email request received:', { emailId, bodyKeys: Object.keys(body) })
      
      if (!emailId) {
        console.error('Missing emailId in request body:', body)
        return new Response(
          JSON.stringify({
            error: 'Missing emailId parameter',
            received: body,
          }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          },
        )
      }

      // Resend API endpoint for received emails
      // Try the receiving-specific endpoint first
      // Format: GET /emails/receiving/{email_id}
      const url = `${RESEND_API_URL}/emails/receiving/${emailId}`
      
      console.log('Fetching email from Resend:', { url, emailId })

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      })

      const text = await response.text()
      
      console.log('Resend API response:', {
        status: response.status,
        statusText: response.statusText,
        bodyLength: text.length,
      })

      if (!response.ok) {
        console.error('Resend get email API error:', {
          status: response.status,
          statusText: response.statusText,
          body: text,
          emailId,
          url,
        })

        return new Response(
          JSON.stringify({
            error: 'Failed to retrieve email from Resend',
            status: response.status,
            statusText: response.statusText,
            details: text,
            note: 'Resend API may not support retrieving individual received emails by ID. Only sent emails can be retrieved individually.',
          }),
          {
            status: response.status,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          },
        )
      }

      let data: unknown
      try {
        data = JSON.parse(text)
        console.log('Successfully retrieved email:', { emailId, hasHtml: !!(data as any).html, hasText: !!(data as any).text })
      } catch {
        data = text
      }

      return new Response(JSON.stringify(data), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      })
    }

    /**
     * LIST-ATTACHMENTS - List attachments for a received email
     * Reference: https://resend.com/docs/api-reference/emails/list-received-email-attachments
     */
    if (action === 'list-attachments') {
      const emailId = body.emailId
      
      if (!emailId) {
        return new Response(
          JSON.stringify({
            error: 'Missing emailId parameter',
          }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          },
        )
      }

      const url = `${RESEND_API_URL}/emails/receiving/${emailId}/attachments`

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      })

      const text = await response.text()

      if (!response.ok) {
        console.error('Resend list attachments API error:', {
          status: response.status,
          statusText: response.statusText,
          body: text,
        })

        return new Response(
          JSON.stringify({
            error: 'Failed to list attachments from Resend',
            status: response.status,
            statusText: response.statusText,
            details: text,
          }),
          {
            status: response.status,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          },
        )
      }

      let data: unknown
      try {
        data = JSON.parse(text)
      } catch {
        data = text
      }

      return new Response(JSON.stringify(data), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      })
    }

    /**
     * GET-ATTACHMENT - Retrieve attachment content
     * Reference: https://resend.com/docs/api-reference/emails/retrieve-received-email-attachment
     */
    if (action === 'get-attachment') {
      const emailId = body.emailId
      const attachmentId = body.attachmentId
      
      if (!emailId || !attachmentId) {
        return new Response(
          JSON.stringify({
            error: 'Missing emailId or attachmentId parameter',
          }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          },
        )
      }

      // First, get the attachment metadata to get download URL
      const listUrl = `${RESEND_API_URL}/emails/receiving/${emailId}/attachments`
      const listResponse = await fetch(listUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      })

      if (!listResponse.ok) {
        const text = await listResponse.text()
        return new Response(
          JSON.stringify({
            error: 'Failed to get attachment metadata',
            details: text,
          }),
          {
            status: listResponse.status,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          },
        )
      }

      const attachmentsData = await listResponse.json()
      const attachment = attachmentsData.data?.find((a: any) => a.id === attachmentId)

      if (!attachment || !attachment.download_url) {
        return new Response(
          JSON.stringify({
            error: 'Attachment not found or no download URL available',
          }),
          {
            status: 404,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          },
        )
      }

      // Return the download URL for client-side fetching
      return new Response(
        JSON.stringify({
          download_url: attachment.download_url,
          filename: attachment.filename,
          content_type: attachment.content_type,
          size: attachment.size,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        },
      )
    }

    /**
     * DELETE - Delete a received email
     */
    if (action === 'delete') {
      const emailId = body.emailId
      
      if (!emailId) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Missing emailId parameter',
          }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          },
        )
      }

      // NOTE: Resend API does NOT support deleting received emails
      // The DELETE endpoint only works for sent emails, not received ones
      // Instead, we'll return a success response and let the frontend handle local hiding
      
      console.log(`Delete requested for received email: ${emailId}`)
      console.log('Note: Resend API does not support deleting received emails')
      console.log('The email will be hidden locally but remains in Resend inbox')

      // Return success to allow local hiding on frontend
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Email marked for local removal (Resend does not support deleting received emails)',
          note: 'Email is hidden locally but still exists in Resend inbox',
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        },
      )
    }

    return new Response(
      JSON.stringify({
        error: 'Invalid action',
        validActions: ['list', 'get', 'delete', 'list-attachments', 'get-attachment'],
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      },
    )
  } catch (error) {
    console.error('Error in resend-inbox function:', error)
    return new Response(
      JSON.stringify({
        error: (error as Error).message || 'Internal server error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      },
    )
  }
})
