import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { PDFDocument, rgb, StandardFonts } from 'npm:pdf-lib@1.17.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Cover letter HTML template
// Note: This template is available for reference. The current implementation uses pdf-lib
// for reliable PDF generation. To use this template directly, an HTML-to-PDF converter
// would be needed (e.g., Puppeteer, but this requires additional setup in Deno edge functions).
const coverLetterTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cover Letter - H-4 EAD Application</title>
    <style>
        @page {
            size: letter;
            margin: 0.5in;
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 11pt;
            line-height: 1.4;
            color: #000;
            margin: 0;
            padding: 0;
            background: white;
        }
        
        .letter-wrapper {
            border: 1px solid #000;
            padding: 0.75in;
            margin: 0 auto;
            max-width: 8.5in;
            max-height: 11in;
            height: 11in;
            overflow: hidden;
            background: white;
            box-sizing: border-box;
        }
        
        .letter-container {
            width: 100%;
            margin: 0 auto;
        }
        
        .sender-address {
            margin-bottom: 12px;
        }
        
        .sender-name {
            font-weight: bold;
            font-size: 11pt;
            margin-bottom: 4px;
        }
        
        .sender-details {
            font-size: 10pt;
            line-height: 1.3;
        }
        
        .date {
            text-align: right;
            font-size: 10pt;
            margin-bottom: 12px;
        }
        
        .recipient-address {
            font-size: 10pt;
            line-height: 1.3;
            margin-bottom: 10px;
        }
        
        .subject-line {
            font-weight: bold;
            font-size: 10pt;
            margin-bottom: 8px;
        }
        
        .greeting {
            font-size: 11pt;
            margin-bottom: 10px;
        }
        
        .body-content {
            font-size: 11pt;
            line-height: 1.5;
            text-align: justify;
            margin-bottom: 10px;
        }
        
        .body-content p {
            margin-bottom: 10px;
            text-indent: 0.5in;
            padding-left: 0;
        }
        
        .body-content p:first-of-type {
            text-indent: 0;
        }
        
        .document-list {
            margin-left: 0.5in;
            margin-top: 6px;
            margin-bottom: 6px;
            padding-left: 0.25in;
            counter-reset: item;
            list-style: none;
        }
        
        .document-list li {
            margin-bottom: 4px;
            line-height: 1.4;
            font-size: 10.5pt;
            counter-increment: item;
            position: relative;
            padding-left: 0.3in;
        }
        
        .document-list li::before {
            content: counter(item) ".";
            position: absolute;
            left: 0;
            font-weight: normal;
        }
        
        .ssn-bold {
            font-weight: bold;
        }
        
        .closing {
            margin-top: 12px;
            font-size: 11pt;
        }
        
        .signature-name {
            font-weight: bold;
            font-size: 11pt;
            margin-top: 12px;
        }
        
        .signature-contact {
            font-size: 10pt;
            margin-top: 4px;
            line-height: 1.3;
        }
    </style>
