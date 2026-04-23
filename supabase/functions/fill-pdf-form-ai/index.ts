import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { PDFDocument } from 'npm:pdf-lib@1.17.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FillPDFRequest {
  formType: 'G-1145' | 'I-765'
  data: {
    firstName?: string
    middleName?: string
    lastName?: string
    email?: string
    mobileNumber?: string
    address?: string
    houseNumber?: string
    streetName?: string
    city?: string
    province?: string
    zipcode?: string
    country?: string
    dateOfBirth?: string
    countryOfBirth?: string
    gender?: string
    maritalStatus?: string
    singleName?: string
    singleFullName?: string
    spouseName?: string
    spouseFirstName?: string
    spouseMiddleName?: string
    spouseLastName?: string
    [key: string]: any
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { formType, data }: FillPDFRequest = await req.json()

    console.log(`AI-powered filling of ${formType} form with data:`, JSON.stringify(data, null, 2))

    // Get OpenAI API key from environment
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured')
    }

    // Fetch the PDF template from Supabase Storage (USCIS Forms bucket)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration not found')
    }

    const formFileName = formType === 'G-1145' ? 'g-1145.pdf' : 'i-765.pdf'
    // Use the public storage endpoint with service role key for authentication
    const bucketName = 'USCIS Forms'
    const storageUrl = `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(bucketName)}/${formFileName}`
    
    console.log(`Fetching template from Supabase Storage: ${storageUrl}`)
    
    // Try public access first (if bucket is public)
    let templateResponse = await fetch(storageUrl)
    
    // If public access fails, try authenticated access
    if (!templateResponse.ok) {
      console.log('Public access failed, trying authenticated access...')
      const authenticatedUrl = `${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucketName)}/${formFileName}`
      templateResponse = await fetch(authenticatedUrl, {
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'apikey': supabaseServiceKey,
        }
      })
    }
    
    if (!templateResponse.ok) {
      const errorText = await templateResponse.text().catch(() => 'Unknown error')
      console.error('Storage fetch error:', errorText)
      throw new Error(`Failed to fetch template from Supabase Storage: ${templateResponse.statusText} - ${errorText}`)
    }

    const templateBytes = await templateResponse.arrayBuffer()
    console.log(`Template fetched from Supabase Storage, size: ${templateBytes.byteLength} bytes`)

    // Load the PDF
    let pdfDoc: PDFDocument
    try {
      pdfDoc = await PDFDocument.load(templateBytes, {
        ignoreEncryption: true,
        updateMetadata: false,
      })
      console.log('PDF loaded successfully')
    } catch (loadError) {
      console.error('Failed to load PDF:', loadError)
      throw new Error('Failed to load PDF template')
    }

    // Get form fields
    let form
    let fields: any[] = []
    let fieldNames: string[] = []
    
    try {
      form = pdfDoc.getForm()
      fields = form.getFields()
      fieldNames = fields.map(f => f.getName())
      
      console.log(`Form has ${fieldNames.length} fields:`, fieldNames)
    } catch (formError) {
      console.error('Error accessing form fields:', formError)
      throw new Error('PDF has no fillable fields or cannot be parsed')
    }

    if (fieldNames.length === 0) {
      throw new Error('PDF has no fillable fields')
    }

    // Use OpenAI to intelligently map data to fields
    console.log('Calling OpenAI API for intelligent field mapping...')
    
    const systemPrompt = `You are an expert at filling out USCIS immigration forms. Given a list of PDF form field names and applicant data, you need to map the data to the correct fields.

CRITICAL RULES:
1. Only use field names that exist in the provided list
2. Format data appropriately for each field type
3. Use standard USCIS format conventions
4. If a field name is unclear, make your best educated guess based on common USCIS form patterns
5. Leave fields empty if you're not confident about the mapping
6. For dates, use MM/DD/YYYY format
7. For phone numbers, use (XXX) XXX-XXXX format if possible
8. Return your response as a JSON object mapping field names to values`

    const userPrompt = `Form Type: ${formType}

Available PDF Fields:
${fieldNames.map((name, idx) => `${idx + 1}. "${name}"`).join('\n')}

Applicant Data:
${JSON.stringify(data, null, 2)}

Please map the applicant data to the correct PDF fields. Return ONLY a JSON object where keys are exact field names from the list above and values are the data to fill in. Do not include any explanations or markdown formatting.`

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      }),
    })

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text()
      console.error('OpenAI API error:', errorText)
      throw new Error(`OpenAI API failed: ${openaiResponse.statusText}`)
    }

    const openaiData = await openaiResponse.json()
    const aiResponse = openaiData.choices[0].message.content
    console.log('AI Response:', aiResponse)

    // Parse AI response
    let fieldMapping: { [key: string]: string }
    try {
      fieldMapping = JSON.parse(aiResponse)
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError)
      throw new Error('AI returned invalid response format')
    }

    console.log('Field Mapping:', JSON.stringify(fieldMapping, null, 2))

    // Fill the form fields using AI mapping
    let filledCount = 0
    for (const [fieldName, value] of Object.entries(fieldMapping)) {
      if (!value || value.trim() === '') continue
      
      try {
        // Verify field exists
        if (!fieldNames.includes(fieldName)) {
          console.warn(`Field "${fieldName}" not found in PDF, skipping`)
          continue
        }

        const field = form.getTextField(fieldName)
        field.setText(String(value))
        filledCount++
        console.log(`✓ Filled "${fieldName}" with "${value}"`)
      } catch (e) {
        console.warn(`Failed to fill "${fieldName}":`, e)
      }
    }

    console.log(`Successfully filled ${filledCount} out of ${Object.keys(fieldMapping).length} mapped fields`)

    if (filledCount === 0) {
      throw new Error('AI could not map any fields successfully')
    }

    // Don't flatten the form - keep it editable
    console.log('Keeping form fields editable (not flattening)')

    // Save the filled PDF
    try {
      const pdfBytes = await pdfDoc.save({
        useObjectStreams: false,
        addDefaultPage: false,
      })
      
      console.log(`Saved AI-filled PDF, size: ${pdfBytes.byteLength} bytes`)

      // Create filename with client name and date
      const clientName = `${data.firstName || ''}_${data.lastName || ''}`.replace(/[^a-zA-Z0-9_]/g, '_')
      const dateStr = new Date().toISOString().split('T')[0]
      const fileName = `${formType}_${clientName}_${dateStr}_AI_Filled.pdf`

      return new Response(pdfBytes, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${fileName}"`,
        },
      })
    } catch (saveError: any) {
      console.error('Error saving PDF:', saveError?.message || saveError)
      throw new Error('Failed to save filled PDF')
    }
  } catch (error: any) {
    console.error('Error:', error?.message || error)
    return new Response(
      JSON.stringify({ 
        error: error?.message || 'Unknown error',
        details: error?.stack || ''
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

