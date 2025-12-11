# Email System - Quick Reference

## 🚀 Quick Start

### Send an Email

```typescript
import { sendPaymentReceiptEmail } from '@/lib/email'

await sendPaymentReceiptEmail('user@example.com', {
  userName: 'John Doe',
  amount: 500.00,
  currency: 'USD',
  transactionId: 'TXN123',
  paymentDate: new Date().toLocaleDateString(),
  description: 'NCLEX Processing'
})
```

## 📧 Available Email Types

| Email Type | Function | Use Case |
|------------|----------|----------|
| 🔐 Forgot Password | `sendForgotPasswordEmail` | Password reset requests |
| ✅ Payment Receipt | `sendPaymentReceiptEmail` | Payment confirmations |
| 📋 Timeline Update | `sendTimelineUpdateEmail` | Application status changes |
| 📄 Missing Documents | `sendMissingDocumentEmail` | Document upload reminders |
| ✏️ Missing Details | `sendMissingDetailsEmail` | Profile completion prompts |
| 🎓 School Letter | `sendSchoolLetterEmail` | Generated letter delivery |
| 📚 Full Instructions | `sendFullInstructionsEmail` | Onboarding guides |
| 🎉 Welcome | `sendWelcomeEmail` | New user welcome |

## 💻 Code Examples

### 1. Password Reset
```typescript
import { sendForgotPasswordEmail } from '@/lib/email'

await sendForgotPasswordEmail(
  email,
  userName,
  resetLink
)
```

### 2. Payment Receipt
```typescript
import { sendPaymentReceiptEmail } from '@/lib/email'

await sendPaymentReceiptEmail(email, {
  userName,
  amount: 500.00,
  currency: 'USD',
  transactionId: 'TXN123',
  paymentDate: new Date().toLocaleDateString(),
  description: 'Service Payment',
  items: [
    { name: 'Processing Fee', amount: 350 },
    { name: 'Express Service', amount: 150 }
  ],
  receiptUrl: 'https://app.com/receipt'
})
```

### 3. Timeline Update
```typescript
import { sendTimelineUpdateEmail } from '@/lib/email'

await sendTimelineUpdateEmail(email, {
  userName,
  applicationId: 'APP001',
  updateTitle: 'Documents Approved',
  updateMessage: 'Your documents have been verified!',
  newStatus: 'In Review',
  actionUrl: 'https://app.com/applications/APP001'
})
```

### 4. Missing Documents
```typescript
import { sendMissingDocumentEmail } from '@/lib/email'

await sendMissingDocumentEmail(email, {
  userName,
  applicationId: 'APP001',
  missingDocuments: [
    { name: 'Passport', required: true },
    { name: 'License', required: false }
  ],
  deadline: 'Jan 30, 2024',
  uploadUrl: 'https://app.com/upload'
})
```

### 5. Automated Reminders
```typescript
import { 
  checkAndSendDocumentReminders,
  checkAndSendDetailsReminders 
} from '@/lib/email'

// Check and send document reminders
await checkAndSendDocumentReminders(userId)

// Check and send profile completion reminders
await checkAndSendDetailsReminders(userId)
```

## 🎨 Preview Templates

**Admin Panel**: Settings → Email Templates

- View all templates
- Send test emails
- See mobile preview

## ⚙️ Configuration

### 1. Set Up Resend
1. Get API key from https://resend.com
2. Admin Settings → Email & Notifications
3. Select "Resend (Recommended)"
4. Enter API key
5. Save

### 2. Test Email
- Use "Send Test Email" button
- Or use test address: `onboarding@resend.dev`

### 3. Verify Domain (Production)
1. Go to https://resend.com/domains
2. Add your domain
3. Add DNS records
4. Wait for verification

## 🔍 Troubleshooting

### Email Not Received?
1. Check spam folder
2. Verify Resend API key
3. Check Resend dashboard for errors
4. Verify email address is correct

### Template Not Rendering?
1. Check browser console
2. Verify all required data provided
3. Test with sample data

### Links Not Working?
1. Check URL format
2. Ensure HTTPS used
3. Test token expiry

## 📊 Monitor Emails

**Resend Dashboard**: https://resend.com/emails

View:
- Delivery status
- Open rates
- Click rates
- Error logs

## 🎯 Best Practices

### ✅ DO
- Personalize with user's name
- Include clear call-to-action
- Test before deploying
- Monitor delivery rates

### ❌ DON'T
- Send without testing
- Include sensitive data
- Use HTTP links
- Ignore bounces

## 📞 Get Help

- **Docs**: `EMAIL_SYSTEM_DOCUMENTATION.md`
- **Troubleshooting**: `RESEND_TROUBLESHOOTING.md`
- **Support**: support@gritsync.com

---

**Quick Access**: `/admin/settings/email-templates`

