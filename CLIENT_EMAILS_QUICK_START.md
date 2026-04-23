# Client Emails - Quick Start Guide

## 🚀 Quick Setup

### 1. Run Database Migration

Apply the new migration to enable auto-email generation:

```bash
# The migration file is already created at:
# supabase/migrations/add-auto-email-generation-trigger.sql

# Apply via Supabase CLI:
supabase db push

# Or run directly in Supabase SQL Editor
```

### 2. Deploy Edge Function Update

Deploy the updated resend-inbox function:

```bash
supabase functions deploy resend-inbox
```

### 3. Test the Implementation

**Create a Test User:**
1. Register a new user with:
   - First Name: "Test"
   - Middle Name: "Client" (optional)
   - Last Name: "User"
2. Expected email: `tcuser@gritsync.com` (or `tuser@gritsync.com` if no middle name)

**Test Email Access:**
1. Login as the test user
2. Navigate to `http://localhost:5000/client/emails`
3. Check Inbox - should only show emails sent TO your email
4. Check Sent - should only show emails sent FROM your email

---

## 🎯 Key Features

### For Clients

✅ **Personalized Email Address**
- Format: `firstInitial + middleInitial + lastname@gritsync.com`
- Auto-generated on registration
- Displayed in profile and emails page

✅ **Secure Inbox**
- Only see emails sent TO your address
- Cannot view other users' emails
- Privacy protected

✅ **Sent Email Tracking**
- View all emails you've sent
- Track delivery status
- Access to email history

✅ **Professional Email Sending**
- Send from your @gritsync.com address
- Use email templates
- Add email signatures
- Reply to received emails

---

## 📋 Email Address Format

### Examples

| Name | Email Generated |
|------|----------------|
| John Michael Smith | jmsmith@gritsync.com |
| Maria Garcia | mgarcia@gritsync.com |
| Jane Ann Doe | jadoe@gritsync.com |
| Robert Lee | rlee@gritsync.com |

### Rules

1. **First Initial:** First letter of first name (lowercase)
2. **Middle Initial:** First letter of middle name (lowercase, optional)
3. **Last Name:** Full last name (lowercase, no spaces)
4. **Domain:** @gritsync.com
5. **Duplicates:** Adds number suffix (e.g., jsmith2@gritsync.com)
6. **Special Characters:** Removed from names

---

## 🔒 Security Features

### Access Control

✅ **Inbox Isolation**
- Clients only see emails TO their address
- Backend + client-side filtering
- RLS policies enforce security

✅ **Sent Email Isolation**
- Clients only see emails FROM their address
- Database-level filtering
- Cannot view admin or other client emails

✅ **Sending Restrictions**
- Can only send FROM assigned email
- From address field is locked
- Cannot impersonate others

---

## ⚠️ Error Messages

The system provides helpful error messages:

### Configuration Issues
```
❌ Email service is not configured. Please contact your administrator.
```
**Action:** Contact admin to configure Resend API key

### No Email Address
```
❌ No email address found for your account. Please contact support to have one assigned.
```
**Action:** Contact support to generate email address

### Network Issues
```
❌ Network error. Please check your internet connection and try again.
```
**Action:** Check internet connection and retry

### Validation Errors
```
⚠️ Please enter a valid email address for the recipient.
```
**Action:** Correct the email format

---

## 🛠️ Troubleshooting

### Email Address Not Generated

**Problem:** New user registered but no email address

**Solutions:**
1. Check if user has first_name and last_name in database
2. Manually generate email:
   ```sql
   SELECT create_client_email_address('user-id-here');
   ```
3. Check function logs for errors

### Cannot Send Emails

**Problem:** "Email service not configured" error

**Solutions:**
1. Verify Resend API key in settings
2. Check Resend dashboard for domain verification
3. Ensure @gritsync.com domain is verified in Resend

### No Emails in Inbox

**Problem:** Client cannot see received emails

