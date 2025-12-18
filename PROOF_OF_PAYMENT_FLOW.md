# Proof of Payment Upload and Display Flow

## Overview
This document explains how proof of payment files are uploaded in the checkout process and how they are fetched and displayed across the application.

## Upload Flow (Checkout Process)

### 1. File Selection (`StripePaymentForm.tsx`)
Location: `src/components/StripePaymentForm.tsx` (Lines 717-850)

**Process:**
- User selects mobile banking/GCash as payment method
- File upload interface appears with drag-and-drop support
- Accepts: JPG, JPEG, PNG, WebP, and PDF files
- Maximum file size: 10MB

**File Handling:**
```typescript
async function handleFileSelect(file: File) {
  // 1. Validate file size (max 10MB)
  if (file.size > 10 * 1024 * 1024) {
    setUploadError('File size must be less than 10MB')
    return
  }

  // 2. Generate preview for images
  if (file.type.startsWith('image/')) {
    const reader = new FileReader()
    reader.onload = (e) => {
      setProofOfPaymentPreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  // 3. Just use the file as-is - no compression or processing
  setProofOfPaymentFile(file)
  showToast?.('File ready for upload!', 'success')
}
```

### 2. File Upload to Supabase Storage (`supabase-api.ts`)
Location: `src/lib/supabase-api.ts` (Lines 4286-4329)

**Process:**
```typescript
// Upload proof of payment file if provided (for mobile banking)
let proofOfPaymentFilePath: string | undefined
if (proofOfPaymentFile) {
  // 1. Generate unique filename
  const fileExt = proofOfPaymentFile.name.split('.').pop()
  const fileName = `proof_of_payment_${paymentId}_${Date.now()}.${fileExt}`
  
  // 2. Determine storage path
  const filePath = userId 
    ? `${userId}/payments/${fileName}` 
    : `public/payments/${fileName}`

  // 3. Upload to Supabase Storage (documents bucket) - no processing
  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(filePath, proofOfPaymentFile, {
      cacheControl: '3600',
      upsert: false,
    })

  if (!uploadError) {
    proofOfPaymentFilePath = filePath
  }
}
```

### 3. Save File Path to Database
**Table:** `application_payments`
**Column:** `proof_of_payment_file_path`

```sql
UPDATE application_payments 
SET proof_of_payment_file_path = '{userId}/payments/proof_of_payment_{paymentId}_{timestamp}.{ext}'
WHERE id = {paymentId}
```

## Display Flow

### 1. Client View (`ApplicationPayments.tsx`)
Location: `src/pages/ApplicationPayments.tsx` (Lines 1730-1773)

**Simple Image Display:**
```tsx
{viewingProof.fileName.match(/\.(pdf)$/i) ? (
  <iframe
    src={viewingProof.url}
    className="w-full"
    style={{ minHeight: '70vh' }}
    title="Proof of Payment"
  />
) : (
  <img
    src={viewingProof.url}
    alt="Proof of Payment"
    className="w-full h-auto max-h-[70vh] object-contain"
  />
)}
```

**Features:**
- Simple view-only display
- No zoom/pan functionality
- Proper image sizing with `w-full h-auto max-h-[70vh] object-contain`
- PDF support via iframe

### 2. Admin View (`AdminApplicationPayments.tsx`)
Location: `src/pages/AdminApplicationPayments.tsx` (Lines 90-272, 1385-1520)

**Advanced Image Display with Zoom/Pan:**

#### Thumbnail Preview (Lines 90-272)
```tsx
function ProofOfPaymentThumbnail({ filePath, onViewClick }) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  
  useEffect(() => {
    async function loadThumbnail() {
      // 1. Get signed URL from Supabase Storage
      const url = await getSignedFileUrl(filePath, 3600)
      
      // 2. Display thumbnail
      setThumbnailUrl(url)
    }
    loadThumbnail()
  }, [filePath])
  
  return (
    <div className="w-full h-32 bg-gray-100 rounded-lg">
      <img 
        src={thumbnailUrl} 
        alt="Proof of Payment" 
        className="w-full h-full object-contain"
        crossOrigin="anonymous"
      />
    </div>
  )
}
```

#### Full-Size Modal View with Zoom/Pan (Lines 1385-1520)

**Features:**
- Interactive zoom (50% - 300%)
- Pan/drag when zoomed
- Download functionality
- PDF viewer support

**Fixed Implementation:**
```tsx
<div
  className="relative overflow-auto flex items-start justify-center"
  style={{ 
    width: '100%',
    height: '70vh',
    cursor: isDragging ? 'grabbing' : (imageZoom > 1 ? 'grab' : 'default')
  }}
>
  <img
    src={viewingProof.url}
    alt="Proof of Payment"
    className="select-none"
    crossOrigin="anonymous"
    style={{
      // FIT TO CONTAINER AT DEFAULT ZOOM
      width: imageZoom === 1 ? '100%' : 'auto',
      height: imageZoom === 1 ? 'auto' : 'auto',
      maxWidth: imageZoom === 1 ? '100%' : 'none',
      maxHeight: imageZoom === 1 ? '100%' : 'none',
      objectFit: imageZoom === 1 ? 'contain' : 'none',
      
      // TRANSFORM FOR ZOOM/PAN
      transform: `translate(${imagePosition.x}px, ${imagePosition.y}px) scale(${imageZoom})`,
      transformOrigin: 'top left',
      transition: isDragging ? 'none' : 'transform 0.1s ease-out'
    }}
  />
</div>
```

### 3. Fetching Signed URLs (`supabase-api.ts`)
Location: `src/lib/supabase-api.ts`

