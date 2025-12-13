# 🔧 Inbox Content Not Showing - Complete Solution

## Problem
Inbox emails are not showing content for both client and admin pages.

## Root Cause
**Resend API Limitation**: The Resend API does NOT provide endpoints to retrieve full email content after initial receipt. The LIST endpoint only returns metadata (from, to, subject, date) but NOT the html/text body content.

According to Resend documentation:
- ✅ `GET /emails/receiving` - Lists received emails (metadata only)
- ❌ `GET /emails/receiving/{id}` - Does NOT exist (no individual retrieval)
- ✅ Webhook `email.received` - Provides FULL email content on receipt

## Solution: Webhook + Database Storage

Since we can't retrieve email content from Resend after initial receipt, we must:
1. **Store emails in our database** via webhook
2. **Display emails from database** instead of Resend API

---

## Implementation Steps

### Step 1: Create Database Table ✅

**File**: `supabase/migrations/create-received-emails-table.sql`

Run this migration:
```bash
npx supabase migration up --local
```

This creates:
- `received_emails` table with full email data
- RLS policies for client/admin access
- Indexes for performance
- Auto-association with users

### Step 2: Deploy Webhook Edge Function ✅

**File**: `supabase/functions/resend-webhook/index.ts`

Deploy the webhook function:
```bash
npx supabase functions deploy resend-webhook --project-ref YOUR_PROJECT_REF
```

This function:
- Receives webhook from Resend
- Stores full email content in database
- Associates with users automatically

### Step 3: Configure Resend Webhook ⚠️ ACTION REQUIRED

1. **Go to Resend Dashboard**: https://resend.com/webhooks
2. **Click "Add Webhook"**
3. **Enter Webhook URL**:
   ```
   https://YOUR_PROJECT_REF.supabase.co/functions/v1/resend-webhook
   ```
4. **Select Events**:
   - ✅ `email.received`
5. **Save Webhook**
6. **Copy Signing Secret** (optional, for verification)

### Step 4: Update Frontend to Use Database ✅

**File**: `src/lib/received-emails-api.ts` (created)

New API for fetching emails from database:
- `receivedEmailsAPI.getAll()` - Get all received emails
- `receivedEmailsAPI.getById()` - Get single email
- `receivedEmailsAPI.markAsRead()` - Mark as read
- `receivedEmailsAPI.delete()` - Soft delete
- `receivedEmailsAPI.getUnreadCount()` - Get unread count

### Step 5: Update Client Emails Page

**File**: `src/pages/ClientEmails.tsx`

Change from Resend API to Database API:
```typescript
// OLD (doesn't work - no content)
import { resendInboxAPI } from '@/lib/resend-inbox-api'
const emails = await resendInboxAPI.getReceivedEmails({ to: email })

// NEW (works - full content from database)
import { receivedEmailsAPI } from '@/lib/received-emails-api'
const emails = await receivedEmailsAPI.getAll({ toEmail: email })
```

### Step 6: Update Admin Emails Page

**File**: `src/pages/AdminEmails.tsx`

Same change as client page - use database API instead of Resend API.

---

## Quick Migration Steps (Do This Now)

### 1. Run Database Migration
```bash
cd E:\GRITSYNC
npx supabase migration up --local
```

### 2. Deploy Webhook Function
```bash
npx supabase functions deploy resend-webhook --project-ref warfdcbvnapietbkpild
```

### 3. Configure Resend Webhook
- Go to https://resend.com/webhooks
- Add webhook URL: `https://warfdcbvnapietbkpild.supabase.co/functions/v1/resend-webhook`
- Enable `email.received` event
- Save

### 4. Test Email Receipt
1. Send test email to a GritSync email address
2. Check Supabase database: `received_emails` table
3. Email should appear with full HTML/text content
4. Check inbox in app - content should display

---

## Why This Approach?

### Option 1: Resend API (Current - Doesn't Work ❌)
```
List emails → Only metadata (no content)
Get by ID → Not supported for received emails
Result: No email content
```

### Option 2: Webhook + Database (New - Works ✅)
```
Email received → Webhook fires → Store in DB → Display from DB
Result: Full email content available
```

### Benefits:
✅ Full email content (HTML + text)
✅ Fast (no external API calls)
✅ Works offline
✅ Can mark as read/unread
✅ Can soft delete
✅ Search capability
✅ Backup of all emails

---

## Email Flow

### Old Flow (Broken)
```
[Resend] → User clicks email → Fetch from Resend API → ❌ No content
```

### New Flow (Works)
```
[Resend] → Webhook → Database → User clicks email → Display from DB → ✅ Full content
```

---

## Database Schema

```sql
received_emails (
  id UUID PRIMARY KEY,
  resend_id TEXT UNIQUE,
  
  -- Sender/Recipients
  from_email TEXT,
  from_name TEXT,
  to_email TEXT,
  cc TEXT[],
  bcc TEXT[],
  
  -- Content (THIS IS WHAT WE NEED!)
  html_body TEXT,  -- ✅ Full HTML content
  text_body TEXT,  -- ✅ Full text content
  subject TEXT,
  
  -- Metadata
  attachments JSONB,
  headers JSONB,
  
  -- Status
  is_read BOOLEAN,
  is_deleted BOOLEAN,
  received_at TIMESTAMPTZ,
  
  -- User association
  recipient_user_id UUID,
  recipient_email_address_id UUID
)
```

