# Complete Inbox Fix - Using Database Table Instead of Resend API

## Issue Found

Your app has **TWO systems** for received emails, and it's using the WRONG one:

### Current (Wrong) Setup:
- ✅ Pages use `resendInboxAPI` → Calls Resend API directly
- ❌ Resend API doesn't filter properly by user
- ❌ No user association in Resend
- ❌ Clients see 0 emails

### Correct Setup (Already Built, Just Not Used):
- ✅ Database table `received_emails` with proper RLS
- ✅ Webhook `resend-webhook` that stores emails
- ✅ API wrapper `receivedEmailsAPI` ready to use
- ✅ User association via triggers
- ❌ **Just need to switch pages to use it!**

## The Complete Solution

### Step 1: Check if `received_emails` Table Has Data

Run this SQL in Supabase SQL Editor:

```sql
-- Check received_emails table
SELECT COUNT(*) as total_emails FROM received_emails;

-- Show sample
SELECT id, from_email, to_email, subject, received_at 
FROM received_emails 
ORDER BY received_at DESC 
LIMIT 10;
```

**If table is empty:** The webhook isn't configured in Resend yet
**If table has data:** Great! Just switch the pages to use it

### Step 2: Configure Resend Webhook (If Not Already Done)

1. Go to Resend Dashboard → Webhooks
2. Add new webhook with URL:
   ```
   https://YOUR_SUPABASE_PROJECT.supabase.co/functions/v1/resend-webhook
   ```
3. Subscribe to event: `email.received`
4. Save webhook

### Step 3: Switch Pages to Use Database Table

The pages need to use `receivedEmailsAPI` instead of `resendInboxAPI`.

#### For Client Inbox:

Change from:
```typescript
const emails = await resendInboxAPI.getReceivedEmails({
  to: clientEmailAddress.email_address,
  limit: 50,
})
```

To:
```typescript
const emails = await receivedEmailsAPI.getAll({
  toEmail: clientEmailAddress.email_address,
  limit: 50,
})
```

#### For Admin Inbox:

Change from:
```typescript
const result = await resendInboxAPI.list({
  limit: 50,
})
```

To:
```typescript
const emails = await receivedEmailsAPI.getAll({
  limit: 50,
})
```

### Step 4: Update Interface Types

The database table uses slightly different field names:

**Resend API Format:**
```typescript
{
  id: string
  to: string[]  // Array
  from: string
  subject: string
  html?: string
  text?: string
  created_at: string
}
```

**Database Format:**
```typescript
{
  id: string
  to_email: string  // Single string
  from_email: string
  from_name?: string
  subject: string
  html_body?: string
  text_body?: string
  received_at: string
  is_read: boolean
  recipient_user_id: string
}
```

## Benefits of Using Database Table

1. ✅ **Proper RLS** - Clients automatically see only their emails
2. ✅ **User Association** - Emails linked to users via `recipient_user_id`
3. ✅ **Read/Unread Status** - Stored in database
4. ✅ **Soft Delete** - `is_deleted` flag instead of permanent deletion
5. ✅ **Better Performance** - Query local database instead of external API
6. ✅ **Offline Support** - Data cached in your database
7. ✅ **Full Email Content** - HTML and text bodies stored permanently

## Why Resend API Direct Access Doesn't Work

The Resend API `/emails/receiving` endpoint:
- Returns ALL emails for the account
- Filtering by `to` parameter may not work as expected
- No concept of "users" or permissions
- No read/unread tracking
- No soft delete support

## Migration Table Check

Your `create-received-emails-table.sql` is **CORRECT** ✅

It has:
- ✅ Proper schema with all fields
- ✅ RLS policies for admin (see all) and clients (see own)
- ✅ Trigger to auto-associate emails with users
- ✅ Indexes for performance
- ✅ Soft delete support

## Quick Test

After switching to database:

```sql
-- Insert test email
INSERT INTO received_emails (
  resend_id,
  from_email,
  from_name,
  to_email,
  subject,
  html_body,
  text_body,
  received_at
) VALUES (
  'test-' || gen_random_uuid()::text,
  'test@example.com',
  'Test Sender',
  'klcantila1@gritsync.com',
  'Test Email',
  '<p>This is a test</p>',
  'This is a test',
  NOW()
);
```

Then refresh client inbox - should show the test email!

## Files to Update

1. `src/pages/ClientEmails.tsx` - Switch to `receivedEmailsAPI`
2. `src/pages/AdminEmails.tsx` - Switch to `receivedEmailsAPI`
3. Update field mappings (to_email vs to, html_body vs html, etc.)

## Next Steps

1. **Check if table has data** (run CHECK_RECEIVED_EMAILS_TABLE.sql)
2. **If empty:** Configure Resend webhook
3. **Update ClientEmails.tsx** to use database API
4. **Update AdminEmails.tsx** to use database API
5. **Test with sample email**

Would you like me to update the pages now to use the database table?

