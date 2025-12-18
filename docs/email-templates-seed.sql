-- Email Templates Seed Data
-- Run this in Supabase SQL Editor to populate email_templates table
-- These templates will be managed via /admin/emails/templates
-- Updated to match production schema with html_content, text_content columns

-- Clear existing templates (optional - comment out if you want to keep existing)
-- DELETE FROM email_templates;

-- Payment Receipt Template
INSERT INTO email_templates (id, name, description, slug, subject, html_content, text_content, category, template_type, variables, is_active, is_default, version)
VALUES (
  gen_random_uuid(),
  'Payment Receipt',
  'Sent to users after successful payment',
  'payment-receipt',
  'Payment Receipt - {{amount}} - GritSync',
  '<div class="email-content">
    <h1>Payment Received</h1>
    <p>Hi {{userName}},</p>
    <p>Thank you for your payment! Your transaction has been completed successfully.</p>
    
    <div class="info-box" style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 25px 0; border-radius: 6px;">
      <h2 style="margin-top: 0;">Payment Details</h2>
      <table style="margin: 0; width: 100%;">
        <tr>
          <td style="border: none; padding: 8px 0;"><strong>Amount:</strong></td>
          <td style="border: none; text-align: right; color: #10b981; font-size: 24px; font-weight: bold;">{{amount}}</td>
        </tr>
        <tr>
          <td style="border: none; padding: 8px 0;"><strong>Transaction ID:</strong></td>
          <td style="border: none; text-align: right;">{{transactionId}}</td>
        </tr>
        <tr>
          <td style="border: none; padding: 8px 0;"><strong>Date:</strong></td>
          <td style="border: none; text-align: right;">{{paymentDate}}</td>
        </tr>
        <tr>
          <td style="border: none; padding: 8px 0;"><strong>Description:</strong></td>
          <td style="border: none; text-align: right;">{{description}}</td>
        </tr>
      </table>
    </div>
    
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <thead>
        <tr>
          <th style="background-color: #f9fafb; padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Item</th>
          <th style="background-color: #f9fafb; padding: 12px; text-align: right; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Amount</th>
        </tr>
      </thead>
      <tbody>
        {{itemsTable}}
      </tbody>
    </table>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{receiptUrl}}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Download Receipt</a>
    </div>
    
    <p>This payment confirmation has been sent to your email for your records.</p>
    
    <div class="card" style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <p style="margin: 0;"><strong>Need help?</strong> If you have any questions about this payment, please do not hesitate to contact our support team.</p>
    </div>
  </div>',
  'Payment Receipt

Hi {{userName}},

Thank you for your payment! Your transaction has been completed successfully.

Payment Details:
- Amount: {{amount}}
- Transaction ID: {{transactionId}}
- Date: {{paymentDate}}
- Description: {{description}}

Download your receipt: {{receiptUrl}}

This payment confirmation has been sent to your email for your records.

Need help? If you have any questions about this payment, please contact our support team.',
  'transactional',
  'payment_receipt',
  '["userName", "amount", "transactionId", "paymentDate", "description", "itemsTable", "receiptUrl"]'::jsonb,
  true,
  true,
  1
);

-- Timeline Update Template
INSERT INTO email_templates (id, name, description, slug, subject, html_content, text_content, category, template_type, variables, is_active, is_default, version)
VALUES (
  gen_random_uuid(),
  'Timeline Update',
  'Sent when application status changes',
  'timeline-update',
  'Application Update: {{updateTitle}} - GritSync',
  '<div class="email-content">
    <h1>Application Update</h1>
    <p>Hi {{userName}},</p>
    <p>There has been an update to your NCLEX application.</p>
    
    <div class="info-box" style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 25px 0; border-radius: 6px;">
      <h2 style="margin-top: 0;">{{updateTitle}}</h2>
      <p style="margin: 0;">{{updateMessage}}</p>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{actionUrl}}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">View Application</a>
    </div>
    
    <p>Log in to your dashboard to view the full details and any required actions.</p>
  </div>',
  'Application Update

Hi {{userName}},

There has been an update to your NCLEX application.

{{updateTitle}}
{{updateMessage}}

View your application: {{actionUrl}}

Log in to your dashboard to view the full details and any required actions.',
  'transactional',
  'timeline_update',
  '["userName", "updateTitle", "updateMessage", "actionUrl"]'::jsonb,
  true,
  true,
  1
);

