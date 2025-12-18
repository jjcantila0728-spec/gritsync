import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { PDFDocument, rgb, StandardFonts } from 'npm:pdf-lib@1.17.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ReceiptItem {
  name: string
  amount: number
}

interface InvoiceItem {
  name: string
  amount: number
  taxable?: boolean
}

interface ReceiptData {
  receipt_number: string
  amount: number
  payment_type: string
  items: ReceiptItem[]
  created_at: string
  application_id?: string
  user_name?: string
  user_email?: string
}

interface InvoiceData {
  invoice_number: string
  amount: number
  payment_type: string
  items: InvoiceItem[]
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

interface GeneratePDFsRequest {
  receipt?: ReceiptData
  invoice?: InvoiceData
}

// Format currency
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

// Format date
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// Generate Receipt PDF
async function generateReceiptPDF(data: ReceiptData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([612, 792]) // Letter size: 8.5" x 11"
  const { width, height } = page.getSize()

  // Load fonts
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const helveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

  // Colors
  const primaryColor = rgb(0.863, 0.149, 0.149) // #dc2626
  const lightGray = rgb(0.953, 0.957, 0.965) // #f3f4f6
  const textGray = rgb(0.420, 0.447, 0.502) // #6b7280
  const textDark = rgb(0.067, 0.094, 0.153) // #111827

  const margin = 20
  const contentWidth = width - margin * 2
  let yPos = height - margin

  // Header with red background
  page.drawRectangle({
    x: 0,
    y: height - 50,
    width: width,
    height: 50,
    color: primaryColor,
  })

  // Company name (centered)
  const companyName = 'GRITSYNC'
  const companyNameWidth = helveticaBold.widthOfTextAtSize(companyName, 28)
  page.drawText(companyName, {
    x: width / 2 - companyNameWidth / 2,
    y: height - 25,
    size: 28,
    font: helveticaBold,
    color: rgb(1, 1, 1),
  })

  // Tagline (centered)
  const tagline = 'Business Consultancy Services'
  const taglineWidth = helveticaOblique.widthOfTextAtSize(tagline, 10)
  page.drawText(tagline, {
    x: width / 2 - taglineWidth / 2,
    y: height - 35,
    size: 10,
    font: helveticaOblique,
    color: rgb(1, 1, 1),
  })

  yPos = height - 70

  // Receipt title
  const receiptTitle = 'PAYMENT RECEIPT'
  const titleWidth = helveticaBold.widthOfTextAtSize(receiptTitle, 20)
  page.drawText(receiptTitle, {
    x: width / 2 - titleWidth / 2,
    y: yPos,
    size: 20,
    font: helveticaBold,
    color: textDark,
  })
  yPos -= 20

  // Receipt info box
  page.drawRoundedRectangle({
    x: margin,
    y: yPos - 25,
    width: contentWidth,
    height: 25,
    borderColor: lightGray,
    borderWidth: 0,
    color: lightGray,
    borderRadius: 3,
  })

  page.drawText('Receipt Number:', {
    x: margin + 10,
    y: yPos - 8,
    size: 12,
    font: helvetica,
    color: textGray,
  })

  page.drawText(`#${data.receipt_number}`, {
    x: margin + 60,
    y: yPos - 8,
    size: 12,
    font: helveticaBold,
    color: textDark,
  })

  page.drawText('Date:', {
    x: margin + 10,
    y: yPos - 18,
    size: 12,
    font: helvetica,
    color: textGray,
  })

  const formattedDate = formatDate(data.created_at)
  page.drawText(formattedDate, {
    x: margin + 60,
    y: yPos - 18,
    size: 12,
    font: helveticaBold,
    color: textDark,
  })

  yPos -= 40

  // Client info (if available)
  if (data.user_name || data.user_email) {
    page.drawText('Client Information', {
      x: margin,
      y: yPos,
      size: 14,
      font: helveticaBold,
      color: textDark,
    })
    yPos -= 15

    if (data.user_name) {
      page.drawText(`Name: ${data.user_name}`, {
        x: margin,
        y: yPos,
        size: 11,
        font: helvetica,
        color: textGray,
      })
      yPos -= 12
    }

    if (data.user_email) {
      page.drawText(`Email: ${data.user_email}`, {
        x: margin,
        y: yPos,
        size: 11,
        font: helvetica,
        color: textGray,
      })
      yPos -= 15
    }
    yPos -= 5
  }

  // Payment details
  page.drawText('Payment Details', {
    x: margin,
    y: yPos,
    size: 14,
    font: helveticaBold,
    color: textDark,
  })
  yPos -= 15

  const paymentTypeLabel =
    data.payment_type === 'step1'
      ? 'Step 1 Payment'
      : data.payment_type === 'step2'
      ? 'Step 2 Payment'
      : 'Full Payment'

  page.drawText(`Payment Type: ${paymentTypeLabel}`, {
    x: margin,
    y: yPos,
    size: 11,
    font: helvetica,
    color: textGray,
  })
  yPos -= 20

  // Items section
  page.drawText('Items', {
    x: margin,
    y: yPos,
    size: 14,
    font: helveticaBold,
    color: textDark,
  })
  yPos -= 15

  // Table header
  page.drawRoundedRectangle({
    x: margin,
    y: yPos - 10,
    width: contentWidth,
    height: 10,
    borderColor: lightGray,
    borderWidth: 0,
    color: lightGray,
    borderRadius: 2,
  })

  page.drawText('Description', {
    x: margin + 5,
    y: yPos - 3,
    size: 10,
    font: helveticaBold,
    color: textDark,
  })

  const amountLabel = 'Amount'
  const amountWidth = helveticaBold.widthOfTextAtSize(amountLabel, 10)
  page.drawText(amountLabel, {
    x: width - margin - 5 - amountWidth,
    y: yPos - 3,
    size: 10,
    font: helveticaBold,
    color: textDark,
  })

  yPos -= 15

  // Items list
  let currentPage = page
  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i]

