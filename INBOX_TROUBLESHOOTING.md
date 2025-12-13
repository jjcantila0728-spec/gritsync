# Inbox Troubleshooting - No Emails Showing

## Current Status

**Client Email Address:** `klcantila1@gritsync.com`
**Result:** 0 emails returned from API

## The Problem

The Resend API is returning an empty array when filtering by `to=klcantila1@gritsync.com`. This means:

1. **Either:** No emails in Resend are addressed TO `klcantila1@gritsync.com`
2. **Or:** The emails are addressed to a different format/casing of the email

## Things to Check

### 1. Check Admin Inbox First
Navigate to: `http://localhost:5000/admin/emails/inbox`

The admin inbox should show ALL received emails (no filter). Check the console logs for:
```
Admin Inbox - API Result: {...}
Admin Inbox - Emails data: [...]
Admin Inbox - Number of emails: X
```

**If admin shows emails:** The emails exist but are not addressed to the client email
**If admin shows 0 emails:** No emails are being received by Resend at all

### 2. Check Resend Dashboard

Go to: https://resend.com/emails

Look at the **received** emails section and check:
- What is the **TO** field for those emails?
- Is it exactly `klcantila1@gritsync.com`?
- Or is it something else like `admin@gritsync.com` or `info@gritsync.com`?

### 3. Check Resend Inbound Email Setup

In Resend Dashboard:
1. Go to **Domains** → Select your domain
2. Check **Inbound Rules**
3. Verify which email addresses are configured to receive

Common setups:
- Catch-all: `*@gritsync.com` → forwards all emails
- Specific addresses: Only listed addresses receive emails
- Domain forwarding: Emails go to specific destination

### 4. Test with Admin Inbox

Since admin inbox shows ALL emails without filtering, try:
1. Navigate to `/admin/emails/inbox`
2. Open browser console
3. Look for emails in the logs
4. Check the `to` field of each email

Example log to look for:
```javascript
Admin Inbox - Emails data: [{
  id: "...",
  to: ["admin@gritsync.com"],  // ← Check this field!
  from: "...",
  subject: "..."
}]
```

## Likely Issues & Solutions

### Issue 1: Emails Not Addressed to Client Email
**Symptom:** Admin sees emails, client doesn't
**Cause:** Emails in Resend are sent to different addresses (e.g., `admin@gritsync.com` instead of `klcantila1@gritsync.com`)

**Solutions:**
A. Send test email TO `klcantila1@gritsync.com` specifically
B. Update Resend inbound rules to forward to client email
C. Use catch-all forwarding in Resend

### Issue 2: No Emails Received by Resend
**Symptom:** Both admin and client show 0 emails
**Cause:** Resend is not receiving any emails

**Solutions:**
A. Check Resend inbound email configuration
B. Verify domain DNS records for receiving emails
C. Check if Resend API key has receive permissions
D. Try sending a test email from Resend's interface

### Issue 3: Resend API Not Returning Received Emails
**Symptom:** Emails show in Resend dashboard but not in app
**Cause:** API issue or wrong API endpoint

**Solutions:**
A. Check Resend API documentation for receiving emails
B. Verify API endpoint: `GET /emails/receiving`
C. Test API directly with curl:
```bash
curl -X GET "https://api.resend.com/emails/receiving" \
  -H "Authorization: Bearer YOUR_RESEND_API_KEY"
```

### Issue 4: Email Address Format Mismatch
**Symptom:** Client email in app doesn't match Resend
**Cause:** Case sensitivity or format difference

**Solutions:**
A. Check exact email format in Resend
B. Verify email address in database matches
C. Check for extra spaces or special characters

## Quick Test Steps

### Test 1: Send Email TO the Client Address
From any email account, send an email TO: `klcantila1@gritsync.com`

Wait 1-2 minutes, then:
1. Check Resend dashboard → Should appear in received emails
2. Refresh client inbox → Should now appear

### Test 2: Check What Resend Actually Has
In browser console on `/admin/emails/inbox`, run:
```javascript
// This will show ALL emails Resend has
fetch('YOUR_SUPABASE_URL/functions/v1/resend-inbox', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'list', options: { limit: 10 } })
}).then(r => r.json()).then(console.log)
```

### Test 3: Check Email Addresses in Database
```sql
-- Run in Supabase SQL Editor
SELECT id, email, email_address, is_primary 
FROM email_addresses 
WHERE user_id = 'USER_ID';
```

## Next Steps

1. **Check admin inbox logs** - Does it show any emails?
2. **Check Resend dashboard** - What's in the TO field of received emails?
3. **Send test email** - Send one TO `klcantila1@gritsync.com` specifically
4. **Share findings** - Let me know what you see in each check

## Additional Logging Added

I've added more detailed logging to help debug:
- Shows what email address is being requested
- Shows the API response before filtering
- Shows sample email data (first email)
- Shows before/after filtering counts
- Shows which emails are filtered out and why

**Please refresh the client inbox page and share the new console logs!**

