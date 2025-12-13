# Fix: Storage Access Error

## ✅ Fixed the Issue

I've updated the edge function to properly access your Supabase Storage.

## 🔧 What Was Fixed

**Problem**: The function was using the wrong storage API endpoint format.

**Solution**: Updated to try both public and authenticated storage access methods.

---

## 🚀 Deploy the Fix

### Method 1: Using PowerShell Script (Easiest)

```powershell
.\deploy-fix.ps1
```

### Method 2: Manual Deployment

```powershell
supabase functions deploy fill-pdf-form-ai
```

### Method 3: Via Supabase Dashboard

1. Go to: https://supabase.com/dashboard/project/warfdcbvnapietbkpild/functions
2. Find `fill-pdf-form-ai` or click "New function"
3. Upload the function code from: `supabase/functions/fill-pdf-form-ai/`
4. Click "Deploy"

---

## 🔍 What Changed in the Code

The function now:
1. ✅ Properly encodes the bucket name (`USCIS Forms` → `USCIS%20Forms`)
2. ✅ Tries public access first (faster if bucket is public)
3. ✅ Falls back to authenticated access (if bucket is private)
4. ✅ Uses correct storage API endpoints
5. ✅ Better error messages for debugging

---

## ⚙️ Alternative: Make Storage Bucket Public (Optional)

If you want faster access, you can make the USCIS Forms bucket public:

### Via Supabase Dashboard:

1. Go to: https://supabase.com/dashboard/project/warfdcbvnapietbkpild/storage/buckets
2. Find `USCIS Forms` bucket
3. Click the "•••" menu → "Edit bucket"
4. Check ✅ **"Public bucket"**
5. Click "Save"

**Benefits**:
- Slightly faster (no authentication needed)
- Forms are official USCIS documents anyway (public)

**Note**: This is optional - the function works either way!

---

## 🧪 Test After Deployment

1. Go to: http://localhost:5000/applications/AP9B83G6Y8HQNH/timeline
2. Click **"Generate G-1145"** button
3. Wait 3-8 seconds
4. PDF should download! ✅

---

## 📊 Expected Logs

After deploying, check function logs:

```powershell
supabase functions logs fill-pdf-form-ai --tail
```

**Successful log output should show**:
```
Fetching template from Supabase Storage: https://...
Template fetched from Supabase Storage, size: XXXXX bytes
Calling OpenAI API for intelligent field mapping...
AI Response: {...}
Successfully filled N out of M mapped fields
Saved AI-filled PDF, size: XXXXX bytes
```

---

## ⚠️ If Still Having Issues

### Check Storage Bucket Exists

1. Go to: https://supabase.com/dashboard/project/warfdcbvnapietbkpild/storage/buckets
2. Verify `USCIS Forms` bucket exists
3. Check files exist: `g-1145.pdf` and `i-765.pdf`

### Check File Paths

Files should be at:
- `USCIS Forms/g-1145.pdf`
- `USCIS Forms/i-765.pdf`

(Not in subdirectories)

### Check Bucket Permissions

If bucket is private, ensure:
- Service role has access
- RLS policies allow service role to read

---

## 🎯 Quick Status Check

Run these commands to verify everything:

```powershell
# 1. Check if function is deployed
supabase functions list

# 2. Check if secret is set
supabase secrets list

# 3. Check function logs
supabase functions logs fill-pdf-form-ai --limit 50
```

Expected output:
- ✅ `fill-pdf-form-ai` in functions list
- ✅ `OPENAI_API_KEY` in secrets list
- ✅ No error messages in logs

---

**Next Step**: Deploy the fix and test! 🚀