    if (yPos < 100) {
      // Add new page if needed
      currentPage = pdfDoc.addPage([612, 792])
      currentPage.drawText('(continued)', {
        x: margin,
        y: height - 20,
        size: 9,
        font: helvetica,
        color: textGray,
      })
      yPos = height - margin - 20
    }

    // Alternating row colors
    const rowColor = i % 2 === 0 ? rgb(1, 1, 1) : rgb(0.976, 0.980, 0.984) // White or Gray-50
    currentPage.drawRoundedRectangle({
      x: margin,
      y: yPos - 10,
      width: contentWidth,
      height: 10,
      borderColor: rowColor,
      borderWidth: 0,
      color: rowColor,
      borderRadius: 1,
    })

    // Truncate long item names
    let itemName = item.name
    const maxWidth = contentWidth - 80
    let textWidth = helvetica.widthOfTextAtSize(itemName, 10)
    if (textWidth > maxWidth) {
      while (textWidth > maxWidth && itemName.length > 0) {
        itemName = itemName.slice(0, -1)
        textWidth = helvetica.widthOfTextAtSize(itemName + '...', 10)
      }
      itemName += '...'
    }

    currentPage.drawText(itemName, {
      x: margin + 5,
      y: yPos - 3,
      size: 10,
      font: helvetica,
      color: textDark,
    })

    const formattedAmount = formatCurrency(item.amount)
    const amountTextWidth = helvetica.widthOfTextAtSize(formattedAmount, 10)
    currentPage.drawText(formattedAmount, {
      x: width - margin - 5 - amountTextWidth,
      y: yPos - 3,
      size: 10,
      font: helvetica,
      color: textDark,
    })