-- Missing Document Template
INSERT INTO email_templates (id, name, description, slug, subject, html_content, text_content, category, template_type, variables, is_active, is_default, version)
VALUES (
  gen_random_uuid(),
  'Missing Document Reminder',
  'Reminder for users to upload missing documents',
  'missing-document',
  'Action Required: Missing Documents - GritSync',
  '<div class="email-content">
    <h1>Missing Documents</h1>
    <p>Hi {{userName}},</p>
    <p>We noticed that some required documents are missing from your NCLEX application. Please upload the following documents to continue with your application:</p>
    
    <div class="warning-box" style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 25px 0; border-radius: 6px;">
      <h3 style="margin-top: 0; color: #92400e;">Required Documents:</h3>
      <p style="margin: 0;">{{documentList}}</p>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{uploadUrl}}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Upload Documents</a>
    </div>
    
    <p>If you have any questions about the required documents, please contact our support team.</p>
  </div>',
  'Missing Documents

Hi {{userName}},

We noticed that some required documents are missing from your NCLEX application. Please upload the following documents to continue with your application:

Required Documents:
{{documentList}}

Upload documents: {{uploadUrl}}

If you have any questions about the required documents, please contact our support team.',
  'transactional',
  'missing_document',
  '["userName", "documentList", "uploadUrl"]'::jsonb,
  true,
  true,
  1
);

-- Missing Details Template
INSERT INTO email_templates (id, name, description, slug, subject, html_content, text_content, category, template_type, variables, is_active, is_default, version)
VALUES (
  gen_random_uuid(),
  'Missing Details Reminder',
  'Reminder for users to complete profile details',
  'missing-details',
  'Action Required: Complete Your Profile - GritSync',
  '<div class="email-content">
    <h1>Complete Your Profile</h1>
    <p>Hi {{userName}},</p>
    <p>We noticed that some information is missing from your profile. Please update the following details to continue with your NCLEX application:</p>
    
    <div class="warning-box" style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 25px 0; border-radius: 6px;">
      <h3 style="margin-top: 0; color: #92400e;">Missing Information:</h3>
      <p style="margin: 0;">{{fieldList}}</p>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{profileUrl}}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Update Profile</a>
    </div>
    
    <p>Completing your profile helps us process your application faster.</p>
  </div>',
  'Complete Your Profile

Hi {{userName}},

We noticed that some information is missing from your profile. Please update the following details to continue with your NCLEX application:

Missing Information:
{{fieldList}}

Update your profile: {{profileUrl}}

Completing your profile helps us process your application faster.',
  'transactional',
  'missing_details',
  '["userName", "fieldList", "profileUrl"]'::jsonb,
  true,
  true,
  1
);

-- Application Approved Template
INSERT INTO email_templates (id, name, description, slug, subject, html_content, text_content, category, template_type, variables, is_active, is_default, version)
VALUES (
  gen_random_uuid(),
  'Application Approved',
  'Congratulations email when application is approved',
  'application-approved',
  'Congratulations! Your {{serviceType}} Has Been Approved - GritSync',
  '<div class="email-content">
    <h1>Application Approved!</h1>
    <p>Hi {{userName}},</p>
    <p>Great news! Your {{serviceType}} application has been <strong>approved</strong> on {{approvalDate}}.</p>
    
    <div class="info-box" style="background-color: #d1fae5; border-left: 4px solid #10b981; padding: 20px; margin: 25px 0; border-radius: 6px;">
      <h2 style="margin-top: 0; color: #065f46;">Congratulations!</h2>
      <p style="margin: 0;">Your application (ID: {{applicationId}}) has been reviewed and approved. You are one step closer to achieving your American Dream!</p>
    </div>
    
    <h3>Next Steps:</h3>
    <p>{{nextSteps}}</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{applicationUrl}}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">View Application</a>
    </div>
    
    <p>If you have any questions, our team is here to help you every step of the way.</p>
  </div>',
  'Application Approved!

Hi {{userName}},

Great news! Your {{serviceType}} application has been approved on {{approvalDate}}.

Congratulations!
Your application (ID: {{applicationId}}) has been reviewed and approved. You are one step closer to achieving your American Dream!

Next Steps:
{{nextSteps}}

View your application: {{applicationUrl}}

If you have any questions, our team is here to help you every step of the way.',
  'transactional',
  'application_approved',
  '["userName", "applicationId", "serviceType", "approvalDate", "nextSteps", "applicationUrl", "certificateUrl", "dashboardUrl"]'::jsonb,
  true,
  true,
  1
);

