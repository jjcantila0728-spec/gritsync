# Inbox Error Display Fix

## Problem
The inbox pages at `/admin/emails/inbox` and `/client/emails/inbox` were showing no content without any error messages when there were issues loading emails (e.g., missing Resend API key configuration).

## Root Cause
When the `loadInboxEmails()` function encountered errors (such as missing Resend API key), it would:
1. Catch the error silently
2. Log it to console only
3. Set `receivedEmails` to empty array
4. Show empty state UI instead of an error message

This made it appear as if there were simply no emails, when in fact there was a configuration/connection problem.

## Solution

### 1. Updated `src/lib/resend-inbox-api.ts`
Added proper error checking for edge function responses:
- Check if `data.error` exists in response (indicates edge function returned error)
- Extract error message from `data.message` or `data.error`
- Throw descriptive error with the message

This ensures errors from the Resend API (like "API key not configured") are properly propagated.

### 2. Updated `src/pages/AdminEmails.tsx`
Modified `loadInboxEmails()` function to:
- Catch errors and parse error messages
- Show appropriate toast notifications with error details
- Differentiate between error types:
  - Missing/invalid API key configuration
  - Permission denied
  - Generic errors with message

### 3. Updated `src/pages/ClientEmails.tsx`
Modified `loadInboxEmails()` function to:
- Show warning toast if email address not configured
- Catch errors and show descriptive toast messages
- Handle specific error scenarios:
  - Email system not configured
  - Invalid email address
  - Network errors
  - Permission denied

## Changes Made

### Files Modified
1. `src/lib/resend-inbox-api.ts`
   - Added error response checking in `listReceivedEmails()`
   - Added error response checking in `getReceivedEmailById()`
   - Added error response checking in `listReceivedEmailAttachments()`
   - Added error response checking in `getReceivedEmailAttachment()`
   - Added error response checking in `deleteReceivedEmail()`

2. `src/pages/AdminEmails.tsx`
   - Enhanced error handling in `loadInboxEmails()` with toast notifications

3. `src/pages/ClientEmails.tsx`
   - Enhanced error handling in `loadInboxEmails()` with toast notifications
   - Added warning for missing email address

## Expected Behavior After Fix

### When Resend API Key is NOT Configured
- **Before:** Blank inbox page with "No emails" message
- **After:** Error toast appears: "❌ Resend API key not configured. Please configure it in Admin Settings → Notifications."

### When There Are Permission Issues
- **Before:** Blank inbox page
- **After:** Error toast appears: "❌ Permission denied to access inbox." (Admin) or "❌ Permission denied. Contact admin." (Client)

### When Email Address is Missing (Client Only)
- **Before:** Silent failure
- **After:** Warning toast appears: "⚠️ Email address not configured. Please contact support."

### When Network Issues Occur
- **Before:** Blank page
- **After:** Warning toast appears: "⚠️ Network error. Please check your connection."

### When Inbox is Actually Empty
- **Before & After:** Shows helpful empty state with setup instructions (no change)

## Testing

To verify the fix:

1. **Test Missing API Key:**
   - Remove Resend API key from Admin Settings
   - Navigate to `/admin/emails/inbox`
   - Should see error toast about missing API key

2. **Test With Valid Configuration:**
   - Add valid Resend API key
   - Navigate to inbox pages
   - Should load emails or show empty state (not error)

3. **Test Client Inbox:**
   - Navigate to `/client/emails/inbox`
   - Should see appropriate error or emails based on configuration

## Related Files
- `src/pages/AdminEmails.tsx` - Admin email management page
- `src/pages/ClientEmails.tsx` - Client email management page
- `src/lib/resend-inbox-api.ts` - Resend inbox API wrapper
- `supabase/functions/resend-inbox/index.ts` - Edge function that proxies to Resend API

## Notes
- The edge function (`resend-inbox`) already had proper error handling and was returning error responses correctly
- The issue was that these error responses were not being properly detected and displayed to users
- Empty inbox state with setup instructions remains unchanged and is appropriate when there are actually no emails

