/**
 * PDF Generation Utilities
 *
 * Generates professional receipt and invoice PDFs for payments. The two
 * documents share a red/charcoal-gray identity, a logo mark, and a QR code
 * verification block so a printed copy can be cross-checked against the
 * receipt number.
 */

import type { jsPDF } from 'jspdf'
import QRCode from 'qrcode'
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

// ─── Brand palette ────────────────────────────────────────────────────────────
const RED: [number, number, number] = [185, 28, 28]       // red-700 — primary
const RED_DEEP: [number, number, number] = [127, 29, 29]  // red-900 — header gradient end
const CHARCOAL: [number, number, number] = [31, 41, 55]   // gray-800 — body text
const GRAY_500: [number, number, number] = [107, 114, 128]
const GRAY_300: [number, number, number] = [209, 213, 219]
const GRAY_100: [number, number, number] = [243, 244, 246]
const GRAY_50:  [number, number, number] = [249, 250, 251]
const WHITE: [number, number, number] = [255, 255, 255]

const COMPANY = {
  name: 'GRITSYNC',
  tagline: 'NCLEX Processing Services',
  web: 'www.gritsync.com',
  contact: 'contact@gritsync.com',
}

// ─── Header / shared chrome ───────────────────────────────────────────────────

/** Red header band with logo mark, wordmark, and the document badge on the right. */
function drawHeader(doc: jsPDF, pageWidth: number, badge: string) {
  // Layered rectangles simulate a left→right red gradient.
  const bandHeight = 38
  doc.setFillColor(...RED_DEEP)
  doc.rect(0, 0, pageWidth, bandHeight, 'F')
  doc.setFillColor(...RED)
  doc.rect(0, 0, pageWidth * 0.62, bandHeight, 'F')

  // Logo mark — rounded square with a stylized "G".
  const logoX = 14
  const logoY = 10
  const logoSize = 18
  doc.setFillColor(...WHITE)
  doc.roundedRect(logoX, logoY, logoSize, logoSize, 3, 3, 'F')
  doc.setTextColor(...RED)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text('G', logoX + logoSize / 2, logoY + logoSize / 2 + 2.5, { align: 'center' })

  // Wordmark + tagline + web
  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text(COMPANY.name, logoX + logoSize + 6, 19)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(COMPANY.tagline, logoX + logoSize + 6, 25.5)
  doc.text(COMPANY.web, logoX + logoSize + 6, 30.5)

  // Document type badge (top-right)
  const badgeText = badge.toUpperCase()
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  const badgeWidth = Math.max(34, doc.getTextWidth(badgeText) + 12)
  const badgeX = pageWidth - badgeWidth - 14
  const badgeY = 13
  doc.setFillColor(...WHITE)
  doc.roundedRect(badgeX, badgeY, badgeWidth, 9, 1.5, 1.5, 'F')
  doc.setTextColor(...RED)
  doc.text(badgeText, badgeX + badgeWidth / 2, badgeY + 6.3, { align: 'center' })
}

/** Document title in red, with a charcoal subtitle. */
function drawTitle(doc: jsPDF, x: number, y: number, title: string, subtitle: string) {
  doc.setTextColor(...CHARCOAL)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(26)
  doc.text(title, x, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...GRAY_500)
  doc.text(subtitle, x, y + 6)
}

/**
 * Two side-by-side info panes (e.g. number + date). Returns the y position
 * just below the panes.
 */
function drawInfoStripe(
  doc: jsPDF,
  margin: number,
  contentWidth: number,
  y: number,
  left: { label: string; value: string },
  right: { label: string; value: string }
) {
  const h = 18
  const half = contentWidth / 2 - 2
  // Left card
  doc.setFillColor(...GRAY_100)
  doc.roundedRect(margin, y, half, h, 2.5, 2.5, 'F')
  // Right card
  doc.setFillColor(...GRAY_100)
  doc.roundedRect(margin + half + 4, y, half, h, 2.5, 2.5, 'F')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...GRAY_500)
  doc.text(left.label.toUpperCase(), margin + 5, y + 6)
  doc.text(right.label.toUpperCase(), margin + half + 9, y + 6)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11.5)
  doc.setTextColor(...CHARCOAL)
  doc.text(left.value, margin + 5, y + 13)
  doc.text(right.value, margin + half + 9, y + 13)

  return y + h + 8
}

/** Section label with a red accent bar. */
function drawSectionLabel(doc: jsPDF, x: number, y: number, label: string) {
  doc.setFillColor(...RED)
  doc.rect(x, y - 4.2, 1.6, 5.2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11.5)
  doc.setTextColor(...CHARCOAL)
  doc.text(label, x + 4, y)
  return y + 6
}

