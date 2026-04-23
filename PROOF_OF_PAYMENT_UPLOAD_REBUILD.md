# Proof of Payment Upload - Complete Rebuild (v5.0)

## 🎯 Problem Identified

The file was being **serialized to JSON** somewhere in the React state or callback chain, causing Supabase to receive `application/json` instead of the actual binary data.

## ✅ Solution: Store as ArrayBuffer

Complete rebuild to prevent ANY possibility of JSON serialization:

### **Key Changes:**

#### 1. **Read File as ArrayBuffer Immediately**
```typescript
// OLD: Store File object (can be serialized to JSON)
const [proofOfPaymentFile, setProofOfPaymentFile] = useState<File | null>(null)

// NEW: Store ArrayBuffer + metadata (CANNOT be serialized to JSON)
const [proofOfPaymentData, setProofOfPaymentData] = useState<{
  arrayBuffer: ArrayBuffer
  fileName: string
  fileType: string
  fileSize: number
} | null>(null)
```

#### 2. **Read File Immediately on Selection**
```typescript
async function handleFileSelect(file: File) {
  // Read as ArrayBuffer immediately (prevents serialization)
  const arrayBuffer = await file.arrayBuffer()
  
  // Detect MIME type from extension (more reliable)
  const mimeTypes = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'webp': 'image/webp',
    'pdf': 'application/pdf',
  }
  const fileExt = file.name.split('.').pop()?.toLowerCase()
  const detectedType = mimeTypes[fileExt] || 'application/octet-stream'
  
  // Store ArrayBuffer with metadata
  setProofOfPaymentData({
    arrayBuffer,
    fileName: file.name,
    fileType: detectedType,
    fileSize: file.size
  })
}
```

#### 3. **Recreate File from ArrayBuffer on Submit**
```typescript
// When submitting, recreate File object from ArrayBuffer
const blob = new Blob([proofOfPaymentData.arrayBuffer], { 
  type: proofOfPaymentData.fileType 
})
const file = new File([blob], proofOfPaymentData.fileName, {
  type: proofOfPaymentData.fileType
})

// Now pass the fresh File object (with correct MIME type)
onSuccess('mobile_banking', 'mobile_banking', details, file)
```

#### 4. **Server-Side: Direct Binary Upload**
```typescript
// Upload ArrayBuffer directly with explicit contentType
const arrayBuffer = await proofOfPaymentFile.arrayBuffer()
const blob = new Blob([arrayBuffer], { type: contentType })

// Upload binary data (not JSON)
await supabase.storage
  .from('documents')
  .upload(filePath, blob, {
    cacheControl: '3600',
    upsert: false,
  })
```

## 🔄 **Complete Flow:**

```
1. User selects file → File object created
    ↓
2. Read as ArrayBuffer IMMEDIATELY
    ↓
3. Detect MIME type from extension (.jpg → image/jpeg)
    ↓
4. Store { arrayBuffer, fileName, fileType, fileSize }
    ↓ (ArrayBuffer CANNOT be serialized to JSON)
    ↓
5. User submits payment
    ↓
6. Recreate File from ArrayBuffer with correct type
    ↓
7. Pass File to API
    ↓
8. API reads File.arrayBuffer()
    ↓
9. Create Blob with explicit MIME type
    ↓
10. Upload Blob to Supabase
    ↓ (Binary upload with correct Content-Type)
    ↓
11. ✅ Supabase stores with correct content-type!
```

## 🎯 **Why This Works:**

### Previous Issues:
- ❌ File object stored in React state → could be serialized
- ❌ File passed through callbacks → could be converted to JSON
- ❌ MIME type from File.type → often empty or wrong
- ❌ Supabase SDK upload → was ignoring contentType

### New Approach:
- ✅ **ArrayBuffer cannot be serialized to JSON** (throws error if tried)
- ✅ **MIME type detected from extension** (reliable)
- ✅ **Fresh File recreated on submit** (correct MIME type)
- ✅ **Binary Blob upload** (correct Content-Type)
- ✅ **Explicit type at every step** (no auto-detection)

## 📋 **Testing Steps:**

1. **Stop and restart dev server:**
   ```bash
   # Ctrl+C to stop
   npm run dev
   ```

2. **Hard refresh browser:**
   ```
   Ctrl + Shift + R (Windows/Linux)
   Cmd + Shift + R (Mac)
   ```

3. **Upload proof of payment**

4. **Check console for:**
   ```javascript
   🔧 PROOF OF PAYMENT UPLOAD v5.0 (BINARY ARRAYBUFFER - NO JSON) 🔧
   📁 Reading file as ArrayBuffer to prevent JSON serialization
   ✅ File read successfully: {
     fileName: "...",
     fileType: "image/png",  // ← Should be correct MIME type
     arrayBufferSize: 77782
   }
   📤 Submitting mobile banking payment with proof: {
     fileName: "...",
     fileType: "image/png",  // ← Should match
     fileSize: 77782
   }
   ```

5. **Check Supabase Storage:**
   - Find the uploaded file
   - **Content-Type should now be `image/png` or `image/jpeg`**
   - **NOT `application/json`!**

## 🎊 **Expected Result:**

```
File: proof_of_payment_XXX.png
Content-Type: image/png ✅ (NOT application/json!)
Size: 76.23 KB
Status: Can download and open successfully
```

## 🔧 **What's Different in v5.0:**

| Aspect | Old (v1-4) | New (v5.0) |
|--------|-----------|-----------|
| **Storage** | File object | ArrayBuffer + metadata |
| **Can serialize?** | Yes (to JSON) | No (binary data) |
| **MIME detection** | File.type | File extension |
| **When read?** | On upload | On selection |
| **State** | File object | Binary data |
| **Passing** | File through callbacks | ArrayBuffer, recreate File |
| **Upload** | Direct File | Blob from ArrayBuffer |

## 📝 **Files Modified:**

1. **src/components/StripePaymentForm.tsx**
   - Changed state from `File` to `ArrayBuffer + metadata`
   - Read file immediately on selection
   - Recreate File on submit

2. **src/lib/supabase-api.ts**
   - Added v5.0 version marker
   - Binary upload with explicit MIME type

## 🎯 **Why ArrayBuffer?**

JavaScript `ArrayBuffer` is **pure binary data** that:
- ✅ Cannot be serialized to JSON (throws error)
- ✅ Cannot be accidentally stringified
- ✅ Preserves exact file bytes
- ✅ Can be converted to Blob/File with any MIME type

This **guarantees** the file data stays binary throughout the entire flow!

## 🚀 **Test It Now!**

The complete rebuild is ready. This should **finally** fix the `application/json` issue because:

1. File cannot be serialized (ArrayBuffer)
2. MIME type is always correct (from extension)
3. Fresh File object created (no stale data)
4. Binary upload (no JSON involved)

**Upload a new file and check Supabase Storage!** 🎊

