-- Migration: Comprehensive Email Templates
-- Adds all email templates for real-time communications
-- Includes employer verification letter templates and all other email notifications

-- Employer Verification Letter - Admin Request (GritSync requesting on behalf of client)
INSERT INTO email_templates (
  name,
  description,
  slug,
  subject,
  html_content,
  text_content,
  category,
  template_type,
  variables,
  is_active,
  is_default,
  tags
) VALUES (
  'Employer Verification Letter Request - Admin',
  'Admin/GritSync requesting employer verification letter on behalf of client for H4-EAD application',
  'employer-verification-letter-request-admin',
  'Request for Employer Verification Letter - H4-EAD Application - {{SPOUSE_NAME}}',
  '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Request for Employer Verification Letter</title>
    <style>
        body {
            font-family: ''Times New Roman'', Times, serif;
            font-size: 11pt;
            line-height: 1.6;
            color: #000;
            margin: 0;
            padding: 20px;
            background: white;
        }
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
        }
        .recipient-info {
            margin-bottom: 20px;
        }
        .greeting {
            margin-bottom: 15px;
        }
        .body-content {
            margin-bottom: 15px;
        }
        .body-content p {
            margin-bottom: 12px;
            text-align: justify;
        }
        .info-list {
            margin-left: 20px;
            margin-bottom: 15px;
        }
        .info-list li {
            margin-bottom: 6px;
        }
        .contact-section {
            margin-top: 20px;
            margin-bottom: 15px;
        }
        .contact-section strong {
            display: block;
            margin-bottom: 5px;
        }
        .closing {
            margin-top: 20px;
        }
        .signature {
            margin-top: 15px;
        }
        .signature-contact {
            margin-top: 10px;
            font-size: 10pt;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="recipient-info">
            Insight Global LLC<br>
            Human Resources Department
        </div>
        
        <div class="greeting">Dear HR Team,</div>
        
        <div class="body-content">
            <p>I hope this message finds you well. I am writing on behalf of {{APPLICANT_NAME}} to request an Employer Verification Letter for their spouse, {{SPOUSE_NAME}}, who is currently employed with Insight Global LLC.</p>
            
            <p>{{APPLICANT_NAME}} is currently in the process of applying for an H4-EAD (Employment Authorization Document), and one of the essential requirements for this application is an Employer Verification Letter from their spouse''s employer (Insight Global LLC) confirming their employment details.</p>
            
            <p>I would be most grateful if you could provide a letter that confirms the following information about {{SPOUSE_NAME}}''s employment:</p>
            
            <ul class="info-list">
                <li>Job Title</li>
                <li>Employment Status (full-time or part-time)</li>
                <li>Employment Start Date</li>
                <li>Current Employment Status</li>
                <li>Any other pertinent details that may support the H4-EAD application</li>
            </ul>
            
            <p>If possible, I would appreciate it if the letter could also include Insight Global LLC''s complete address and contact information for verification purposes.</p>
            
            <p>If you need to verify this request or require additional information, please contact the spouse directly:</p>
            
            <div class="contact-section">
                <strong>SPOUSE EMAIL:</strong> {{SPOUSE_EMAIL}}<br>
                <strong>SPOUSE CONTACT NUMBER:</strong> {{SPOUSE_CONTACT_NUMBER}}
            </div>
            
            <p>Please feel free to reach out to me at info@gritsync.com or via phone if additional information is required or if there are any forms that need to be completed for this request.</p>
            
            <p>I kindly request that the letter be sent as a reply to this email at your earliest convenience to facilitate the H4-EAD application process. Your timely assistance would be greatly appreciated.</p>
            
            <p>Thank you for your time and consideration.</p>
        </div>
        
        <div class="closing">Best regards,</div>
        
        <div class="signature">
            GritSync Information Team<br>
            Email: info@gritsync.com
        </div>
        
        <div class="signature-contact">
            <strong>Client Contact Information:</strong><br>
            Name: {{APPLICANT_NAME}}<br>
            Email: {{APPLICANT_EMAIL}}<br>
            Phone: {{APPLICANT_PHONE}}<br><br>
            
            <strong>Spouse Contact Information (for verification):</strong><br>
            Email: {{SPOUSE_EMAIL}}<br>
            Contact Number: {{SPOUSE_CONTACT_NUMBER}}
        </div>
    </div>
</body>
</html>',
  'Insight Global LLC
Human Resources Department

Dear HR Team,

I hope this message finds you well. I am writing on behalf of {{APPLICANT_NAME}} to request an Employer Verification Letter for their spouse, {{SPOUSE_NAME}}, who is currently employed with Insight Global LLC.

{{APPLICANT_NAME}} is currently in the process of applying for an H4-EAD (Employment Authorization Document), and one of the essential requirements for this application is an Employer Verification Letter from their spouse''s employer (Insight Global LLC) confirming their employment details.

I would be most grateful if you could provide a letter that confirms the following information about {{SPOUSE_NAME}}''s employment:

- Job Title
- Employment Status (full-time or part-time)
- Employment Start Date
- Current Employment Status
- Any other pertinent details that may support the H4-EAD application

If possible, I would appreciate it if the letter could also include Insight Global LLC''s complete address and contact information for verification purposes.

If you need to verify this request or require additional information, please contact the spouse directly:
- SPOUSE EMAIL: {{SPOUSE_EMAIL}}
- SPOUSE CONTACT NUMBER: {{SPOUSE_CONTACT_NUMBER}}

Please feel free to reach out to me at info@gritsync.com or via phone if additional information is required or if there are any forms that need to be completed for this request.

I kindly request that the letter be sent as a reply to this email at your earliest convenience to facilitate the H4-EAD application process. Your timely assistance would be greatly appreciated.

Thank you for your time and consideration.

Best regards,

GritSync Information Team
Email: info@gritsync.com

Client Contact Information:
Name: {{APPLICANT_NAME}}
Email: {{APPLICANT_EMAIL}}
Phone: {{APPLICANT_PHONE}}

Spouse Contact Information (for verification):
Email: {{SPOUSE_EMAIL}}
Contact Number: {{SPOUSE_CONTACT_NUMBER}}',
  'transactional',
  'system',
  '[
    {"name": "APPLICANT_NAME", "description": "Full name of the applicant (client)", "required": true},
    {"name": "SPOUSE_NAME", "description": "Full name of the spouse who is employed", "required": true},
    {"name": "SPOUSE_EMAIL", "description": "Email address of the spouse", "required": true},
    {"name": "SPOUSE_CONTACT_NUMBER", "description": "Contact number of the spouse", "required": true},
    {"name": "APPLICANT_EMAIL", "description": "Email address of the applicant", "required": true},
    {"name": "APPLICANT_PHONE", "description": "Phone number of the applicant", "required": true}
  ]'::jsonb,
  TRUE,
  FALSE,
  ARRAY['employer-verification', 'admin', 'transactional', 'ead']
) ON CONFLICT (slug) DO UPDATE SET
  html_content = EXCLUDED.html_content,
  text_content = EXCLUDED.text_content,
  subject = EXCLUDED.subject,
  updated_at = NOW();