---

## RLS Policies

### Clients
```sql
-- Can only see their own emails
WHERE recipient_user_id = auth.uid()
OR to_email IN (SELECT email_address FROM email_addresses WHERE user_id = auth.uid())
```

### Admins
```sql
-- Can see all emails
WHERE EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
```

---

## API Comparison

### Before (Resend API)
```typescript
// ❌ Returns metadata only (no html/text)
const emails = await resendInboxAPI.getReceivedEmails({
  to: 'user@gritsync.com',
  limit: 50
})

// Result:
{
  id: "abc123",
  from: "sender@example.com",
  to: ["user@gritsync.com"],
  subject: "Hello",
  // ❌ NO html or text fields!
}
```

### After (Database API)
```typescript
// ✅ Returns full email with content
const emails = await receivedEmailsAPI.getAll({
  toEmail: 'user@gritsync.com',
  limit: 50
})

// Result:
{
  id: "uuid",
  resend_id: "abc123",
  from_email: "sender@example.com",
  to_email: "user@gritsync.com",
  subject: "Hello",
  html_body: "<html>...</html>",  // ✅ Full HTML!
  text_body: "Hello world...",    // ✅ Full text!
  attachments: [...],
  is_read: false,
  received_at: "2024-01-01T00:00:00Z"
}
```

---

## Replicating Client View in Admin

The admin page should use the EXACT same components and logic as the client page:

### Shared Components
1. **Email List Component**: Shows inbox/sent in table format
2. **Email Detail View**: Full-page email view with back button
3. **Read/Unread Status**: Visual indicators
4. **Delete Buttons**: Soft delete functionality
5. **Sender Details**: Profile pictures and names

### Code Structure
```typescript
// ClientEmails.tsx
import { EmailList } from '@/components/email/EmailList'
import { EmailDetailView } from '@/components/email/EmailDetailView'

// AdminEmails.tsx (should use same components)
import { EmailList } from '@/components/email/EmailList'
import { EmailDetailView } from '@/components/email/EmailDetailView'
```

---

## Migration Checklist

### Database
- [ ] Run migration: `create-received-emails-table.sql`
- [ ] Verify table created in Supabase dashboard
- [ ] Check RLS policies are active

### Edge Function
- [ ] Deploy `resend-webhook` function
- [ ] Test function with curl/Postman
- [ ] Check function logs

### Resend Configuration
- [ ] Add webhook in Resend dashboard
- [ ] Enable `email.received` event
- [ ] Test webhook delivery
- [ ] Verify emails stored in database

### Frontend
- [ ] Update ClientEmails to use `receivedEmailsAPI`
- [ ] Update AdminEmails to use `receivedEmailsAPI`
- [ ] Test inbox loading
- [ ] Test email content display
- [ ] Test read/unread functionality
- [ ] Test delete functionality

---

## Testing

### 1. Send Test Email
```bash
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "test@yourdomain.com",
    "to": "user@gritsync.com",
    "subject": "Test Email",
    "html": "<h1>Hello World</h1><p>This is a test email with HTML content.</p>"
  }'
```

### 2. Verify in Database
```sql
SELECT id, from_email, to_email, subject, 
       LENGTH(html_body) as html_length,
       LENGTH(text_body) as text_length,
       received_at
FROM received_emails
ORDER BY received_at DESC
LIMIT 5;
```

### 3. Check Frontend
1. Open `http://localhost:5000/client/emails`
2. Click inbox
3. Click email
4. ✅ Should see full HTML content

---

## Troubleshooting

### No Emails in Database
**Check**:
1. Webhook configured in Resend? ✓
2. Webhook URL correct? ✓
3. Edge function deployed? ✓
4. Check function logs for errors

### Emails in Database but Not Showing
**Check**:
1. RLS policies active? ✓
2. User has correct `recipient_user_id`? ✓
3. Email address exists in `email_addresses` table? ✓
4. Frontend using `receivedEmailsAPI`? ✓

### Content Still Not Showing
**Check**:
1. `html_body` or `text_body` populated in database? ✓
2. Using correct field names in frontend? ✓
3. Check browser console for errors ✓

---

## Files Created/Modified

### New Files
1. ✅ `supabase/migrations/create-received-emails-table.sql`
2. ✅ `supabase/functions/resend-webhook/index.ts`
3. ✅ `src/lib/received-emails-api.ts`

### Modified Files
1. ⏳ `src/pages/ClientEmails.tsx` - Switch to database API
2. ⏳ `src/pages/AdminEmails.tsx` - Switch to database API

---

## Next Steps

1. **Run migration** (5 minutes)
2. **Deploy webhook** (5 minutes)
3. **Configure Resend** (5 minutes)
4. **Update frontend** (15 minutes)
5. **Test thoroughly** (10 minutes)

**Total Time**: ~40 minutes

---

## Status

✅ Database table created
✅ Webhook function created
✅ Frontend API created
⏳ Migration needs to run
⏳ Webhook needs deployment
⏳ Resend needs configuration
⏳ Frontend needs updates

---

**Once webhook is set up, ALL NEW emails will have full content! 🎉**