/** Footer block: thin separator, company info, generation note. */
function drawFooter(doc: jsPDF, pageWidth: number, pageHeight: number, verifyCode: string) {
  const margin = 14
  const y = pageHeight - 22
  doc.setDrawColor(...GRAY_300)
  doc.setLineWidth(0.3)
  doc.line(margin, y, pageWidth - margin, y)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...CHARCOAL)
  doc.text(`${COMPANY.name} · ${COMPANY.tagline}`, margin, y + 5)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...GRAY_500)
  doc.text(COMPANY.contact, margin, y + 9.5)
  doc.text(`Verify: ${verifyCode}`, pageWidth - margin, y + 5, { align: 'right' })
  doc.text(new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }), pageWidth - margin, y + 9.5, { align: 'right' })
}

/** Renders the QR code + caption on the bottom-left. Returns the bottom Y. */
async function drawQrBlock(
  doc: jsPDF,
  margin: number,
  y: number,
  payload: string,
  caption: string,
  subCaption: string
) {
  // Generate a high-contrast QR PNG. dark/red foreground keeps the brand cue;
  // light is white. errorCorrectionLevel='M' is a good balance of density and tolerance.
  const dataUrl = await QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 256,
    color: { dark: '#7f1d1d', light: '#ffffffff' },
  })
  const size = 28
  // White card behind so the QR pops on alternating backgrounds.
  doc.setFillColor(...WHITE)
  doc.roundedRect(margin - 2, y - 2, size + 4, size + 4, 2, 2, 'F')
  doc.setDrawColor(...GRAY_300)
  doc.setLineWidth(0.2)
  doc.roundedRect(margin - 2, y - 2, size + 4, size + 4, 2, 2, 'S')
  doc.addImage(dataUrl, 'PNG', margin, y, size, size)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...CHARCOAL)
  doc.text(caption, margin + size + 6, y + 8)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...GRAY_500)
  doc.text(subCaption, margin + size + 6, y + 13)
  doc.text('Scan to verify this document.', margin + size + 6, y + 18)

  return y + size
}

// ─── Receipt ─────────────────────────────────────────────────────────────────

export async function generateReceiptPDF(receipt: ReceiptData): Promise<Uint8Array> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 14
  const contentWidth = pageWidth - margin * 2

  drawHeader(doc, pageWidth, 'Receipt')

  let yPos = 56
  drawTitle(doc, margin, yPos, 'Payment Receipt', 'Thank you for your payment.')
  yPos += 14

  const receiptDate = new Date(receipt.created_at)
  const formattedDate = receiptDate.toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
  yPos = drawInfoStripe(doc, margin, contentWidth, yPos,
    { label: 'Receipt No.', value: `#${receipt.receipt_number}` },
    { label: 'Issued', value: formattedDate }
  )

  // ── Bill To / From two-column block
  const colY = yPos
  const colW = contentWidth / 2 - 4
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...GRAY_500)
  doc.text('BILLED TO', margin, colY)
  doc.text('FROM', margin + colW + 8, colY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...CHARCOAL)
  doc.text(receipt.user_name || 'Valued Customer', margin, colY + 6)
  doc.text(COMPANY.name, margin + colW + 8, colY + 6)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...GRAY_500)
  if (receipt.user_email) doc.text(receipt.user_email, margin, colY + 12)
  doc.text(COMPANY.tagline, margin + colW + 8, colY + 12)
  doc.text(COMPANY.contact, margin + colW + 8, colY + 17)
  if (receipt.application_id) {
    doc.text(`Application: ${receipt.application_id}`, margin, colY + 17)
  }
  yPos = colY + 26

  // ── Payment summary
  yPos = drawSectionLabel(doc, margin, yPos, 'Payment Summary')
  const paymentTypeLabel = receipt.payment_type === 'step1' ? 'Step 1 Payment' :
                           receipt.payment_type === 'step2' ? 'Step 2 Payment' :
                           'Full Payment'
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...GRAY_500)
  doc.text('Payment Type', margin, yPos)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...CHARCOAL)
  doc.text(paymentTypeLabel, pageWidth - margin, yPos, { align: 'right' })
  yPos += 8

  // ── Line items
  yPos = drawSectionLabel(doc, margin, yPos, 'Line Items')
  // Table header
  doc.setFillColor(...CHARCOAL)
  doc.roundedRect(margin, yPos - 2, contentWidth, 8, 1.5, 1.5, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...WHITE)
  doc.text('DESCRIPTION', margin + 5, yPos + 3.5)
  doc.text('AMOUNT', pageWidth - margin - 5, yPos + 3.5, { align: 'right' })
  yPos += 10

  doc.setFont('helvetica', 'normal')
  receipt.items.forEach((item, index) => {
    if (yPos > pageHeight - 90) {
      doc.addPage()
      drawHeader(doc, pageWidth, 'Receipt')
      yPos = 50
    }
    if (index % 2 === 1) {
      doc.setFillColor(...GRAY_50)
      doc.rect(margin, yPos - 4, contentWidth, 9, 'F')
    }
    doc.setFontSize(10)
    doc.setTextColor(...CHARCOAL)
    const maxWidth = contentWidth - 50
    let itemName = item.name
    if (doc.getTextWidth(itemName) > maxWidth) {
      while (doc.getTextWidth(itemName + '...') > maxWidth && itemName.length > 0) {
        itemName = itemName.slice(0, -1)
      }
      itemName += '...'
    }
    doc.text(itemName, margin + 5, yPos + 1)
    doc.text(formatCurrency(item.amount), pageWidth - margin - 5, yPos + 1, { align: 'right' })
    yPos += 9
  })
  yPos += 6

  // ── Total
  if (yPos > pageHeight - 70) {
    doc.addPage()
    drawHeader(doc, pageWidth, 'Receipt')
    yPos = 50
  }
  doc.setFillColor(...RED)
  doc.roundedRect(margin, yPos, contentWidth, 16, 2.5, 2.5, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...WHITE)
  doc.text('TOTAL PAID', margin + 6, yPos + 10.5)
  doc.setFontSize(16)
  doc.text(formatCurrency(receipt.amount), pageWidth - margin - 6, yPos + 10.5, { align: 'right' })
  yPos += 24

  // ── QR verification block
  const verifyPayload = [
    `Receipt: ${receipt.receipt_number}`,
    `Amount: ${formatCurrency(receipt.amount)}`,
    `Issued: ${formattedDate}`,
    receipt.application_id ? `App: ${receipt.application_id}` : '',
  ].filter(Boolean).join('\n')

  await drawQrBlock(
    doc,
    margin,
    yPos,
    verifyPayload,
    `Receipt #${receipt.receipt_number}`,
    `Total ${formatCurrency(receipt.amount)} · ${formattedDate}`
  )

  drawFooter(doc, pageWidth, pageHeight, receipt.receipt_number)

  const arrayBuffer = doc.output('arraybuffer')
  return new Uint8Array(arrayBuffer)
}