**Process:**
```typescript
export async function getSignedFileUrl(
  filePath: string, 
  expiresIn: number = 3600, 
  silent: boolean = true
): Promise<string | null> {
  try {
    // 1. Get signed URL from Supabase Storage
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(filePath, expiresIn)

    if (error) throw error

    // 2. Return signed URL (valid for specified duration)
    return data.signedUrl
  } catch (error) {
    console.error('Error getting signed URL:', error)
    return null
  }
}
```

## File Storage Structure

```
documents/ (Supabase Storage Bucket)
├── {userId}/
│   └── payments/
│       ├── proof_of_payment_{paymentId}_1234567890.jpg
│       ├── proof_of_payment_{paymentId}_1234567891.png
│       └── proof_of_payment_{paymentId}_1234567892.pdf
└── public/
    └── payments/
        └── proof_of_payment_{paymentId}_1234567893.jpg (for non-authenticated uploads)
```

## Database Schema

```sql
-- Migration: supabase/add-mobile-banking-proof-of-payment.sql

ALTER TABLE application_payments 
ADD COLUMN IF NOT EXISTS proof_of_payment_file_path TEXT;

-- Payment status now includes 'pending_approval'
CHECK (status IN ('pending', 'pending_approval', 'paid', 'failed', 'cancelled'));
```

## Security & Access Control

### Storage RLS Policies
1. **Upload:** Authenticated users can upload to their own folder
2. **View:** 
   - Users can view their own files
   - Admins can view all files
3. **Public:** Public checkout users upload to `public/payments/` (accessible to admins only)

### Signed URLs
- URLs expire after specified duration (default: 1 hour)
- Longer expiration for admin viewing (2 hours)
- Automatically renewed when viewing

## Error Handling

### Upload Errors
1. **File too large:** "File size must be less than 10MB"
2. **Compression failed:** Falls back to original file
3. **Upload failed:** "Failed to upload proof of payment: {error}"

### Display Errors
1. **No file path:** Shows placeholder with "No file path provided"
2. **Signed URL failed:** Shows "Failed to generate access URL"
3. **Image load failed:** Attempts CORS fetch with blob fallback
4. **Timeout:** 10-second timeout with error message

## Testing Checklist

- [ ] Upload JPG/PNG/WebP image (< 10MB)
- [ ] Upload PDF file (< 10MB)
- [ ] Upload file > 10MB (should show error)
- [ ] Drag and drop file
- [ ] View thumbnail in admin dashboard
- [ ] View full-size image in modal
- [ ] Test zoom in/out functionality
- [ ] Test pan/drag when zoomed
- [ ] Download proof of payment
- [ ] View PDF in iframe
- [ ] Test image compression
- [ ] Test signed URL expiration and renewal

## Bug Fixed

**Issue:** Image not displaying correctly in admin modal viewer
- **Location:** `src/pages/AdminApplicationPayments.tsx` (Lines 1470-1514)
- **Problem:** Image lacked initial width/height constraints, causing it to render at full size
- **Solution:** Added conditional sizing based on zoom level:
  - At default zoom (1x): Image fits container with `width: 100%`, `maxWidth: 100%`, `maxHeight: 100%`, `objectFit: contain`
  - At zoomed levels: Removes constraints to allow transform to work properly
  - Added flexbox centering to container for better alignment

**Changes Made:**
```diff
<div
- className="relative overflow-auto"
+ className="relative overflow-auto flex items-start justify-center"
  style={{ 
    width: '100%',
    height: '70vh',
    cursor: isDragging ? 'grabbing' : (imageZoom > 1 ? 'grab' : 'default')
  }}
>
  <img
    src={viewingProof.url}
    alt="Proof of Payment"
    className="select-none"
    crossOrigin="anonymous"
    style={{
+     width: imageZoom === 1 ? '100%' : 'auto',
+     height: imageZoom === 1 ? 'auto' : 'auto',
+     maxWidth: imageZoom === 1 ? '100%' : 'none',
+     maxHeight: imageZoom === 1 ? '100%' : 'none',
+     objectFit: imageZoom === 1 ? 'contain' : 'none',
      transform: `translate(${imagePosition.x}px, ${imagePosition.y}px) scale(${imageZoom})`,
      transformOrigin: 'top left',
-     maxWidth: 'none',
      transition: isDragging ? 'none' : 'transform 0.1s ease-out'
    }}
  />
</div>
```

## Recent Changes

### Simplified Upload Flow (Latest Update)
**Change:** Removed all file compression and processing from proof of payment upload

**Rationale:** Keep the upload process simple and fast - just upload the file as-is without any modifications.

**What Changed:**
1. ✅ **Removed automatic image compression** in `StripePaymentForm.tsx`
2. ✅ **Removed server-side compression** in `supabase-api.ts` 
3. ✅ **Removed unused `compressingFile` state** variable
4. ✅ **Removed `compressDocument` import** from StripePaymentForm
5. ✅ **Updated UI text** - removed references to "auto-compressed"
6. ✅ **Changed file size display** from KB to MB for clarity

**Benefits:**
- ⚡ **Faster uploads** - no compression delay
- 🎯 **Simpler code** - easier to maintain
- 📸 **Original quality** - admins see the exact file uploaded
- 🐛 **Fewer errors** - no compression failures

**Validation Still Applied:**
- ✅ File type validation (JPG, PNG, WebP, PDF only)
- ✅ File size limit (10MB maximum)
- ✅ Preview generation for images

## Related Files

- **Upload Component:** `src/components/StripePaymentForm.tsx`
- **API Layer:** `src/lib/supabase-api.ts`
- **Client View:** `src/pages/ApplicationPayments.tsx`
- **Admin View:** `src/pages/AdminApplicationPayments.tsx`
- **Checkout Page:** `src/pages/ApplicationCheckout.tsx`
- **Migration:** `supabase/add-mobile-banking-proof-of-payment.sql`

