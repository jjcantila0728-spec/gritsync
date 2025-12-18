/**
 * Merge Documents Edge Function
 * 
 * MVP function to merge documents in a specific order and compress the output
 * 
 * Order:
 * 1. cover_letter
 * 2. Form G-1145
 * 3. Money Order
 * 4. Form I-765
 * 5. 2x2picture
 * 6. passport biographical page
 * 7. H-4 visa stamp
 * 8. I-94
 * 9. marriage certificate
 * 10. spouse_i797
 * 11. spouse_i140
 * 12. employer_letter
 * 13. paystub
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { PDFDocument } from 'npm:pdf-lib@1.17.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

// Document order mapping - maps user-friendly names to document_type keys
const DOCUMENT_ORDER = [
  { keys: ['additional_cover_letter', 'cover_letter'], name: 'Cover Letter' },
  { keys: ['additional_g1145', 'g1145'], name: 'Form G-1145' },
  { keys: ['money_order', 'additional_money_order'], name: 'Money Order' },
  { keys: ['additional_i765', 'i765'], name: 'Form I-765' },
  { keys: ['ead_2x2_picture', '2x2picture', 'picture'], name: '2x2 Picture' },
  { keys: ['ead_passport', 'passport'], name: 'Passport Biographical Page' },
  { keys: ['ead_h4_visa'], name: 'H-4 Visa Stamp' },
  { keys: ['ead_i94'], name: 'I-94' },
  { keys: ['ead_marriage_certificate'], name: 'Marriage Certificate' },
  { keys: ['ead_spouse_i797'], name: 'Spouse I-797' },
  { keys: ['ead_spouse_i140'], name: 'Spouse I-140' },
  { keys: ['ead_employer_letter'], name: 'Employer Letter' },
  { keys: ['ead_paystub'], name: 'Paystub' },
]

interface DocumentInfo {
  document_type: string
  file_path: string
  file_name: string
  id: string
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders,
        'Content-Length': '0',
      }
    })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request body
    let body: any = {}
    try {
      body = await req.json()
    } catch (e) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { application_id, user_id } = body

    if (!application_id && !user_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Either application_id or user_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user_id from application if needed
    let targetUserId = user_id
    if (application_id && !user_id) {
      const { data: application, error: appError } = await supabase
        .from('applications')
        .select('user_id')
        .eq('id', application_id)
        .single()

      if (appError || !application) {
        return new Response(
          JSON.stringify({ success: false, error: 'Application not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      targetUserId = application.user_id
    }

    if (!targetUserId) {
      return new Response(
        JSON.stringify({ success: false, error: 'User ID not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[MERGE] Starting document merge for user: ${targetUserId}`)

    // Fetch all user documents
    const { data: allDocuments, error: docsError } = await supabase
      .from('user_documents')
      .select('id, document_type, file_path, file_name, uploaded_at')
      .eq('user_id', targetUserId)

    if (docsError) {
      console.error('[MERGE] Error fetching documents:', docsError)
      return new Response(
        JSON.stringify({ success: false, error: `Failed to fetch documents: ${docsError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!allDocuments || allDocuments.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No documents found for user' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[MERGE] Found ${allDocuments.length} documents`)

    // Create a map of document_type -> document (prefer latest if multiple)
    // Sort by uploaded_at descending to get the most recent version
    const sortedDocs = [...allDocuments].sort((a, b) => {
      const aTime = new Date(a.uploaded_at || 0).getTime()
      const bTime = new Date(b.uploaded_at || 0).getTime()
      return bTime - aTime // Descending order (newest first)
    })
    
    const docMap = new Map<string, DocumentInfo>()
    for (const doc of sortedDocs) {
      // Only add if we don't have this document_type yet (keeps the first/latest one)
      if (!docMap.has(doc.document_type)) {
        docMap.set(doc.document_type, doc as DocumentInfo)
      }
    }

    // Fetch and convert documents in order
    const mergedPdf = await PDFDocument.create()
    const processedDocs: string[] = []
    const skippedDocs: string[] = []

    for (const docConfig of DOCUMENT_ORDER) {
      let foundDoc: DocumentInfo | null = null

      // Try each key variant
      for (const key of docConfig.keys) {
        const doc = docMap.get(key)
        if (doc) {
          foundDoc = doc
          break
        }
      }

      if (!foundDoc) {
        console.log(`[MERGE] Skipping ${docConfig.name} - not found`)
        skippedDocs.push(docConfig.name)
        continue
      }

      try {
        console.log(`[MERGE] Processing ${docConfig.name} (${foundDoc.document_type})`)

        // Fetch file from storage
        const { data: fileData, error: fetchError } = await supabase.storage
          .from('documents')
          .download(foundDoc.file_path)

        if (fetchError || !fileData) {
          console.error(`[MERGE] Failed to fetch ${docConfig.name}:`, fetchError)
          skippedDocs.push(docConfig.name)
          continue
        }

        const fileBytes = new Uint8Array(await fileData.arrayBuffer())
        const fileExtension = foundDoc.file_name.split('.').pop()?.toLowerCase() || ''

        // Check if it's a PDF or image
        let pdfBytes: Uint8Array

        if (fileExtension === 'pdf' || fileBytes[0] === 0x25 && fileBytes[1] === 0x50 && fileBytes[2] === 0x44 && fileBytes[3] === 0x46) {
          // It's a PDF
          try {
            const sourcePdf = await PDFDocument.load(fileBytes, {
              ignoreEncryption: true,
              updateMetadata: false,
            })
            const pages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices())
            pages.forEach((page) => mergedPdf.addPage(page))
            processedDocs.push(docConfig.name)
            console.log(`[MERGE] ✓ Added ${docConfig.name} (${pages.length} pages)`)
          } catch (pdfError) {
            console.error(`[MERGE] Failed to load PDF ${docConfig.name}:`, pdfError)
            skippedDocs.push(docConfig.name)
            continue
          }
        } else {
          // It's an image - convert to PDF first
          try {
            const imagePdf = await PDFDocument.create()
            let image

            // Try JPEG first
            try {
              image = await imagePdf.embedJpg(fileBytes)
            } catch {
              // Try PNG
              try {
                image = await imagePdf.embedPng(fileBytes)
              } catch {
                console.error(`[MERGE] Unsupported image format for ${docConfig.name}`)
                skippedDocs.push(docConfig.name)
                continue
              }
            }

            // Create page and add image
            const page = imagePdf.addPage([612, 792]) // Letter size
            const { width, height } = image.scale(1)
            const pageWidth = 612
            const pageHeight = 792

            // Scale to fit page while maintaining aspect ratio
            const scale = Math.min(pageWidth / width, pageHeight / height)
            const scaledWidth = width * scale
            const scaledHeight = height * scale
            const x = (pageWidth - scaledWidth) / 2
            const y = (pageHeight - scaledHeight) / 2

            page.drawImage(image, {
              x,
              y,
              width: scaledWidth,
              height: scaledHeight,
            })

            // Save image PDF with compression
            const imagePdfBytes = await imagePdf.save({
              useObjectStreams: false,
              addDefaultPage: false,
            })
            const imagePdfDoc = await PDFDocument.load(imagePdfBytes, {
              ignoreEncryption: true,
              updateMetadata: false,
            })
            const pages = await mergedPdf.copyPages(imagePdfDoc, imagePdfDoc.getPageIndices())
            pages.forEach((page) => mergedPdf.addPage(page))
            processedDocs.push(docConfig.name)
            console.log(`[MERGE] ✓ Added ${docConfig.name} (converted from image)`)
          } catch (imageError) {
            console.error(`[MERGE] Failed to process image ${docConfig.name}:`, imageError)
            skippedDocs.push(docConfig.name)
            continue
          }
        }
      } catch (error) {
        console.error(`[MERGE] Error processing ${docConfig.name}:`, error)
        skippedDocs.push(docConfig.name)
        continue
      }
    }

    if (processedDocs.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No documents could be processed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[MERGE] Processed ${processedDocs.length} documents, skipped ${skippedDocs.length}`)

    // Generate merged PDF with compression
    console.log('[MERGE] Generating merged PDF...')
    const mergedPdfBytes = await mergedPdf.save({
      useObjectStreams: false,
      addDefaultPage: false,
    })

    const originalSizeMB = mergedPdfBytes.length / 1024 / 1024
    console.log(`[MERGE] Original merged PDF size: ${originalSizeMB.toFixed(2)}MB`)

    // Compress/optimize the PDF by re-saving with optimization
    // This helps remove redundant objects and can reduce file size
    console.log('[MERGE] Compressing PDF...')
    let finalBytes: Uint8Array
    let finalSizeMB: number
    
    try {
      // Load the PDF for optimization
      const optimizedPdf = await PDFDocument.load(mergedPdfBytes, {
        ignoreEncryption: true,
        updateMetadata: false,
        updateDocDates: false,
      })
      
      // Re-save with compression options
      // Multiple passes can help reduce size further
      let currentBytes = mergedPdfBytes
      let bestBytes = mergedPdfBytes
      let bestSize = mergedPdfBytes.length
      
      // Try multiple optimization passes
      for (let pass = 0; pass < 2; pass++) {
        const tempPdf = await PDFDocument.load(currentBytes, {
          ignoreEncryption: true,
          updateMetadata: false,
          updateDocDates: false,
        })
        
        const optimizedBytes = await tempPdf.save({
          useObjectStreams: false,
          addDefaultPage: false,
        })
        
        if (optimizedBytes.length < bestSize) {
          bestBytes = optimizedBytes
          bestSize = optimizedBytes.length
          currentBytes = optimizedBytes
        } else {
          break // No improvement, stop trying
        }
      }

      const optimizedSizeMB = bestBytes.length / 1024 / 1024
      const compressionRatio = bestBytes.length < mergedPdfBytes.length
        ? ((mergedPdfBytes.length - bestBytes.length) / mergedPdfBytes.length * 100).toFixed(1)
        : '0'
      
      console.log(`[MERGE] Optimized PDF size: ${optimizedSizeMB.toFixed(2)}MB (${compressionRatio}% reduction)`)

      // Use the best compressed version
      if (bestBytes.length < mergedPdfBytes.length) {
        finalBytes = bestBytes
        finalSizeMB = optimizedSizeMB
        console.log(`[MERGE] Using optimized version (${compressionRatio}% smaller)`)
      } else {
        finalBytes = mergedPdfBytes
        finalSizeMB = originalSizeMB
        console.log(`[MERGE] Using original version (optimization didn't reduce size)`)
      }
    } catch (optimizeError) {
      console.warn(`[MERGE] Optimization failed, using original:`, optimizeError)
      finalBytes = mergedPdfBytes
      finalSizeMB = originalSizeMB
    }

    // Use consistent filename to overwrite previous merged documents
    const fileName = `merged_documents.pdf`
    const filePath = `${targetUserId}/${fileName}`

    // Delete any previous merged documents with different names (timestamp-based)
    console.log(`[MERGE] Cleaning up previous merged documents...`)
    try {
      const { data: existingFiles } = await supabase.storage
        .from('documents')
        .list(targetUserId, {
          search: 'merged_documents',
        })
      
      if (existingFiles && existingFiles.length > 0) {
        const filesToDelete = existingFiles
          .filter(file => file.name.startsWith('merged_documents') && file.name !== fileName)
          .map(file => `${targetUserId}/${file.name}`)
        
        if (filesToDelete.length > 0) {
          console.log(`[MERGE] Deleting ${filesToDelete.length} previous merged document(s)...`)
          await supabase.storage
            .from('documents')
            .remove(filesToDelete)
        }
      }
    } catch (cleanupError) {
      console.warn(`[MERGE] Cleanup warning (non-critical):`, cleanupError)
      // Continue even if cleanup fails
    }

    console.log(`[MERGE] Saving to storage: ${filePath} (will overwrite if exists)`)
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, finalBytes, {
        contentType: 'application/pdf',
        upsert: true, // Overwrite previous merged document
      })

    if (uploadError) {
      console.error('[MERGE] Upload error:', uploadError)
      return new Response(
        JSON.stringify({ success: false, error: `Failed to save merged PDF: ${uploadError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate signed URL
    const { data: signedUrlData } = await supabase.storage
      .from('documents')
      .createSignedUrl(filePath, 3600)

    console.log(`[MERGE] ✓ Successfully merged and saved ${processedDocs.length} documents`)
    console.log(`[MERGE] Final file size: ${finalSizeMB.toFixed(2)}MB`)

    return new Response(
      JSON.stringify({
        success: true,
        file_path: filePath,
        file_name: fileName,
        file_size: finalBytes.length,
        file_size_mb: parseFloat(finalSizeMB.toFixed(2)),
        signed_url: signedUrlData?.signedUrl || null,
        processed_documents: processedDocs,
        skipped_documents: skippedDocs,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[MERGE] Error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