-- Application Rejected Template
INSERT INTO email_templates (id, name, description, slug, subject, html_content, text_content, category, template_type, variables, is_active, is_default, version)
VALUES (
  gen_random_uuid(),
  'Application Rejected',
  'Notification when application needs attention',
  'application-rejected',
  'Application Update: {{serviceType}} Action Required - GritSync',
  '<div class="email-content">
    <h1>Application Update</h1>
    <p>Hi {{userName}},</p>
    <p>We have reviewed your {{serviceType}} application (ID: {{applicationId}}) on {{rejectionDate}} and unfortunately, we are unable to approve it at this time.</p>
    
    <div class="warning-box" style="background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 20px; margin: 25px 0; border-radius: 6px;">
      <h3 style="margin-top: 0; color: #991b1b;">Reason:</h3>
      <p style="margin: 0;">{{rejectionReason}}</p>
    </div>
    
    <h3>What You Can Do:</h3>
    <p>{{actionItems}}</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{applicationUrl}}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">View Application</a>
    </div>
    
    <p>Please do not hesitate to contact our support team at {{supportContact}} if you need assistance.</p>
  </div>',
  'Application Update

Hi {{userName}},

We have reviewed your {{serviceType}} application (ID: {{applicationId}}) on {{rejectionDate}} and unfortunately, we are unable to approve it at this time.

Reason:
{{rejectionReason}}

What You Can Do:
{{actionItems}}

View your application: {{applicationUrl}}

Please contact our support team at {{supportContact}} if you need assistance.',
  'transactional',
  'application_rejected',
  '["userName", "applicationId", "serviceType", "rejectionDate", "rejectionReason", "actionItems", "applicationUrl", "supportContact", "dashboardUrl"]'::jsonb,
  true,
  true,
  1
);

-- Document Approved Template
INSERT INTO email_templates (id, name, description, slug, subject, html_content, text_content, category, template_type, variables, is_active, is_default, version)
VALUES (
  gen_random_uuid(),
  'Document Approved',
  'Notification when document is approved',
  'document-approved',
  'Document Approved: {{documentName}} - GritSync',
  '<div class="email-content">
    <h1>Document Approved</h1>
    <p>Hi {{userName}},</p>
    <p>Great news! Your document has been reviewed and approved.</p>
    
    <div class="info-box" style="background-color: #d1fae5; border-left: 4px solid #10b981; padding: 20px; margin: 25px 0; border-radius: 6px;">
      <h3 style="margin-top: 0; color: #065f46;">{{documentName}}</h3>
      <p style="margin: 0;">This document has been verified and accepted for your application.</p>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{dashboardUrl}}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">View Dashboard</a>
    </div>
    
    <p>Continue with your application to complete the remaining steps.</p>
  </div>',
  'Document Approved

Hi {{userName}},

Great news! Your document has been reviewed and approved.

Document: {{documentName}}
This document has been verified and accepted for your application.

View your dashboard: {{dashboardUrl}}

Continue with your application to complete the remaining steps.',
  'transactional',
  'document_approved',
  '["userName", "documentName", "dashboardUrl"]'::jsonb,
  true,
  true,
  1
);

-- Document Rejected Template
INSERT INTO email_templates (id, name, description, slug, subject, html_content, text_content, category, template_type, variables, is_active, is_default, version)
VALUES (
  gen_random_uuid(),
  'Document Rejected',
  'Notification when document needs resubmission',
  'document-rejected',
  'Document Requires Attention: {{documentName}} - GritSync',
  '<div class="email-content">
    <h1>Document Requires Attention</h1>
    <p>Hi {{userName}},</p>
    <p>We have reviewed your submitted document and unfortunately, it could not be approved.</p>
    
    <div class="warning-box" style="background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 20px; margin: 25px 0; border-radius: 6px;">
      <h3 style="margin-top: 0; color: #991b1b;">{{documentName}}</h3>
      <p style="margin: 0;"><strong>Reason:</strong> {{rejectionReason}}</p>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{uploadUrl}}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Upload New Document</a>
    </div>
    
    <p>Please upload a new version of this document that addresses the issue mentioned above.</p>
  </div>',
  'Document Requires Attention

Hi {{userName}},

We have reviewed your submitted document and unfortunately, it could not be approved.

Document: {{documentName}}
Reason: {{rejectionReason}}

Upload a new document: {{uploadUrl}}

Please upload a new version of this document that addresses the issue mentioned above.',
  'transactional',
  'document_rejected',
  '["userName", "documentName", "rejectionReason", "uploadUrl"]'::jsonb,
  true,
  true,
  1
);