</head>
<body>
    <div class="letter-wrapper">
        <div class="letter-container">
        <!-- Sender Address -->
        <div class="sender-address">
            <div class="sender-name">{{APPLICANT_NAME}}</div>
            <div class="sender-details">
                {{STREET_ADDRESS}}{{STREET_ADDRESS_BR}}
                {{CITY_STATE_ZIP}}{{CITY_STATE_ZIP_BR}}
                {{COUNTRY}}{{COUNTRY_BR}}
                {{PHONE}}{{PHONE_BR}}
                {{EMAIL}}
            </div>
        </div>
            
            <!-- Date -->
            <div class="date">{{DATE}}</div>
            
            <!-- Recipient Address -->
            <div class="recipient-address">
                {{RECIPIENT_NAME}}<br>
                {{RECIPIENT_ATTN}}<br>
                {{RECIPIENT_PO_BOX}}<br>
                {{RECIPIENT_CITY_STATE_ZIP}}
            </div>
            
            <!-- Subject Line -->
            <div class="subject-line">Subject: Application for Employment Authorization Document (EAD) under H-4 Visa Category (C)(26)</div>
            
            <!-- Greeting -->
            <div class="greeting">Dear Sir / Madam,</div>
            
            <!-- Body Content -->
            <div class="body-content">
                <p>I am writing to respectfully submit my application for an Employment Authorization Document (EAD) as an H-4 visa holder under the (C)(26) eligibility category. My spouse, {{SPOUSE_NAME}}, is currently in valid H-1B status, and her Form I-140, Immigrant Petition for Alien Worker, has been approved.</p>
                
                <p>Enclosed, please find my completed Form I-765 along with all required supporting documentation to establish my eligibility. For ease of review, I have organized the documents in the following order:</p>
                
                <ol class="document-list">
                    <li>Form G-1145, E-Notification of Application/Petition Acceptance</li>
                    <li>Money Order in the amount of {{FEE_AMOUNT}} payable to "U.S. Department of Homeland Security"</li>
                    <li>Form I-765, Application for Employment Authorization</li>
                    <li>Two passport-style photographs (2x2 inches), labeled with my name and enclosed in a small envelope</li>
                    <li>Copy of my passport biographical page</li>
                    <li>Copy of my H-4 visa stamp</li>
                    <li>Copy of my most recent I-94 Arrival/Departure Record</li>
                    <li>Certified copy of our marriage certificate</li>
                    <li>Copy of my spouse's H-1B approval notice (Form I-797)</li>
                    <li>Copy of my spouse's approved Form I-140</li>
                    <li>Copy of my spouse's current employer verification letter and most recent pay stub</li>
                </ol>
                
                <p>I would also like to request concurrent processing of my Social Security Number (<span class="ssn-bold">SSN</span>) with this application. Should you need any further information or documentation, please feel free to contact me at the phone number or email address listed above.</p>
                
                <p>Thank you for your attention to this matter. I sincerely appreciate your time and consideration, and I look forward to a favorable response.</p>
            </div>
            
            <!-- Closing -->
            <div class="closing">Sincerely,</div>
            
            <!-- Signature -->
            <div class="signature-name">{{APPLICANT_NAME}}</div>
            <div class="signature-contact">
                {{PHONE}}<br>
                {{EMAIL}}
            </div>
        </div>
    </div>
