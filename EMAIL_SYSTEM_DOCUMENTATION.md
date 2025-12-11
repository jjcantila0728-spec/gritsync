# GritSync Email Notification System

## Overview
Complete email notification system with beautiful, responsive templates for all user communications.

## 🎨 Features

### Modern Email Design
- **Responsive Design**: Works perfectly on desktop, tablet, and mobile
- **Dark Mode Support**: Email templates adapt to user preferences
- **Professional Layout**: Clean, modern design with brand colors
- **Accessible**: High contrast, clear typography, screen reader friendly

### Email Templates

#### 1. 🔐 Forgot Password Email
**Purpose**: Secure password reset with expiring link  
**Triggers**: User requests password reset  
**Contains**:
- Secure reset link (1-hour expiry)
- Security tips
- Warning for unauthorized requests

**Usage**:
```typescript
import { sendForgotPasswordEmail } from '@/lib/email-notifications'

await sendForgotPasswordEmail(
  email,
  userName,
  resetLink
)
```

#### 2. ✅ Payment Receipt Email
**Purpose**: Professional payment confirmation  
**Triggers**: Successful payment processing  
**Contains**:
- Transaction details (amount, ID, date)
- Itemized breakdown
- Downloadable receipt link

**Usage**:
```typescript
import { sendPaymentReceiptEmail } from '@/lib/email-notifications'

await sendPaymentReceiptEmail(email, {
  userName,
  amount: 500.00,
  currency: 'USD',
  transactionId: 'TXN123',
  paymentDate: new Date().toLocaleDateString(),
  description: 'NCLEX Processing',
  items: [{ name: 'Application Fee', amount: 500 }],
  receiptUrl: 'https://...'
})
```

#### 3. 📋 Timeline Update Email
**Purpose**: Application progress notifications  
**Triggers**: Status changes, milestones  
**Contains**:
- Update title and message
- New status badge
- Visual timeline
- Action button to view application

**Usage**:
```typescript
import { sendTimelineUpdateEmail } from '@/lib/email-notifications'

await sendTimelineUpdateEmail(email, {
  userName,
  applicationId: 'APP001',
  updateTitle: 'Documents Verified',
  updateMessage: 'Your documents have been approved!',
  newStatus: 'In Review',
  actionUrl: 'https://...',
  timeline: [
    { date: 'Jan 15', title: 'Submitted', completed: true },
    { date: 'Jan 16', title: 'Under Review', completed: false }
  ]
})
```

#### 4. 📄 Missing Document Reminder
**Purpose**: Prompt users to upload required documents  
**Triggers**: Document requirements not met  
**Contains**:
- List of missing documents (required/optional)
- Upload deadline
- Document upload tips
- Direct upload link

**Usage**:
```typescript
import { sendMissingDocumentEmail } from '@/lib/email-notifications'

await sendMissingDocumentEmail(email, {
  userName,
  applicationId: 'APP001',
  missingDocuments: [
    { name: 'Passport Copy', description: 'All pages', required: true },
    { name: 'License', required: false }
  ],
  deadline: 'January 30, 2024',
  uploadUrl: 'https://...'
})
```

#### 5. ✏️ Missing Profile Details
**Purpose**: Encourage profile completion  
**Triggers**: Incomplete profile detected  
**Contains**:
- List of missing fields
- Field descriptions
- Urgency indicator
- Profile update link

**Usage**:
```typescript
import { sendMissingDetailsEmail } from '@/lib/email-notifications'

await sendMissingDetailsEmail(email, {
  userName,
  missingFields: [
    { fieldName: 'Phone Number', description: 'For verification' },
    { fieldName: 'Date of Birth', description: 'Required field' }
  ],
  profileUrl: 'https://...',
  isUrgent: false
})
```

#### 6. 🎓 School Letter Generated
**Purpose**: Deliver generated school letters  
**Triggers**: Letter generation complete  
**Contains**:
- School name
- Download link
- Usage instructions
- Validity period

**Usage**:
```typescript
import { sendSchoolLetterEmail } from '@/lib/email-notifications'

await sendSchoolLetterEmail(email, {
  userName,
  schoolName: 'University of California',
  letterUrl: 'https://...',
  applicationId: 'APP001',
  instructions: 'Print and submit to admissions'
})
```

#### 7. 📚 Full Instructions
**Purpose**: Comprehensive onboarding guide  
**Triggers**: New application started  
**Contains**:
- Step-by-step instructions
- Due dates for each step
- Additional resources
- Help contacts

**Usage**:
```typescript
import { sendFullInstructionsEmail } from '@/lib/email-notifications'

await sendFullInstructionsEmail(email, {
  userName,
  applicationId: 'APP001',
  serviceType: 'NCLEX Processing',
  steps: [
    {
      stepNumber: 1,
      title: 'Complete Profile',
      description: 'Fill in your details',
      dueDate: 'Within 3 days'
    }
  ],
  resourcesUrl: 'https://...'
})
```

