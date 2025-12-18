-- Migration: Add NCLEX Congratulatory Email Template
-- A congratulatory message from GritSync founder to NCLEX passers

-- Insert NCLEX Congratulatory Email Template
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
  tags
) VALUES (
  'NCLEX Passer Congratulations',
  'Congratulatory message from GritSync founder to NCLEX passers',
  'nclex-passer-congratulations',
  '🎉 Congratulations on Passing the NCLEX! - A Message from GritSync',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; 
      line-height: 1.6; 
      color: #333; 
      margin: 0; 
      padding: 0; 
      background-color: #f4f4f4; 
    }
    .container { 
      max-width: 600px; 
      margin: 20px auto; 
      background: #ffffff; 
      border-radius: 12px; 
      overflow: hidden; 
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .header { 
      background: linear-gradient(135deg, #dc2626 0%, #991b1b 50%, #7f1d1d 100%); 
      color: white; 
      padding: 40px 30px; 
      text-align: center; 
    }
    .header h1 {
      margin: 0;
      font-size: 32px;
      font-weight: 700;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }
    .header .subtitle {
      margin-top: 10px;
      font-size: 18px;
      opacity: 0.95;
    }
    .content { 
      padding: 40px 30px; 
    }
    .celebration-icon {
      text-align: center;
      font-size: 64px;
      margin: 20px 0;
    }
    .congratulations-box {
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      border-left: 5px solid #f59e0b;
      padding: 25px;
      border-radius: 8px;
      margin: 25px 0;
      text-align: center;
    }
    .congratulations-box h2 {
      margin: 0 0 10px 0;
      color: #92400e;
      font-size: 24px;
      font-weight: 700;
    }
    .congratulations-box p {
      margin: 0;
      color: #78350f;
      font-size: 16px;
      font-weight: 500;
    }
    .message-section {
      margin: 30px 0;
      padding: 25px;
      background: #f9fafb;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    }
    .message-section p {
      margin: 15px 0;
      font-size: 16px;
      line-height: 1.8;
      color: #374151;
    }
    .signature-section {
      margin: 30px 0;
      padding: 20px;
      background: #ffffff;
      border-top: 2px solid #dc2626;
      border-radius: 8px;
    }
    .signature-section p {
      margin: 8px 0;
      color: #374151;
    }
    .signature-name {
      font-weight: 700;
      font-size: 18px;
      color: #dc2626;
      margin-top: 15px;
    }
    .signature-title {
      color: #6b7280;
      font-size: 14px;
      font-style: italic;
    }
    .button { 
      display: inline-block; 
      padding: 16px 36px; 
      background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); 
      color: white; 
      text-decoration: none; 
      border-radius: 8px; 
      font-weight: 600;
      font-size: 16px;
      margin: 25px 0;
      box-shadow: 0 4px 6px rgba(220, 38, 38, 0.3);
      transition: transform 0.2s;
    }
    .button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 12px rgba(220, 38, 38, 0.4);
    }
    .button-container {
      text-align: center;
      margin: 30px 0;
    }
    .next-steps {
      margin: 30px 0;
      padding: 25px;
      background: #eff6ff;
      border-left: 4px solid #3b82f6;
      border-radius: 8px;
    }
    .next-steps h3 {
      margin: 0 0 15px 0;
      color: #1e40af;
      font-size: 20px;
      font-weight: 600;
    }
    .next-steps ul {
      margin: 0;
      padding-left: 20px;
      color: #1e3a8a;
    }
    .next-steps li {
      margin: 10px 0;
      line-height: 1.6;
    }
    .footer { 
      background: #f9fafb; 
      padding: 30px; 
      text-align: center; 
      color: #6b7280; 
      font-size: 14px;
      border-top: 1px solid #e5e7eb;
    }
    .footer p {
      margin: 8px 0;
    }
    .footer a {
      color: #dc2626;
      text-decoration: none;
    }
    @media only screen and (max-width: 600px) {
      .container {
        margin: 10px;
        border-radius: 8px;
      }
      .header {
        padding: 30px 20px;
      }
      .header h1 {
        font-size: 24px;
      }
      .content {
        padding: 30px 20px;
      }
      .button {
        display: block;
        text-align: center;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Congratulations!</h1>
      <p class="subtitle">You''ve Passed the NCLEX!</p>
    </div>
    <div class="content">
      <div class="celebration-icon">
        🎊 🎉 🎈
      </div>
      
      <div class="congratulations-box">
        <h2>Congratulations, {{userName}}!</h2>
        <p>You have successfully passed the NCLEX examination!</p>
      </div>

      <div class="message-section">
        <p>Dear {{userName}},</p>
        
        <p>On behalf of the entire GritSync team, I want to extend my heartfelt congratulations on this incredible achievement. Passing the NCLEX is a significant milestone that represents years of dedication, hard work, and unwavering commitment to your dream of becoming a registered nurse in the United States.</p>
        
        <p>Your journey has been remarkable, and this achievement is a testament to your resilience, determination, and the passion you have for nursing. You''ve overcome challenges, studied tirelessly, and never gave up on your goal. Today, you stand as a testament to what is possible when grit meets opportunity.</p>
        
        <p>At GritSync, we are honored to have been part of your journey. Your success is our success, and we celebrate this moment with you. This is not just a personal victory—it''s a step forward for the global nursing community, and you are now part of an elite group of healthcare professionals who will make a profound difference in countless lives.</p>
        
        <p>As you move forward in your career, remember that this achievement is just the beginning. You now have the opportunity to impact lives, provide compassionate care, and contribute to the healthcare system in meaningful ways. The path ahead is filled with possibilities, and we are excited to see where your nursing career takes you.</p>
        
        <p>We are here to support you in your next steps, whether that''s finding employment opportunities, continuing your education, or navigating the next phase of your professional journey. GritSync remains committed to supporting nurses like you every step of the way.</p>
        
        <p>Once again, congratulations on this extraordinary achievement. You''ve earned this moment, and we couldn''t be prouder!</p>
      </div>

      <div class="signature-section">
        <p>With warmest regards and deepest admiration,</p>
        <p class="signature-name">{{founderName}}</p>
        <p class="signature-title">Founder & CEO, GritSync</p>
      </div>

      <div class="next-steps">
        <h3>📋 What''s Next?</h3>
        <ul>
          <li><strong>Update Your Profile:</strong> Make sure your GritSync profile reflects your new status as an NCLEX passer</li>
          <li><strong>Explore Opportunities:</strong> Check out job opportunities and career resources available through GritSync</li>
          <li><strong>Connect with Our Community:</strong> Join other successful NCLEX passers in our community</li>
          <li><strong>Share Your Success:</strong> Your story can inspire others on their journey</li>
        </ul>
      </div>

      <div class="button-container">
        <a href="{{dashboardUrl}}" class="button">Visit Your Dashboard</a>
      </div>

      <p style="text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px;">
        Need assistance? Contact us at <a href="mailto:{{supportEmail}}" style="color: #dc2626;">{{supportEmail}}</a>
      </p>
    </div>
    
    <div class="footer">
      <p><strong>GritSync</strong> - Empowering Nurses, Transforming Healthcare</p>
      <p>{{websiteUrl}} | {{supportEmail}}</p>
      <p style="margin-top: 15px; font-size: 12px; color: #9ca3af;">
        This is an automated message from GritSync. Please do not reply directly to this email.
      </p>
    </div>
  </div>
</body>
</html>',
  '🎉 Congratulations on Passing the NCLEX!

Dear {{userName}},

On behalf of the entire GritSync team, I want to extend my heartfelt congratulations on this incredible achievement. Passing the NCLEX is a significant milestone that represents years of dedication, hard work, and unwavering commitment to your dream of becoming a registered nurse in the United States.

Your journey has been remarkable, and this achievement is a testament to your resilience, determination, and the passion you have for nursing. You''ve overcome challenges, studied tirelessly, and never gave up on your goal. Today, you stand as a testament to what is possible when grit meets opportunity.

At GritSync, we are honored to have been part of your journey. Your success is our success, and we celebrate this moment with you. This is not just a personal victory—it''s a step forward for the global nursing community, and you are now part of an elite group of healthcare professionals who will make a profound difference in countless lives.

As you move forward in your career, remember that this achievement is just the beginning. You now have the opportunity to impact lives, provide compassionate care, and contribute to the healthcare system in meaningful ways. The path ahead is filled with possibilities, and we are excited to see where your nursing career takes you.

We are here to support you in your next steps, whether that''s finding employment opportunities, continuing your education, or navigating the next phase of your professional journey. GritSync remains committed to supporting nurses like you every step of the way.

Once again, congratulations on this extraordinary achievement. You''ve earned this moment, and we couldn''t be prouder!

With warmest regards and deepest admiration,

{{founderName}}
Founder & CEO, GritSync

What''s Next?
- Update Your Profile: Make sure your GritSync profile reflects your new status as an NCLEX passer
- Explore Opportunities: Check out job opportunities and career resources available through GritSync
- Connect with Our Community: Join other successful NCLEX passers in our community
- Share Your Success: Your story can inspire others on their journey

Visit your dashboard: {{dashboardUrl}}

Need assistance? Contact us at {{supportEmail}}

---
GritSync - Empowering Nurses, Transforming Healthcare
{{websiteUrl}} | {{supportEmail}}

This is an automated message from GritSync. Please do not reply directly to this email.',
  'announcement',
  'system',
  '[
    {"name": "userName", "description": "User''s full name", "required": true},
    {"name": "founderName", "description": "GritSync founder''s name", "required": true},
    {"name": "dashboardUrl", "description": "URL to user dashboard", "required": true},
    {"name": "supportEmail", "description": "Support email address", "required": false},
    {"name": "websiteUrl", "description": "GritSync website URL", "required": false}
  ]'::jsonb,
  TRUE,
  ARRAY['nclex', 'congratulations', 'achievement', 'announcement', 'founder']
)
ON CONFLICT (slug) DO NOTHING;