    yPos -= 12
  }

  yPos -= 10

  // Total section
  if (yPos < 80) {
    currentPage = pdfDoc.addPage([612, 792])
    yPos = height - margin - 20
  }

  currentPage.drawRoundedRectangle({
    x: margin,
    y: yPos - 20,
    width: contentWidth,
    height: 20,
    borderColor: primaryColor,
    borderWidth: 0,
    color: primaryColor,
    borderRadius: 3,
  })

  currentPage.drawText('Total Amount', {
    x: margin + 10,
    y: yPos - 8,
    size: 16,
    font: helveticaBold,
    color: rgb(1, 1, 1),
  })

  const totalAmount = formatCurrency(data.amount)
  const totalWidth = helveticaBold.widthOfTextAtSize(totalAmount, 16)
  currentPage.drawText(totalAmount, {
    x: width - margin - 10 - totalWidth,
    y: yPos - 8,
    size: 16,
    font: helveticaBold,
    color: rgb(1, 1, 1),
  })

  yPos -= 40

  // Footer
  if (yPos < 60) {
    currentPage = pdfDoc.addPage([612, 792])
    yPos = height - margin
  }

  // Thank you message (centered)
  const thankYouText = 'Thank you for your payment!'
  const thankYouWidth = helvetica.widthOfTextAtSize(thankYouText, 12)
  currentPage.drawText(thankYouText, {
    x: width / 2 - thankYouWidth / 2,
    y: yPos,
    size: 12,
    font: helvetica,
    color: textDark,
  })
  yPos -= 15

  // Footer line
  currentPage.drawLine({
    start: { x: margin, y: yPos },
    end: { x: width - margin, y: yPos },
    thickness: 0.5,
    color: primaryColor,
  })
  yPos -= 15

  // Footer text (centered)
  const footerText1 = 'GritSync - NCLEX Application Services'
  const footer1Width = helvetica.widthOfTextAtSize(footerText1, 9)
  currentPage.drawText(footerText1, {
    x: width / 2 - footer1Width / 2,
    y: yPos,
    size: 9,
    font: helvetica,
    color: textGray,
  })
  yPos -= 10

  const footerText2 = 'This is an official receipt for your records.'
  const footer2Width = helvetica.widthOfTextAtSize(footerText2, 9)
  currentPage.drawText(footerText2, {
    x: width / 2 - footer2Width / 2,
    y: yPos,
    size: 9,
    font: helvetica,
    color: textGray,
  })

  const pdfBytes = await pdfDoc.save()
  return pdfBytes
}

