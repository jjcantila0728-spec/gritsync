import { serve } from 'https://deno.land/std@0.181.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface BuilderRequest {
  prompt: string
  focus?: string
  topics?: string[]
  template?: 'professional' | 'modern' | 'minimal'
}

interface BuilderResponse {
  html: string
  subject: string
  preheader: string
  focus: string
  topicsSummary: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const payload: BuilderRequest = await req.json()
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      throw new Error('OPENAI_API_KEY is not configured in Supabase secrets.')
    }

    const topics = (payload.topics || []).slice(0, 5)
    const topicsList = topics.length > 0 ? topics.map((t) => `- ${t}`).join('\n') : '- General MVP updates'
    const effectiveFocus = payload.focus?.trim() || 'Community, care, and platform momentum'
    const systemPrompt = `
You are an email designer who builds MVP-ready HTML newsletters for a healthcare staffing brand. 
Respond with JSON only. The JSON must include the following keys: html, subject, preheader, focus, topicsSummary.
Do not wrap the output in markdown or quotes. Make sure the html is complete enough to render inside an email preview.
`
    const userPrompt = `
Prompt:
${payload.prompt || 'Share our latest MVP newsletter.'}

Focus:
${effectiveFocus}

Topics:
${topicsList}

Style Type:
${payload.template || 'professional'}

Return an engaging subject, a compelling preheader, and a polished hero+sectioned HTML email. Keep code compatible with major email clients (inline styles, tables are acceptable but not required). Use the focus sentence and topic bullets inside the body.`

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.0',
        temperature: 0.25,
        messages: [
          { role: 'system', content: systemPrompt.trim() },
          { role: 'user', content: userPrompt.trim() },
        ],
        max_tokens: 1500,
      }),
    })

    if (!openaiResponse.ok) {
      const message = await openaiResponse.text().catch(() => 'Unknown error')
      throw new Error(`OpenAI API error: ${openaiResponse.status} ${message}`)
    }

    const data = await openaiResponse.json()
    const content = data?.choices?.[0]?.message?.content
    if (!content) {
      throw new Error('OpenAI returned an empty response.')
    }

    let json: BuilderResponse
    try {
      json = typeof content === 'string' ? JSON.parse(content) : content
    } catch (error) {
      console.error('Failed to parse AI response:', content)
      throw new Error('AI response could not be parsed as JSON.')
    }

    if (!json.html) {
      throw new Error('AI response is missing html content.')
    }

    return new Response(JSON.stringify({
      html: json.html,
      subject: json.subject || 'Nurses at GritSync Update',
      preheader: json.preheader || effectiveFocus,
      focus: json.focus || effectiveFocus,
      topicsSummary: json.topicsSummary || (topics.length ? topics.join(', ') : 'General MVP updates'),
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    })
  } catch (error: any) {
    const message = error?.message || 'Unknown error'
    console.error('AI Newsletter Builder error:', message)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

