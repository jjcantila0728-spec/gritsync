# Next Steps: Testing and Deployment Plan

## 🎯 Current Status

✅ **Completed:**
- Fixed admin compose buttons (all clickable)
- Implemented attachment sending support
- Added attachment receiving/download functionality
- Fixed React hooks error in ComposeEmailModal
- Updated edge function to handle attachments
- Added attachment UI in both admin and client compose

## 📋 Testing Checklist

### Phase 1: Local Development Testing

#### 1.1 Test Attachment Sending (Admin)
- [ ] Navigate to `http://localhost:5000/admin/emails`
- [ ] Click "Compose" button
- [ ] Verify compose modal opens
- [ ] Fill in recipient email
- [ ] Fill in subject
- [ ] Fill in body
- [ ] Click paperclip icon to attach file
- [ ] Select a small file (< 1MB)
- [ ] Verify attachment appears in attachment list
- [ ] Click remove button on attachment (verify it removes)
- [ ] Attach file again
- [ ] Click "Send" button
- [ ] Verify success toast appears
- [ ] Check recipient's inbox to verify email received with attachment
- [ ] Verify attachment can be downloaded from received email

#### 1.2 Test Attachment Sending (Client)
- [ ] Navigate to `http://localhost:5000/client/emails`
- [ ] Click "Compose" button
- [ ] Repeat steps from 1.1
- [ ] Verify attachments are sent correctly

#### 1.3 Test Multiple Attachments
- [ ] Compose new email
- [ ] Attach multiple files (2-3 files)
- [ ] Verify all attachments appear in list
- [ ] Send email
- [ ] Verify all attachments are received

#### 1.4 Test Large Files
- [ ] Try attaching a file > 10MB
- [ ] Verify appropriate error/warning (Resend limit is 25MB)
- [ ] Test with file near limit (20-24MB)

#### 1.5 Test Different File Types
- [ ] Test PDF attachment
- [ ] Test image attachment (JPG, PNG)
- [ ] Test document attachment (DOC, DOCX)
- [ ] Test spreadsheet (XLS, XLSX)
- [ ] Verify all file types display correctly

#### 1.6 Test Attachment Receiving (From Gmail)
- [ ] Send email with attachment from Gmail to admin email
- [ ] Navigate to `http://localhost:5000/admin/emails/inbox`
- [ ] Open received email
- [ ] Verify attachments section appears
- [ ] Verify attachment filename displays correctly
- [ ] Click download button
- [ ] Verify attachment downloads
- [ ] Repeat for client inbox

#### 1.7 Test Edge Cases
- [ ] Try composing email without recipient (should show error)
- [ ] Try sending with very large attachment (should handle gracefully)
- [ ] Try sending with many attachments (5+ files)
- [ ] Test drag-and-drop file attachment
- [ ] Test paste image attachment (if implemented)

### Phase 2: Edge Function Deployment

#### 2.1 Verify Edge Function Code
- [ ] Review `supabase/functions/send-email/index.ts`
- [ ] Verify attachment handling code is correct
- [ ] Verify base64 encoding logic
- [ ] Check error handling for attachments

#### 2.2 Deploy Edge Function
```bash
# Navigate to project root
cd E:\GRITSYNC

# Deploy send-email function
supabase functions deploy send-email

# Verify deployment success
supabase functions list
```

- [ ] Verify deployment succeeds
- [ ] Check for any deployment errors
- [ ] Verify function is listed in Supabase dashboard

#### 2.3 Test Deployed Function
- [ ] Send test email with attachment via UI
- [ ] Check Supabase function logs for errors
- [ ] Verify attachment is included in API call
- [ ] Verify Resend API receives attachment correctly

### Phase 3: Integration Testing

#### 3.1 End-to-End Testing
- [ ] Admin sends email with attachment to external email (Gmail)
- [ ] Verify email arrives with attachment
- [ ] Download attachment from Gmail
- [ ] Verify file is intact and correct
- [ ] Repeat with client email

#### 3.2 Cross-Browser Testing
- [ ] Test in Chrome
- [ ] Test in Firefox
- [ ] Test in Safari (if available)
- [ ] Test in Edge
- [ ] Verify attachment UI works in all browsers

#### 3.3 Mobile Responsiveness
- [ ] Test compose modal on mobile device
- [ ] Verify attachment button is accessible
- [ ] Test file selection on mobile
- [ ] Verify attachment list displays correctly

### Phase 4: Resend Configuration Verification

#### 4.1 Check Resend Dashboard
- [ ] Go to https://resend.com/dashboard
- [ ] Verify domain is configured
- [ ] Check receiving settings
- [ ] Verify attachments are enabled

#### 4.2 Check Resend Logs
- [ ] Go to https://resend.com/emails
- [ ] Find test emails sent with attachments
- [ ] Verify attachment count is correct
- [ ] Check delivery status

#### 4.3 Verify Received Email Handling
- [ ] Check Resend receiving dashboard
- [ ] Verify domain is set up for receiving
- [ ] Check if attachments are being received
- [ ] Verify download URLs are available

## 🐛 Troubleshooting Guide

### Issue: Attachments Not Sending

**Check:**
1. Browser console for errors
2. Network tab for API calls
3. Edge function logs in Supabase
4. Resend API response

**Common Causes:**
- File size exceeds limit
- Edge function not deployed
- Base64 encoding error
- API key issues

### Issue: Attachments Not Receiving

**Check:**
1. Resend receiving configuration
2. Domain DNS settings
3. Resend dashboard for received emails
4. Browser console for attachment data

**Common Causes:**
- Resend receiving not configured
- Domain not verified
- Download URL not available
- API response missing attachments

### Issue: Download Not Working

**Check:**
1. Attachment download_url exists
2. URL is accessible
3. CORS settings
4. Browser console for errors

**Common Causes:**
- Download URL expired
- CORS blocking
- Authentication required
- Invalid URL

## 📊 Success Criteria

### Must Have:
- ✅ Attachments can be attached in compose modal
- ✅ Attachments are sent with emails
- ✅ Attachments are received correctly
- ✅ Attachments can be downloaded
- ✅ Multiple attachments work
- ✅ Different file types work

### Nice to Have:
- ⚠️ Large file handling (>10MB)
- ⚠️ Progress indicator for large uploads
- ⚠️ Image preview in compose
- ⚠️ Drag-and-drop support

## 🚀 Deployment Steps

### 1. Pre-Deployment
- [ ] All tests pass locally
- [ ] Edge function tested
- [ ] Code reviewed
- [ ] No console errors

### 2. Deploy Edge Function
```bash
supabase functions deploy send-email
```

### 3. Post-Deployment
- [ ] Verify function is live
- [ ] Test with production API key
- [ ] Monitor function logs
- [ ] Test end-to-end flow

## 📝 Notes

- Resend API attachment limit: 25MB per file
- Base64 encoding increases file size by ~33%
- Multiple attachments are supported
- All common file types should work

## 🔄 Next Actions

1. **Immediate:** Test attachment sending locally
2. **Short-term:** Deploy edge function and verify
3. **Medium-term:** Test receiving attachments from external sources
4. **Long-term:** Add optimizations (progress indicators, previews, etc.)