// Generate Invoice PDF
async function generateInvoicePDF(data: InvoiceData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([612, 792]) // Letter size: 8.5" x 11"
  const { width, height } = page.getSize()

  // Load fonts
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const helveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

  // Colors
  const primaryColor = rgb(0.863, 0.149, 0.149) // #dc2626
  const lightGray = rgb(0.953, 0.957, 0.965) // #f3f4f6
  const textGray = rgb(0.420, 0.447, 0.502) // #6b7280
  const textDark = rgb(0.067, 0.094, 0.153) // #111827

  const margin = 20
  const contentWidth = width - margin * 2
  let yPos = height - margin

  // Header with red background
  page.drawRectangle({
    x: 0,
    y: height - 50,
    width: width,
    height: 50,
    color: primaryColor,
  })

  // Company name (centered)
  const companyName = 'GRITSYNC'
  const companyNameWidth = helveticaBold.widthOfTextAtSize(companyName, 28)
  page.drawText(companyName, {
    x: width / 2 - companyNameWidth / 2,
    y: height - 25,
    size: 28,
    font: helveticaBold,
    color: rgb(1, 1, 1),
  })

  // Tagline (centered)
  const tagline = 'Business Consultancy Services'
  const taglineWidth = helveticaOblique.widthOfTextAtSize(tagline, 10)
  page.drawText(tagline, {
    x: width / 2 - taglineWidth / 2,
    y: height - 35,
    size: 10,
    font: helveticaOblique,
    color: rgb(1, 1, 1),
  })

  yPos = height - 70

  // Invoice title
  const invoiceTitle = 'INVOICE'
  const titleWidth = helveticaBold.widthOfTextAtSize(invoiceTitle, 20)
  page.drawText(invoiceTitle, {
    x: width / 2 - titleWidth / 2,
    y: yPos,
    size: 20,
    font: helveticaBold,
    color: textDark,
  })
  yPos -= 20

  // Invoice info box
  page.drawRoundedRectangle({
    x: margin,
    y: yPos - 25,
    width: contentWidth,
    height: 25,
    borderColor: lightGray,
    borderWidth: 0,
    color: lightGray,
    borderRadius: 3,
  })

  page.drawText('Invoice Number:', {
    x: margin + 10,
    y: yPos - 8,
    size: 12,
    font: helvetica,
    color: textGray,
  })

  page.drawText(`#${data.invoice_number}`, {
    x: margin + 60,
    y: yPos - 8,
    size: 12,
    font: helveticaBold,
    color: textDark,
  })

  page.drawText('Date:', {
    x: margin + 10,
    y: yPos - 18,
    size: 12,
    font: helvetica,
    color: textGray,
  })

  const formattedDate = formatDate(data.created_at)
  page.drawText(formattedDate, {
    x: margin + 60,
    y: yPos - 18,
    size: 12,
    font: helveticaBold,
    color: textDark,
  })

  yPos -= 40

  // Billing info (if available)
  if (data.billing_address) {
    page.drawText('Bill To', {
      x: margin,
      y: yPos,
      size: 14,
      font: helveticaBold,
      color: textDark,
    })
    yPos -= 15

    if (data.billing_address.name) {
      page.drawText(data.billing_address.name, {
        x: margin,
        y: yPos,
        size: 11,
        font: helvetica,
        color: textGray,
      })
      yPos -= 12
    }

    if (data.billing_address.email) {
      page.drawText(data.billing_address.email, {
        x: margin,
        y: yPos,
        size: 11,
        font: helvetica,
        color: textGray,
      })
      yPos -= 12
    }

    if (data.billing_address.address) {
      page.drawText(data.billing_address.address, {
        x: margin,
        y: yPos,
        size: 11,
        font: helvetica,
        color: textGray,
      })
      yPos -= 12
    }

    if (data.billing_address.city && data.billing_address.state) {
      const cityStateZip = `${data.billing_address.city}, ${data.billing_address.state} ${data.billing_address.zip || ''}`.trim()
      page.drawText(cityStateZip, {
        x: margin,
        y: yPos,
        size: 11,
        font: helvetica,
        color: textGray,
      })
      yPos -= 12
    }

    if (data.billing_address.country) {
      page.drawText(data.billing_address.country, {
        x: margin,
        y: yPos,
        size: 11,
        font: helvetica,
        color: textGray,
      })
      yPos -= 15
    }
    yPos -= 5
  }

  // Items section
  page.drawText('Items', {
    x: margin,
    y: yPos,
    size: 14,
    font: helveticaBold,
    color: textDark,
  })
  yPos -= 15

  // Table header
  page.drawRoundedRectangle({
    x: margin,
    y: yPos - 10,
    width: contentWidth,
    height: 10,
    borderColor: lightGray,
    borderWidth: 0,
    color: lightGray,
    borderRadius: 2,
  })

  page.drawText('Description', {
    x: margin + 5,
    y: yPos - 3,
    size: 10,
    font: helveticaBold,
    color: textDark,
  })

  const amountLabel = 'Amount'
  const amountWidth = helveticaBold.widthOfTextAtSize(amountLabel, 10)
  page.drawText(amountLabel, {
    x: width - margin - 5 - amountWidth,
    y: yPos - 3,
    size: 10,
    font: helveticaBold,
    color: textDark,
  })

  yPos -= 15

  // Items list
  let currentPage = page
  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i]

    if (yPos < 120) {
      // Add new page if needed
      currentPage = pdfDoc.addPage([612, 792])
      currentPage.drawText('(continued)', {
        x: margin,
        y: height - 20,
        size: 9,
        font: helvetica,
        color: textGray,
      })
      yPos = height - margin - 20
    }

    // Alternating row colors
    const rowColor = i % 2 === 0 ? rgb(1, 1, 1) : rgb(0.976, 0.980, 0.984)
    currentPage.drawRoundedRectangle({
      x: margin,
      y: yPos - 10,
      width: contentWidth,
      height: 10,
      borderColor: rowColor,
      borderWidth: 0,
      color: rowColor,
      borderRadius: 1,
    })

    // Truncate long item names
    let itemName = item.name
    const maxWidth = contentWidth - 80
    let textWidth = helvetica.widthOfTextAtSize(itemName, 10)
    if (textWidth > maxWidth) {
      while (textWidth > maxWidth && itemName.length > 0) {
        itemName = itemName.slice(0, -1)
        textWidth = helvetica.widthOfTextAtSize(itemName + '...', 10)
      }
      itemName += '...'
    }

    currentPage.drawText(itemName, {
      x: margin + 5,
      y: yPos - 3,
      size: 10,
      font: helvetica,
      color: textDark,
    })

    const formattedAmount = formatCurrency(item.amount)
    const amountTextWidth = helvetica.widthOfTextAtSize(formattedAmount, 10)
    currentPage.drawText(formattedAmount, {
      x: width - margin - 5 - amountTextWidth,
      y: yPos - 3,
      size: 10,
      font: helvetica,
      color: textDark,
    })

    yPos -= 12
  }

  yPos -= 10

  // Totals summary
  if (yPos < 100) {
    currentPage = pdfDoc.addPage([612, 792])
    yPos = height - margin - 20
  }

  currentPage.drawText('Subtotal:', {
    x: width - margin - 50,
    y: yPos,
    size: 11,
    font: helvetica,
    color: textDark,
  })

  const subtotalText = formatCurrency(data.subtotal)
  const subtotalWidth = helvetica.widthOfTextAtSize(subtotalText, 11)
  currentPage.drawText(subtotalText, {
    x: width - margin - 5 - subtotalWidth,
    y: yPos,
    size: 11,
    font: helvetica,
    color: textDark,
  })
  yPos -= 12

  if (data.tax > 0) {
    currentPage.drawText('Tax:', {
      x: width - margin - 50,
      y: yPos,
      size: 11,
      font: helvetica,
      color: textDark,
    })

    const taxText = formatCurrency(data.tax)
    const taxWidth = helvetica.widthOfTextAtSize(taxText, 11)
    currentPage.drawText(taxText, {
      x: width - margin - 5 - taxWidth,
      y: yPos,
      size: 11,
      font: helvetica,
      color: textDark,
    })
    yPos -= 15
  } else {
    yPos -= 5
  }

  // Total line
  currentPage.drawLine({
    start: { x: width - margin - 60, y: yPos },
    end: { x: width - margin, y: yPos },
    thickness: 0.5,
    color: textDark,
  })
  yPos -= 10

  // Total box
  currentPage.drawRoundedRectangle({
    x: margin,
    y: yPos - 20,
    width: contentWidth,
    height: 20,
    borderColor: primaryColor,
    borderWidth: 0,
    color: primaryColor,
    borderRadius: 3,
  })

  currentPage.drawText('Total Amount:', {
    x: width - margin - 60,
    y: yPos - 8,
    size: 16,
    font: helveticaBold,
    color: rgb(1, 1, 1),
  })

  const totalAmount = formatCurrency(data.total)
  const totalWidth = helveticaBold.widthOfTextAtSize(totalAmount, 16)
  currentPage.drawText(totalAmount, {
    x: width - margin - 5 - totalWidth,
    y: yPos - 8,
    size: 16,
    font: helveticaBold,
    color: rgb(1, 1, 1),
  })

  yPos -= 40

  // Footer
  if (yPos < 60) {
    currentPage = pdfDoc.addPage([612, 792])
    yPos = height - margin
  }

  // Footer text (centered)
  const footerText1 = 'GritSync - Business Consultancy Services'
  const footer1Width = helvetica.widthOfTextAtSize(footerText1, 9)
  currentPage.drawText(footerText1, {
    x: width / 2 - footer1Width / 2,
    y: yPos,
    size: 9,
    font: helvetica,
    color: textGray,
  })
  yPos -= 10

  const footerText2 = 'Thank you for your business!'
  const footer2Width = helvetica.widthOfTextAtSize(footerText2, 9)
  currentPage.drawText(footerText2, {
    x: width / 2 - footer2Width / 2,
    y: yPos,
    size: 9,
    font: helvetica,
    color: textGray,
  })

  const pdfBytes = await pdfDoc.save()
  return pdfBytes
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const requestData: GeneratePDFsRequest = await req.json()

    if (!requestData.receipt && !requestData.invoice) {
      return new Response(
        JSON.stringify({ error: 'Either receipt or invoice data is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const result: {
      receipt?: string
      invoice?: string
    } = {}

    // Generate Receipt PDF if requested
    if (requestData.receipt) {
      console.log('Generating receipt PDF...')
      const receiptPdfBytes = await generateReceiptPDF(requestData.receipt)
      const receiptBase64 = btoa(
        String.fromCharCode(...new Uint8Array(receiptPdfBytes))
      )
      result.receipt = receiptBase64
      console.log('Receipt PDF generated successfully')
    }

    // Generate Invoice PDF if requested
    if (requestData.invoice) {
      console.log('Generating invoice PDF...')
      const invoicePdfBytes = await generateInvoicePDF(requestData.invoice)
      const invoiceBase64 = btoa(
        String.fromCharCode(...new Uint8Array(invoicePdfBytes))
      )
      result.invoice = invoiceBase64
      console.log('Invoice PDF generated successfully')
    }

    return new Response(
      JSON.stringify({
        success: true,
        ...result,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error generating PDFs:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to generate PDFs',
        details: error instanceof Error ? error.stack : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

