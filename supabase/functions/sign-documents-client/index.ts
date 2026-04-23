import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { PDFDocument } from 'npm:pdf-lib@1.17.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface SignClientDocumentsRequest {
  compiledPdf: string // Base64 encoded compiled PDF
  signatureDataUrl: string // Data URL of signature image (data:image/png;base64,...)
}

// Convert data URL to Uint8Array
function dataURLToUint8Array(dataURL: string): Uint8Array {
  const base64 = dataURL.includes(',') ? dataURL.split(',')[1] : dataURL
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

// Add signature to cover letter (first page)
async function signCoverLetter(
  pdfDoc: PDFDocument,
  signatureImage: any
): Promise<void> {
  const pages = pdfDoc.getPages()
  if (pages.length < 1) {
    throw new Error('PDF does not have pages')
  }

  const page = pages[0] // First page
  const { width, height } = page.getSize()

  // Place signature at bottom of cover letter
  const signatureX = width * 0.1 // 10% from left
  const signatureY = height * 0.1 // 10% from bottom
  const signatureWidth = width * 0.3 // 30% of page width
  const signatureHeight = signatureWidth * 0.25 // Maintain aspect ratio

  page.drawImage(signatureImage, {
    x: signatureX,
    y: signatureY,
    width: signatureWidth,
    height: signatureHeight,
  })
}

// Add signature to I-765 page 4 (Applicant's signature section)
async function signI765Applicant(
  pdfDoc: PDFDocument,
  signatureImage: any
): Promise<void> {
  const pages = pdfDoc.getPages()
  
  // Find I-765 form (usually after cover letter, G-1145, money order)
  // I-765 is typically around page 4-5 of the compiled document
  // We'll search for a page that looks like I-765 (has form fields or specific dimensions)
  let i765PageIndex = -1
  
  // Try to find I-765 by checking page count and structure
  // Typically: Cover Letter (1) + G-1145 (1) + Money Order (1) + I-765 starts around page 4
  // But I-765 itself is multi-page, so we look for page 4 of I-765 which is around page 7-8 of compiled doc
  // For safety, we'll check pages starting from index 3 (4th page)
  for (let i = 3; i < Math.min(pages.length, 10); i++) {
    const page = pages[i]
    const { width, height } = page.getSize()
    
    // I-765 pages are typically letter size (612x792)
    if (Math.abs(width - 612) < 10 && Math.abs(height - 792) < 10) {
      // This could be an I-765 page, check if it's page 4 of I-765
      // We'll use a heuristic: if we're around page 7-8 of compiled doc, it's likely I-765 page 4
      if (i >= 6 && i <= 8) {
        i765PageIndex = i
        break
      }
    }
  }
  
  // Fallback: if we couldn't find it, use page 7 (index 6) as default
  if (i765PageIndex === -1) {
    if (pages.length >= 7) {
      i765PageIndex = 6 // Page 7 (0-indexed)
    } else {
      console.warn('Could not find I-765 page 4, skipping applicant signature')
      return
    }
  }

  const page = pages[i765PageIndex]
  const { width, height } = page.getSize()

  // Approximate coordinates for I-765 page 4 signature fields
  // 7.a. Applicant's Signature - typically around bottom left area
  const signatureX = width * 0.1 // 10% from left
  const signatureY = height * 0.15 // 15% from bottom
  const signatureWidth = width * 0.35 // 35% of page width
  const signatureHeight = signatureWidth * 0.2 // Maintain aspect ratio

  page.drawImage(signatureImage, {
    x: signatureX,
    y: signatureY,
    width: signatureWidth,
    height: signatureHeight,
  })
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { compiledPdf, signatureDataUrl }: SignClientDocumentsRequest = await req.json()

    if (!compiledPdf || !signatureDataUrl) {
      return new Response(
        JSON.stringify({ error: 'compiledPdf and signatureDataUrl are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log('Starting client document signing...')

    // Convert base64 PDF to Uint8Array
    const pdfBytes = Uint8Array.from(atob(compiledPdf), c => c.charCodeAt(0))
    
    // Load PDF
    const pdfDoc = await PDFDocument.load(pdfBytes, {
      ignoreEncryption: true,
      updateMetadata: false,
    })

    // Convert signature data URL to image
    const signatureBytes = dataURLToUint8Array(signatureDataUrl)
    let signatureImage
    try {
      signatureImage = await pdfDoc.embedPng(signatureBytes)
    } catch {
      // Try JPG if PNG fails
      signatureImage = await pdfDoc.embedJpg(signatureBytes)
    }

    // Sign cover letter (first page)
    console.log('Signing cover letter...')
    await signCoverLetter(pdfDoc, signatureImage)

    // Sign I-765 page 4 (applicant signature)
    console.log('Signing I-765 applicant section...')
    await signI765Applicant(pdfDoc, signatureImage)

    // Save the signed PDF
    console.log('Saving signed PDF...')
    const signedPdfBytes = await pdfDoc.save()
    const arrayBuffer = new ArrayBuffer(signedPdfBytes.length)
    new Uint8Array(arrayBuffer).set(signedPdfBytes)

    // Convert to base64 for response
    const base64 = btoa(
      String.fromCharCode(...new Uint8Array(arrayBuffer))
    )

    console.log('Client document signing completed successfully')

    return new Response(
      JSON.stringify({
        success: true,
        pdf: base64,
        message: 'Documents signed successfully',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error signing client documents:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to sign documents',
        details: error instanceof Error ? error.stack : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