// ─── Invoice ─────────────────────────────────────────────────────────────────

export async function generateInvoicePDF(invoice: InvoiceData): Promise<Uint8Array> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 14
  const contentWidth = pageWidth - margin * 2

  drawHeader(doc, pageWidth, 'Invoice')

  let yPos = 56
  drawTitle(doc, margin, yPos, 'Invoice', 'Itemized billing summary.')
  yPos += 14

  const invoiceDate = new Date(invoice.created_at)
  const formattedDate = invoiceDate.toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
  yPos = drawInfoStripe(doc, margin, contentWidth, yPos,
    { label: 'Invoice No.', value: `#${invoice.invoice_number}` },
    { label: 'Issued', value: formattedDate }
  )

  // ── Bill To / From
  const colY = yPos
  const colW = contentWidth / 2 - 4
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...GRAY_500)
  doc.text('BILL TO', margin, colY)
  doc.text('FROM', margin + colW + 8, colY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...CHARCOAL)
  const billName = invoice.billing_address?.name || invoice.user_name || 'Valued Customer'
  doc.text(billName, margin, colY + 6)
  doc.text(COMPANY.name, margin + colW + 8, colY + 6)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...GRAY_500)
  let billLineY = colY + 12
  const billEmail = invoice.billing_address?.email || invoice.user_email
  if (billEmail) { doc.text(billEmail, margin, billLineY); billLineY += 5 }
  if (invoice.billing_address?.address) { doc.text(invoice.billing_address.address, margin, billLineY); billLineY += 5 }
  const addressParts = [
    invoice.billing_address?.city,
    invoice.billing_address?.state,
    invoice.billing_address?.zip,
    invoice.billing_address?.country,
  ].filter(Boolean) as string[]
  if (addressParts.length > 0) { doc.text(addressParts.join(', '), margin, billLineY); billLineY += 5 }
  if (invoice.application_id) { doc.text(`Application: ${invoice.application_id}`, margin, billLineY); billLineY += 5 }
  // FROM column lines
  doc.text(COMPANY.tagline, margin + colW + 8, colY + 12)
  doc.text(COMPANY.contact, margin + colW + 8, colY + 17)
  doc.text(COMPANY.web, margin + colW + 8, colY + 22)
  yPos = Math.max(billLineY, colY + 28)

  // ── Payment details
  yPos = drawSectionLabel(doc, margin, yPos, 'Payment Details')
  const paymentTypeLabel = invoice.payment_type === 'step1' ? 'Step 1 Payment' :
                           invoice.payment_type === 'step2' ? 'Step 2 Payment' :
                           'Full Payment'
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...GRAY_500)
  doc.text('Payment Type', margin, yPos)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...CHARCOAL)
  doc.text(paymentTypeLabel, pageWidth - margin, yPos, { align: 'right' })
  yPos += 8

  // ── Line items
  yPos = drawSectionLabel(doc, margin, yPos, 'Line Items')
  doc.setFillColor(...CHARCOAL)
  doc.roundedRect(margin, yPos - 2, contentWidth, 8, 1.5, 1.5, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...WHITE)
  doc.text('DESCRIPTION', margin + 5, yPos + 3.5)
  doc.text('AMOUNT', pageWidth - margin - 5, yPos + 3.5, { align: 'right' })
  yPos += 10

  doc.setFont('helvetica', 'normal')
  invoice.items.forEach((item, index) => {
    if (yPos > pageHeight - 110) {
      doc.addPage()
      drawHeader(doc, pageWidth, 'Invoice')
      yPos = 50
    }
    if (index % 2 === 1) {
      doc.setFillColor(...GRAY_50)
      doc.rect(margin, yPos - 4, contentWidth, 9, 'F')
    }
    doc.setFontSize(10)
    doc.setTextColor(...CHARCOAL)
    const maxWidth = contentWidth - 50
    let itemName = item.name
    if (doc.getTextWidth(itemName) > maxWidth) {
      while (doc.getTextWidth(itemName + '...') > maxWidth && itemName.length > 0) {
        itemName = itemName.slice(0, -1)
      }
      itemName += '...'
    }
    doc.text(itemName, margin + 5, yPos + 1)
    doc.text(formatCurrency(item.amount), pageWidth - margin - 5, yPos + 1, { align: 'right' })
    yPos += 9
  })
  yPos += 6

  // ── Totals stack
  if (yPos > pageHeight - 90) {
    doc.addPage()
    drawHeader(doc, pageWidth, 'Invoice')
    yPos = 50
  }
  const totalsX = pageWidth - margin - 70
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...GRAY_500)
  doc.text('Subtotal', totalsX, yPos)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...CHARCOAL)
  doc.text(formatCurrency(invoice.subtotal), pageWidth - margin - 5, yPos, { align: 'right' })
  yPos += 7
  if (invoice.tax > 0) {
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...GRAY_500)
    doc.text('Tax (12%)', totalsX, yPos)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...CHARCOAL)
    doc.text(formatCurrency(invoice.tax), pageWidth - margin - 5, yPos, { align: 'right' })
    yPos += 7
  }
  yPos += 2

  // Total bar
  doc.setFillColor(...RED)
  doc.roundedRect(margin, yPos, contentWidth, 16, 2.5, 2.5, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...WHITE)
  doc.text('TOTAL DUE', margin + 6, yPos + 10.5)
  doc.setFontSize(16)
  doc.text(formatCurrency(invoice.total), pageWidth - margin - 6, yPos + 10.5, { align: 'right' })
  yPos += 24

  // ── QR verification
  const verifyPayload = [
    `Invoice: ${invoice.invoice_number}`,
    `Total: ${formatCurrency(invoice.total)}`,
    `Issued: ${formattedDate}`,
    invoice.application_id ? `App: ${invoice.application_id}` : '',
  ].filter(Boolean).join('\n')
  await drawQrBlock(
    doc,
    margin,
    yPos,
    verifyPayload,
    `Invoice #${invoice.invoice_number}`,
    `Total ${formatCurrency(invoice.total)} · ${formattedDate}`
  )

  drawFooter(doc, pageWidth, pageHeight, invoice.invoice_number)

  const arrayBuffer = doc.output('arraybuffer')
  return new Uint8Array(arrayBuffer)
}

// ─── Helpers reused elsewhere ────────────────────────────────────────────────

/** Convert PDF bytes to base64 (e.g. for email attachments). */
export function pdfToBase64(pdfData: Uint8Array): string {
  const binary = Array.from(pdfData)
    .map((byte) => String.fromCharCode(byte))
    .join('')
  return btoa(binary)
}

/** Convert PDF bytes to a `File` object. */
export function pdfToFile(pdfData: Uint8Array, filename: string): File {
  const blob = new Blob([pdfData as unknown as BlobPart], { type: 'application/pdf' })
  return new File([blob], filename, { type: 'application/pdf' })
}
