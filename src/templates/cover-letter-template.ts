export const coverLetterTemplate = `<!DOCTYPE html>
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
            text-indent: 0;
            padding-left: 0;
            text-align: justify;
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

