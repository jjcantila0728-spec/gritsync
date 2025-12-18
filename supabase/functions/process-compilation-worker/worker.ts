/**
 * Document Compilation Worker
 * 
 * This module handles all the heavy processing:
 * - Image normalization and conversion
 * - PDF optimization
 * - Document merging
 * - File storage
 * 
 * Designed to be called from the worker edge function
 */

import { PDFDocument } from 'npm:pdf-lib@1.17.1'

// ============================================================================
// TYPES
// ============================================================================

export interface DocumentInfo {
  document: any
  fileType: 'pdf' | 'image' | 'unknown'
  fileExtension: string
  name: string
  key: string
}

export interface ProcessingResult {
  success: boolean
  pdfBytes?: Uint8Array
  filePath?: string
  fileName?: string
  error?: string
  fileSize?: number
  fileSizeMB?: number
}

// ============================================================================
// IMAGE FORMAT DETECTION
// ============================================================================

/**
 * Detect actual image format from buffer (not just extension)
 * Critical for preventing "SOI not found" errors
 */
export function detectImageFormat(buffer: Uint8Array): 'jpeg' | 'png' | 'unknown' {
  // JPEG signature: 0xFF 0xD8 (SOI - Start of Image)
  if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xD8) {
    return 'jpeg'
  }
  
  // PNG signature: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
  if (buffer.length >= 8 && 
      buffer[0] === 0x89 && 
      buffer[1] === 0x50 && 
      buffer[2] === 0x4E && 
      buffer[3] === 0x47 &&
      buffer[4] === 0x0D &&
      buffer[5] === 0x0A &&
      buffer[6] === 0x1A &&
      buffer[7] === 0x0A) {
    return 'png'
  }
  
  return 'unknown'
}

// ============================================================================
// DOCUMENT OPTIMIZATION SETTINGS
// ============================================================================

/**
 * Get document-specific optimization settings
 * Based on document type (2x2 photo, passport, etc.)
 */
export function getDocumentOptimizationSettings(
  docKey: string,
  docName: string
): { maxWidth: number; maxHeight: number; quality: string } {
  // 2x2 Picture: Small dimensions, higher quality
  if (docKey.includes('2x2') || docKey.includes('picture') || docName.toLowerCase().includes('2x2')) {
    return { maxWidth: 300, maxHeight: 300, quality: 'high (2x2 photo)' }
  }
  
  // Passport, Visa, I-94: Document quality
  if (docKey.includes('passport') || docKey.includes('visa') || docKey.includes('i94')) {
    return { maxWidth: 1200, maxHeight: 1200, quality: 'document (passport/visa)' }
  }
  
  // Scans and certificates: Document quality
  if (docKey.includes('certificate') || docKey.includes('marriage')) {
    return { maxWidth: 1200, maxHeight: 1200, quality: 'document (scan)' }
  }
  
  // Default: Balanced quality
  return { maxWidth: 800, maxHeight: 1200, quality: 'balanced' }
}

// ============================================================================
// IMAGE TO PDF CONVERSION (WORKER FUNCTION)
// ============================================================================

/**
 * Convert image to PDF with smart format detection and compression
 * 
 * CRITICAL FIXES:
 * - Validates JPEG format before embedding (prevents "SOI not found" errors)
 * - Fails fast on fake JPEGs (no PNG fallback loop)
 * - Uses document-specific optimization settings
 * - Comprehensive logging for debugging
 */
