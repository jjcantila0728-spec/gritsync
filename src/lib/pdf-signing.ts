import { PDFDocument } from 'pdf-lib'

/**
 * Add signature image to a PDF at specific coordinates
 */
export async function addSignatureToPDF(
  pdfBytes: Uint8Array,
  signatureImageBytes: Uint8Array,
  pageIndex: number,
  x: number,
  y: number,
  width: number,
  height: number
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes)
  const signatureImage = await pdfDoc.embedPng(signatureImageBytes)
  
  const pages = pdfDoc.getPages()
  if (pageIndex >= pages.length) {
    throw new Error(`Page index ${pageIndex} is out of range`)
  }
  
  const page = pages[pageIndex]
  page.drawImage(signatureImage, {
    x,
    y,
    width,
    height,
  })
  
  return await pdfDoc.save()
}

/**
 * Add signature to Form I-765 page 4 (Applicant's signature section)
 * Coordinates approximate for 7.a (signature)
 */
export async function signI765Applicant(
  pdfBytes: Uint8Array,
  signatureImageBytes: Uint8Array
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes)
  const signatureImage = await pdfDoc.embedPng(signatureImageBytes)
  
  // Find page 4 (index 3)
  const pages = pdfDoc.getPages()
  if (pages.length < 4) {
    throw new Error('PDF does not have enough pages')
  }
  
  const page = pages[3] // Page 4 (0-indexed)
  const { width, height } = page.getSize()
  
  // Approximate coordinates for I-765 page 4 signature fields
  // 7.a. Applicant's Signature - typically around bottom left area
  const signatureX = width * 0.1 // 10% from left
  const signatureY = height * 0.15 // 15% from bottom
  const signatureWidth = width * 0.35 // 35% of page width
  const signatureHeight = signatureWidth * 0.2 // Maintain aspect ratio
  
  // Add signature
  page.drawImage(signatureImage, {
    x: signatureX,
    y: signatureY,
    width: signatureWidth,
    height: signatureHeight,
  })
  
  return await pdfDoc.save()
}

/**
 * Add signature to Form I-765 page 6 (Preparer's signature section)
 * Coordinates approximate for 8.a (signature)
 */
export async function signI765Preparer(
  pdfBytes: Uint8Array,
  signatureImageBytes: Uint8Array
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes)
  const signatureImage = await pdfDoc.embedPng(signatureImageBytes)
  
  // Find page 6 (index 5)
  const pages = pdfDoc.getPages()
  if (pages.length < 6) {
    throw new Error('PDF does not have enough pages')
  }
  
  const page = pages[5] // Page 6 (0-indexed)
  const { width, height } = page.getSize()
  
  // Approximate coordinates for I-765 page 6 preparer signature fields
  // 8.a. Preparer's Signature - typically around bottom left area
  const signatureX = width * 0.1 // 10% from left
  const signatureY = height * 0.15 // 15% from bottom
  const signatureWidth = width * 0.35 // 35% of page width
  const signatureHeight = signatureWidth * 0.2 // Maintain aspect ratio
  
  // Add signature
  page.drawImage(signatureImage, {
    x: signatureX,
    y: signatureY,
    width: signatureWidth,
    height: signatureHeight,
  })
  
  return await pdfDoc.save()
}

/**
 * Add signature to cover letter (typically first page)
 */
export async function signCoverLetter(
  pdfBytes: Uint8Array,
  signatureImageBytes: Uint8Array
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes)
  const signatureImage = await pdfDoc.embedPng(signatureImageBytes)
  
  // Cover letter is typically the first page
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
  
  return await pdfDoc.save()
}

/**
 * Convert data URL to Uint8Array
 */
export function dataURLToUint8Array(dataURL: string): Uint8Array {
  const base64 = dataURL.split(',')[1]
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * Convert Uint8Array to Blob
 */
export function uint8ArrayToBlob(uint8Array: Uint8Array, mimeType: string = 'application/pdf'): Blob {
  return new Blob([uint8Array as unknown as BlobPart], { type: mimeType })
}

/**
 * Sign the complete application package (client signature)
 * Signs: Cover letter and supporting documents
 */
export async function signClientDocuments(
  compiledPdfBytes: Uint8Array,
  signatureDataUrl: string
): Promise<Uint8Array> {
  let signedPdf = compiledPdfBytes
  const signatureBytes = dataURLToUint8Array(signatureDataUrl)
  
  // Sign cover letter (first page)
  signedPdf = await signCoverLetter(signedPdf, signatureBytes)
  
  // Sign I-765 page 4 (applicant signature)
  signedPdf = await signI765Applicant(signedPdf, signatureBytes)
  
  return signedPdf
}

/**
 * Sign the preparer section of I-765 (preparer signature)
 * Signs: I-765 page 6
 */
export async function signPreparerDocuments(
  clientSignedPdfBytes: Uint8Array,
  signatureDataUrl: string
): Promise<Uint8Array> {
  const signatureBytes = dataURLToUint8Array(signatureDataUrl)
  
  // Sign I-765 page 6 (preparer signature)
  const signedPdf = await signI765Preparer(clientSignedPdfBytes, signatureBytes)
  
  return signedPdf
}

