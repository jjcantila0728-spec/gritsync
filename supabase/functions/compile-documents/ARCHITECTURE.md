# Document Compilation Architecture

## Overview

This function follows a **worker-based architecture** pattern where processing is separated from orchestration:

```
Edge Function (Orchestrator) → Worker Module → Processing
```

## Architecture Layers

### 1. Orchestrator (`index.ts`)
**Role:** HTTP request handling, validation, coordination

**Responsibilities:**
- Handle HTTP requests (CORS, validation)
- Parse and validate input
- Find all required documents
- Check file types
- Call worker for processing
- Handle storage upload
- Return response

**No heavy processing** - delegates all CPU-intensive work to worker

### 2. Worker (`worker.ts`)
**Role:** All heavy processing logic

**Responsibilities:**
- Image normalization (format detection, validation)
- Image to PDF conversion
- PDF loading and optimization
- PDF merging
- File compression

**Key Features:**
- JPEG validation (prevents "SOI not found" errors)
- Document-specific optimization settings
- Smart size limits to prevent CPU timeout
- Comprehensive logging

## Flow

```
1. HTTP Request → Orchestrator
   ↓
2. Validate Request (applicationId, userId)
   ↓
3. Find Documents (database queries)
   ↓
4. Check File Types
   ↓
5. Delegate to Worker
   ↓
   [WORKER]
   ├─ Convert Images to PDF (with validation)
   ├─ Load PDFs
   ├─ Merge All PDFs
   └─ Return compiled PDF bytes
   ↓
6. Upload to Storage
   ↓
7. Return Download URL
```

## Key Improvements

### ✅ JPEG Validation
- Validates JPEG format before embedding (checks SOI marker)
- Fails fast on fake JPEGs (no PNG fallback loop)
- Prevents "SOI not found" errors

### ✅ Document-Specific Optimization
- 2x2 Pictures: 300x300px, high quality
- Passports/Visas: 1200x1200px, document quality
- Scans/Certificates: 1200x1200px, document quality
- Default: 800x1200px, balanced

### ✅ Smart Size Limits
- Skips images >6MB to prevent CPU timeout
- Skips PDF optimization for files <500KB (saves CPU, prevents size increase)

### ✅ Better Logging
- Clear prefixes: `[ORCHESTRATOR]` vs `[WORKER]`
- Detailed image conversion logs
- Format detection logging
- Size change tracking

## Benefits

1. **Separation of Concerns** - Orchestration vs Processing
2. **Easier Testing** - Worker can be tested independently
3. **Better Maintainability** - Clear boundaries
4. **Reduced CPU Timeout Risk** - Smart limits and validation
5. **Better Error Handling** - Fail fast, clear errors

## Future Enhancements

If CPU timeouts persist, consider:
1. **True Background Jobs** - Use Supabase database as job queue
2. **Separate Worker Function** - Deploy worker as separate Edge Function
3. **External Image Processing** - Use service like Cloudinary/Imgix for image normalization
4. **Streaming Processing** - Process documents in smaller batches