-- Employer Verification Letter - Client Request (Client requesting directly)
INSERT INTO email_templates (
  name,
  description,
  slug,
  subject,
  html_content,
  text_content,
  category,
  template_type,
  variables,
  is_active,
  is_default,
  tags
) VALUES (
  'Employer Verification Letter Request - Client',
  'Client requesting employer verification letter directly for H4-EAD application',
  'employer-verification-letter-request-client',
  'Request for Employer Verification Letter - H4-EAD Application - {{SPOUSE_NAME}}',
  '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Request for Employer Verification Letter</title>
    <style>
        body {
            font-family: ''Times New Roman'', Times, serif;
            font-size: 11pt;
            line-height: 1.6;
            color: #000;
            margin: 0;
            padding: 20px;
            background: white;
        }
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
        }
        .recipient-info {
            margin-bottom: 20px;
        }
        .greeting {
            margin-bottom: 15px;
        }
        .body-content {
            margin-bottom: 15px;
        }
        .body-content p {
            margin-bottom: 12px;
            text-align: justify;
        }
        .info-list {
            margin-left: 20px;
            margin-bottom: 15px;
        }
        .info-list li {
            margin-bottom: 6px;
        }
        .contact-section {
            margin-top: 20px;
            margin-bottom: 15px;
        }
        .contact-section strong {
            display: block;
            margin-bottom: 5px;
        }
        .closing {
            margin-top: 20px;
        }
        .signature {
            margin-top: 15px;
        }
        .signature-contact {
            margin-top: 10px;
            font-size: 10pt;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="recipient-info">
            Insight Global LLC<br>
            Human Resources Department
        </div>
        
        <div class="greeting">Dear HR Team,</div>
        
        <div class="body-content">
            <p>I hope this message finds you well. My name is {{APPLICANT_NAME}}, and I am writing to request an Employer Verification Letter for my spouse, {{SPOUSE_NAME}}, who is currently employed with Insight Global LLC.</p>
            
            <p>I am currently in the process of applying for an H4-EAD (Employment Authorization Document), and one of the essential requirements for this application is an Employer Verification Letter from my spouse''s employer (Insight Global LLC) confirming their employment details.</p>
            
            <p>I would be most grateful if you could provide a letter that confirms the following information about {{SPOUSE_NAME}}''s employment:</p>
            
            <ul class="info-list">
                <li>Job Title</li>
                <li>Employment Status (full-time or part-time)</li>
                <li>Employment Start Date</li>
                <li>Current Employment Status</li>
                <li>Any other pertinent details that may support my H4-EAD application</li>
            </ul>
            
            <p>If possible, I would appreciate it if the letter could also include Insight Global LLC''s complete address and contact information for verification purposes.</p>
            
            <p>If you need to verify this request or require additional information, please contact my spouse directly:</p>
            
            <div class="contact-section">
                <strong>SPOUSE EMAIL:</strong> {{SPOUSE_EMAIL}}<br>
                <strong>SPOUSE CONTACT NUMBER:</strong> {{SPOUSE_CONTACT_NUMBER}}
            </div>
            
            <p>Please feel free to reach out to me at {{APPLICANT_EMAIL}} or via phone at {{APPLICANT_PHONE}} if additional information is required or if there are any forms I need to complete for this request.</p>
            
            <p>I kindly request that the letter be sent as a reply to this email at your earliest convenience to facilitate my H4-EAD application process. Your timely assistance would be greatly appreciated.</p>
            
            <p>Thank you for your time and consideration.</p>
        </div>
        
        <div class="closing">Best regards,</div>
        
        <div class="signature">
            {{APPLICANT_NAME}}
        </div>
        
        <div class="signature-contact">
            <strong>Contact Information:</strong><br>
            Email: {{APPLICANT_EMAIL}}<br>
            Phone: {{APPLICANT_PHONE}}<br><br>
            
            <strong>Spouse Contact Information (for verification):</strong><br>
            Email: {{SPOUSE_EMAIL}}<br>
            Contact Number: {{SPOUSE_CONTACT_NUMBER}}
        </div>
    </div>
</body>
</html>',
  'Insight Global LLC
Human Resources Department

Dear HR Team,

I hope this message finds you well. My name is {{APPLICANT_NAME}}, and I am writing to request an Employer Verification Letter for my spouse, {{SPOUSE_NAME}}, who is currently employed with Insight Global LLC.

I am currently in the process of applying for an H4-EAD (Employment Authorization Document), and one of the essential requirements for this application is an Employer Verification Letter from my spouse''s employer (Insight Global LLC) confirming their employment details.

I would be most grateful if you could provide a letter that confirms the following information about {{SPOUSE_NAME}}''s employment:

- Job Title
- Employment Status (full-time or part-time)
- Employment Start Date
- Current Employment Status
- Any other pertinent details that may support my H4-EAD application

If possible, I would appreciate it if the letter could also include Insight Global LLC''s complete address and contact information for verification purposes.

If you need to verify this request or require additional information, please contact my spouse directly:
- SPOUSE EMAIL: {{SPOUSE_EMAIL}}
- SPOUSE CONTACT NUMBER: {{SPOUSE_CONTACT_NUMBER}}

Please feel free to reach out to me at {{APPLICANT_EMAIL}} or via phone at {{APPLICANT_PHONE}} if additional information is required or if there are any forms I need to complete for this request.

I kindly request that the letter be sent as a reply to this email at your earliest convenience to facilitate my H4-EAD application process. Your timely assistance would be greatly appreciated.

Thank you for your time and consideration.

Best regards,

{{APPLICANT_NAME}}

Contact Information:
Email: {{APPLICANT_EMAIL}}
Phone: {{APPLICANT_PHONE}}

Spouse Contact Information (for verification):
Email: {{SPOUSE_EMAIL}}
Contact Number: {{SPOUSE_CONTACT_NUMBER}}',
  'transactional',
  'system',
  '[
    {"name": "APPLICANT_NAME", "description": "Full name of the applicant (client)", "required": true},
    {"name": "SPOUSE_NAME", "description": "Full name of the spouse who is employed", "required": true},
    {"name": "SPOUSE_EMAIL", "description": "Email address of the spouse", "required": true},
    {"name": "SPOUSE_CONTACT_NUMBER", "description": "Contact number of the spouse", "required": true},
    {"name": "APPLICANT_EMAIL", "description": "Email address of the applicant", "required": true},
    {"name": "APPLICANT_PHONE", "description": "Phone number of the applicant", "required": true}
  ]'::jsonb,
  TRUE,
  FALSE,
  ARRAY['employer-verification', 'client', 'transactional', 'ead']
) ON CONFLICT (slug) DO UPDATE SET
  html_content = EXCLUDED.html_content,
  text_content = EXCLUDED.text_content,
  subject = EXCLUDED.subject,
  updated_at = NOW();

