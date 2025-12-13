# Inbox Debugging Guide

## Issue
Emails exist in Resend email history but are not showing in the inbox at `/admin/emails/inbox` and `/client/emails/inbox`.

## Debug Steps

### Step 1: Check Browser Console Logs

After refreshing the inbox pages, check the browser console (F12 → Console tab) for these log messages:

#### For Admin Inbox (`/admin/emails/inbox`):
Look for:
```
Admin Inbox - API Result: {...}
Admin Inbox - Emails data: [...]
Admin Inbox - Number of emails: X
```

#### For Client Inbox (`/client/emails/inbox`):
Look for:
```
Client Inbox - Fetching emails for: [email address]
Client Inbox - Raw emails received: [...]
Client Inbox - Number of emails: X
```

### Step 2: Check Edge Function Logs

In Supabase Dashboard:
1. Go to **Edge Functions** → **resend-inbox**
2. Click **Logs** tab
3. Look for:
   ```
   Fetching from Resend: { url: "...", queryString: "..." }
   Resend LIST Response: { dataType: "...", hasData: true/false, dataLength: X }
   ```

### Step 3: Analyze the Data

**Check these things:**

1. **Is data being returned from Resend?**
   - `dataLength` should be > 0 if emails exist
   - If `dataLength: 0`, emails might be filtered or not in the expected format

2. **Is the response structure correct?**
   - Should have: `{ object: 'list', has_more: boolean, data: [...] }`
   - If structure is different, there's a format mismatch

3. **For Client Inbox: Is the correct email address being queried?**
   - Check `Client Inbox - Fetching emails for: [email]`
   - Ensure it matches the email address in Resend

4. **Are emails being filtered out?**
   - Client inbox filters by `to` field
   - Check if the email address in Resend matches exactly

## Common Issues & Solutions

### Issue 1: Empty `data` array
**Symptom:** `dataLength: 0` but emails exist in Resend
**Possible Causes:**
- Resend API filtering by `to` parameter (client inbox)
- Emails sent to different addresses
- Email address case sensitivity

**Solution:**
- For admin: Remove `to` filter to see all emails
- For client: Verify email address matches exactly

### Issue 2: Wrong response structure
**Symptom:** `hasData: false` or unexpected structure
**Possible Causes:**
- Resend API version mismatch
- Response format changed

**Solution:**
- Check Resend API documentation
- Update response interface

### Issue 3: Emails filtered out on client side
**Symptom:** Emails come from API but don't display
**Check:**
- `hiddenEmails` in localStorage
- Client-side filtering logic in `getReceivedEmails()`

## Quick Tests

### Test 1: Admin Inbox (All Emails)
```javascript
// In browser console on /admin/emails/inbox
console.log('Received Emails:', receivedEmails)
console.log('Loading:', loading)
```

### Test 2: Check Resend Directly
Use Resend API test:
```bash
curl -X GET https://api.resend.com/emails/receiving \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Test 3: Check localStorage filters
```javascript
// In browser console
console.log('Hidden Emails:', JSON.parse(localStorage.getItem('hiddenEmails') || '[]'))
console.log('Read Status:', JSON.parse(localStorage.getItem('email_read_status_USER_ID') || '[]'))
```

## Next Steps Based on Logs

### If logs show `dataLength: 0`:
→ **Problem:** Resend is returning empty array
→ **Action:** Check Resend dashboard filters or API parameters

### If logs show data but UI is empty:
→ **Problem:** Frontend filtering or rendering issue
→ **Action:** Check `receivedEmails` state and filtering logic

### If no logs appear:
→ **Problem:** Function not being called
→ **Action:** Check if `loadInboxEmails()` is triggered on mount

### If edge function logs show errors:
→ **Problem:** API key or configuration issue
→ **Action:** Verify Resend API key in settings

## Files to Check

1. **Edge Function:** `supabase/functions/resend-inbox/index.ts`
2. **Admin Page:** `src/pages/AdminEmails.tsx` (line ~1004)
3. **Client Page:** `src/pages/ClientEmails.tsx` (line ~271)
4. **API Wrapper:** `src/lib/resend-inbox-api.ts`

## Please Share

When reporting the issue, please share:
1. All console log output from browser
2. Edge function logs from Supabase
3. Whether emails show in Resend dashboard
4. Email addresses being used (to/from)

