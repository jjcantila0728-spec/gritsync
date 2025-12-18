export const employerVerificationEmailTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Request for Employer Verification Letter</title>
    <style>
        body {
            font-family: 'Times New Roman', Times, serif;
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
            
            <p>I am currently in the process of applying for an H4-EAD (Employment Authorization Document), and one of the essential requirements for this application is an Employer Verification Letter from my spouse's employer (Insight Global LLC) confirming their employment details.</p>
            
            <p>I would be most grateful if you could provide a letter that confirms the following information about {{SPOUSE_NAME}}'s employment:</p>
            
            <ul class="info-list">
                <li>Job Title</li>
                <li>Employment Status (full-time or part-time)</li>
                <li>Employment Start Date</li>
                <li>Current Employment Status</li>
                <li>Any other pertinent details that may support my H4-EAD application</li>
            </ul>
            
            <p>If possible, I would appreciate it if the letter could also include Insight Global LLC's complete address and contact information for verification purposes.</p>
            
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
</html>`

