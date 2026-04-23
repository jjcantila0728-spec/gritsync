# Proof of Payment Upload - Comprehensive Test Guide

## Test Page Created

A comprehensive test page has been created to diagnose and fix the file corruption issue.

**Access the test page at:** `http://localhost:5000/test-upload`

## What the Test Page Does

The test page performs **10 comprehensive tests** on file uploads:

### 1. File Selection Tests
- ✅ Validates file selection
- ✅ Checks file size
- ✅ Verifies MIME type

### 2. File Readability Test
- ✅ Reads file as ArrayBuffer
- ✅ Verifies file is not corrupted in browser
- ✅ Reports exact byte count

### 3. Magic Number Check
- ✅ Reads first 4 bytes of file
- ✅ Identifies actual file format (JPEG, PNG, PDF, WEBP)
- ✅ Compares with declared MIME type

### 4. Data URL Test
- ✅ Converts file to Data URL
- ✅ Verifies browser can process the file

### 5. Upload Method 1: Direct Upload
- ✅ Uploads file directly with contentType
- ✅ Logs any upload errors
- ✅ Falls back to Method 2 if failed

### 6. Upload Method 2: Blob Upload
- ✅ Converts file to Blob
- ✅ Uploads Blob with explicit type
- ✅ Provides alternative upload method

### 7. File Verification
- ✅ Lists files in storage
- ✅ Confirms file exists
- ✅ Reports file metadata

### 8. URL Generation Tests
- ✅ Creates public URL
- ✅ Creates signed URL
- ✅ Verifies URLs are accessible

### 9. Download and Comparison
- ✅ Downloads uploaded file
- ✅ Compares size with original
- ✅ Compares MIME type with original
- ✅ Reports any discrepancies

### 10. Magic Number Verification
- ✅ Checks magic numbers of downloaded file
- ✅ Verifies file format is preserved
- ✅ **Detects corruption** if magic numbers don't match

## How to Use the Test Page

### Step 1: Access the Test Page
```
http://localhost:5000/test-upload
```

### Step 2: Select a File
1. Click "Choose File" button
2. Select a proof of payment file (JPG, PNG, WebP, or PDF)
3. Watch the automatic validation results appear

### Step 3: Run Upload Test
1. Click "Run Upload Test" button
2. Watch the test progress through all 10 steps
3. Each step will show:
   - ✅ Green = Success
   - ❌ Red = Error (indicates where corruption happens)
   - ⚠️ Yellow = Warning

### Step 4: Analyze Results
Look for these key indicators:

**✅ GOOD SIGNS:**
- "File is readable: XXX bytes" ✅
- "Detected: JPEG (ffd8ff...)" ✅
- "Upload successful" ✅
- "Downloaded file size matches original" ✅
- "Downloaded file format: JPEG" ✅

**❌ BAD SIGNS (Corruption):**
- "Size mismatch! Original: XXX, Downloaded: YYY" ❌
- "Type mismatch! Original: image/jpeg, Downloaded: application/octet-stream" ❌
- "Downloaded file format: Unknown" ❌
- Different magic numbers between original and downloaded ❌

### Step 5: Download Test File
1. Click "Download Test File" button
2. Try to open the downloaded file
3. If file doesn't open = **CORRUPTION CONFIRMED**

### Step 6: Cleanup
Click "Clean Up Test Files" to remove test uploads from storage

## Expected Results

### If Upload is Working Correctly:
```
✅ File Selection: Selected: image.jpg
✅ File Size: Size: 123.45 KB
✅ File Type: Type: image/jpeg
✅ File Readability: File is readable: 126412 bytes
✅ Magic Number Check: Detected: JPEG (ffd8ffe0)
✅ Data URL Creation: File can be converted to Data URL
✅ Upload Method 1: Upload successful: test-uploads/test_proof_1234567890.jpg
✅ File Verification: File exists in storage
✅ Public URL: URL: https://...
✅ Signed URL: URL created
✅ Download Test: Downloaded: 126412 bytes, Type: image/jpeg
✅ Size Comparison: Downloaded file size matches original
✅ Type Comparison: Downloaded file type matches original
✅ Magic Number Verification: Downloaded file format: JPEG (ffd8ffe0)
✅ Test Complete: All tests completed
```

### If Upload is Corrupted:
```
✅ File Selection: Selected: image.jpg
✅ File Readability: File is readable: 126412 bytes
✅ Magic Number Check: Detected: JPEG (ffd8ffe0)
✅ Upload Method 1: Upload successful
✅ Download Test: Downloaded: 89234 bytes, Type: application/octet-stream
❌ Size Comparison: Size mismatch! Original: 126412, Downloaded: 89234
❌ Type Comparison: Type mismatch! Original: image/jpeg, Downloaded: application/octet-stream
❌ Magic Number Verification: Downloaded file format: Unknown (3c21444f)
```

## Common Corruption Patterns

### Pattern 1: MIME Type Lost
**Symptoms:**
- Original: `image/jpeg`
- Downloaded: `application/octet-stream`

**Cause:** contentType not set in upload
**Fix:** ✅ Already applied in code

### Pattern 2: Size Mismatch
**Symptoms:**
- Original size ≠ Downloaded size
- Magic numbers corrupted