</body>
</html>`

interface GenerateCoverLetterRequest {
  applicationData: {
    first_name?: string
    middle_name?: string
    last_name?: string
    application_type?: string
    house_number?: string
    street_address?: string
    street_name?: string
    apartment_suite?: string
    apartment?: string
    suite?: string
    floor?: string
    city?: string
    state?: string
    province?: string
    zip_code?: string
    zipcode?: string
    country?: string
    mobile_number?: string
    email?: string
    spouse_name?: string
    spouse_first_name?: string
    spouse_middle_name?: string
    spouse_last_name?: string
  }
  formsVerifiedData?: {
    serviceCenter?: {
      address?: {
        name?: string
        attn?: string
        poBox?: string
        city?: string
        state?: string
        zip?: string
      }
    }
    latestFee?: string
  }
}

// Format date to "Month Day, Year" format
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// Helper function to render the HTML template with data (available for future use)
function renderCoverLetterTemplate(data: {
  applicantName: string
  streetAddress: string
  cityStateZip: string
  country: string
  phone: string
  email: string
  date: string
  recipientName: string
  recipientAttn: string
  recipientPoBox: string
  recipientCityStateZip: string
  spouseName: string
  feeAmount: string
}): string {
  let html = coverLetterTemplate

  // Replace all placeholders
  html = html.replace(/\{\{APPLICANT_NAME\}\}/g, data.applicantName)
  html = html.replace(/\{\{STREET_ADDRESS\}\}/g, data.streetAddress)
  html = html.replace(/\{\{STREET_ADDRESS_BR\}\}/g, data.streetAddress ? '<br>' : '')
  html = html.replace(/\{\{CITY_STATE_ZIP\}\}/g, data.cityStateZip)
  html = html.replace(/\{\{CITY_STATE_ZIP_BR\}\}/g, data.cityStateZip ? '<br>' : '')
  html = html.replace(/\{\{COUNTRY\}\}/g, data.country)
  html = html.replace(/\{\{COUNTRY_BR\}\}/g, data.country ? '<br>' : '')
  html = html.replace(/\{\{PHONE\}\}/g, data.phone ? `Phone: ${data.phone}` : '')
  html = html.replace(/\{\{PHONE_BR\}\}/g, data.phone ? '<br>' : '')
  html = html.replace(/\{\{EMAIL\}\}/g, data.email ? `Email: ${data.email}` : '')
  html = html.replace(/\{\{DATE\}\}/g, data.date)
  html = html.replace(/\{\{RECIPIENT_NAME\}\}/g, data.recipientName)
  html = html.replace(/\{\{RECIPIENT_ATTN\}\}/g, data.recipientAttn)
  html = html.replace(/\{\{RECIPIENT_PO_BOX\}\}/g, data.recipientPoBox)
  html = html.replace(/\{\{RECIPIENT_CITY_STATE_ZIP\}\}/g, data.recipientCityStateZip)
  html = html.replace(/\{\{SPOUSE_NAME\}\}/g, data.spouseName)
  html = html.replace(/\{\{FEE_AMOUNT\}\}/g, data.feeAmount)

  return html
}

// Wrap text to fit within a width
function wrapText(text: string, maxWidth: number, fontSize: number, font: any): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word
    const width = font.widthOfTextAtSize(testLine, fontSize)

    if (width > maxWidth && currentLine) {
      lines.push(currentLine)
      currentLine = word
    } else {
      currentLine = testLine
    }
  }

  if (currentLine) {
    lines.push(currentLine)
  }

  return lines
}

// Justify text by adding spaces between words to fill the width
function justifyText(text: string, maxWidth: number, fontSize: number, font: any): string {
  const words = text.split(' ').filter(w => w.length > 0)
  
  // If only one word or empty, return as is
  if (words.length <= 1) {
    return text
  }
  
  // Calculate width of all words without spaces
  let wordsWidth = 0
  for (const word of words) {
    wordsWidth += font.widthOfTextAtSize(word, fontSize)
  }
  
  // Calculate how much space we have for spaces
  const numGaps = words.length - 1
  const spaceAvailable = maxWidth - wordsWidth
  const singleSpaceWidth = font.widthOfTextAtSize(' ', fontSize)
  
  // Calculate spaces per gap
  const spacesPerGap = Math.floor(spaceAvailable / singleSpaceWidth / numGaps)
  const remainingSpace = spaceAvailable - (spacesPerGap * singleSpaceWidth * numGaps)
  const extraSpaces = Math.floor(remainingSpace / singleSpaceWidth)
  
  // Build justified text
  let justifiedText = words[0]
  for (let i = 1; i < words.length; i++) {
    // Add base spaces plus distribute extra spaces
    const spaces = ' '.repeat(spacesPerGap + 1 + (i <= extraSpaces ? 1 : 0))
    justifiedText += spaces + words[i]
  }
  
  return justifiedText
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { applicationData, formsVerifiedData }: GenerateCoverLetterRequest = await req.json()

    if (!applicationData) {
      return new Response(
        JSON.stringify({ error: 'applicationData is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log('Starting cover letter generation...')

    // Get client information
    const applicantName = `${applicationData.first_name || ''} ${applicationData.middle_name || ''} ${applicationData.last_name || ''}`.trim()
    const applicantNameUpper = applicantName.toUpperCase()

    // Check if this is an EAD application
    const isEAD = applicationData.application_type === 'EAD'

    // Format address
    const houseNumber = isEAD ? '' : (applicationData.house_number || '')
    const streetName = isEAD ? (applicationData.street_address || '') : (applicationData.street_name || '')
    const apartment = isEAD
      ? (applicationData.apartment_suite || '')
      : (applicationData.apartment || applicationData.suite || applicationData.floor || '')
    const city = applicationData.city || ''
    const province = isEAD ? (applicationData.state || '') : (applicationData.province || '')
    const zipcode = isEAD ? (applicationData.zip_code || '') : (applicationData.zipcode || '')
    const country = applicationData.country || 'United States'

    // Format address lines
    const addressLines: string[] = []
    const streetAddressParts: string[] = []
    if (houseNumber && houseNumber.toUpperCase() !== 'N/A') {
      streetAddressParts.push(houseNumber)
    }
    if (streetName && streetName.toUpperCase() !== 'N/A') {
      streetAddressParts.push(streetName)
    }
    if (streetAddressParts.length > 0) {
      let streetLine = streetAddressParts.join(' ')
      if (apartment && apartment.toUpperCase() !== 'N/A') {
        streetLine += `, ${apartment}`
      }
      addressLines.push(streetLine)
    }

    const cityStateZipParts: string[] = []
    if (city && city.toUpperCase() !== 'N/A') {
      cityStateZipParts.push(city)
    }
    if (province && province.toUpperCase() !== 'N/A') {
      cityStateZipParts.push(province)
    }
    if (zipcode && zipcode.toUpperCase() !== 'N/A') {
      cityStateZipParts.push(zipcode)
    }
    if (cityStateZipParts.length > 0) {
      addressLines.push(cityStateZipParts.join(', '))
    }

    if (country && country.toUpperCase() !== 'N/A' && country.toUpperCase() !== 'UNITED STATES') {
      addressLines.push(country)
    }

    const phone = applicationData.mobile_number || ''
    const email = applicationData.email || ''

    // Get spouse name
    const spouseName = applicationData.spouse_name ||
      `${applicationData.spouse_first_name || ''} ${applicationData.spouse_middle_name || ''} ${applicationData.spouse_last_name || ''}`.trim() ||
      'AESA JANE PACLIBAR PAYONGA'

    // Current date
    const currentDate = formatDate(new Date())

    // Get service center and fee information
    const serviceCenter = formsVerifiedData?.serviceCenter
    const latestFee = formsVerifiedData?.latestFee || '$520'
    const feeAmount = latestFee.replace(/[$,]/g, '')
    const formattedFee = `$${parseFloat(feeAmount).toFixed(2)}`

    // Prepare recipient address
    let recipientName = 'U.S. Citizenship and Immigration Services'
    let recipientAttn = 'Attn: H-4 EAD'
    let recipientPoBox = 'P.O. Box 20400'
    let recipientCityStateZip = 'Phoenix, AZ 85036-0400'

    if (serviceCenter?.address) {
      recipientName = serviceCenter.address.name || recipientName
      recipientAttn = serviceCenter.address.attn ? `Attn: ${serviceCenter.address.attn}` : recipientAttn
      recipientPoBox = serviceCenter.address.poBox || recipientPoBox
      recipientCityStateZip = `${serviceCenter.address.city}, ${serviceCenter.address.state} ${serviceCenter.address.zip}`
    }

    // Create PDF
    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([612, 792]) // Letter size: 8.5" x 11" in points
    const { width, height } = page.getSize()

    // Load fonts
    const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman)
    const timesRomanBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold)

    // Page margins - 1 inch on all sides (1 inch = 72 points)
    const margin = 72
    const topMargin = 72
    const bottomMargin = 72
    const leftMargin = 72
    const rightMargin = 72
    const contentWidth = width - leftMargin - rightMargin
    let yPos = height - topMargin

    // No border for business letter format

    // Sender name (bold) - with spacing
    page.drawText(applicantNameUpper, {
      x: leftMargin,
      y: yPos,
      size: 11,
      font: timesRomanBold,
      color: rgb(0, 0, 0),
    })
    yPos -= 16 // Increased spacing after name

    // Sender address - with proper line spacing
    for (const line of addressLines) {
      if (line) {
        page.drawText(line, {
          x: leftMargin,
          y: yPos,
          size: 10,
          font: timesRoman,
          color: rgb(0, 0, 0),
        })
        yPos -= 13 // Slightly increased line spacing for readability
      }
    }

    // Phone and email - with spacing
    if (phone) {
      page.drawText(`Phone: ${phone}`, {
        x: leftMargin,
        y: yPos,
        size: 10,
        font: timesRoman,
        color: rgb(0, 0, 0),
      })
      yPos -= 13
    }
    if (email) {
      page.drawText(`Email: ${email}`, {
        x: leftMargin,
        y: yPos,
        size: 10,
        font: timesRoman,
        color: rgb(0, 0, 0),
      })
      yPos -= 13
    }

    yPos -= 16 // Increased spacing before date section

    // Date (right aligned) - with better spacing
    const dateText = currentDate
    const dateWidth = timesRoman.widthOfTextAtSize(dateText, 10)
    page.drawText(dateText, {
      x: width - rightMargin - dateWidth,
      y: yPos,
      size: 10,
      font: timesRoman,
      color: rgb(0, 0, 0),
    })
    yPos -= 18 // Increased spacing after date

    // Recipient address - with proper line spacing
    page.drawText(recipientName, {
      x: leftMargin,
      y: yPos,
      size: 10,
      font: timesRoman,
      color: rgb(0, 0, 0),
    })
    yPos -= 13
    page.drawText(recipientAttn, {
      x: leftMargin,
      y: yPos,
      size: 10,
      font: timesRoman,
      color: rgb(0, 0, 0),
    })
    yPos -= 13
    page.drawText(recipientPoBox, {
      x: leftMargin,
      y: yPos,
      size: 10,
      font: timesRoman,
      color: rgb(0, 0, 0),
    })
    yPos -= 13
    page.drawText(recipientCityStateZip, {
      x: leftMargin,
      y: yPos,
      size: 10,
      font: timesRoman,
      color: rgb(0, 0, 0),
    })
    yPos -= 20 // Increased spacing before subject

    // Subject line (bold) - with better spacing
    const subjectText = 'Subject: Application for Employment Authorization Document (EAD) under H-4 Visa Category (C)(26)'
    const subjectLines = wrapText(subjectText, contentWidth, 10, timesRomanBold)
    for (const line of subjectLines) {
      page.drawText(line, {
        x: leftMargin,
        y: yPos,
        size: 10,
        font: timesRomanBold,
        color: rgb(0, 0, 0),
      })
      yPos -= 13
    }
    yPos -= 12 // Increased spacing after subject

    // Greeting - with proper spacing
    page.drawText('Dear Sir / Madam,', {
      x: leftMargin,
      y: yPos,
      size: 11,
      font: timesRoman,
      color: rgb(0, 0, 0),
    })
    yPos -= 20 // Increased spacing after greeting

    // Body paragraphs - with proper indentation, spacing, and justification
    const bodyTexts = [
      `I am writing to respectfully submit my application for an Employment Authorization Document (EAD) as an H-4 visa holder under the (C)(26) eligibility category. My spouse, ${spouseName.toUpperCase()}, is currently in valid H-1B status, and her Form I-140, Immigrant Petition for Alien Worker, has been approved.`,
      `Enclosed, please find my completed Form I-765 along with all required supporting documentation to establish my eligibility. For ease of review, I have organized the documents in the following order:`,
    ]

    for (const text of bodyTexts) {
      const lines = wrapText(text, contentWidth, 11, timesRoman) // Full width, no indent
      const lineWidth = contentWidth // Width for justified lines
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const indent = 0 // No indent, all lines start at left margin
        const isLastLine = i === lines.length - 1
        
        // Justify all lines except the last line of each paragraph (last line stays left-aligned)
        const textToDraw = isLastLine ? line : justifyText(line, lineWidth, 11, timesRoman)
        
        page.drawText(textToDraw, {
          x: leftMargin + indent,
          y: yPos,
          size: 11,
          font: timesRoman,
          color: rgb(0, 0, 0),
        })
        yPos -= 16 // Increased line spacing for better readability
      }
      yPos -= 8 // Increased spacing between paragraphs
    }

    // Document list - with proper indentation and spacing
    const documents = [
      'Form G-1145, E-Notification of Application/Petition Acceptance',
      `Money Order in the amount of ${formattedFee} payable to "U.S. Department of Homeland Security"`,
      'Form I-765, Application for Employment Authorization',
      'Two passport-style photographs (2x2 inches), labeled with my name and enclosed in a small envelope',
      'Copy of my passport biographical page',
      'Copy of my H-4 visa stamp',
      'Copy of my most recent I-94 Arrival/Departure Record',
      'Certified copy of our marriage certificate',
      "Copy of my spouse's H-1B approval notice (Form I-797)",
      "Copy of my spouse's approved Form I-140",
      "Copy of my spouse's current employer verification letter and most recent pay stub",
    ]

    const listIndent = 36 // 0.5 inch indent for list items
    const listWidth = contentWidth - listIndent - 24 // Account for number and spacing
    
    for (let i = 0; i < documents.length; i++) {
      const docText = `${i + 1}. ${documents[i]}`
      const lines = wrapText(docText, listWidth, 10.5, timesRoman)
      for (let j = 0; j < lines.length; j++) {
        const line = lines[j]
        // First line includes number, subsequent lines indent further for text alignment
        const lineIndent = j === 0 ? listIndent : listIndent + 20
        page.drawText(line, {
          x: leftMargin + lineIndent,
          y: yPos,
          size: 10.5,
          font: timesRoman,
          color: rgb(0, 0, 0),
        })
        yPos -= 13 // Better line spacing for list items
      }
      yPos -= 2 // Small spacing between list items
    }

    yPos -= 10 // Increased spacing after document list

    // Remaining body paragraphs - with proper indentation and justification
    const remainingTexts = [
      `I would also like to request concurrent processing of my Social Security Number (SSN) with this application. Should you need any further information or documentation, please feel free to contact me at the phone number or email address listed above.`,
      `Thank you for your attention to this matter. I sincerely appreciate your time and consideration, and I look forward to a favorable response.`,
    ]

    for (const text of remainingTexts) {
      const lines = wrapText(text, contentWidth, 11, timesRoman) // Full width, no indent
      const lineWidth = contentWidth // Width for justified lines
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const indent = 0 // No indent, all lines start at left margin
        const isLastLine = i === lines.length - 1
        
        // Justify all lines except the last line of each paragraph (last line stays left-aligned)
        const textToDraw = isLastLine ? line : justifyText(line, lineWidth, 11, timesRoman)
        
        page.drawText(textToDraw, {
          x: leftMargin + indent,
          y: yPos,
          size: 11,
          font: timesRoman,
          color: rgb(0, 0, 0),
        })
        yPos -= 16 // Better line spacing
      }
      yPos -= 8 // Increased spacing between paragraphs
    }

    // Closing - with proper spacing
    yPos -= 12 // Increased spacing before closing
    page.drawText('Sincerely,', {
      x: leftMargin,
      y: yPos,
      size: 11,
      font: timesRoman,
      color: rgb(0, 0, 0),
    })
    yPos -= 24 // Increased spacing for signature area

    // Signature name (bold) - with spacing
    page.drawText(applicantNameUpper, {
      x: leftMargin,
      y: yPos,
      size: 11,
      font: timesRomanBold,
      color: rgb(0, 0, 0),
    })
    yPos -= 18 // Increased spacing after signature name

    // Signature contact - with proper spacing
    if (phone) {
      page.drawText(phone, {
        x: leftMargin,
        y: yPos,
        size: 10,
        font: timesRoman,
        color: rgb(0, 0, 0),
      })
      yPos -= 13
    }
    if (email) {
      page.drawText(email, {
        x: leftMargin,
        y: yPos,
        size: 10,
        font: timesRoman,
        color: rgb(0, 0, 0),
      })
    }

    // Save the PDF
    console.log('Saving cover letter PDF...')
    const pdfBytes = await pdfDoc.save()
    const arrayBuffer = new ArrayBuffer(pdfBytes.length)
    new Uint8Array(arrayBuffer).set(pdfBytes)

    // Convert to base64 for response
    const base64 = btoa(
      String.fromCharCode(...new Uint8Array(arrayBuffer))
    )

    console.log('Cover letter generation completed successfully')

    return new Response(
      JSON.stringify({
        success: true,
        pdf: base64,
        message: 'Cover letter generated successfully',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error generating cover letter:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to generate cover letter',
        details: error instanceof Error ? error.stack : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

