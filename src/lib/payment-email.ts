/**
 * Payment Email Service
 * Sends payment receipt emails with PDF attachments
 * NOTE: This feature is currently stubbed pending full migration
 */

import { sendEmail } from './email-service'
import { formatCurrency } from './utils'

interface PaymentReceiptData {
  receipt: {
    id: string
    receipt_number: string
    amount: number
    payment_type: string
    items: Array<{ name: string; amount: number }>
    created_at: string
    application_id?: string
    user_id?: string
  }
  payment: {
    id: string
    amount: number
    payment_type: string
    payment_method?: string
    application_id?: string
    user_id?: string
  }
  application?: {
    id: string
    first_name?: string
    last_name?: string
    email?: string
    mobile_number?: string
    province?: string
    city?: string
    country?: string
    zipcode?: string
  }
  user?: {
    id: string
    email?: string
    full_name?: string
    first_name?: string
    last_name?: string
  }
}

/**
 * Send payment receipt email with PDF attachments
 */
export async function sendPaymentReceiptEmailWithAttachments(data: PaymentReceiptData): Promise<boolean> {
  try {
    let userEmail: string | undefined
    let userName: string = 'Valued Customer'
    
    if (data.user?.email) {
      userEmail = data.user.email
      userName = data.user.full_name || 
                 (data.user.first_name && data.user.last_name 
                   ? `${data.user.first_name} ${data.user.last_name}` 
                   : data.user.first_name || userName)
    } else if (data.application?.email) {
      userEmail = data.application.email
      userName = data.application.first_name && data.application.last_name
        ? `${data.application.first_name} ${data.application.last_name}`
        : data.application.first_name || userName
    }
    
    if (!userEmail) {
      console.error('No email address found for payment receipt')
      return false
    }
    
    const formattedAmount = formatCurrency(data.receipt.amount)
    const receiptNumber = data.receipt.receipt_number
    
    const itemsHtml = data.receipt.items.map(item => 
      `<tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(item.amount)}</td>
      </tr>`
    ).join('')
    
    const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Receipt</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #DC2626 0%, #B91C1C 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1>Payment Received</h1>
  </div>
  <div style="background: #fff; padding: 30px; border: 1px solid #e5e7eb;">
    <p>Hello ${userName},</p>
    <p>Thank you for your payment! Here are the details:</p>
    
    <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p><strong>Receipt Number:</strong> ${receiptNumber}</p>
      <p><strong>Amount:</strong> ${formattedAmount}</p>
      <p><strong>Date:</strong> ${new Date(data.receipt.created_at).toLocaleDateString()}</p>
    </div>
    
    <h3>Payment Details</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr>
          <th style="padding: 8px; text-align: left; border-bottom: 2px solid #ddd;">Item</th>
          <th style="padding: 8px; text-align: right; border-bottom: 2px solid #ddd;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
      <tfoot>
        <tr>
          <td style="padding: 8px; font-weight: bold;">Total</td>
          <td style="padding: 8px; text-align: right; font-weight: bold;">${formattedAmount}</td>
        </tr>
      </tfoot>
    </table>
    
    <p style="margin-top: 30px;">If you have any questions, please don't hesitate to contact us.</p>
  </div>
  <div style="background: #f9fafb; padding: 20px; text-align: center; font-size: 14px; color: #6b7280; border-radius: 0 0 8px 8px;">
    <p>GritSync - Your NCLEX Processing Partner</p>
  </div>
</body>
</html>`
    
    const result = await sendEmail({
      to: userEmail,
      subject: `Payment Receipt - ${receiptNumber}`,
      html: emailHtml,
    })
    
    return result.success
  } catch (error) {
    console.error('Error sending payment receipt email:', error)
    return false
  }
}
