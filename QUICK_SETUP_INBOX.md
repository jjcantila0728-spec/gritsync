# 🚀 Quick Setup - Inbox Content Fix

## The Problem
Inbox emails show "No content" because Resend API doesn't provide email body content after initial receipt.

## The Solution
Use webhooks to store emails in database with full content.

---

## Step-by-Step Setup (10 minutes)

### 1. Run Database Migration (2 min)
```bash
cd E:\GRITSYNC
npx supabase migration up --local
```

**What this does**: Creates `received_emails` table to store email content

**Verify**: Check Supabase dashboard → Database → Tables → `received_emails`

---

### 2. Deploy Webhook Function (3 min)
```bash
npx supabase functions deploy resend-webhook --project-ref warfdcbvnapietbkpild
```

**What this does**: Deploys edge function to receive emails from Resend

**Verify**: Check Supabase dashboard → Edge Functions → `resend-webhook`

---

### 3. Configure Resend Webhook (5 min)

**Go to**: https://resend.com/webhooks

**Click**: "Add Webhook"

**Webhook URL**:
```
https://warfdcbvnapietbkpild.supabase.co/functions/v1/resend-webhook
```

**Events to enable**:
- ✅ email.received

**Click**: "Create Webhook"

---

## Test It Works

### Send Test Email
Use Resend dashboard or curl:
```bash
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer YOUR_RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "test@yourdomain.com",
    "to": "YOUR_GRITSYNC_EMAIL@gritsync.com",
    "subject": "Test Email",
    "html": "<h1>Hello!</h1><p>This is a test with <strong>HTML</strong> content.</p>",
    "text": "Hello! This is a test with plain text."
  }'
```

### Check Database
Go to Supabase Dashboard → Table Editor → `received_emails`

You should see:
- New row with email data
- `html_body` column has HTML content
- `text_body` column has text content

### Check Inbox
1. Open `http://localhost:5000/client/emails`
2. Click inbox
3. Click the test email
4. ✅ Should now see full email content!

---

## What Changed?

### Before (Broken)
```
Resend API → List emails → No content ❌
```

### After (Works)
```
Email arrives → Webhook → Database → Display from DB → Full content ✅
```

---

## If It Still Doesn't Work

### Issue: No emails in database
**Solution**: Check webhook logs in Resend dashboard

### Issue: Emails in DB but not showing
**Solution**: Make sure frontend is updated (see below)

### Issue: Webhook failing
**Solution**: Check edge function logs in Supabase dashboard

---

## Update Frontend (If Needed)

If emails are in database but still not showing, you need to update the frontend to use the database API.

**Change this line in `ClientEmails.tsx`**:
```typescript
// OLD
import { resendInboxAPI } from '@/lib/resend-inbox-api'
const emails = await resendInboxAPI.getReceivedEmails(...)

// NEW  
import { receivedEmailsAPI } from '@/lib/received-emails-api'
const emails = await receivedEmailsAPI.getAll({ toEmail: ... })
```

**Also update field names**:
```typescript
// OLD (Resend API format)
email.from      // "Name <email@example.com>"
email.html      // HTML content
email.text      // Text content

// NEW (Database format)
email.from_email  // "email@example.com"
email.from_name   // "Name"
email.html_body   // HTML content
email.text_body   // Text content
```

---

## Summary

1. ✅ Run migration
2. ✅ Deploy webhook function
3. ✅ Configure Resend webhook
4. ✅ Test email delivery
5. ⏳ Update frontend (if needed)

**Total Time**: ~10 minutes

Once done, ALL incoming emails will have full content! 🎉

---

## Commands Reference

```bash
# 1. Migration
npx supabase migration up --local

# 2. Deploy webhook
npx supabase functions deploy resend-webhook --project-ref warfdcbvnapietbkpild

# 3. Test webhook locally (optional)
npx supabase functions serve resend-webhook

# 4. Check logs
npx supabase functions logs resend-webhook --project-ref warfdcbvnapietbkpild
```

---

## Webhook URL for Production

**Local**:
```
http://localhost:54321/functions/v1/resend-webhook
```

**Production**:
```
https://warfdcbvnapietbkpild.supabase.co/functions/v1/resend-webhook
```

Use production URL in Resend dashboard!

---

Need help? Check `INBOX_CONTENT_SOLUTION.md` for detailed explanation.

