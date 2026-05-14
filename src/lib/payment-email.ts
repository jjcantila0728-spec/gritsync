/**
 * Payment Email Service
 * Sends payment receipt confirmation emails.
 */

import { db } from './api-client'
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
  /** Optional pre-built attachments (receipt + invoice PDFs). */
  attachments?: File[]
}

/**
 * Send payment receipt email with PDF attachments
 */
export async function sendPaymentReceiptEmailWithAttachments(data: PaymentReceiptData): Promise<boolean> {
  try {
    // Get user email and name
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
    } else if (data.receipt.user_id) {
      // Fetch user from database
      const { data: userData, error: userError } = await db
        .from('users')
        .select('email, first_name, last_name')
        .eq('id', data.receipt.user_id)
        .single()
      
      if (!userError && userData) {
        const user = userData as { email?: string; full_name?: string; first_name?: string; last_name?: string }
        if (user.email) {
          userEmail = user.email
          userName = user.full_name || 
                     (user.first_name && user.last_name 
                       ? `${user.first_name} ${user.last_name}` 
                       : user.first_name || userName)
        }
      }
    }
    
    if (!userEmail) {
      console.error('No email found for payment receipt')
      return false
    }

    // Payment type label
    const paymentTypeLabel = data.receipt.payment_type === 'step1' ? 'Step 1 Payment' : 
                             data.receipt.payment_type === 'step2' ? 'Step 2 Payment' : 
                             'Full Payment'

    // Create email HTML
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
          }
          .email-container {
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .email-header {
            background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
          }
          .email-header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: bold;
          }
          .email-body {
            padding: 30px 20px;
          }
          .success-box {
            background: #d1fae5;
            border: 2px solid #10b981;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            text-align: center;
          }
          .success-box h2 {
            margin: 0 0 10px 0;
            color: #065f46;
            font-size: 20px;
          }
          .amount {
            font-size: 32px;
            font-weight: bold;
            color: #dc2626;
            margin: 15px 0;
          }
          .receipt-details {
            background: #f9fafb;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
          }
          .receipt-details table {
            width: 100%;
            border-collapse: collapse;
          }
          .receipt-details td {
            padding: 8px 0;
            border-bottom: 1px solid #e5e7eb;
          }
          .receipt-details td:first-child {
            font-weight: 600;
            color: #6b7280;
          }
          .attachments-note {
            background: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .footer {
            text-align: center;
            padding: 20px;
            color: #6b7280;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="email-header">
            <h1>GRITSYNC</h1>
          </div>
          <div class="email-body">
            <p>Hello ${userName},</p>
            
            <div class="success-box">
              <h2>✅ Payment Successful!</h2>
              <div class="amount">${formatCurrency(data.receipt.amount)}</div>
              <p style="margin: 0; color: #065f46;">Your payment has been processed successfully.</p>
            </div>

            <div class="receipt-details">
              <h3 style="margin-top: 0;">Payment Details</h3>
              <table>
                <tr>
                  <td>Receipt Number:</td>
                  <td><strong>#${data.receipt.receipt_number}</strong></td>
                </tr>
                <tr>
                  <td>Payment Type:</td>
                  <td>${paymentTypeLabel}</td>
                </tr>
                <tr>
                  <td>Payment Method:</td>
                  <td>${data.payment.payment_method ? data.payment.payment_method.charAt(0).toUpperCase() + data.payment.payment_method.slice(1) : 'Credit Card'}</td>
                </tr>
                <tr>
                  <td>Date:</td>
                  <td>${new Date(data.receipt.created_at).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}</td>
                </tr>
                <tr>
                  <td>Amount:</td>
                  <td><strong>${formatCurrency(data.receipt.amount)}</strong></td>
                </tr>
              </table>
            </div>

            ${data.attachments && data.attachments.length > 0 ? `
            <div class="attachments-note">
              <strong>📎 Attached to this email:</strong> your official receipt and invoice (PDF). Please save them for your records.
            </div>` : ''}

            <p>Thank you for your payment! Please keep this email as a record of your payment.</p>

            <p>If you have any questions about your payment, please don't hesitate to contact our support team.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} GritSync. All rights reserved.</p>
            <p>This is an automated email. Please do not reply to this message.</p>
          </div>
        </div>
      </body>
      </html>
    `

    return await sendEmail({
      to: userEmail,
      subject: `Payment Receipt ${data.receipt.receipt_number} - GritSync`,
      html: emailHtml,
      emailType: 'transactional',
      emailCategory: 'payment_receipt',
      recipientName: userName,
      recipientUserId: data.user?.id || data.receipt.user_id,
      applicationId: data.application?.id || data.receipt.application_id,
      attachments: data.attachments && data.attachments.length > 0 ? data.attachments : undefined,
      metadata: {
        receiptNumber: data.receipt.receipt_number,
        amount: data.receipt.amount,
        paymentType: data.receipt.payment_type,
        paymentId: data.payment.id,
        applicationId: data.application?.id || data.receipt.application_id,
      },
      tags: ['payment', 'receipt', 'invoice'],
    })
  } catch (error) {
    console.error('Error sending payment receipt email:', error)
    return false
  }
}