#### 8. 🎉 Welcome Email
**Purpose**: Welcome new users  
**Triggers**: Account creation  
**Contains**:
- Welcome message
- Getting started steps
- Dashboard link
- Support information

**Usage**:
```typescript
import { sendWelcomeEmail } from '@/lib/email-notifications'

await sendWelcomeEmail(email, {
  userName,
  userEmail: email,
  dashboardUrl: 'https://...'
})
```

## 🔧 Configuration

### Email Service Provider
Configured in Admin Settings → Email & Notifications

**Supported Providers**:
- Resend (Recommended)
- SMTP
- SendGrid (Coming soon)

### Template Customization
Templates use site configuration from general settings:
- Site Name
- Support Email
- Site URL

## 📊 Email Template Preview

Access the preview system at:
**Admin Settings → Email Templates**

Features:
- Live preview of all templates
- Send test emails
- Interactive template browser
- Mobile responsive preview

## 🚀 Integration Points

### Authentication Flow
- Password reset emails automatically sent
- Welcome emails on signup (if enabled)

### Application Flow
- Status change notifications
- Timeline updates
- Document reminders

### Payment Flow
- Payment receipts
- Payment confirmations

### Automated Reminders
Functions available for scheduled tasks:
- `checkAndSendDocumentReminders(userId)`
- `checkAndSendDetailsReminders(userId)`

## 📝 Best Practices

### 1. Personalization
- Always include user's name
- Use specific details (application ID, amounts, etc.)
- Reference their specific context

### 2. Clear CTAs
- One primary action per email
- Button text should be action-oriented
- Links should be prominent

### 3. Timing
- Send immediately for time-sensitive emails (password reset)
- Batch non-urgent reminders
- Respect user preferences

### 4. Testing
- Test all templates before deployment
- Check on multiple devices
- Verify links and dynamic content
- Test spam score

## 🔒 Security

### Password Reset
- Links expire after 1 hour
- One-time use only
- Secure token generation
- No password hints in email

### Email Validation
- Verify email format
- Check deliverability
- Handle bounces gracefully

### Content Safety
- Never include sensitive data
- Use secure links (HTTPS only)
- Sanitize user-generated content

## 📈 Monitoring

### Track Email Metrics
- Delivery rates
- Open rates
- Click-through rates
- Bounce rates

### Resend Dashboard
Monitor at: https://resend.com/emails
- Real-time delivery status
- Failed delivery reasons
- Email logs and analytics

## 🐛 Troubleshooting

### Email Not Delivered
1. Check Resend/SMTP configuration
2. Verify domain is verified (for Resend)
3. Check spam folder
4. Review Resend dashboard for errors
5. Check email format/validity

### Template Not Rendering
1. Check browser console for errors
2. Verify all required data is provided
3. Test with sample data
4. Check email client compatibility

### Links Not Working
1. Verify URL generation
2. Check token expiry
3. Test in different email clients
4. Ensure HTTPS is used

## 🔄 Future Enhancements

### Planned Features
- [ ] Email preferences center
- [ ] Unsubscribe management
- [ ] Email scheduling
- [ ] A/B testing
- [ ] Multi-language support
- [ ] SMS notifications
- [ ] Push notifications
- [ ] Webhook notifications

### Template Additions
- [ ] Invoice generation
- [ ] Appointment reminders
- [ ] Survey/feedback requests
- [ ] Newsletter templates
- [ ] Announcement templates

## 📞 Support

For issues or questions:
- **Email**: support@gritsync.com
- **Documentation**: Check this file
- **Admin Panel**: Settings → Email Templates
- **Resend Docs**: https://resend.com/docs

## 🎨 Design System

### Colors
- Primary: #10b981 (green-500)
- Secondary: #3b82f6 (blue-500)
- Success: #10b981
- Warning: #f59e0b
- Danger: #ef4444

### Typography
- Font: System fonts for best compatibility
- Headings: Bold, hierarchical
- Body: 16px, line-height 1.6
- Responsive sizing

### Components
- Buttons: Gradient, rounded, with hover effects
- Cards: Subtle borders, light backgrounds
- Badges: Color-coded status indicators
- Tables: Striped, responsive

## ✅ Checklist for New Templates

When creating new email templates:
- [ ] Mobile responsive design
- [ ] Dark mode compatible
- [ ] All links are HTTPS
- [ ] Personalization tokens work
- [ ] Unsubscribe link included (if marketing)
- [ ] Preview in multiple clients
- [ ] Test with real data
- [ ] Document usage in this file
- [ ] Add to preview system
- [ ] Test spam score

---

**Last Updated**: December 2024  
**Version**: 1.0.0  
**Maintained By**: GritSync Development Team

