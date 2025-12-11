import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_URL = 'https://api.resend.com'

interface InboxListOptions {
  limit?: number
  after?: string
  before?: string
}

interface InboxRequestBody {
  action?: 'list'
  options?: InboxListOptions
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

    if (action === 'list') {
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

      const params = new URLSearchParams()
      const options = body.options || {}

      if (options.limit) {
        params.append('limit', options.limit.toString())
      }
      if (options.after) {
        params.append('after', options.after)
      }
      if (options.before) {
        params.append('before', options.before)
      }

      const queryString = params.toString()
      const url = `${RESEND_API_URL}/emails/receiving${queryString ? `?${queryString}` : ''}`

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

      return new Response(JSON.stringify(data), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      })
    }

    // Delete received email
    if (action === 'delete') {
      const emailId = (body as any).emailId
      
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

      const apiKey = await getResendApiKey(supabaseClient)

      if (!apiKey) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Resend API key not configured',
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

      const url = `${RESEND_API_URL}/emails/${emailId}`

      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const text = await response.text()
        console.error('Resend delete API error:', {
          status: response.status,
          statusText: response.statusText,
          body: text,
        })

        return new Response(
          JSON.stringify({
            success: false,
            error: 'Failed to delete email from Resend',
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

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Email deleted successfully',
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


