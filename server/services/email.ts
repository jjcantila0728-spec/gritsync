import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected');
  }
  return {
    apiKey: connectionSettings.settings.api_key, 
    fromEmail: connectionSettings.settings.from_email
  };
}

async function getUncachableResendClient() {
  const credentials = await getCredentials();
  return {
    client: new Resend(credentials.apiKey),
    fromEmail: credentials.fromEmail
  };
}

interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
}

function getBaseEmailTemplate(content: string, preheader: string = ''): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>GritSync</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    .preheader { display: none !important; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5;">
  <span class="preheader">${preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #DC2626 0%, #991B1B 100%); padding: 30px 40px; border-radius: 8px 8px 0 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">GritSync</h1>
                    <p style="margin: 5px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Achieve Your American Dream</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="background-color: #ffffff; padding: 40px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px 40px; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="text-align: center;">
                    <p style="margin: 0 0 10px; color: #6b7280; font-size: 14px;">GritSync - Your NCLEX Processing Partner</p>
                    <p style="margin: 0; color: #9ca3af; font-size: 12px;">Helping Filipino nurses achieve their US nursing dreams</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendEmail(options: EmailOptions) {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    
    const emailPayload: any = {
      from: fromEmail,
      to: options.to,
      subject: options.subject,
    };
    
    if (options.html) emailPayload.html = options.html;
    if (options.text) emailPayload.text = options.text;
    
    const result = await client.emails.send(emailPayload);
    console.log('Email sent successfully to:', options.to);
    
    return { success: true, data: result };
  } catch (error: any) {
    console.error('Failed to send email:', error.message);
    return { success: false, error: error.message };
  }
}

export async function sendWelcomeEmail(email: string, name: string) {
  const content = `
    <h2 style="margin: 0 0 20px; color: #111827; font-size: 24px; font-weight: 600;">Welcome to GritSync, ${name}!</h2>
    <p style="margin: 0 0 16px; color: #374151; font-size: 16px; line-height: 1.6;">Thank you for joining us on your journey to becoming a licensed nurse in the United States. We're excited to help you achieve your American Dream!</p>
    <p style="margin: 0 0 16px; color: #374151; font-size: 16px; line-height: 1.6;">Here's what you can do with your GritSync account:</p>
    <ul style="margin: 0 0 24px; padding-left: 20px; color: #374151; font-size: 16px; line-height: 1.8;">
      <li>Submit and track your NCLEX applications</li>
      <li>Get personalized quotations for our services</li>
      <li>Access your application timeline and status updates</li>
      <li>Connect with NCLEX sponsorship opportunities</li>
    </ul>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
      <tr>
        <td style="background-color: #DC2626; border-radius: 6px;">
          <a href="${process.env.REPLIT_DEV_DOMAIN ? 'https://' + process.env.REPLIT_DEV_DOMAIN : 'http://localhost:5000'}/dashboard" style="display: inline-block; padding: 14px 28px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600;">Go to Dashboard</a>
        </td>
      </tr>
    </table>
    <p style="margin: 0; color: #374151; font-size: 16px; line-height: 1.6;">If you have any questions, our support team is here to help!</p>
  `;
  
  return sendEmail({
    to: email,
    subject: 'Welcome to GritSync - Your NCLEX Journey Begins!',
    html: getBaseEmailTemplate(content, 'Welcome to GritSync! Start your journey to becoming a US-licensed nurse.')
  });
}

export async function sendPasswordResetEmail(email: string, name: string, resetToken: string) {
  const resetUrl = `${process.env.REPLIT_DEV_DOMAIN ? 'https://' + process.env.REPLIT_DEV_DOMAIN : 'http://localhost:5000'}/reset-password?token=${resetToken}`;
  
  const content = `
    <h2 style="margin: 0 0 20px; color: #111827; font-size: 24px; font-weight: 600;">Reset Your Password</h2>
    <p style="margin: 0 0 16px; color: #374151; font-size: 16px; line-height: 1.6;">Hello ${name},</p>
    <p style="margin: 0 0 16px; color: #374151; font-size: 16px; line-height: 1.6;">We received a request to reset your password. Click the button below to create a new password:</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
      <tr>
        <td style="background-color: #DC2626; border-radius: 6px;">
          <a href="${resetUrl}" style="display: inline-block; padding: 14px 28px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600;">Reset Password</a>
        </td>
      </tr>
    </table>
    <p style="margin: 0 0 16px; color: #6b7280; font-size: 14px; line-height: 1.6;">This link will expire in 1 hour for security reasons.</p>
    <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.6;">If you didn't request this password reset, you can safely ignore this email.</p>
  `;
  
  return sendEmail({
    to: email,
    subject: 'GritSync - Reset Your Password',
    html: getBaseEmailTemplate(content, 'Reset your GritSync password')
  });
}

export async function sendApplicationStatusEmail(email: string, name: string, status: string, applicationId: string) {
  const statusColors: Record<string, string> = {
    'pending': '#F59E0B',
    'in_progress': '#3B82F6',
    'approved': '#10B981',
    'completed': '#10B981',
    'rejected': '#EF4444'
  };
  const statusColor = statusColors[status.toLowerCase()] || '#6B7280';
  
  const content = `
    <h2 style="margin: 0 0 20px; color: #111827; font-size: 24px; font-weight: 600;">Application Status Update</h2>
    <p style="margin: 0 0 16px; color: #374151; font-size: 16px; line-height: 1.6;">Hello ${name},</p>
    <p style="margin: 0 0 16px; color: #374151; font-size: 16px; line-height: 1.6;">Your application status has been updated:</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0; background-color: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
      <tr>
        <td style="padding: 20px;">
          <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px;">Application ID</p>
          <p style="margin: 0 0 16px; color: #111827; font-size: 16px; font-weight: 600;">${applicationId}</p>
          <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px;">Status</p>
          <span style="display: inline-block; padding: 6px 12px; background-color: ${statusColor}; color: #ffffff; border-radius: 4px; font-size: 14px; font-weight: 600;">${status.toUpperCase()}</span>
        </td>
      </tr>
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
      <tr>
        <td style="background-color: #DC2626; border-radius: 6px;">
          <a href="${process.env.REPLIT_DEV_DOMAIN ? 'https://' + process.env.REPLIT_DEV_DOMAIN : 'http://localhost:5000'}/dashboard/applications" style="display: inline-block; padding: 14px 28px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600;">View Application</a>
        </td>
      </tr>
    </table>
  `;
  
  return sendEmail({
    to: email,
    subject: `GritSync - Application Status Update: ${status}`,
    html: getBaseEmailTemplate(content, `Your application status is now: ${status}`)
  });
}

export async function sendPaymentConfirmationEmail(email: string, name: string, amount: string, description: string) {
  const content = `
    <h2 style="margin: 0 0 20px; color: #111827; font-size: 24px; font-weight: 600;">Payment Confirmed</h2>
    <p style="margin: 0 0 16px; color: #374151; font-size: 16px; line-height: 1.6;">Hello ${name},</p>
    <p style="margin: 0 0 16px; color: #374151; font-size: 16px; line-height: 1.6;">Thank you for your payment. Here are the details:</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0; background-color: #f0fdf4; border-radius: 8px; border: 1px solid #bbf7d0;">
      <tr>
        <td style="padding: 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #bbf7d0;">
                <span style="color: #6b7280; font-size: 14px;">Amount Paid</span>
              </td>
              <td style="padding: 8px 0; border-bottom: 1px solid #bbf7d0; text-align: right;">
                <span style="color: #111827; font-size: 18px; font-weight: 700;">${amount}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0;">
                <span style="color: #6b7280; font-size: 14px;">Description</span>
              </td>
              <td style="padding: 8px 0; text-align: right;">
                <span style="color: #111827; font-size: 14px;">${description}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <p style="margin: 0; color: #374151; font-size: 16px; line-height: 1.6;">If you have any questions about this payment, please contact our support team.</p>
  `;
  
  return sendEmail({
    to: email,
    subject: 'GritSync - Payment Confirmation',
    html: getBaseEmailTemplate(content, `Payment of ${amount} confirmed`)
  });
}

export async function sendQuotationEmail(email: string, name: string, quotationDetails: any) {
  const content = `
    <h2 style="margin: 0 0 20px; color: #111827; font-size: 24px; font-weight: 600;">Your NCLEX Application Quotation</h2>
    <p style="margin: 0 0 16px; color: #374151; font-size: 16px; line-height: 1.6;">Hello ${name},</p>
    <p style="margin: 0 0 16px; color: #374151; font-size: 16px; line-height: 1.6;">Thank you for requesting a quotation. Here are the details:</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0; background-color: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
      <tr>
        <td style="padding: 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                <span style="color: #6b7280; font-size: 14px;">Services</span>
              </td>
              <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">
                <span style="color: #111827; font-size: 14px;">${quotationDetails.services || 'N/A'}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 0;">
                <span style="color: #111827; font-size: 16px; font-weight: 600;">Total</span>
              </td>
              <td style="padding: 12px 0; text-align: right;">
                <span style="color: #DC2626; font-size: 20px; font-weight: 700;">${quotationDetails.total || 'N/A'}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <p style="margin: 0 0 16px; color: #6b7280; font-size: 14px; line-height: 1.6;">This quotation is valid for 30 days.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
      <tr>
        <td style="background-color: #DC2626; border-radius: 6px;">
          <a href="${process.env.REPLIT_DEV_DOMAIN ? 'https://' + process.env.REPLIT_DEV_DOMAIN : 'http://localhost:5000'}/apply" style="display: inline-block; padding: 14px 28px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600;">Start Application</a>
        </td>
      </tr>
    </table>
  `;
  
  return sendEmail({
    to: email,
    subject: 'GritSync - Your Quotation',
    html: getBaseEmailTemplate(content, 'Your NCLEX application quotation is ready')
  });
}

export async function sendNewsletterEmail(emails: string[], subject: string, htmlContent: string) {
  const results = [];
  for (const email of emails) {
    const result = await sendEmail({
      to: email,
      subject,
      html: getBaseEmailTemplate(htmlContent, subject)
    });
    results.push({ email, ...result });
  }
  return results;
}

export async function sendTestEmail(to: string, subject?: string) {
  const content = `
    <h2 style="margin: 0 0 20px; color: #111827; font-size: 24px; font-weight: 600;">Test Email</h2>
    <p style="margin: 0 0 16px; color: #374151; font-size: 16px; line-height: 1.6;">This is a test email to verify your email settings are working correctly.</p>
    <p style="margin: 0; color: #6b7280; font-size: 14px;">Sent from GritSync admin panel at ${new Date().toISOString()}</p>
  `;
  
  return sendEmail({
    to,
    subject: subject || 'GritSync - Test Email',
    html: getBaseEmailTemplate(content, 'Test email from GritSync')
  });
}

export async function sendDonationReceiptEmail(email: string, name: string, amount: string, donationId: string) {
  const content = `
    <h2 style="margin: 0 0 20px; color: #111827; font-size: 24px; font-weight: 600;">Thank You for Your Donation!</h2>
    <p style="margin: 0 0 16px; color: #374151; font-size: 16px; line-height: 1.6;">Hello ${name},</p>
    <p style="margin: 0 0 16px; color: #374151; font-size: 16px; line-height: 1.6;">Thank you for your generous donation. Your support helps us continue our mission of helping Filipino nurses achieve their American dream.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0; background-color: #fef3c7; border-radius: 8px; border: 1px solid #fcd34d;">
      <tr>
        <td style="padding: 20px; text-align: center;">
          <p style="margin: 0 0 8px; color: #92400e; font-size: 14px;">Donation Amount</p>
          <p style="margin: 0 0 16px; color: #92400e; font-size: 32px; font-weight: 700;">${amount}</p>
          <p style="margin: 0; color: #b45309; font-size: 12px;">Donation ID: ${donationId}</p>
        </td>
      </tr>
    </table>
    <p style="margin: 0; color: #374151; font-size: 16px; line-height: 1.6;">Your kindness makes a real difference. Thank you!</p>
  `;
  
  return sendEmail({
    to: email,
    subject: 'GritSync - Thank You for Your Donation!',
    html: getBaseEmailTemplate(content, `Thank you for your ${amount} donation!`)
  });
}
