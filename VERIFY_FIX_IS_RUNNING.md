# Verify the Fix is Running

## 🔍 How to Check if New Code is Active

The file is still showing `application/json` which means either:
1. ❌ Dev server wasn't restarted
2. ❌ Browser cache is using old code
3. ❌ Build didn't update
4. ⚠️ Supabase Storage API is overriding the contentType

## ✅ Step-by-Step Verification

### Step 1: Restart Dev Server

**Stop and restart completely:**
```bash
# In your terminal, press Ctrl+C to stop
# Then restart:
npm run dev
```

**OR rebuild:**
```bash
npm run build
npm run dev
```

### Step 2: Clear Browser Cache

**Option A: Hard Refresh**
- Windows/Linux: `Ctrl + Shift + R`
- Mac: `Cmd + Shift + R`

**Option B: Clear Cache**
1. Open DevTools (F12)
2. Right-click the refresh button
3. Click "Empty Cache and Hard Reload"

### Step 3: Check Console Logs

When you upload a file, you should see in browser console:

```javascript
🔧 PROOF OF PAYMENT UPLOAD v2.0 (BLOB METHOD) 🔧  // ← THIS CONFIRMS NEW CODE IS RUNNING
Uploading proof of payment: {
  fileName: "proof_of_payment_...jpg",
  fileSize: 189530,
  originalType: "",
  detectedType: "image/jpeg",  // ✅ Should be image/jpeg, NOT application/json
  fileExtension: "jpg",
  filePath: "..."
}
Created Blob: {
  blobSize: 189530,
  blobType: "image/jpeg"  // ✅ Should match detectedType
}
Proof of payment uploaded successfully: ... with contentType: image/jpeg
```

**If you DON'T see** `🔧 PROOF OF PAYMENT UPLOAD v2.0 (BLOB METHOD) 🔧`:
- ❌ Old code is still running
- ❌ Need to restart server and clear cache

**If you DO see the v2.0 message:**
- ✅ New code is running
- If still showing `application/json` in Supabase → Storage API issue

### Step 4: Test Upload

1. Go to checkout:
   ```
   http://localhost:5000/applications/AP9B83G6Y8HQNH/checkout?payment_id=43bd18da-0356-462d-9f1d-c40207eb3f76
   ```

2. Upload proof of payment

3. Watch console for the `v2.0 (BLOB METHOD)` message

4. Check Supabase Storage for contentType

### Step 5: Check Supabase Storage

In Supabase Dashboard:
1. Go to Storage → documents
2. Find the uploaded file
3. Check metadata

**Expected:**
```
Content-Type: image/jpeg ✅
```

**If still wrong:**
```
Content-Type: application/json ❌
```

## 🐛 If Still application/json After v2.0 Runs

If the console shows `v2.0 (BLOB METHOD)` and `blobType: "image/jpeg"` but Supabase still stores as `application/json`, then Supabase Storage API might be:

1. **Ignoring the contentType parameter**
2. **Overriding with default type**
3. **RLS policy issue**
4. **Bucket configuration issue**

### Solution: Check Supabase Storage Bucket Settings

1. Go to Supabase Dashboard
2. Storage → documents bucket
3. Check settings:
   - ✅ Public bucket: NO
   - ✅ File size limit: 10MB+
   - ✅ Allowed MIME types: image/*, application/pdf (or leave empty)

### Solution: Check RLS Policies

Run this in Supabase SQL Editor:

```sql
-- Check if there are any RLS policies affecting uploads
SELECT * FROM storage.policies 
WHERE bucket_id = 'documents';
```

Make sure there's a policy allowing uploads with custom contentType.

### Solution: Try Direct Supabase Upload Test

Test if Supabase Storage is accepting contentType:

```javascript
// Run this in browser console on your site
const supabase = // your supabase client
const testBlob = new Blob(['test'], { type: 'image/jpeg' })
const { data, error } = await supabase.storage
  .from('documents')
  .upload('test-uploads/test.jpg', testBlob, {
    contentType: 'image/jpeg'
  })

console.log('Upload result:', { data, error })

// Then check the file's contentType in Supabase Dashboard
```

## 🔧 Alternative Fix: Use ArrayBuffer

If Blob doesn't work, try ArrayBuffer:

```typescript
// In supabase-api.ts, replace Blob creation with:
const arrayBuffer = await proofOfPaymentFile.arrayBuffer()

await supabase.storage
  .from('documents')
  .upload(filePath, arrayBuffer, {
    cacheControl: '3600',
    upsert: false,
    contentType: contentType,
  })
```

## 📊 Diagnostic Checklist

Run through this checklist:

- [ ] Dev server restarted
- [ ] Browser cache cleared
- [ ] Console shows `v2.0 (BLOB METHOD)` message
- [ ] Console shows `detectedType: "image/jpeg"`
- [ ] Console shows `blobType: "image/jpeg"`
- [ ] Console shows `uploaded successfully with contentType: image/jpeg`
- [ ] No upload errors in console
- [ ] File appears in Supabase Storage
- [ ] File contentType in Supabase is `image/jpeg` (NOT `application/json`)
- [ ] File can be downloaded and opened

## 🎯 What to Report Back

Please check your browser console and tell me:

1. **Do you see this message?**
   ```
   🔧 PROOF OF PAYMENT UPLOAD v2.0 (BLOB METHOD) 🔧
   ```
   - YES → New code is running ✅
   - NO → Old code still active ❌

2. **What does the console log show for:**
   - `originalType`: ?
   - `detectedType`: ?
   - `blobType`: ?

3. **In Supabase Storage, what's the Content-Type?**
   - Expected: `image/jpeg`
   - Current: ?

4. **Any errors in console?**

This will help us determine if it's a:
- Code update issue (old code running)
- Supabase Storage API issue (ignoring contentType)
- Configuration issue (bucket/RLS policies)

## 🚀 Quick Test Commands

```bash
# Full rebuild
npm run build
npm run dev

# Or just restart
# Ctrl+C
npm run dev

# Check if build is fresh
ls -la dist/  # Should have recent timestamps
```

Then hard refresh browser (Ctrl+Shift+R) and try upload again!

