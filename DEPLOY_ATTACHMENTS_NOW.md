# Deploy Email Attachments Feature - Execution Plan

## 🎯 Goal
Deploy the email attachment feature to make it available for use.

## ✅ Pre-Deployment Checklist

### Code Status
- ✅ All code changes complete
- ✅ No linter errors
- ✅ React hooks error fixed
- ✅ Attachment sending implemented
- ✅ Attachment receiving implemented

### Files Modified
- `src/components/email/ComposeEmailModal.tsx` - Attachment UI and handling
- `src/pages/AdminEmails.tsx` - Admin compose attachment support
- `src/pages/ClientEmails.tsx` - Client compose attachment support
- `src/lib/email-service.ts` - Base64 encoding for attachments
- `src/lib/email-api.ts` - Attachment support in email API
- `supabase/functions/send-email/index.ts` - Edge function attachment handling

## 🚀 Deployment Steps

### Step 1: Deploy Edge Function (Required)

The `send-email` edge function must be deployed to handle attachments.

**Option A: Using PowerShell Script (Recommended)**
```powershell
cd E:\GRITSYNC
.\scripts\deploy-serverless.ps1
```

**Option B: Manual Deployment**
```powershell
# Navigate to project
cd E:\GRITSYNC

# Deploy send-email function
supabase functions deploy send-email

# Verify deployment
supabase functions list
```

**Option C: Using npx (No CLI installation needed)**
```powershell
cd E:\GRITSYNC
npx supabase functions deploy send-email --project-ref warfdcbvnapietbkpild
```

### Step 2: Verify Deployment

Check that the function deployed successfully:
```powershell
supabase functions list
```

You should see `send-email` in the list with a recent deployment timestamp.

### Step 3: Test Locally (Before Full Testing)

1. **Start Dev Server** (if not running):
   ```powershell
   npm run dev
   ```

2. **Test Admin Compose:**
   - Navigate to `http://localhost:5000/admin/emails`
   - Click "Compose"
   - Try attaching a small file (< 1MB)
   - Verify attachment appears in list
   - Don't send yet (wait for edge function deployment)

3. **Test Client Compose:**
   - Navigate to `http://localhost:5000/client/emails`
   - Repeat same steps as admin

### Step 4: Test With Deployed Function

After deploying the edge function:

1. **Send Test Email with Attachment:**
   - Compose email with attachment
   - Send to your own email address
   - Check recipient inbox
   - Verify attachment is received
   - Download and verify file integrity

2. **Check Logs:**
   ```powershell
   supabase functions logs send-email --follow
   ```
   Look for:
   - "Adding attachments: X" log message
   - No errors in the logs
   - Successful API response

### Step 5: Verify Resend Configuration

1. **Check Resend Dashboard:**
   - Go to https://resend.com/dashboard
   - Check email logs for sent emails
   - Verify attachments are included

2. **Test Receiving:**
   - Send email with attachment from Gmail
   - Check admin/client inbox
   - Verify attachment appears
   - Test download functionality

## 🐛 Troubleshooting

### Edge Function Deployment Issues

**Error: "Not logged in"**
```powershell
supabase login
```

**Error: "Project not linked"**
```powershell
supabase link --project-ref warfdcbvnapietbkpild
```

**Error: "Function not found"**
- Verify you're in the project root directory
- Check that `supabase/functions/send-email/index.ts` exists

### Attachment Not Sending

1. Check browser console for errors
2. Check network tab for API calls
3. Verify edge function logs:
   ```powershell
   supabase functions logs send-email
   ```
4. Check Resend API response in logs

### Attachment Not Receiving

1. Verify Resend receiving is configured
2. Check Resend dashboard for received emails
3. Verify download URLs are available in attachment data
4. Check browser console for attachment data

## 📊 Success Criteria

- ✅ Edge function deployed successfully
- ✅ Attachments can be attached in compose modal
- ✅ Attachments are sent with emails
- ✅ Attachments are received correctly
- ✅ Attachments can be downloaded
- ✅ Multiple attachments work
- ✅ Different file types work

## 🔄 Next Actions

1. **Deploy edge function** (Step 1)
2. **Test locally** (Step 3)
3. **Test with deployed function** (Step 4)
4. **Verify receiving** (Step 5)

## 📝 Notes

- Resend API limit: 25MB per file
- Base64 encoding increases size by ~33%
- Multiple attachments are supported
- All common file types should work

