import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1'

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
    city?: string
    province?: string
    zipcode?: string
    country?: string
    dateOfBirth?: string
    countryOfBirth?: string
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { formType, data }: FillPDFRequest = await req.json()

    console.log(`Filling ${formType} form with data:`, data)

    // Fetch the official PDF template from Supabase Storage or public URL
    const templateUrl = formType === 'G-1145' 
      ? 'https://www.uscis.gov/sites/default/files/document/forms/g-1145.pdf'
      : 'https://www.uscis.gov/sites/default/files/document/forms/i-765.pdf'
    
    console.log(`Fetching template from: ${templateUrl}`)
    const templateResponse = await fetch(templateUrl)
    
    if (!templateResponse.ok) {
      throw new Error(`Failed to fetch template: ${templateResponse.statusText}`)
    }

    const templateBytes = await templateResponse.arrayBuffer()
    console.log(`Template fetched, size: ${templateBytes.byteLength} bytes`)

    let pdfDoc: PDFDocument
    try {
      // Try to load the PDF with error handling options
      pdfDoc = await PDFDocument.load(templateBytes, {
        ignoreEncryption: true,
        updateMetadata: false,
      })
      console.log('PDF loaded successfully')
    } catch (loadError) {
      console.error('Failed to load PDF:', loadError)
      // Return the original template if we can't parse it
      return new Response(templateBytes, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${formType}.pdf"`,
        },
      })
    }

    // Try to fill form fields
    let filledAnyField = false
    let hasFormFields = false
    
    try {
      const form = pdfDoc.getForm()
      const fields = form.getFields()
      const fieldNames = fields.map(f => f.getName())
      
      console.log(`Form has ${fieldNames.length} fields:`, fieldNames)
      
      if (fieldNames.length > 0) {
        hasFormFields = true
        
        // Helper function to fill fields
        const fillField = (patterns: string[], value: string | undefined): boolean => {
          if (!value) return false
          
          // Try exact match first
          let fieldName = fieldNames.find(name => patterns.includes(name))
          
          // Then try partial match
          if (!fieldName) {
            fieldName = fieldNames.find(name => {
              const lower = name.toLowerCase()
              return patterns.some(p => lower.includes(p.toLowerCase()))
            })
          }

          if (fieldName) {
            try {
              const field = form.getTextField(fieldName)
              field.setText(value)
              console.log(`✓ Filled "${fieldName}" with "${value}"`)
              return true
            } catch (e) {
              console.warn(`Failed to fill "${fieldName}":`, e)
              return false
            }
          }
          return false
        }

        // Fill fields based on form type
        if (formType === 'G-1145') {
          filledAnyField = fillField(['Applicant/Petitioner Full First Name', 'first', 'firstname'], data.firstName) ||
                          fillField(['Applicant/Petitioner Full Middle Name', 'middle', 'middlename'], data.middleName) ||
                          fillField(['Applicant/Petitioner Full Last Name', 'last', 'lastname'], data.lastName) ||
                          fillField(['Email Address', 'email'], data.email) ||
                          fillField(['Mobile Phone Number', 'mobile', 'phone'], data.mobileNumber) ||
                          filledAnyField
        } else if (formType === 'I-765') {
          filledAnyField = fillField(['first', 'firstname', 'given'], data.firstName) ||
                          fillField(['middle', 'middlename'], data.middleName) ||
                          fillField(['last', 'lastname', 'family'], data.lastName) ||
                          fillField(['email', 'e-mail'], data.email) ||
                          fillField(['phone', 'mobile', 'telephone'], data.mobileNumber) ||
                          fillField(['address', 'street'], data.address) ||
                          fillField(['city'], data.city) ||
                          fillField(['state', 'province'], data.province) ||
                          fillField(['zip', 'postal'], data.zipcode) ||
                          fillField(['birth', 'dob'], data.dateOfBirth) ||
                          fillField(['country', 'birth'], data.countryOfBirth) ||
                          filledAnyField
        }

        // Skip flattening for G-1145 as it can cause PDF corruption
        // The form will remain editable but will display filled values
        if (filledAnyField) {
          if (formType === 'I-765') {
            // Only try to flatten for I-765
            try {
              form.flatten()
              console.log('Form flattened successfully')
            } catch (flattenError: any) {
              console.warn('Could not flatten form, continuing without flattening:', flattenError?.message || flattenError)
            }
          } else {
            console.log('Skipping form flattening for', formType, 'to avoid corruption')
          }
        } else {
          console.warn('No fields were filled - field names may not match expected patterns')
        }
      } else {
        console.warn('PDF has no fillable fields')
      }
    } catch (formError: any) {
      console.error('Error accessing form fields:', formError?.message || formError)
      // Don't throw - we'll try text overlay fallback
      hasFormFields = false
    }

    // For G-1145, if no fields were filled, just return the original template
    // The G-1145 form structure may be causing corruption issues with pdf-lib
    if (!filledAnyField && formType === 'G-1145') {
      console.log('No fields were filled for G-1145 - returning original template to avoid corruption')
      return new Response(templateBytes, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${formType}.pdf"`,
        },
      })
    }
    
    // For I-765 or if fields were filled, try text overlays as fallback
    if (!filledAnyField && formType === 'I-765') {
      console.log('No fields were filled - attempting text overlay fallback')
      try {
        const pages = pdfDoc.getPages()
        if (pages.length > 0) {
          const firstPage = pages[0]
          const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
          const fontSize = 11
          const textColor = rgb(0, 0, 0)

          // Add basic text overlays
          if (data.lastName && data.firstName) {
            const fullName = `${data.firstName} ${data.middleName || ''} ${data.lastName}`.trim()
            firstPage.drawText(fullName, { x: 100, y: 700, font, size: fontSize, color: textColor })
          }
          
          console.log('Text overlays added successfully')
          filledAnyField = true
        }
      } catch (overlayError: any) {
        console.error('Error adding text overlays:', overlayError?.message || overlayError)
      }
    }

    // Save and return the filled PDF
    try {
      // Try with basic options first for maximum compatibility
      const pdfBytes = await pdfDoc.save({
        useObjectStreams: false,
        addDefaultPage: false,
      })
      
      console.log(`Saved PDF, size: ${pdfBytes.byteLength} bytes`)

      // Verify the PDF is valid by checking size
      if (pdfBytes.byteLength < 1000 && formType === 'G-1145') {
        console.warn('PDF size suspiciously small, returning original template')
        return new Response(templateBytes, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${formType}.pdf"`,
          },
        })
      }

      return new Response(pdfBytes, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${formType}-filled.pdf"`,
        },
      })
    } catch (saveError: any) {
      console.error('Error saving PDF with options:', saveError?.message || saveError)
      
      // For G-1145, immediately return original template on save error
      if (formType === 'G-1145') {
        console.log('Save failed for G-1145, returning original template')
        return new Response(templateBytes, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${formType}.pdf"`,
          },
        })
      }
      
      // For other forms, try minimal save
      try {
        const pdfBytes = await pdfDoc.save()
        console.log(`Saved PDF with minimal options, size: ${pdfBytes.byteLength} bytes`)

        return new Response(pdfBytes, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${formType}-filled.pdf"`,
          },
        })
      } catch (fallbackError: any) {
        console.error('Both save attempts failed, returning original template')
        return new Response(templateBytes, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${formType}-original.pdf"`,
          },
        })
      }
    }
  } catch (error: any) {
    console.error('Error:', error?.message || error)
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

