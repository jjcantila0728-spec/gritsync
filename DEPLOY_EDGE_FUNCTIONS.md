# 🚀 Deploy Edge Functions - Quick Guide

## ⚠️ Important: Deploy Updated Edge Functions

The following edge functions have been updated and need to be deployed:

1. **send-email** - Anti-spam headers added
2. **resend-inbox** - Delete handling improved

---

## 📋 Deployment Steps

### Option 1: Using Supabase CLI (Recommended)

```bash
# Navigate to project
cd E:\GRITSYNC

# Deploy send-email function
npx supabase functions deploy send-email --project-ref warfdcbvnapietbkpild

# Deploy resend-inbox function
npx supabase functions deploy resend-inbox --project-ref warfdcbvnapietbkpild
```

### Option 2: Using Supabase Dashboard

If CLI deployment fails:

1. **Go to Supabase Dashboard**
   - URL: https://supabase.com/dashboard/project/warfdcbvnapietbkpild

2. **Navigate to Edge Functions**
   - Left sidebar → Edge Functions

3. **Deploy send-email:**
   - Click on `send-email` function
   - Click "Deploy new version"
   - Copy contents from: `supabase/functions/send-email/index.ts`
   - Paste and deploy

4. **Deploy resend-inbox:**
   - Click on `resend-inbox` function
   - Click "Deploy new version"
   - Copy contents from: `supabase/functions/resend-inbox/index.ts`
   - Paste and deploy

---

## 🔍 Verify Deployment

After deployment, test:

### Test send-email:
```bash
# Send a test email from the app
# Check if it includes new headers
```

### Check headers in received email:
```
X-Entity-Ref-ID: gritsync-1234567890
X-Mailer: GritSync Email Service
List-Unsubscribe: <mailto:unsubscribe@gritsync.com>
Precedence: bulk
```

### Test resend-inbox:
```bash
# Try to delete an inbox email from admin/client page
# Should return success
# Check console for: "Email marked for local removal"
```

---

## 🐛 Troubleshooting

### Error: `.env` file issue
If you see: `unexpected character '»' in variable name`

**Fix:**
1. Open `.env` file
2. Remove any BOM (Byte Order Mark) characters
3. Save as UTF-8 without BOM
4. Try deployment again

**Or skip .env:**
```bash
npx supabase functions deploy send-email --project-ref warfdcbvnapietbkpild --no-verify-jwt
```

### Error: `Cannot find project ref`
**Fix:**
```bash
# Link project first
npx supabase link --project-ref warfdcbvnapietbkpild

# Then deploy
npx supabase functions deploy send-email
```

### Error: `Not authenticated`
**Fix:**
```bash
# Login to Supabase
npx supabase login

# Then try deployment again
```

---

## ✅ What Changed

### send-email function:
```typescript
// NEW: Anti-spam headers
headers: {
  'X-Entity-Ref-ID': `gritsync-${Date.now()}`,
  'X-Mailer': 'GritSync Email Service',
  'List-Unsubscribe': `<mailto:unsubscribe@gritsync.com>`,
  'Precedence': 'bulk'
}

// NEW: Email tags
tags: [
  { name: 'environment', value: 'production' },
  { name: 'source', value: 'gritsync-app' }
]
```

### resend-inbox function:
```typescript
// UPDATED: Delete action now returns success
// Allows local hiding since Resend doesn't support deleting received emails
return {
  success: true,
  message: 'Email marked for local removal',
  note: 'Email is hidden locally but still exists in Resend inbox'
}
```

---

## 📊 Expected Results

After deployment:

✅ Emails include anti-spam headers
✅ Better email deliverability
✅ Inbox delete works (local hide)
✅ No more 400 errors on delete
✅ Informative console logs

---

## 🔄 Alternative: Manual Deployment via Dashboard

If CLI doesn't work, use the dashboard method:

1. **Copy file contents:**
   - `supabase/functions/send-email/index.ts`
   - `supabase/functions/resend-inbox/index.ts`

2. **Paste in Supabase Dashboard:**
   - Functions → send-email → Deploy
   - Functions → resend-inbox → Deploy

3. **Click Deploy**

4. **Verify:**
   - Check function logs
   - Test email sending
   - Test inbox delete

---

## 🎯 Priority

**HIGH PRIORITY:** Deploy these functions ASAP
- send-email: For spam prevention
- resend-inbox: For delete functionality

**After deployment:**
- Test email sending
- Verify headers in received emails
- Test delete functionality
- Check console logs

---

## 📞 Need Help?

If deployment fails:
1. Check error message
2. Try dashboard deployment
3. Verify environment variables in Supabase dashboard
4. Check function logs for errors

---

**Status:** ✅ Code ready for deployment
**Action:** Deploy via CLI or Dashboard
**Priority:** High (for spam prevention)

