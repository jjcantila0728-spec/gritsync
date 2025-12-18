# File Corruption Fix - Proof of Payment Upload

## Problem
When users uploaded proof of payment files during checkout, the files were being corrupted in Supabase Storage. When downloaded, the files showed error: **"don't support this format"**.

### Root Cause
The file upload to Supabase Storage was missing the `contentType` parameter. Without explicitly setting the content type:
- Files were stored with a generic/incorrect MIME type
- When downloaded, the browser/OS couldn't recognize the file format
- Users received "unsupported format" errors

## Solution Applied

### 1. **Added Explicit Content Type** ✅
Set the `contentType` in Supabase upload options to preserve the original file format:

```typescript
const { error: uploadError } = await supabase.storage
  .from('documents')
  .upload(filePath, proofOfPaymentFile, {
    cacheControl: '3600',
    upsert: false,
    contentType: proofOfPaymentFile.type || 'application/octet-stream', // ✅ ADDED
  })
```

### 2. **Added File Validation** ✅
Added comprehensive validation before upload to catch issues early:

```typescript
// Validate file before upload
if (!proofOfPaymentFile.name || proofOfPaymentFile.size === 0) {
  throw new Error('Invalid file: File appears to be empty or corrupted')
}

// Validate file size (max 10MB)
const maxSize = 10 * 1024 * 1024
if (proofOfPaymentFile.size > maxSize) {
  throw new Error('File size exceeds 10MB limit')
}

// Validate file type
const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
const fileType = proofOfPaymentFile.type || ''
if (!allowedTypes.includes(fileType) && !proofOfPaymentFile.name.match(/\.(jpg|jpeg|png|webp|pdf)$/i)) {
  throw new Error(`Unsupported file type: ${fileType}. Please upload JPG, PNG, WebP, or PDF files.`)
}
```

### 3. **Added Debug Logging** ✅
Added logging to help diagnose upload issues:

```typescript
console.log('Uploading proof of payment:', {
  fileName,
  fileSize: proofOfPaymentFile.size,
  fileType: proofOfPaymentFile.type,
  filePath
})

// After upload
console.log('Proof of payment uploaded successfully:', filePath)
```

## How Content Type Works

### Before Fix:
```
User uploads image.jpg (MIME: image/jpeg)
    ↓
Supabase Storage: No contentType specified
    ↓
File stored as: application/octet-stream (generic binary)
    ↓
Download: Browser doesn't recognize format
    ↓
Error: "don't support this format" ❌
```

### After Fix:
```
User uploads image.jpg (MIME: image/jpeg)
    ↓
Supabase Storage: contentType='image/jpeg' specified
    ↓
File stored with proper MIME type
    ↓
Download: Browser recognizes it as JPEG
    ↓
File opens correctly ✅
```

## Supported MIME Types

| File Extension | MIME Type            | Browser Support |
|---------------|---------------------|----------------|
| `.jpg/.jpeg`  | `image/jpeg`        | ✅ All browsers |
| `.png`        | `image/png`         | ✅ All browsers |
| `.webp`       | `image/webp`        | ✅ Modern browsers |
| `.pdf`        | `application/pdf`   | ✅ All browsers |

## Testing Checklist

To verify the fix works:

- [ ] Upload a JPEG image as proof of payment
- [ ] Complete the payment and wait for "pending_approval" status
- [ ] Go to Supabase Storage → documents bucket
- [ ] Find the uploaded file (e.g., `{userId}/payments/proof_of_payment_{paymentId}_{timestamp}.jpg`)
- [ ] Download the file from Supabase Storage
- [ ] Verify the file opens correctly with correct format
- [ ] Repeat for PNG, WebP, and PDF files

## Admin View Testing

- [ ] Log in as admin
- [ ] Navigate to Admin → Application Payments
- [ ] Find payment with proof of payment
- [ ] View thumbnail (should display correctly)
- [ ] Click "View Proof" to open modal
- [ ] Verify full-size image displays correctly
- [ ] Test zoom in/out functionality
- [ ] Download the file and verify it opens correctly

## Additional Validation Added

The fix also adds several layers of validation to prevent corrupt uploads:

1. **Empty File Check**: Prevents uploading empty or corrupted files
2. **Size Validation**: Enforces 10MB maximum file size
3. **Type Validation**: Only allows specific image and PDF formats
4. **MIME Type Fallback**: Uses `application/octet-stream` if type is missing (better than no type)

## File Upload Flow (Updated)

```typescript
// Frontend: StripePaymentForm.tsx
User selects file
    ↓
Validate type and size
    ↓
Create preview (images only)
    ↓
Set file in state
    ↓
User submits payment
    ↓
// Backend: supabase-api.ts (applicationPaymentsAPI.complete)
Receive File object
    ↓
Validate file (size, type, content)
    ↓
Upload to Supabase with contentType ✅
    ↓
Save file path to database
    ↓
Set payment status to 'pending_approval'
```

## Why This Matters

### Without Content Type:
- ❌ File corruption on download
- ❌ Users can't view their uploaded receipts
- ❌ Admins can't verify payments
- ❌ Support tickets for "broken files"

### With Content Type:
- ✅ Files preserve their format
- ✅ Users can verify their uploads
- ✅ Admins can review payment proofs
- ✅ Better user experience

## Related Files Modified

- `src/lib/supabase-api.ts` - Added contentType and validation
- `FILE_CORRUPTION_FIX.md` - This documentation

## Browser Compatibility

This fix works across all modern browsers:
- ✅ Chrome/Edge (Chromium)
- ✅ Firefox
- ✅ Safari
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## Future Improvements

Consider these enhancements:
1. Add file format conversion for uncommon image formats
2. Add automatic image optimization (if needed in future)
3. Add virus scanning for uploaded files
4. Add duplicate file detection
5. Add upload progress indicator

## References

- [Supabase Storage Upload API](https://supabase.com/docs/reference/javascript/storage-from-upload)
- [MDN: MIME Types](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types)
- [File API](https://developer.mozilla.org/en-US/docs/Web/API/File)

