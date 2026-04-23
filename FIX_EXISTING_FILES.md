# Fix Existing Corrupted Files in Supabase Storage

## The Problem

Files uploaded before the fix have **incorrect content-type** in Supabase Storage:
- Stored as: `application/json` ❌
- Should be: `image/jpeg`, `image/png`, `image/webp`, or `application/pdf` ✅

## The Solution Applied

The code now:
1. ✅ Detects MIME type from file extension as fallback
2. ✅ Never uses `application/json` for image files
3. ✅ Validates content type before upload
4. ✅ Logs both original and detected types for debugging

## Fix for Existing Files

Unfortunately, Supabase Storage does **not allow updating metadata** (content-type) of existing files.

### Option 1: Re-upload Files (Recommended)

Users need to re-upload their proof of payment files:

1. Delete the corrupted file from storage
2. Upload again (will now use correct content-type)
3. New uploads will work correctly

### Option 2: Manual Fix via Supabase CLI

For each corrupted file:

```bash
# Download the file
supabase storage download documents/path/to/file.jpg > temp.jpg

# Re-upload with correct content-type
supabase storage upload documents/path/to/file.jpg temp.jpg \
  --content-type image/jpeg

# Clean up
rm temp.jpg
```

### Option 3: Script to Re-upload All Corrupted Files

Create a script to fix all files:

```typescript
// fix-corrupted-files.ts
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! // Need service role key
)

async function fixCorruptedFiles() {
  // List all files in payment folders
  const { data: files } = await supabase.storage
    .from('documents')
    .list('', { 
      recursive: true,
      search: 'proof_of_payment'
    })

  if (!files) return

  for (const file of files) {
    // Check if it's a proof of payment file
    if (!file.name.startsWith('proof_of_payment')) continue

    // Detect correct content type from extension
    const ext = file.name.split('.').pop()?.toLowerCase()
    const mimeTypes: { [key: string]: string } = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'webp': 'image/webp',
      'pdf': 'application/pdf',
    }
    const correctType = mimeTypes[ext || '']

    if (!correctType) continue

    // Check current metadata
    const filePath = `${file.bucket_id}/${file.name}`
    
    // Download file
    const { data: downloadData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(filePath)

    if (downloadError || !downloadData) {
      console.error(`Failed to download ${file.name}:`, downloadError)
      continue
    }

    // Re-upload with correct content type
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, downloadData, {
        contentType: correctType,
        upsert: true, // Overwrite existing
      })

    if (uploadError) {
      console.error(`Failed to fix ${file.name}:`, uploadError)
    } else {
      console.log(`✅ Fixed ${file.name} - Set content-type to ${correctType}`)
    }
  }
}

fixCorruptedFiles()
  .then(() => console.log('Done!'))
  .catch(console.error)
```

### Option 4: Admin UI to Re-upload

Add an admin feature to:
1. List all proof of payment files
2. Show which have incorrect content-type
3. Button to "Fix" each file (re-upload with correct type)

## How to Identify Corrupted Files

In Supabase Dashboard → Storage → documents:

**Corrupted files show:**
- Content-Type: `application/json` ❌
- Preview fails with "don't support this format"

**Fixed files show:**
- Content-Type: `image/jpeg` (or png/webp/pdf) ✅
- Preview works correctly

## Prevention (Already Applied)

The code fix ensures:
```typescript
// Fallback: detect MIME type from file extension
const mimeTypes: { [key: string]: string } = {
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'png': 'image/png',
  'webp': 'image/webp',
  'pdf': 'application/pdf',
}
contentType = mimeTypes[fileExt] || 'application/octet-stream'
```

This means:
- ✅ Even if `File.type` is empty, we detect from extension
- ✅ Even if `File.type` is wrong (`application/json`), we override it
- ✅ Logs both original and detected type for verification

## Test the Fix

1. Go to checkout page
2. Upload a new proof of payment
3. Check Supabase Storage
4. Verify content-type is now correct (e.g., `image/jpeg`)
5. Download the file - it should open correctly

## For the Current Corrupted File

File: `proof_of_payment_b98b884a-954c-4209-b3c2-5c18bb50bd04_1765978260446.jpg`

**Quick Fix:**
1. Go to Supabase Dashboard → Storage → documents
2. Find the file
3. Delete it
4. Ask user to re-upload
5. New upload will have correct content-type

**Or use Supabase CLI:**
```bash
# Download
supabase storage download documents/proof_of_payment_b98b884a-954c-4209-b3c2-5c18bb50bd04_1765978260446.jpg > temp.jpg

# Re-upload with correct type
supabase storage upload documents/proof_of_payment_b98b884a-954c-4209-b3c2-5c18bb50bd04_1765978260446.jpg temp.jpg \
  --content-type image/jpeg \
  --upsert

# Verify
supabase storage list documents/
```

## Why This Happened

The `File.type` property in JavaScript can be:
- Empty string when browser can't detect type
- Wrong value due to file system metadata
- `application/octet-stream` for unknown types

**Our old code:**
```typescript
contentType: proofOfPaymentFile.type || 'application/octet-stream'
```

If `File.type` was empty and defaulted to `application/octet-stream`, some middleware might have changed it to `application/json`.

**New code:**
```typescript
// Always detect from extension as fallback
const mimeTypes = { 'jpg': 'image/jpeg', ... }
contentType = mimeTypes[fileExt] || 'application/octet-stream'
```

Now it's **impossible** for image files to get `application/json` as content-type.

## Verification

After the fix, check console logs:
```javascript
Uploading proof of payment: {
  fileName: "proof_of_payment_123_1234567890.jpg",
  fileSize: 189530,
  originalType: "",  // Empty or wrong
  detectedType: "image/jpeg",  // Correctly detected
  fileExtension: "jpg",
  filePath: "user_id/payments/proof_of_payment_123_1234567890.jpg"
}

Proof of payment uploaded successfully: ... with contentType: image/jpeg
```

## Summary

**The Fix:**
- ✅ Detects MIME type from file extension
- ✅ Overrides incorrect File.type values
- ✅ Never uses application/json for images
- ✅ Logs all type detection for debugging

**For Existing Files:**
- ⚠️ Need to be re-uploaded or manually fixed
- ⚠️ Supabase doesn't allow metadata updates
- ✅ New uploads will work correctly

**Test Now:**
Upload a new file and verify it has correct content-type in Supabase Storage! 🚀