export async function convertImageToPdf(
  imageBlob: Blob,
  imageUrl: string,
  docKey: string,
  docName: string,
  fileExtension: string
): Promise<Uint8Array | null> {
  try {
    console.log(`\n[WORKER] [IMAGE CONVERSION] Starting: ${docName}`)
    console.log(`[WORKER] [IMAGE CONVERSION] URL: ${imageUrl.substring(0, 80)}...`)
    
    const imageBytes = await imageBlob.arrayBuffer()
    const imageBuffer = new Uint8Array(imageBytes)
    const originalSize = imageBytes.byteLength
    const sizeMB = originalSize / 1024 / 1024
    
    console.log(`[WORKER] [IMAGE CONVERSION] Original size: ${sizeMB.toFixed(2)}MB (${(originalSize / 1024).toFixed(0)}KB)`)
    console.log(`[WORKER] [IMAGE CONVERSION] File extension: ${fileExtension}`)

    if (imageBytes.byteLength === 0) {
      console.error('[WORKER] [IMAGE CONVERSION] ❌ Image is empty')
      return null
    }

    // Skip very large images (>10MB) to prevent CPU timeout
    // Note: Without Sharp, we can't resize, so very large images will cause timeouts
    // Images between 6-10MB will be processed but may take longer
    const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10MB
    const WARNING_SIZE = 6 * 1024 * 1024 // 6MB (warning threshold)
    
    if (originalSize > MAX_IMAGE_SIZE) {
      console.warn(`[WORKER] [IMAGE CONVERSION] ❌ Image too large (${sizeMB.toFixed(2)}MB), skipping to prevent CPU timeout`)
      console.warn(`[WORKER] [IMAGE CONVERSION] 💡 Recommendation: Resize image to <10MB before upload`)
      return null
    }
    
    if (originalSize > WARNING_SIZE) {
      console.warn(`[WORKER] [IMAGE CONVERSION] ⚠️ Large image (${sizeMB.toFixed(2)}MB), processing may take longer`)
      console.warn(`[WORKER] [IMAGE CONVERSION] 💡 For faster processing, resize image to <6MB before upload`)
    }

    // Detect actual image format from buffer (not just extension)
    const detectedFormat = detectImageFormat(imageBuffer)
    console.log(`[WORKER] [IMAGE CONVERSION] Detected format: ${detectedFormat} (extension suggests: ${fileExtension})`)

    // Get document-specific optimization settings
    const settings = getDocumentOptimizationSettings(docKey, docName)
    console.log(`[WORKER] [IMAGE CONVERSION] Optimization: ${settings.quality}, max dimensions: ${settings.maxWidth}x${settings.maxHeight}`)

    // Create a new PDF document
    const pdfDoc = await PDFDocument.create()

    // HARD FAIL on fake JPEGs - don't try PNG fallback
    // This prevents CPU waste from retry loops
    let image
    if (detectedFormat === 'jpeg') {
      try {
        image = await pdfDoc.embedJpg(imageBuffer)
        console.log(`[WORKER] [IMAGE CONVERSION] ✓ JPEG embedded successfully`)
      } catch (jpegError) {
        console.error(`[WORKER] [IMAGE CONVERSION] ❌ JPEG validation failed - buffer does not contain valid JPEG data`)
        console.error(`[WORKER] [IMAGE CONVERSION] Error: ${jpegError instanceof Error ? jpegError.message : String(jpegError)}`)
        console.error(`[WORKER] [IMAGE CONVERSION] 💡 This file may be HEIC/HEIF from iOS or corrupted JPEG`)
        console.error(`[WORKER] [IMAGE CONVERSION] 💡 Recommendation: Convert to JPEG using image editing software before upload`)
        // Fail fast - don't try PNG (would cause large file size)
        return null
      }
    } else if (detectedFormat === 'png') {
      // PNG detected - warn about size inflation but proceed
      console.warn(`[WORKER] [IMAGE CONVERSION] ⚠️  PNG detected - PDF will be larger (PNG doesn't compress well in PDFs)`)
      console.warn(`[WORKER] [IMAGE CONVERSION] 💡 Recommendation: Convert to JPEG for smaller PDF size`)
      try {
        image = await pdfDoc.embedPng(imageBuffer)
        console.log(`[WORKER] [IMAGE CONVERSION] ✓ PNG embedded successfully`)
      } catch (pngError) {
        console.error(`[WORKER] [IMAGE CONVERSION] ❌ PNG embedding failed`)
        console.error(`[WORKER] [IMAGE CONVERSION] Error: ${pngError instanceof Error ? pngError.message : String(pngError)}`)
        return null
      }
    } else {
      // Unknown format - try JPEG first (most common), then PNG
      console.warn(`[WORKER] [IMAGE CONVERSION] ⚠️  Unknown format, attempting JPEG embedding...`)
      try {
        image = await pdfDoc.embedJpg(imageBuffer)
        console.log(`[WORKER] [IMAGE CONVERSION] ✓ JPEG embedding succeeded (format was misdetected)`)
      } catch (jpegError) {
        console.warn(`[WORKER] [IMAGE CONVERSION] ⚠️  JPEG failed, trying PNG...`)
        try {
          image = await pdfDoc.embedPng(imageBuffer)
          console.log(`[WORKER] [IMAGE CONVERSION] ✓ PNG embedding succeeded (format was misdetected)`)
        } catch (pngError) {
          console.error(`[WORKER] [IMAGE CONVERSION] ❌ Both JPEG and PNG embedding failed`)
          console.error(`[WORKER] [IMAGE CONVERSION] JPEG error: ${jpegError instanceof Error ? jpegError.message : String(jpegError)}`)
          console.error(`[WORKER] [IMAGE CONVERSION] PNG error: ${pngError instanceof Error ? pngError.message : String(pngError)}`)
          return null
        }
      }
    }

    // Create a page with standard letter size (8.5 x 11 inches = 612 x 792 points)
    const page = pdfDoc.addPage([612, 792])

    // Calculate dimensions using document-specific settings
    let width = image.width
    let height = image.height
    const originalDimensions = `${image.width}x${image.height}`

    // Scale down if image is larger than target dimensions
    if (width > settings.maxWidth || height > settings.maxHeight) {
      const widthRatio = settings.maxWidth / width
      const heightRatio = settings.maxHeight / height
      const ratio = Math.min(widthRatio, heightRatio)
      width = width * ratio
      height = height * ratio
      console.log(`[WORKER] [IMAGE CONVERSION] Display scaled: ${originalDimensions} -> ${width.toFixed(0)}x${height.toFixed(0)}`)
    } else {
      console.log(`[WORKER] [IMAGE CONVERSION] Display dimensions: ${width.toFixed(0)}x${height.toFixed(0)} (within limits)`)
    }

    // Center the image on the page
    const x = (612 - width) / 2
    const y = (792 - height) / 2

    // Draw image on page
    page.drawImage(image, {
      x,
      y,
      width,
      height,
    })

    // Save PDF (pdf-lib handles compression internally)
    const pdfBytes = await pdfDoc.save({
      useObjectStreams: false,
      addDefaultPage: false,
    })

    const compressedSizeMB = pdfBytes.length / 1024 / 1024
    const sizeReduction = ((originalSize - pdfBytes.length) / originalSize * 100).toFixed(1)
    const sizeChange = originalSize > pdfBytes.length ? 'reduction' : 'increase'
    
    console.log(`[WORKER] [IMAGE CONVERSION] Final PDF size: ${(pdfBytes.length / 1024).toFixed(0)}KB (${compressedSizeMB.toFixed(2)}MB)`)
    console.log(`[WORKER] [IMAGE CONVERSION] Size change: ${Math.abs(parseFloat(sizeReduction))}% ${sizeChange}`)
    console.log(`[WORKER] [IMAGE CONVERSION] ✓ Conversion complete: ${docName}`)
    
    return pdfBytes
  } catch (error) {
    console.error(`[WORKER] [IMAGE CONVERSION] ❌ Failed to convert image to PDF: ${docName}`)
    console.error(`[WORKER] [IMAGE CONVERSION] Error: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      console.error(`[WORKER] [IMAGE CONVERSION] Stack: ${error.stack}`)
    }
    return null
  }
}

// ============================================================================
// PDF LOADING (WORKER FUNCTION)
// ============================================================================

/**
 * Load PDF (skip optimization to save CPU time)
 * Smart rule: Skip optimization if PDF < 500KB (not worth CPU time)
 */
export async function loadPdf(pdfBlob: Blob, docName: string): Promise<Uint8Array | null> {
  try {
    const pdfBytes = await pdfBlob.arrayBuffer()
    const sizeKB = pdfBytes.byteLength / 1024
    const sizeMB = pdfBytes.byteLength / 1024 / 1024
    
    console.log(`[WORKER] [PDF LOAD] ${docName}: ${sizeKB.toFixed(0)}KB (${sizeMB.toFixed(2)}MB)`)
    
    // Smart optimization rule: Only optimize if PDF is large (>500KB)
    // Re-saving small PDFs wastes CPU and can increase file size
    if (pdfBytes.byteLength < 500 * 1024) {
      console.log(`[WORKER] [PDF LOAD] ✓ Small PDF (<500KB), skipping optimization to save CPU time`)
      return new Uint8Array(pdfBytes)
    }
    
    // For larger PDFs, we could optimize, but it was making files larger
    // So we'll just return the original bytes
    console.log(`[WORKER] [PDF LOAD] ✓ Large PDF (≥500KB), using as-is (optimization disabled to prevent size increase)`)
    return new Uint8Array(pdfBytes)
  } catch (error) {
    console.error(`[WORKER] [PDF LOAD] ❌ Failed to load PDF: ${docName}`)
    console.error(`[WORKER] [PDF LOAD] Error: ${error instanceof Error ? error.message : String(error)}`)
    return null
  }
}

// ============================================================================
// PDF MERGING (WORKER FUNCTION)
// ============================================================================

/**
 * Add PDF pages to merged document
 */
export async function addPdfToMerged(mergedPdf: PDFDocument, pdfBytes: Uint8Array): Promise<boolean> {
  try {
    const pdfDoc = await PDFDocument.load(pdfBytes, {
      ignoreEncryption: true,
      updateMetadata: false,
      capNumbers: true,
      parseSpeed: 1,
    })
    const pages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices())
    pages.forEach((page) => mergedPdf.addPage(page))
    return true
  } catch (error) {
    console.warn('[WORKER] [PDF MERGE] Failed to add PDF, trying alternative method:', error)
    try {
      const pdfDoc = await PDFDocument.load(pdfBytes, {
        ignoreEncryption: true,
        updateMetadata: false,
        capNumbers: false,
        parseSpeed: 0,
      })
      const pages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices())
      pages.forEach((page) => mergedPdf.addPage(page))
      return true
    } catch (retryError) {
      console.error('[WORKER] [PDF MERGE] Failed to add PDF with alternative method:', retryError)
      return false
    }
  }
}

// ============================================================================
// MAIN WORKER PROCESSING FUNCTION
// ============================================================================

/**
 * Process documents compilation
 * 
 * This is the main worker function that handles all heavy processing:
 * 
 * STEP 1: NORMALIZE IMAGES
 *   - Fetch images from storage
 *   - Validate image formats (JPEG/PNG detection)
 *   - Handle base64 encoded documents
 * 
 * STEP 2: CONVERT TO PDFs
 *   - Convert normalized images to PDF format
 *   - Load existing PDFs
 *   - Apply document-specific optimization settings
 * 
 * STEP 3: MERGE
 *   - Merge all PDFs in the correct order
 *   - Handle page copying and document structure
 * 
 * STEP 4: RETURN COMPILED PDF
 *   - Save final merged PDF
 *   - Return PDF bytes for storage
 */
export async function processDocumentCompilation(
  documents: Map<string, DocumentInfo>,
  fetchFileWithRetry: (supabase: any, filePath: string) => Promise<Blob | null>,
  supabase: any,
  checkTimeout: () => void
): Promise<{ success: boolean; pdfBytes?: Uint8Array; error?: string }> {
  try {
    console.log('\n[WORKER] === Starting document compilation processing ===')
    
    // STEP 1: NORMALIZE IMAGES & CONVERT TO PDFs
    // Fetch all documents, normalize images, and convert everything to PDF format
    console.log('\n[WORKER] [STEP 1] Normalizing images and converting to PDFs')
    const convertedPdfs: Map<string, Uint8Array> = new Map()

    for (const [key, docInfo] of documents.entries()) {
      checkTimeout()

      if (docInfo.fileType === 'pdf') {
        // Load existing PDF
        let pdfBlob: Blob

        if (docInfo.document.isBase64) {
          // Decode base64
          const pdfBytes = Uint8Array.from(atob(docInfo.document.base64Data), c => c.charCodeAt(0))
          pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' })
        } else {
          // Fetch from storage
          const blob = await fetchFileWithRetry(supabase, docInfo.document.file_path)
          if (!blob) {
            throw new Error(`Failed to fetch ${docInfo.name} from storage`)
          }
          pdfBlob = blob
        }

        const pdfBytes = await loadPdf(pdfBlob, docInfo.name)
        if (!pdfBytes) {
          throw new Error(`Failed to load PDF: ${docInfo.name}`)
        }
        convertedPdfs.set(key, pdfBytes)
      } else if (docInfo.fileType === 'image') {
        // Convert image to PDF
        checkTimeout()
        console.log(`[WORKER] Converting image to PDF: ${docInfo.name}`)
        
        const imageBlob = await fetchFileWithRetry(supabase, docInfo.document.file_path)
        checkTimeout()
        if (!imageBlob) {
          throw new Error(`Failed to fetch ${docInfo.name} from storage`)
        }

        // Get signed URL for logging
        const { data: signedUrlData } = await supabase.storage
          .from('documents')
          .createSignedUrl(docInfo.document.file_path, 3600)

        const imageUrl = signedUrlData?.signedUrl || docInfo.document.file_path

        checkTimeout()
        const convertedPdf = await convertImageToPdf(
          imageBlob,
          imageUrl,
          docInfo.key,
          docInfo.name,
          docInfo.fileExtension
        )
        checkTimeout()
        if (!convertedPdf) {
          // Get file size for better error message
          const fileSizeMB = (imageBlob.size / 1024 / 1024).toFixed(2)
          const errorMessage = fileSizeMB && parseFloat(fileSizeMB) > 10
            ? `Failed to convert image to PDF: ${docInfo.name}. Image is too large (${fileSizeMB}MB). Please resize to <10MB and try again.`
            : `Failed to convert image to PDF: ${docInfo.name}. Please check the image format and try again.`
          throw new Error(errorMessage)
        }
        convertedPdfs.set(key, convertedPdf)
      } else {
        throw new Error(`Unsupported file type for ${docInfo.name}: ${docInfo.fileType}`)
      }
    }

    console.log(`\n[WORKER] [STEP 1] ✓ All ${convertedPdfs.size} documents normalized and converted to PDFs`)

    // STEP 2: MERGE ALL PDFs
    // Merge all converted PDFs in the correct document order
    console.log('\n[WORKER] [STEP 2] Merging all PDFs in order')
    const mergedPdf = await PDFDocument.create()

    const orderedKeys = [
      'cover_letter',
      'g1145',
      'i765',
      'ead_2x2_picture',
      'passport',
      'ead_h4_visa',
      'ead_i94',
      'ead_marriage_certificate',
      'ead_spouse_i797',
      'ead_spouse_i140',
      'ead_employer_letter',
      'ead_paystub',
    ]

    for (const key of orderedKeys) {
      checkTimeout()
      const pdfBytes = convertedPdfs.get(key)
      if (!pdfBytes) {
        console.warn(`[WORKER] [STEP 2] Warning: PDF for ${key} not found, skipping`)
        continue
      }

      const success = await addPdfToMerged(mergedPdf, pdfBytes)
      if (success) {
        const docInfo = documents.get(key)
        console.log(`[WORKER] [STEP 2] ✓ Added ${docInfo?.name || key} to merged PDF`)
      } else {
        throw new Error(`Failed to add ${key} to merged PDF`)
      }
    }

    console.log('\n[WORKER] [STEP 2] ✓ All documents merged successfully')

    // STEP 3: SAVE FINAL PDF
    // Generate the final compiled PDF bytes
    console.log('\n[WORKER] [STEP 3] Generating final compiled PDF')
    checkTimeout()

    const finalPdfBytes = await mergedPdf.save({
      useObjectStreams: false,
      addDefaultPage: false,
    })

    const finalSizeMB = finalPdfBytes.length / 1024 / 1024
    console.log(`[WORKER] [STEP 3] Final PDF size: ${finalSizeMB.toFixed(2)}MB (${(finalPdfBytes.length / 1024).toFixed(0)}KB)`)
    console.log('\n[WORKER] === Document compilation processing complete ===')

    return {
      success: true,
      pdfBytes: finalPdfBytes,
    }
  } catch (error) {
    console.error('[WORKER] ❌ Document compilation processing failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