-- Timeline Update Email Template
INSERT INTO email_templates (
  name,
  description,
  slug,
  subject,
  html_content,
  text_content,
  category,
  template_type,
  variables,
  is_active,
  is_default,
  tags
) VALUES (
  'Timeline Update',
  'Notify users when application timeline is updated',
  'timeline-update',
  '{{UPDATE_TITLE}} - Application #{{APPLICATION_ID}}',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .status-badge { display: inline-block; padding: 8px 16px; background: #10b981; color: white; border-radius: 20px; font-weight: 600; margin: 10px 0; }
    .button { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
    .footer { background: #f9fafb; padding: 20px; text-align: center; color: #666; font-size: 14px; }
    .timeline-item { padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
    .timeline-item:last-child { border-bottom: none; }
    .timeline-item.completed { color: #10b981; }
    .timeline-item.pending { color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📋 Timeline Update</h1>
    </div>
    <div class="content">
      <p>Hi {{USER_NAME}},</p>
      <p>There''s an update on your application <strong>#{{APPLICATION_ID}}</strong>:</p>
      <h2 style="color: #3b82f6; margin-top: 20px;">{{UPDATE_TITLE}}</h2>
      <p>{{UPDATE_MESSAGE}}</p>
      {{NEW_STATUS_BADGE}}
      {{TIMELINE_SECTION}}
      <div style="text-align: center;">
        <a href="{{ACTION_URL}}" class="button">View Application</a>
      </div>
    </div>
    <div class="footer">
      <p>&copy; 2024 GritSync. All rights reserved.</p>
    </div>
  </div>
</body>
</html>',
  'Timeline Update: {{UPDATE_TITLE}}

Hi {{USER_NAME}},

Your application #{{APPLICATION_ID}} has been updated.

{{UPDATE_MESSAGE}}

{{NEW_STATUS_TEXT}}

View your application: {{ACTION_URL}}',
  'notification',
  'system',
  '[
    {"name": "USER_NAME", "description": "User''s full name", "required": true},
    {"name": "APPLICATION_ID", "description": "Application ID", "required": true},
    {"name": "UPDATE_TITLE", "description": "Title of the update", "required": true},
    {"name": "UPDATE_MESSAGE", "description": "Detailed update message", "required": true},
    {"name": "NEW_STATUS", "description": "New status (optional)", "required": false},
    {"name": "ACTION_URL", "description": "URL to view application", "required": true},
    {"name": "TIMELINE", "description": "Timeline HTML (optional)", "required": false}
  ]'::jsonb,
  TRUE,
  TRUE,
  ARRAY['timeline', 'update', 'notification']
) ON CONFLICT (slug) DO UPDATE SET
  html_content = EXCLUDED.html_content,
  text_content = EXCLUDED.text_content,
  subject = EXCLUDED.subject,
  updated_at = NOW();

-- Missing Documents Email Template
INSERT INTO email_templates (
  name,
  description,
  slug,
  subject,
  html_content,
  text_content,
  category,
  template_type,
  variables,
  is_active,
  is_default,
  tags
) VALUES (
  'Missing Documents Reminder',
  'Remind users about missing required documents',
  'missing-documents-reminder',
  'Action Required: Missing Documents for Application #{{APPLICATION_ID}}',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .warning-box { background: #fef3c7; padding: 20px; border-left: 4px solid #f59e0b; border-radius: 4px; margin: 20px 0; }
    .document-list { margin: 20px 0; }
    .document-item { padding: 12px; margin: 8px 0; background: #f9fafb; border-radius: 6px; }
    .document-item.required { border-left: 4px solid #ef4444; }
    .document-item.optional { border-left: 4px solid #6b7280; }
    .button { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
    .footer { background: #f9fafb; padding: 20px; text-align: center; color: #666; font-size: 14px; }
    .deadline { color: #ef4444; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📄 Documents Required</h1>
    </div>
    <div class="content">
      <p>Hi {{USER_NAME}},</p>
      <p>We need the following documents to continue processing your application <strong>#{{APPLICATION_ID}}</strong>:</p>
      <div class="warning-box">
        <p style="margin: 0;"><strong>⚠️ Action Required</strong></p>
        {{DEADLINE_SECTION}}
      </div>
      <div class="document-list">
        {{DOCUMENTS_LIST}}
      </div>
      <div style="text-align: center;">
        <a href="{{UPLOAD_URL}}" class="button">Upload Documents</a>
      </div>
      <p style="margin-top: 30px;">If you have any questions about document requirements, please contact our support team.</p>
    </div>
    <div class="footer">
      <p>&copy; 2024 GritSync. All rights reserved.</p>
    </div>
  </div>
</body>
</html>',
  'Missing Documents Reminder

Hi {{USER_NAME}},

We need the following documents to continue processing your application #{{APPLICATION_ID}}:

{{DOCUMENTS_LIST_TEXT}}

{{DEADLINE_TEXT}}

Upload documents: {{UPLOAD_URL}}',
  'reminder',
  'system',
  '[
    {"name": "USER_NAME", "description": "User''s full name", "required": true},
    {"name": "APPLICATION_ID", "description": "Application ID", "required": true},
    {"name": "DOCUMENTS_LIST", "description": "HTML list of missing documents", "required": true},
    {"name": "DOCUMENTS_LIST_TEXT", "description": "Plain text list of missing documents", "required": true},
    {"name": "DEADLINE", "description": "Upload deadline (optional)", "required": false},
    {"name": "UPLOAD_URL", "description": "URL to upload documents", "required": true}
  ]'::jsonb,
  TRUE,
  TRUE,
  ARRAY['documents', 'reminder', 'required']
) ON CONFLICT (slug) DO UPDATE SET
  html_content = EXCLUDED.html_content,
  text_content = EXCLUDED.text_content,
  subject = EXCLUDED.subject,
  updated_at = NOW();

-- Missing Profile Details Email Template
INSERT INTO email_templates (
  name,
  description,
  slug,
  subject,
  html_content,
  text_content,
  category,
  template_type,
  variables,
  is_active,
  is_default,
  tags
) VALUES (
  'Missing Profile Details',
  'Remind users to complete their profile',
  'missing-profile-details',
  'Complete Your Profile - {{URGENCY_TEXT}}',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .info-box { background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .field-list { margin: 20px 0; }
    .field-item { padding: 12px; margin: 8px 0; background: #ffffff; border-left: 4px solid #8b5cf6; border-radius: 4px; }
    .button { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
    .footer { background: #f9fafb; padding: 20px; text-align: center; color: #666; font-size: 14px; }
    .urgent { background: #fee2e2; border-left-color: #ef4444 !important; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✏️ Complete Your Profile</h1>
    </div>
    <div class="content">
      <p>Hi {{USER_NAME}},</p>
      <p>To continue with your application, we need some additional information:</p>
      <div class="info-box {{URGENT_CLASS}}">
        <h3 style="margin-top: 0;">Missing Information:</h3>
        <div class="field-list">
          {{FIELDS_LIST}}
        </div>
      </div>
      <div style="text-align: center;">
        <a href="{{PROFILE_URL}}" class="button">Update Profile</a>
      </div>
      <p style="margin-top: 30px;">Completing your profile helps us process your application faster and provide better service.</p>
    </div>
    <div class="footer">
      <p>&copy; 2024 GritSync. All rights reserved.</p>
    </div>
  </div>
</body>
</html>',
  'Complete Your Profile

Hi {{USER_NAME}},

To continue with your application, we need some additional information:

{{FIELDS_LIST_TEXT}}

Update your profile: {{PROFILE_URL}}',
  'reminder',
  'system',
  '[
    {"name": "USER_NAME", "description": "User''s full name", "required": true},
    {"name": "FIELDS_LIST", "description": "HTML list of missing fields", "required": true},
    {"name": "FIELDS_LIST_TEXT", "description": "Plain text list of missing fields", "required": true},
    {"name": "PROFILE_URL", "description": "URL to update profile", "required": true},
    {"name": "URGENT_CLASS", "description": "CSS class for urgent styling (optional)", "required": false},
    {"name": "URGENCY_TEXT", "description": "Urgency indicator text (optional)", "required": false}
  ]'::jsonb,
  TRUE,
  TRUE,
  ARRAY['profile', 'reminder', 'details']
) ON CONFLICT (slug) DO UPDATE SET
  html_content = EXCLUDED.html_content,
  text_content = EXCLUDED.text_content,
  subject = EXCLUDED.subject,
  updated_at = NOW();

-- School Letter Generated Email Template
INSERT INTO email_templates (
  name,
  description,
  slug,
  subject,
  html_content,
  text_content,
  category,
  template_type,
  variables,
  is_active,
  is_default,
  tags
) VALUES (
  'School Letter Generated',
  'Notify users when school verification letter is generated',
  'school-letter-generated',
  '🎓 Your School Letter for {{SCHOOL_NAME}} is Ready',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .info-box { background: #f0fdf4; padding: 20px; border-left: 4px solid #10b981; border-radius: 4px; margin: 20px 0; }
    .button { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
    .footer { background: #f9fafb; padding: 20px; text-align: center; color: #666; font-size: 14px; }
    .warning-box { background: #fef3c7; padding: 15px; border-left: 4px solid #f59e0b; border-radius: 4px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎓 Your School Letter is Ready</h1>
    </div>
    <div class="content">
      <p>Hi {{USER_NAME}},</p>
      <p>Great news! Your verification letter for <strong>{{SCHOOL_NAME}}</strong> has been generated and is ready for download.</p>
      <div class="info-box">
        <p style="margin: 0;">
          <strong>Application ID:</strong> #{{APPLICATION_ID}}<br>
          <strong>School:</strong> {{SCHOOL_NAME}}
        </p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{LETTER_URL}}" class="button">Download Letter</a>
      </div>
      {{INSTRUCTIONS_SECTION}}
      <div class="warning-box">
        <p style="margin: 0;"><strong>⚠️ Important:</strong> This letter is valid for 90 days from the date of issue. Please ensure you submit it within this timeframe.</p>
      </div>
      <p>If you need any changes or have questions about the letter, please contact our support team.</p>
    </div>
    <div class="footer">
      <p>&copy; 2024 GritSync. All rights reserved.</p>
    </div>
  </div>
</body>
</html>',
  'School Letter Generated

Hi {{USER_NAME}},

Your verification letter for {{SCHOOL_NAME}} is ready for download.

Application ID: #{{APPLICATION_ID}}

Download: {{LETTER_URL}}

{{INSTRUCTIONS_TEXT}}

Important: This letter is valid for 90 days.',
  'notification',
  'system',
  '[
    {"name": "USER_NAME", "description": "User''s full name", "required": true},
    {"name": "SCHOOL_NAME", "description": "Name of the school", "required": true},
    {"name": "APPLICATION_ID", "description": "Application ID", "required": true},
    {"name": "LETTER_URL", "description": "URL to download letter", "required": true},
    {"name": "INSTRUCTIONS", "description": "Additional instructions (optional)", "required": false}
  ]'::jsonb,
  TRUE,
  TRUE,
  ARRAY['school', 'letter', 'notification']
) ON CONFLICT (slug) DO UPDATE SET
  html_content = EXCLUDED.html_content,
  text_content = EXCLUDED.text_content,
  subject = EXCLUDED.subject,
  updated_at = NOW();

-- Payment Receipt Email Template (Enhanced)
INSERT INTO email_templates (
  name,
  description,
  slug,
  subject,
  html_content,
  text_content,
  category,
  template_type,
  variables,
  is_active,
  is_default,
  tags
) VALUES (
  'Payment Receipt',
  'Payment confirmation and receipt email',
  'payment-receipt-enhanced',
  'Payment Received - Receipt #{{TRANSACTION_ID}}',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 40px 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; }
    .content { padding: 30px; }
    .receipt-box { background: #f9fafb; padding: 25px; border-radius: 8px; margin: 20px 0; border: 2px solid #e5e7eb; }
    .amount { font-size: 36px; color: #10b981; font-weight: bold; text-align: center; margin: 20px 0; }
    .receipt-details { margin: 20px 0; }
    .receipt-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e5e7eb; }
    .receipt-row:last-child { border-bottom: none; }
    .receipt-label { font-weight: 600; color: #6b7280; }
    .receipt-value { color: #111827; }
    .items-list { margin: 20px 0; }
    .item-row { display: flex; justify-content: space-between; padding: 10px 0; }
    .button { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
    .footer { background: #f9fafb; padding: 20px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Payment Received</h1>
    </div>
    <div class="content">
      <p>Hi {{USER_NAME}},</p>
      <p>Thank you for your payment!</p>
      <div class="amount">{{CURRENCY}}{{AMOUNT}}</div>
      <div class="receipt-box">
        <div class="receipt-details">
          <div class="receipt-row">
            <span class="receipt-label">Transaction ID:</span>
            <span class="receipt-value">{{TRANSACTION_ID}}</span>
          </div>
          <div class="receipt-row">
            <span class="receipt-label">Payment Date:</span>
            <span class="receipt-value">{{PAYMENT_DATE}}</span>
          </div>
          <div class="receipt-row">
            <span class="receipt-label">Payment Method:</span>
            <span class="receipt-value">{{PAYMENT_METHOD}}</span>
          </div>
          <div class="receipt-row">
            <span class="receipt-label">Description:</span>
            <span class="receipt-value">{{DESCRIPTION}}</span>
          </div>
          {{APPLICATION_ID_ROW}}
        </div>
        {{ITEMS_SECTION}}
      </div>
      <p>This payment has been applied to your account.</p>
      {{RECEIPT_URL_BUTTON}}
    </div>
    <div class="footer">
      <p>Keep this receipt for your records</p>
      <p>&copy; 2024 GritSync. All rights reserved.</p>
    </div>
  </div>
</body>
</html>',
  'Payment Receipt #{{TRANSACTION_ID}}

Hi {{USER_NAME}},

Thank you for your payment of {{CURRENCY}}{{AMOUNT}}.

Transaction ID: {{TRANSACTION_ID}}
Payment Date: {{PAYMENT_DATE}}
Payment Method: {{PAYMENT_METHOD}}
Description: {{DESCRIPTION}}

{{APPLICATION_ID_TEXT}}
{{RECEIPT_URL_TEXT}}

Keep this receipt for your records.',
  'transactional',
  'system',
  '[
    {"name": "USER_NAME", "description": "User''s full name", "required": true},
    {"name": "AMOUNT", "description": "Payment amount", "required": true},
    {"name": "CURRENCY", "description": "Currency symbol (e.g., $)", "required": true},
    {"name": "TRANSACTION_ID", "description": "Transaction/receipt ID", "required": true},
    {"name": "PAYMENT_DATE", "description": "Payment date", "required": true},
    {"name": "PAYMENT_METHOD", "description": "Payment method", "required": true},
    {"name": "DESCRIPTION", "description": "Payment description", "required": true},
    {"name": "APPLICATION_ID", "description": "Application ID (optional)", "required": false},
    {"name": "ITEMS", "description": "HTML list of items (optional)", "required": false},
    {"name": "RECEIPT_URL", "description": "URL to download receipt (optional)", "required": false}
  ]'::jsonb,
  TRUE,
  TRUE,
  ARRAY['payment', 'receipt', 'transactional']
) ON CONFLICT (slug) DO UPDATE SET
  html_content = EXCLUDED.html_content,
  text_content = EXCLUDED.text_content,
  subject = EXCLUDED.subject,
  updated_at = NOW();

-- Application Status Change Email Template
INSERT INTO email_templates (
  name,
  description,
  slug,
  subject,
  html_content,
  text_content,
  category,
  template_type,
  variables,
  is_active,
  is_default,
  tags
) VALUES (
  'Application Status Change',
  'Notify users when application status changes',
  'application-status-change',
  'Application Status Updated: {{NEW_STATUS}} - #{{APPLICATION_ID}}',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .status-box { background: #eff6ff; padding: 20px; border-left: 4px solid #3b82f6; border-radius: 4px; margin: 20px 0; text-align: center; }
    .status-badge { display: inline-block; padding: 10px 20px; background: #3b82f6; color: white; border-radius: 20px; font-weight: 600; font-size: 18px; }
    .status-change { display: flex; justify-content: center; align-items: center; gap: 15px; margin: 20px 0; }
    .arrow { font-size: 24px; color: #6b7280; }
    .old-status { padding: 8px 16px; background: #e5e7eb; color: #6b7280; border-radius: 20px; }
    .new-status { padding: 8px 16px; background: #3b82f6; color: white; border-radius: 20px; font-weight: 600; }
    .button { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
    .footer { background: #f9fafb; padding: 20px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📋 Status Update</h1>
    </div>
    <div class="content">
      <p>Hi {{USER_NAME}},</p>
      <p>Your application <strong>#{{APPLICATION_ID}}</strong> status has been updated:</p>
      <div class="status-box">
        <div class="status-change">
          {{OLD_STATUS_BADGE}}
          {{STATUS_ARROW}}
          <span class="new-status">{{NEW_STATUS}}</span>
        </div>
      </div>
      <p>{{MESSAGE}}</p>
      <div style="text-align: center;">
        <a href="{{APPLICATION_URL}}" class="button">View Application</a>
      </div>
    </div>
    <div class="footer">
      <p>&copy; 2024 GritSync. All rights reserved.</p>
    </div>
  </div>
</body>
</html>',
  'Application Status Update

Hi {{USER_NAME}},

Your application #{{APPLICATION_ID}} status has been updated.

{{STATUS_CHANGE_TEXT}}

{{MESSAGE}}

View application: {{APPLICATION_URL}}',
  'notification',
  'system',
  '[
    {"name": "USER_NAME", "description": "User''s full name", "required": true},
    {"name": "APPLICATION_ID", "description": "Application ID", "required": true},
    {"name": "OLD_STATUS", "description": "Previous status (optional)", "required": false},
    {"name": "NEW_STATUS", "description": "New status", "required": true},
    {"name": "MESSAGE", "description": "Status change message", "required": true},
    {"name": "APPLICATION_URL", "description": "URL to view application", "required": true}
  ]'::jsonb,
  TRUE,
  TRUE,
  ARRAY['status', 'application', 'notification']
) ON CONFLICT (slug) DO UPDATE SET
  html_content = EXCLUDED.html_content,
  text_content = EXCLUDED.text_content,
  subject = EXCLUDED.subject,
  updated_at = NOW();

-- Welcome Email Template (Enhanced)
INSERT INTO email_templates (
  name,
  description,
  slug,
  subject,
  html_content,
  text_content,
  category,
  template_type,
  variables,
  is_active,
  is_default,
  tags
) VALUES (
  'Welcome New User',
  'Welcome email for new user registrations',
  'welcome-new-user-enhanced',
  'Welcome to GritSync, {{USER_NAME}}! 🎉',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 40px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; }
    .content { padding: 40px 30px; }
    .steps-list { margin: 30px 0; }
    .step-item { display: flex; align-items: flex-start; margin: 20px 0; padding: 15px; background: #f9fafb; border-radius: 8px; }
    .step-number { background: #10b981; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 15px; flex-shrink: 0; }
    .step-content h3 { margin: 0 0 8px 0; color: #111827; }
    .step-content p { margin: 0; color: #6b7280; }
    .button { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
    .footer { background: #f9fafb; padding: 20px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to GritSync! 🎉</h1>
    </div>
    <div class="content">
      <h2>Hi {{USER_NAME}},</h2>
      <p>We''re thrilled to have you join the GritSync community! Your journey to achieving your USRN dreams starts here.</p>
      <p>Here''s what you can do next:</p>
      <div class="steps-list">
        <div class="step-item">
          <div class="step-number">1</div>
          <div class="step-content">
            <h3>Complete Your Profile</h3>
            <p>Add your personal information and details</p>
          </div>
        </div>
        <div class="step-item">
          <div class="step-number">2</div>
          <div class="step-content">
            <h3>Upload Required Documents</h3>
            <p>Submit all necessary documents for your application</p>
          </div>
        </div>
        <div class="step-item">
          <div class="step-number">3</div>
          <div class="step-content">
            <h3>Start Your Application</h3>
            <p>Begin your application process</p>
          </div>
        </div>
      </div>
      <div style="text-align: center;">
        <a href="{{DASHBOARD_URL}}" class="button">Go to Dashboard</a>
      </div>
      <p>If you have any questions, our support team is here to help at {{SUPPORT_EMAIL}}!</p>
    </div>
    <div class="footer">
      <p>&copy; 2024 GritSync. All rights reserved.</p>
      <p>{{SUPPORT_EMAIL}} | {{WEBSITE_URL}}</p>
    </div>
  </div>
</body>
</html>',
  'Welcome to GritSync, {{USER_NAME}}!

We''re thrilled to have you join our community. Your journey to achieving your USRN dreams starts here.

Here''s what you can do next:
1. Complete Your Profile
2. Upload Required Documents
3. Start Your Application

Visit your dashboard: {{DASHBOARD_URL}}

If you have any questions, contact us at {{SUPPORT_EMAIL}}',
  'welcome',
  'system',
  '[
    {"name": "USER_NAME", "description": "User''s full name", "required": true},
    {"name": "DASHBOARD_URL", "description": "URL to dashboard", "required": true},
    {"name": "SUPPORT_EMAIL", "description": "Support email address", "required": false},
    {"name": "WEBSITE_URL", "description": "Website URL", "required": false}
  ]'::jsonb,
  TRUE,
  TRUE,
  ARRAY['welcome', 'onboarding', 'new-user']
) ON CONFLICT (slug) DO UPDATE SET
  html_content = EXCLUDED.html_content,
  text_content = EXCLUDED.text_content,
  subject = EXCLUDED.subject,
  updated_at = NOW();

-- Password Reset Email Template
INSERT INTO email_templates (
  name,
  description,
  slug,
  subject,
  html_content,
  text_content,
  category,
  template_type,
  variables,
  is_active,
  is_default,
  tags
) VALUES (
  'Password Reset',
  'Password reset request email',
  'password-reset',
  'Reset Your GritSync Password',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .warning-box { background: #fee2e2; padding: 20px; border-left: 4px solid #ef4444; border-radius: 4px; margin: 20px 0; }
    .button { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
    .footer { background: #f9fafb; padding: 20px; text-align: center; color: #666; font-size: 14px; }
    .expiry { color: #ef4444; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔐 Password Reset Request</h1>
    </div>
    <div class="content">
      <p>Hi {{USER_NAME}},</p>
      <p>We received a request to reset your password for your GritSync account.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{RESET_LINK}}" class="button">Reset Password</a>
      </div>
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #3b82f6;">{{RESET_LINK}}</p>
      <div class="warning-box">
        <p style="margin: 0;"><strong>⚠️ Security Notice:</strong></p>
        <ul style="margin: 10px 0 0 20px; padding: 0;">
          <li>This link will expire in <span class="expiry">{{EXPIRY_TIME}}</span></li>
          <li>If you didn''t request this, please ignore this email</li>
          <li>Never share your password reset link with anyone</li>
        </ul>
      </div>
      <p>If you have any concerns about your account security, please contact our support team immediately.</p>
    </div>
    <div class="footer">
      <p>This is an automated message. Please do not reply to this email.</p>
      <p>&copy; 2024 GritSync. All rights reserved.</p>
    </div>
  </div>
</body>
</html>',
  'Password Reset Request

Hi {{USER_NAME}},

We received a request to reset your password for your GritSync account.

Reset your password: {{RESET_LINK}}

This link will expire in {{EXPIRY_TIME}}.

If you didn''t request this, please ignore this email.

⚠️ Security: Never share your password reset link with anyone.',
  'transactional',
  'system',
  '[
    {"name": "USER_NAME", "description": "User''s full name", "required": true},
    {"name": "RESET_LINK", "description": "Password reset link", "required": true},
    {"name": "EXPIRY_TIME", "description": "Link expiry time (e.g., 1 hour)", "required": true}
  ]'::jsonb,
  TRUE,
  TRUE,
  ARRAY['password', 'reset', 'security']
) ON CONFLICT (slug) DO UPDATE SET
  html_content = EXCLUDED.html_content,
  text_content = EXCLUDED.text_content,
  subject = EXCLUDED.subject,
  updated_at = NOW();

COMMENT ON TABLE email_templates IS 'Stores reusable email templates with variables and versioning - Enhanced with comprehensive templates for all communications';

