/**
 * Document compression utilities
 * Automatically compresses images and PDFs to reduce file size before upload
 */

interface CompressionOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  maxFileSizeMB?: number
}

const DEFAULT_OPTIONS: CompressionOptions = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.85, // 85% quality for good balance between size and quality
  maxFileSizeMB: 0, // Always compress (0 means no threshold)
}

/**
 * Compresses an image file using canvas API
 * @param file - The image file to compress
 * @param options - Compression options
 * @returns Compressed file or original file if compression fails
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  // Only compress image files
  if (!file.type.startsWith('image/')) {
    return file
  }

  // Determine best quality based on file size
  // Smaller files can use higher quality, larger files need more compression
  let quality = opts.quality || 0.85
  const fileSizeMB = file.size / (1024 * 1024)
  
  if (fileSizeMB > 3) {
    quality = 0.7 // More aggressive compression for large files
  } else if (fileSizeMB > 1) {
    quality = 0.8
  } else if (fileSizeMB > 0.5) {
    quality = 0.85
  } else {
    quality = 0.9 // Higher quality for very small files
  }

  try {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = (e) => {
        const img = new Image()
        
        img.onload = () => {
          // Calculate new dimensions while maintaining aspect ratio
          let { width, height } = img
          const maxWidth = opts.maxWidth || 1920
          const maxHeight = opts.maxHeight || 1920
          
          // Always resize if larger than max dimensions, or if file is large
          const shouldResize = width > maxWidth || height > maxHeight || fileSizeMB > 1
          
          if (shouldResize && (width > maxWidth || height > maxHeight)) {
            const ratio = Math.min(maxWidth / width, maxHeight / height)
            width = Math.round(width * ratio)
            height = Math.round(height * ratio)
          }
          
          // Create canvas and draw resized image
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            reject(new Error('Failed to get canvas context'))
            return
          }
          
          // Use high-quality image rendering
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'high'
          
          ctx.drawImage(img, 0, 0, width, height)
          
          // Determine output format - use JPEG for better compression
          // Keep original format to avoid issues with transparency or format requirements
          let outputType = file.type
          
          // Only convert to JPEG if original is not PNG (to preserve transparency) or if file is large
          if (file.type !== 'image/png' && file.type !== 'image/gif' && file.type !== 'image/webp') {
            // Convert other formats to JPEG for better compression
            if (!file.type.startsWith('image/jpeg')) {
              outputType = 'image/jpeg'
            }
          } else if (fileSizeMB > 1 && file.type === 'image/png') {
            // For large PNGs, convert to JPEG for better compression (loses transparency)
            outputType = 'image/jpeg'
          }
          
          // Convert to blob with compression
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                resolve(file) // Return original if conversion fails
                return
              }
              
              // Always use compressed version if it's smaller, or if original is very large
              if (blob.size < file.size || fileSizeMB > 2) {
                // Preserve original filename extension unless we're converting format
                let newFileName = file.name
                if (outputType === 'image/jpeg' && !file.name.toLowerCase().endsWith('.jpg') && !file.name.toLowerCase().endsWith('.jpeg')) {
                  newFileName = file.name.replace(/\.[^/.]+$/, '.jpg')
                }
                
                const compressedFile = new File(
                  [blob],
                  newFileName,
                  {
                    type: outputType,
                    lastModified: Date.now(),
                  }
                )
                console.log(`Image compressed: ${(file.size / 1024 / 1024).toFixed(2)}MB -> ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB (${((1 - compressedFile.size / file.size) * 100).toFixed(1)}% reduction)`)
                resolve(compressedFile)
              } else {
                // If compressed version is larger, use original
                console.log(`Image compression resulted in larger file (${(blob.size / 1024 / 1024).toFixed(2)}MB >= ${(file.size / 1024 / 1024).toFixed(2)}MB), using original`)
                resolve(file)
              }
            },
            outputType,
            quality
          )
        }
        
        img.onerror = () => {
          console.warn('Image load failed, using original file')
          resolve(file) // Return original if image load fails
        }
        
        if (e.target?.result) {
          img.src = e.target.result as string
        } else {
          resolve(file)
        }
      }
      
      reader.onerror = () => {
        console.warn('File read failed, using original file')
        resolve(file) // Return original if read fails
      }
      
      reader.readAsDataURL(file)
    })
  } catch (error) {
    console.warn('Image compression failed, using original file:', error)
    return file
  }
}

/**
 * Compresses a PDF file using pdf-lib
 * Note: PDF compression in browser is limited, this mainly optimizes structure
 * @param file - The PDF file to compress
 * @returns Compressed file or original file if compression fails
 */
