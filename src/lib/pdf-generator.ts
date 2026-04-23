/**
 * PDF Generation Utilities
 * Generates receipt and invoice PDFs for payments
 */

import jsPDF from 'jspdf'
import { formatCurrency } from './utils'

interface ReceiptData {
  receipt_number: string
  amount: number
  payment_type: string
  items: Array<{ name: string; amount: number }>
  created_at: string
  application_id?: string
  user_name?: string
  user_email?: string
}

interface InvoiceData {
  invoice_number: string
  amount: number
  payment_type: string
  items: Array<{ name: string; amount: number; taxable?: boolean }>
  subtotal: number
  tax: number
  total: number
  created_at: string
  application_id?: string
  user_name?: string
  user_email?: string
  billing_address?: {
    name?: string
    email?: string
    address?: string
    city?: string
    state?: string
    zip?: string
    country?: string
  }
}

// Colors
const primaryColor: [number, number, number] = [220, 38, 38] // Red #dc2626
const lightGray: [number, number, number] = [243, 244, 246] // Gray-100
const textGray: [number, number, number] = [107, 114, 128] // Gray-500
const textDark: [number, number, number] = [17, 24, 39] // Gray-900

/**
 * Generate Receipt PDF
 */
export function generateReceiptPDF(receipt: ReceiptData): Uint8Array {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  const contentWidth = pageWidth - (margin * 2)
  let yPos = margin

  // Header with gradient effect (simulated with rectangle)
  doc.setFillColor(...primaryColor)
  doc.rect(0, 0, pageWidth, 50, 'F')
  
  // Company name
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(28)
  doc.setFont('helvetica', 'bold')
  doc.text('GRITSYNC', pageWidth / 2, 25, { align: 'center' })
  
  // Tagline
  doc.setFontSize(10)
  doc.setFont('helvetica', 'italic')
  doc.text('Business Consultancy Services', pageWidth / 2, 35, { align: 'center' })

  yPos = 70

  // Receipt title
  doc.setTextColor(...textDark)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('PAYMENT RECEIPT', pageWidth / 2, yPos, { align: 'center' })
  yPos += 10

  // Receipt number and date box
  doc.setFillColor(...lightGray)
  doc.roundedRect(margin, yPos, contentWidth, 25, 3, 3, 'F')
  
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...textGray)
  doc.text('Receipt Number:', margin + 10, yPos + 8)
  doc.text('Date:', margin + 10, yPos + 18)
  
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...textDark)
  doc.text(`#${receipt.receipt_number}`, margin + 60, yPos + 8)
  
  const receiptDate = new Date(receipt.created_at)
  const formattedDate = receiptDate.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })
  doc.text(formattedDate, margin + 60, yPos + 18)

  yPos += 35

  // Payment details section
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...textDark)
  doc.text('Payment Details', margin, yPos)
  yPos += 8

  // Payment type
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...textGray)
  const paymentTypeLabel = receipt.payment_type === 'step1' ? 'Step 1 Payment' : 
                           receipt.payment_type === 'step2' ? 'Step 2 Payment' : 
                           'Full Payment'
  doc.text(`Payment Type: ${paymentTypeLabel}`, margin, yPos)
  yPos += 10

  // Items section
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...textDark)
  doc.text('Items', margin, yPos)
  yPos += 8

  // Table header
  doc.setFillColor(...lightGray)
  doc.roundedRect(margin, yPos - 5, contentWidth, 10, 2, 2, 'F')
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...textDark)
  doc.text('Description', margin + 5, yPos + 2)
  doc.text('Amount', pageWidth - margin - 5, yPos + 2, { align: 'right' })
  yPos += 8

  // Items list
  doc.setFont('helvetica', 'normal')
  receipt.items.forEach((item, index) => {
    if (yPos > pageHeight - 60) {
      doc.addPage()
      yPos = margin + 20
    }

    // Alternating row colors
    if (index % 2 === 0) {
      doc.setFillColor(255, 255, 255)
    } else {
      doc.setFillColor(249, 250, 251) // Gray-50
    }
    doc.roundedRect(margin, yPos - 3, contentWidth, 10, 1, 1, 'F')

    doc.setFontSize(10)
    doc.setTextColor(...textDark)
    
    // Truncate long item names
    const maxWidth = contentWidth - 80
    let itemName = item.name
    const textWidth = doc.getTextWidth(itemName)
    if (textWidth > maxWidth) {
      // Truncate and add ellipsis
      while (doc.getTextWidth(itemName + '...') > maxWidth && itemName.length > 0) {
        itemName = itemName.slice(0, -1)
      }
      itemName += '...'
    }
    
    doc.text(itemName, margin + 5, yPos + 3)
    doc.text(formatCurrency(item.amount), pageWidth - margin - 5, yPos + 3, { align: 'right' })
    yPos += 10
  })

  yPos += 5

  // Total section
  if (yPos > pageHeight - 50) {
    doc.addPage()
    yPos = margin + 20
  }

  // Total box with accent color
  doc.setFillColor(...primaryColor)
  doc.roundedRect(margin, yPos, contentWidth, 20, 3, 3, 'F')
  
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text('Total Amount', margin + 10, yPos + 8)
  doc.text(formatCurrency(receipt.amount), pageWidth - margin - 10, yPos + 8, { align: 'right' })

  yPos += 35

  // Footer
  if (yPos > pageHeight - 40) {
    doc.addPage()
    yPos = margin
  }

  // Thank you message
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...textDark)
  doc.text('Thank you for your payment!', pageWidth / 2, yPos, { align: 'center' })
  yPos += 8

  // Footer line
  doc.setDrawColor(...primaryColor)
  doc.setLineWidth(0.5)
  doc.line(margin, yPos, pageWidth - margin, yPos)
  yPos += 10

  // Company info footer
  doc.setFontSize(9)
  doc.setTextColor(...textGray)
  doc.text('GritSync - NCLEX Application Services', pageWidth / 2, yPos, { align: 'center' })
  yPos += 5
  doc.text('This is an official receipt for your records.', pageWidth / 2, yPos, { align: 'center' })

  // Return PDF as Uint8Array
  const arrayBuffer = doc.output('arraybuffer')
  return new Uint8Array(arrayBuffer)
}

