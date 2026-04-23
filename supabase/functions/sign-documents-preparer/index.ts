import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { PDFDocument } from 'npm:pdf-lib@1.17.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface SignPreparerDocumentsRequest {
  clientSignedPdf: string // Base64 encoded client-signed PDF
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

// Add signature to I-765 page 6 (Preparer's signature section)
async function signI765Preparer(
  pdfDoc: PDFDocument,
  signatureImage: any
): Promise<void> {
  const pages = pdfDoc.getPages()
  
  // Find I-765 page 6 (Preparer section)
  // I-765 is typically multi-page, and page 6 is usually around page 9-10 of compiled document
  // Structure: Cover Letter (1) + G-1145 (1) + Money Order (1) + I-765 pages (6+) = page 9+ for preparer section
  let preparerPageIndex = -1
  
  // Try to find I-765 page 6 by checking pages
  // Preparer section is typically on the last page of I-765 form
  for (let i = Math.min(pages.length - 1, 15); i >= 8; i--) {
    const page = pages[i]
    const { width, height } = page.getSize()
    
    // I-765 pages are typically letter size (612x792)
    if (Math.abs(width - 612) < 10 && Math.abs(height - 792) < 10) {
      // This could be the preparer page, typically one of the last I-765 pages
      preparerPageIndex = i
      break
    }
  }
  
  // Fallback: if we couldn't find it, use the last page or page 9 (index 8)
  if (preparerPageIndex === -1) {
    if (pages.length >= 9) {
      preparerPageIndex = 8 // Page 9 (0-indexed)
    } else if (pages.length > 0) {
      preparerPageIndex = pages.length - 1 // Last page
    } else {
      throw new Error('PDF does not have enough pages for preparer signature')
    }
  }

  const page = pages[preparerPageIndex]
  const { width, height } = page.getSize()

  // Approximate coordinates for I-765 page 6 preparer signature fields
  // 8.a. Preparer's Signature - typically around bottom left area
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
    const { clientSignedPdf, signatureDataUrl }: SignPreparerDocumentsRequest = await req.json()

    if (!clientSignedPdf || !signatureDataUrl) {
      return new Response(
        JSON.stringify({ error: 'clientSignedPdf and signatureDataUrl are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log('Starting preparer document signing...')

    // Convert base64 PDF to Uint8Array
    const pdfBytes = Uint8Array.from(atob(clientSignedPdf), c => c.charCodeAt(0))
    
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

    // Sign I-765 page 6 (preparer signature)
    console.log('Signing I-765 preparer section...')
    await signI765Preparer(pdfDoc, signatureImage)

    // Save the signed PDF
    console.log('Saving signed PDF...')
    const signedPdfBytes = await pdfDoc.save()
    const arrayBuffer = new ArrayBuffer(signedPdfBytes.length)
    new Uint8Array(arrayBuffer).set(signedPdfBytes)

    // Convert to base64 for response
    const base64 = btoa(
      String.fromCharCode(...new Uint8Array(arrayBuffer))
    )

    console.log('Preparer document signing completed successfully')

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
    console.error('Error signing preparer documents:', error)
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