**Possible Causes:**
- File encoding issue
- Middleware processing file
- Base64 encoding applied
- CORS issue modifying file
- Proxy/CDN compressing file

### Pattern 3: Wrong Magic Numbers
**Symptoms:**
- Original: `ffd8ffe0` (JPEG)
- Downloaded: `3c21444f` (HTML/XML)

**Cause:** Server returning HTML error page instead of file

### Pattern 4: Empty File
**Symptoms:**
- Downloaded size: 0 bytes

**Cause:** File not actually uploaded or storage error

## Magic Number Reference

Use this to identify file types:

| Format | Magic Number (Hex) | First Bytes |
|--------|-------------------|-------------|
| JPEG   | `FF D8 FF`        | ffd8ff...   |
| PNG    | `89 50 4E 47`     | 89504e47... |
| PDF    | `25 50 44 46`     | 25504446... |
| WEBP   | `52 49 46 46`     | 52494646... |

If downloaded magic numbers don't match, **file is corrupted**.

## Next Steps Based on Results

### If All Tests Pass ✅
1. Issue is not with Supabase upload
2. Check storage bucket configuration
3. Check RLS policies
4. Check CORS settings

### If Upload Fails ❌
1. Check Supabase connection
2. Check storage bucket exists
3. Check permissions
4. Check network/firewall

### If Download Shows Corruption ❌
1. Note the exact error message
2. Compare magic numbers
3. Check if contentType is being preserved
4. Check if middleware is processing files
5. Check browser network tab for actual response

## Manual Verification in Supabase

After running the test:

1. Go to Supabase Dashboard
2. Navigate to Storage → documents
3. Open `test-uploads` folder
4. Find your test file
5. Click to download
6. Try to open the file
7. If it doesn't open, file is corrupted in storage

## Browser Console Logs

The test page logs extensively to console. Open browser DevTools (F12) and check Console for:

```javascript
[TEST] File Selection: success - Selected: image.jpg
[TEST] File Size: success - Size: 123.45 KB
[TEST] File Type: success - Type: image/jpeg
...
[TEST] Magic Number Verification: success - Downloaded file format: JPEG (ffd8ffe0)
```

## API Logs

The actual upload function (`supabase-api.ts`) also logs:

```javascript
Uploading proof of payment: {
  fileName: "proof_of_payment_123_1234567890.jpg",
  fileSize: 126412,
  fileType: "image/jpeg",
  filePath: "user_id/payments/proof_of_payment_123_1234567890.jpg"
}

Proof of payment uploaded successfully: user_id/payments/proof_of_payment_123_1234567890.jpg
```

## Troubleshooting Steps

### Step 1: Run Basic Test
1. Go to test page
2. Upload a small JPEG (< 1MB)
3. Check if all tests pass

### Step 2: Test Different File Types
1. Test JPG
2. Test PNG
3. Test PDF
4. See if specific type has issues

### Step 3: Test File Sizes
1. Test small file (< 100KB)
2. Test medium file (1-5MB)
3. Test large file (8-10MB)
4. See if size affects corruption

### Step 4: Check Network
1. Open DevTools → Network tab
2. Run upload test
3. Find the upload request
4. Check:
   - Request headers
   - Request payload (file should be binary)
   - Response status
   - Response headers

### Step 5: Check Storage
1. Supabase Dashboard → Storage
2. Check `documents` bucket settings
3. Check file size limits
4. Check allowed MIME types
5. Check RLS policies

## Report Format

After running tests, report back with:

```
Test Results:
- File Type Tested: [JPEG/PNG/PDF]
- File Size: [XXX KB]
- Upload Status: [SUCCESS/FAILED]
- Download Status: [SUCCESS/FAILED]
- Size Match: [YES/NO]
- Type Match: [YES/NO]
- Magic Numbers: Original [xxx] vs Downloaded [yyy]
- Can Open Downloaded File: [YES/NO]

Error Messages (if any):
[Copy exact error messages here]

Console Logs:
[Copy relevant console logs]
```

## Quick Fixes to Try

If corruption is detected:

### Fix 1: Use Blob Method
In `supabase-api.ts`, replace direct upload with:
```typescript
const blob = new Blob([await proofOfPaymentFile.arrayBuffer()], { 
  type: proofOfPaymentFile.type 
})
await supabase.storage.from('documents').upload(filePath, blob, {...})
```

### Fix 2: Force Binary Mode
```typescript
const arrayBuffer = await proofOfPaymentFile.arrayBuffer()
await supabase.storage.from('documents').upload(filePath, arrayBuffer, {
  contentType: proofOfPaymentFile.type
})
```

### Fix 3: Check Storage Settings
Ensure in Supabase Dashboard → Storage → documents:
- Public bucket: NO
- File size limit: 10MB or higher
- Allowed MIME types: image/*, application/pdf
- CORS: Properly configured

## Success Criteria

Upload is working correctly when:
- ✅ All 10 tests pass
- ✅ Downloaded file size matches original
- ✅ Downloaded file type matches original
- ✅ Magic numbers are identical
- ✅ Downloaded file opens correctly
- ✅ No corruption at any step

## Contact Points

When reporting results, include:
1. Test page screenshot
2. Console logs
3. Network tab screenshot
4. Downloaded file (if possible)
5. Original file for comparison