export async function compressPDF(file: File): Promise<File> {
  // Only compress PDF files
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    return file
  }

  // Skip compression if file is very small (under 500KB) as compression overhead might not be worth it
  if (file.size < 500 * 1024) {
    return file
  }

  try {
    // Dynamically import pdf-lib to avoid loading it if not needed
    const { PDFDocument } = await import('pdf-lib')
    
    const arrayBuffer = await file.arrayBuffer()
    const pdfDoc = await PDFDocument.load(arrayBuffer)
    
    // Save the PDF which will optimize its structure
    const pdfBytes = await pdfDoc.save({
      useObjectStreams: false, // Disable object streams for better compression
      addDefaultPage: false,
    })
    
    // Only use compressed version if it's actually smaller
    if (pdfBytes.length < file.size) {
      const compressedFile = new File(
        [pdfBytes as unknown as BlobPart],
        file.name,
        {
          type: 'application/pdf',
          lastModified: Date.now(),
        }
      )
      console.log(`PDF compressed: ${(file.size / 1024 / 1024).toFixed(2)}MB -> ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB (${((1 - compressedFile.size / file.size) * 100).toFixed(1)}% reduction)`)
      return compressedFile
    } else {
      console.log(`PDF compression resulted in larger file, using original`)
    }
    
    return file
  } catch (error) {
    console.warn('PDF compression failed, using original file:', error)
    return file
  }
}

/**
 * Automatically compresses a file based on its type
 * @param file - The file to compress
 * @param options - Compression options for images
 * @returns Compressed file or original file if compression is not applicable
 */
export async function compressDocument(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const originalSize = file.size
  const fileType = file.type || ''
  const fileName = file.name.toLowerCase()
  
  console.log(`Compressing file: ${file.name} (${(originalSize / 1024 / 1024).toFixed(2)}MB, type: ${fileType || 'unknown'})`)
  
  let compressedFile: File
  
  // Detect file type by extension if MIME type is missing or generic
  const isImage = fileType.startsWith('image/') || 
    /\.(jpg|jpeg|png|gif|webp|bmp|tiff)$/i.test(fileName)
  const isPDF = fileType === 'application/pdf' || fileName.endsWith('.pdf')
  
  // Compress images
  if (isImage) {
    compressedFile = await compressImage(file, options)
  }
  // Compress PDFs
  else if (isPDF) {
    compressedFile = await compressPDF(file)
  }
  // For other file types, return as-is
  else {
    console.log(`File type not supported for compression (${fileType || 'unknown'}), using original`)
    return file
  }
  
  const compressedSize = compressedFile.size
  if (compressedSize < originalSize) {
    console.log(`✅ Compression successful: ${((1 - compressedSize / originalSize) * 100).toFixed(1)}% reduction (${(originalSize / 1024 / 1024).toFixed(2)}MB -> ${(compressedSize / 1024 / 1024).toFixed(2)}MB)`)
  } else {
    console.log(`⚠️ Compression did not reduce size (${(compressedSize / 1024 / 1024).toFixed(2)}MB >= ${(originalSize / 1024 / 1024).toFixed(2)}MB), using original file`)
  }
  
  return compressedFile
}

