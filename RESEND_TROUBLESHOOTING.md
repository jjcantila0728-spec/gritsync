# Resend Email Troubleshooting Guide

## Issue: Email Shows "Success" but Not Received

If you're seeing a success message when testing emails but not receiving them, here are the most common causes and solutions:

### 1. **Domain Verification (Most Common Issue)**

Resend requires you to verify your sending domain before emails can be delivered.

**Steps to verify:**
1. Go to https://resend.com/domains
2. Add your domain (`gritsync.com`)
3. Add the required DNS records (SPF, DKIM, DMARC)
4. Wait for DNS propagation (can take up to 48 hours)

**Temporary Solution:**
- Use Resend's testing domain for development: `onboarding@resend.dev`
- Update your "From Email" in settings to: `onboarding@resend.dev`

### 2. **Check Your Spam/Junk Folder**

Even if the email is sent successfully, it might be filtered as spam:
- Check your spam/junk folder
- Mark the email as "Not Spam" if found
- Add `noreply@gritsync.com` to your contacts

### 3. **Verify API Key**

**Check if your API key is correct:**
1. Go to https://resend.com/api-keys
2. Copy your API key (starts with `re_`)
3. In GritSync admin settings:
   - Navigate to: Settings → Email & Notifications → Email Configuration
   - Select "Resend (Recommended)" as provider
   - Paste your API key
   - Click "Save Settings"

### 4. **Check API Key Permissions**

Make sure your API key has the "Sending Access" permission:
1. Go to https://resend.com/api-keys
2. Check your API key permissions
3. It should have "Sending Access" enabled
4. If not, create a new API key with proper permissions

### 5. **Monitor Resend Dashboard**

Check if the email actually reached Resend:
1. Go to https://resend.com/emails
2. Look for your test email in the logs
3. Check the status (delivered, bounced, failed, etc.)
4. Click on the email for more details

### 6. **Verify Email Format**

Ensure your "From Email" address is properly formatted:
- ✅ Good: `noreply@gritsync.com`
- ✅ Good: `GritSync <noreply@gritsync.com>`
- ❌ Bad: `gritsync.com`
- ❌ Bad: `@gritsync.com`

### 7. **Check Resend Account Status**

Verify your Resend account:
- Go to https://resend.com/overview
- Check if your account is active
- Verify you haven't exceeded your sending limits
- Free plan: 100 emails/day
- Check billing status if on paid plan

### 8. **Test with Different Email Address**

Try sending to a different email address:
1. Use a Gmail address if testing with Outlook
2. Use a different domain entirely
3. Some email providers have stricter spam filters

### 9. **Enhanced Logging**

I've added enhanced logging to help diagnose issues. To view logs:

**Browser Console:**
```javascript
// Open browser console (F12)
// Look for these logs when sending test email:
- "Sending email with payload:"
- "Email service response:"
- Any error messages
```

**Supabase Edge Function Logs:**
```bash
# If you have Supabase CLI installed
supabase functions logs send-email --follow
```

### 10. **Common Error Messages**

| Error | Cause | Solution |
|-------|-------|----------|
| "Invalid API key" | Wrong or expired API key | Generate new API key from Resend |
| "Domain not verified" | Domain verification pending | Verify domain or use `onboarding@resend.dev` |
| "Rate limit exceeded" | Too many emails sent | Wait or upgrade plan |
| "Invalid from address" | Wrong email format | Fix email format |
| "Recipient email invalid" | Wrong recipient format | Check recipient email |

## Quick Fix for Testing

If you need to test immediately, use Resend's test email:

1. **Update Settings:**
   - From Email: `onboarding@resend.dev`
   - From Name: `GritSync Test`
   
2. **Keep your Resend API Key**

3. **Save and test again**

This will work immediately without domain verification.

## Next Steps

1. ✅ Verify your domain (recommended for production)
2. ✅ Set up proper DNS records (SPF, DKIM, DMARC)
3. ✅ Test with multiple email providers
4. ✅ Monitor Resend dashboard for delivery status
5. ✅ Set up webhook for delivery notifications (optional)

## Need More Help?

1. **Check Resend Status:** https://resend.com/status
2. **Resend Documentation:** https://resend.com/docs
3. **Resend Support:** https://resend.com/support
4. **Check Supabase Logs:** In your Supabase project → Edge Functions → send-email → Logs

## Debugging Commands

```bash
# Redeploy the edge function
supabase functions deploy send-email

# View real-time logs
supabase functions logs send-email --follow

# Test edge function directly
curl -X POST 'https://[YOUR-PROJECT].supabase.co/functions/v1/send-email' \
  -H 'Authorization: Bearer [YOUR-ANON-KEY]' \
  -H 'Content-Type: application/json' \
  -d '{
    "to": "test@example.com",
    "subject": "Test Email",
    "html": "<p>This is a test</p>",
    "from": "onboarding@resend.dev"
  }'
```

## Production Checklist

Before going to production:

- [ ] Domain verified in Resend
- [ ] DNS records properly configured
- [ ] SPF record added
- [ ] DKIM record added  
- [ ] DMARC policy set
- [ ] Test emails delivered successfully
- [ ] Spam score checked (use mail-tester.com)
- [ ] Unsubscribe link added to transactional emails
- [ ] Privacy policy and terms linked in footer
- [ ] Bounce handling configured
- [ ] Rate limiting considered