/**
 * Generate Invoice PDF
 */
export function generateInvoicePDF(invoice: InvoiceData): Uint8Array {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  const contentWidth = pageWidth - (margin * 2)
  let yPos = margin

  // Header with gradient effect
  doc.setFillColor(...primaryColor)
  doc.rect(0, 0, pageWidth, 50, 'F')
  
  // Company name
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(28)
  doc.setFont('helvetica', 'bold')
  doc.text('GRITSYNC', pageWidth / 2, 25, { align: 'center' })
  
  // Tagline
  doc.setFontSize(10)
  doc.setFont('helvetica', 'italic')
  doc.text('Business Consultancy Services', pageWidth / 2, 35, { align: 'center' })

  yPos = 70

  // Invoice title
  doc.setTextColor(...textDark)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('INVOICE', pageWidth / 2, yPos, { align: 'center' })
  yPos += 10

  // Invoice number and date box
  doc.setFillColor(...lightGray)
  doc.roundedRect(margin, yPos, contentWidth, 25, 3, 3, 'F')
  
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...textGray)
  doc.text('Invoice Number:', margin + 10, yPos + 8)
  doc.text('Date:', margin + 10, yPos + 18)
  
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...textDark)
  doc.text(`#${invoice.invoice_number}`, margin + 60, yPos + 8)
  
  const invoiceDate = new Date(invoice.created_at)
  const formattedDate = invoiceDate.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })
  doc.text(formattedDate, margin + 60, yPos + 18)

  yPos += 35

  // Billing information (if available)
  if (invoice.billing_address) {
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...textDark)
    doc.text('Bill To:', margin, yPos)
    yPos += 6
    
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...textGray)
    if (invoice.billing_address.name) {
      doc.text(invoice.billing_address.name, margin, yPos)
      yPos += 5
    }
    if (invoice.billing_address.email) {
      doc.text(invoice.billing_address.email, margin, yPos)
      yPos += 5
    }
    if (invoice.billing_address.address) {
      doc.text(invoice.billing_address.address, margin, yPos)
      yPos += 5
    }
    const addressParts = [
      invoice.billing_address.city,
      invoice.billing_address.state,
      invoice.billing_address.zip,
      invoice.billing_address.country
    ].filter(Boolean)
    if (addressParts.length > 0) {
      doc.text(addressParts.join(', '), margin, yPos)
      yPos += 5
    }
    yPos += 5
  }

  // Payment details section
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...textDark)
  doc.text('Payment Details', margin, yPos)
  yPos += 8

  // Payment type
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...textGray)
  const paymentTypeLabel = invoice.payment_type === 'step1' ? 'Step 1 Payment' : 
                           invoice.payment_type === 'step2' ? 'Step 2 Payment' : 
                           'Full Payment'
  doc.text(`Payment Type: ${paymentTypeLabel}`, margin, yPos)
  yPos += 10

  // Items section
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...textDark)
  doc.text('Items', margin, yPos)
  yPos += 8

  // Table header
  doc.setFillColor(...lightGray)
  doc.roundedRect(margin, yPos - 5, contentWidth, 10, 2, 2, 'F')
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...textDark)
  doc.text('Description', margin + 5, yPos + 2)
  doc.text('Amount', pageWidth - margin - 5, yPos + 2, { align: 'right' })
  yPos += 8

  // Items list
  doc.setFont('helvetica', 'normal')
  invoice.items.forEach((item, index) => {
    if (yPos > pageHeight - 80) {
      doc.addPage()
      yPos = margin + 20
    }

    // Alternating row colors
    if (index % 2 === 0) {
      doc.setFillColor(255, 255, 255)
    } else {
      doc.setFillColor(249, 250, 251) // Gray-50
    }
    doc.roundedRect(margin, yPos - 3, contentWidth, 10, 1, 1, 'F')

    doc.setFontSize(10)
    doc.setTextColor(...textDark)
    
    // Truncate long item names
    const maxWidth = contentWidth - 80
    let itemName = item.name
    const textWidth = doc.getTextWidth(itemName)
    if (textWidth > maxWidth) {
      while (doc.getTextWidth(itemName + '...') > maxWidth && itemName.length > 0) {
        itemName = itemName.slice(0, -1)
      }
      itemName += '...'
    }
    
    doc.text(itemName, margin + 5, yPos + 3)
    doc.text(formatCurrency(item.amount), pageWidth - margin - 5, yPos + 3, { align: 'right' })
    yPos += 10
  })

  yPos += 5

  // Totals section
  if (yPos > pageHeight - 80) {
    doc.addPage()
    yPos = margin + 20
  }

  // Subtotal
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...textGray)
  doc.text('Subtotal:', pageWidth - margin - 80, yPos)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...textDark)
  doc.text(formatCurrency(invoice.subtotal), pageWidth - margin - 5, yPos, { align: 'right' })
  yPos += 8

  // Tax
  if (invoice.tax > 0) {
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...textGray)
    doc.text('Tax (12%):', pageWidth - margin - 80, yPos)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...textDark)
    doc.text(formatCurrency(invoice.tax), pageWidth - margin - 5, yPos, { align: 'right' })
    yPos += 8
  }

  // Total box with accent color
  doc.setFillColor(...primaryColor)
  doc.roundedRect(margin, yPos, contentWidth, 20, 3, 3, 'F')
  
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text('Total Amount', margin + 10, yPos + 8)
  doc.text(formatCurrency(invoice.total), pageWidth - margin - 10, yPos + 8, { align: 'right' })

  yPos += 35

  // Footer
  if (yPos > pageHeight - 40) {
    doc.addPage()
    yPos = margin
  }

  // Payment terms
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...textGray)
  doc.text('Payment Terms: Payment received', margin, yPos)
  yPos += 8

  // Footer line
  doc.setDrawColor(...primaryColor)
  doc.setLineWidth(0.5)
  doc.line(margin, yPos, pageWidth - margin, yPos)
  yPos += 10

  // Company info footer
  doc.setFontSize(9)
  doc.setTextColor(...textGray)
  doc.text('GritSync - NCLEX Application Services', pageWidth / 2, yPos, { align: 'center' })
  yPos += 5
  doc.text('This is an official invoice for your records.', pageWidth / 2, yPos, { align: 'center' })

  // Return PDF as Uint8Array
  const arrayBuffer = doc.output('arraybuffer')
  return new Uint8Array(arrayBuffer)
}

/**
 * Convert PDF Uint8Array to base64 string for email attachment
 */
export function pdfToBase64(pdfData: Uint8Array): string {
  const binary = Array.from(pdfData)
    .map(byte => String.fromCharCode(byte))
    .join('')
  return btoa(binary)
}

/**
 * Convert PDF Uint8Array to File object
 */
export function pdfToFile(pdfData: Uint8Array, filename: string): File {
  const blob = new Blob([pdfData], { type: 'application/pdf' })
  return new File([blob], filename, { type: 'application/pdf' })
}