**Solutions:**
1. Check if emails are actually addressed to client's email
2. Verify Resend inbox is receiving emails
3. Check browser console for API errors
4. Verify client's email address is active

### Duplicate Email Address Error

**Problem:** Error when creating email address

**Solutions:**
1. System automatically handles duplicates with numbers
2. If error persists, check database constraints
3. Manually assign unique email via admin panel

---

## 📊 Admin Actions

### Generate Email for Existing Users

Run this to generate emails for all clients without one:

```sql
-- Already included in migration, but can be run manually
DO $$
DECLARE
  user_record RECORD;
  generated_email TEXT;
BEGIN
  FOR user_record IN 
    SELECT u.id, u.first_name, u.middle_name, u.last_name, u.role
    FROM users u
    LEFT JOIN email_addresses ea ON ea.user_id = u.id AND ea.address_type = 'client'
    WHERE u.role = 'client' 
      AND u.first_name IS NOT NULL 
      AND u.last_name IS NOT NULL
      AND ea.id IS NULL
  LOOP
    BEGIN
      generated_email := create_client_email_address(user_record.id);
      RAISE NOTICE 'Created email % for user %', generated_email, user_record.id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to create email for user %: %', user_record.id, SQLERRM;
    END;
  END LOOP;
END $$;
```

### View All Client Emails

```sql
SELECT 
  u.first_name,
  u.last_name,
  ea.email_address,
  ea.is_primary,
  ea.is_active,
  ea.created_at
FROM users u
JOIN email_addresses ea ON ea.user_id = u.id
WHERE u.role = 'client' AND ea.address_type = 'client'
ORDER BY ea.created_at DESC;
```

### Manually Create Email Address

```sql
-- For a specific user
SELECT create_client_email_address('user-uuid-here');

-- Or manually insert
INSERT INTO email_addresses (
  email_address,
  display_name,
  user_id,
  address_type,
  is_primary,
  is_active,
  can_send,
  can_receive
) VALUES (
  'custom@gritsync.com',
  'Custom Name',
  'user-uuid-here',
  'client',
  TRUE,
  TRUE,
  TRUE,
  TRUE
);
```

---

## 🎨 UI Elements

### Client Emails Page

**URL:** `/client/emails`

**Tabs:**
1. **Inbox** - Received emails
2. **Sent** - Sent emails  
3. **Templates** - Available email templates

**Features:**
- Compose email button (top right)
- Search and filters
- Gmail-style email list
- Email detail modals
- Reply/Forward actions
- Template support
- Signature support

---

## 📱 User Experience

### Compose Email Flow

1. Click "Compose Email" button
2. From address is pre-filled (locked)
3. Enter recipient email
4. Enter subject
5. Compose message body (HTML supported)
6. Optional: Select email template
7. Optional: Add email signature
8. Click "Send Email"
9. Success confirmation
10. Email appears in Sent tab

### Read Email Flow

1. Click on email in list
2. Modal opens with full email
3. View sender, subject, body
4. See attachments (if any)
5. Actions: Reply, Forward, Print
6. Close modal to return to list

---

## 🔗 Related Pages

- **Admin Email Management:** `/admin/emails`
- **Admin Email Addresses:** `/admin/email-addresses`
- **Client Dashboard:** `/dashboard`
- **Client Profile:** `/profile`

---

## 💡 Tips

1. **Email Verification:** Ensure @gritsync.com domain is verified in Resend for emails to send/receive
2. **Middle Names:** Encourage users to provide middle names during registration for better uniqueness
3. **Monitoring:** Check email logs regularly in admin panel
4. **Support:** Provide clear instructions to clients on how to use their new email address
5. **Training:** Consider creating tutorial videos for email usage

---

## 📞 Support

If you encounter issues:

1. Check error messages in browser console
2. Review Supabase logs for backend errors
3. Verify Resend configuration
4. Check database migration status
5. Review this documentation
6. Contact system administrator

---

**Last Updated:** December 12, 2025
**Status:** ✅ Production Ready

