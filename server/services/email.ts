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
    
    return { success: true, data: result };
  } catch (error: any) {
    console.error('Failed to send email:', error.message);
    return { success: false, error: error.message };
  }
}

export async function sendWelcomeEmail(email: string, name: string) {
  return sendEmail({
    to: email,
    subject: 'Welcome to GritSync - Your NCLEX Journey Begins!',
    html: `
      <h1>Welcome to GritSync, ${name}!</h1>
      <p>Thank you for joining us on your journey to becoming a licensed nurse in the United States.</p>
      <p>We're here to help you navigate every step of the NCLEX application process.</p>
      <p>If you have any questions, don't hesitate to reach out to our support team.</p>
      <p>Best regards,<br>The GritSync Team</p>
    `
  });
}

export async function sendApplicationStatusEmail(email: string, name: string, status: string, applicationId: string) {
  return sendEmail({
    to: email,
    subject: `GritSync - Application Status Update: ${status}`,
    html: `
      <h1>Application Status Update</h1>
      <p>Hello ${name},</p>
      <p>Your application (ID: ${applicationId}) status has been updated to: <strong>${status}</strong></p>
      <p>Log in to your GritSync account to view more details.</p>
      <p>Best regards,<br>The GritSync Team</p>
    `
  });
}

export async function sendPaymentConfirmationEmail(email: string, name: string, amount: string, description: string) {
  return sendEmail({
    to: email,
    subject: 'GritSync - Payment Confirmation',
    html: `
      <h1>Payment Confirmed</h1>
      <p>Hello ${name},</p>
      <p>We have received your payment of <strong>${amount}</strong> for: ${description}</p>
      <p>Thank you for your payment. If you have any questions, please contact our support team.</p>
      <p>Best regards,<br>The GritSync Team</p>
    `
  });
}

export async function sendQuotationEmail(email: string, name: string, quotationDetails: any) {
  return sendEmail({
    to: email,
    subject: 'GritSync - Your Quotation',
    html: `
      <h1>Your NCLEX Application Quotation</h1>
      <p>Hello ${name},</p>
      <p>Thank you for requesting a quotation. Here are the details:</p>
      <p><strong>Services:</strong> ${quotationDetails.services || 'N/A'}</p>
      <p><strong>Total:</strong> ${quotationDetails.total || 'N/A'}</p>
      <p>This quotation is valid for 30 days.</p>
      <p>Best regards,<br>The GritSync Team</p>
    `
  });
}