-- Visa Bulletin Update Template
INSERT INTO email_templates (id, name, description, slug, subject, html_content, text_content, category, template_type, variables, is_active, is_default, version)
VALUES (
  gen_random_uuid(),
  'Visa Bulletin Update',
  'Monthly visa bulletin notification for subscribers',
  'visa-bulletin-update',
  'New Visa Bulletin Available: {{month}} {{year}} - GritSync',
  '<div class="email-content">
    <h1>Visa Bulletin Update</h1>
    <p>Hi {{userName}},</p>
    <p>The new Visa Bulletin for {{month}} {{year}} has been released by USCIS.</p>
    
    <div class="info-box" style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 25px 0; border-radius: 6px;">
      <h2 style="margin-top: 0;">Philippines EB3 Category</h2>
      <table style="width: 100%; margin-top: 15px;">
        <tr>
          <td style="border: none; padding: 8px 0;"><strong>Final Action Date:</strong></td>
          <td style="border: none; text-align: right; font-weight: bold; color: #10b981;">{{finalActionDate}}</td>
        </tr>
        <tr>
          <td style="border: none; padding: 8px 0;"><strong>Dates for Filing:</strong></td>
          <td style="border: none; text-align: right; font-weight: bold; color: #3b82f6;">{{datesForFiling}}</td>
        </tr>
      </table>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{bulletinUrl}}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">View Full Bulletin</a>
    </div>
    
    <p>Stay updated with the latest immigration news and track your priority date progress.</p>
  </div>',
  'Visa Bulletin Update

Hi {{userName}},

The new Visa Bulletin for {{month}} {{year}} has been released by USCIS.

Philippines EB3 Category:
- Final Action Date: {{finalActionDate}}
- Dates for Filing: {{datesForFiling}}

View full bulletin: {{bulletinUrl}}

Stay updated with the latest immigration news and track your priority date progress.',
  'marketing',
  'visa_bulletin_update',
  '["userName", "month", "year", "finalActionDate", "datesForFiling", "bulletinUrl"]'::jsonb,
  true,
  true,
  1
);

-- School Letter Request Template
INSERT INTO email_templates (id, name, description, slug, subject, html_content, text_content, category, template_type, variables, is_active, is_default, version)
VALUES (
  gen_random_uuid(),
  'School Letter Request',
  'Request sent to schools for verification documents',
  'school-letter',
  'Document Request: {{schoolName}} Verification Letter - GritSync',
  '<div class="email-content">
    <h1>School Letter Request</h1>
    <p>Dear School Administrator at {{schoolName}},</p>
    <p>We are writing to request official verification documents for one of your graduates who is applying for NCLEX licensure in the United States.</p>
    
    <div class="info-box" style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 25px 0; border-radius: 6px;">
      <h3 style="margin-top: 0;">Applicant Information:</h3>
      <p><strong>Name:</strong> {{applicantName}}</p>
      <p><strong>Application ID:</strong> {{applicationId}}</p>
      <p><strong>School:</strong> {{schoolName}}</p>
    </div>
    
    <h3>Required Documents:</h3>
    <p>{{documentRequirements}}</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{letterUrl}}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">View Letter</a>
    </div>
    
    <p>Please send the documents to our processing center or contact us if you have any questions.</p>
    
    <p>Thank you for your assistance in supporting our applicants nursing career journey.</p>
  </div>',
  'School Letter Request

Dear School Administrator at {{schoolName}},

We are writing to request official verification documents for one of your graduates who is applying for NCLEX licensure in the United States.

Applicant Information:
- Name: {{applicantName}}
- Application ID: {{applicationId}}
- School: {{schoolName}}

Required Documents:
{{documentRequirements}}

View Letter: {{letterUrl}}

Please send the documents to our processing center or contact us if you have any questions.

Thank you for your assistance in supporting our applicants nursing career journey.',
  'transactional',
  'school_letter',
  '["applicantName", "applicationId", "schoolName", "letterUrl", "documentRequirements"]'::jsonb,
  true,
  true,
  1
);

-- Full Instructions Template
INSERT INTO email_templates (id, name, description, slug, subject, html_content, text_content, category, template_type, variables, is_active, is_default, version)
VALUES (
  gen_random_uuid(),
  'Full Instructions',
  'Detailed instructions for completing application steps',
  'full-instructions',
  'Your NCLEX Application Instructions - GritSync',
  '<div class="email-content">
    <h1>Application Instructions</h1>
    <p>Hi {{userName}},</p>
    <p>Thank you for starting your NCLEX application with GritSync. Below are the detailed instructions to complete your application process.</p>
    
    <div class="info-box" style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 25px 0; border-radius: 6px;">
      <h2 style="margin-top: 0;">Step-by-Step Instructions</h2>
      {{instructions}}
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{dashboardUrl}}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Go to Dashboard</a>
    </div>
    
    <p>If you have any questions or need assistance, our support team is here to help you achieve your American Dream.</p>
  </div>',
  'Application Instructions

Hi {{userName}},

Thank you for starting your NCLEX application with GritSync. Below are the detailed instructions to complete your application process.

{{instructions}}

Go to your dashboard: {{dashboardUrl}}

If you have any questions or need assistance, our support team is here to help you achieve your American Dream.',
  'transactional',
  'full_instructions',
  '["userName", "instructions", "dashboardUrl"]'::jsonb,
  true,
  true,
  1
);
