# Picture Public Access Setup

## Issue
Pictures uploaded to Supabase Storage were not displaying in the public tracking page because:
1. The `DocumentImagePreview` component was only using signed URLs (requires authentication)
2. The public policy for pictures might not be applied correctly
3. Case-insensitive file extensions (JPG vs jpg) weren't handled

## Changes Made

### 1. Updated DocumentImagePreview Component
**File:** `src/components/ui/DocumentImagePreview.tsx`

- Now detects picture files (files with "picture" in the name)
- For picture files: Tries public URL first, then falls back to signed URL if public URL fails
- For other files: Uses signed URL (requires authentication)
- Handles errors gracefully with automatic fallback

### 2. Created Migration for Public Policy
**File:** `supabase/migrations/add_public_pictures_policy.sql`

This migration ensures pictures are publicly accessible with case-insensitive matching for file extensions.

## Setup Instructions

### Step 1: Apply the Public Policy Migration

Run the migration in your Supabase SQL Editor:

```sql
-- File: supabase/migrations/add_public_pictures_policy.sql
```

Or manually run this SQL in Supabase Dashboard > SQL Editor:

```sql
-- Drop policy if it exists first
DROP POLICY IF EXISTS "Public can view pictures for tracking" ON storage.objects;

-- Add public policy to allow anyone to read pictures from the documents bucket
CREATE POLICY "Public can view pictures for tracking"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'documents' AND
  (
    -- Match picture files with case-insensitive pattern
    LOWER(name) LIKE '%/picture_%.jpg' OR
    LOWER(name) LIKE '%/picture_%.jpeg' OR
    LOWER(name) LIKE '%/picture_%.png' OR
    -- Match any file in a user folder that contains 'picture' in the name
    LOWER(name) ~ '.*/picture.*\.(jpg|jpeg|png)$'
  )
);
```

### Step 2: Verify the Policy

Run this query to verify the policy was created:

```sql
SELECT 
  policyname,
  cmd,
  roles,
  qual
FROM pg_policies 
WHERE tablename = 'objects' 
  AND schemaname = 'storage'
  AND policyname = 'Public can view pictures for tracking';
```

You should see a policy with:
- `policyname`: "Public can view pictures for tracking"
- `cmd`: "SELECT"
- `roles`: "anon, authenticated"

### Step 3: Test the Implementation

1. **Test Public Access (No Authentication):**
   - Open the tracking page in an incognito/private window
   - Enter a tracking ID that has a picture
   - The picture should display using the public URL

2. **Test Authenticated Access:**
   - Log in to the application
   - View an application detail page with a picture
   - The picture should display (will use public URL if available, signed URL as fallback)

3. **Check Browser Console:**
   - Look for logs like:
     - `DocumentImagePreview: Detected picture file, trying public URL first`
     - `DocumentImagePreview: Generated public URL for picture`
     - If public URL fails: `DocumentImagePreview: Public URL failed, trying signed URL as fallback`

## How It Works

1. **Picture Detection:**
   - Files matching pattern: `picture_*.jpg`, `picture_*.JPG`, `picture_*.jpeg`, etc.
   - Or any file path containing "picture" (case-insensitive)

2. **URL Selection:**
   - **Picture files:** Try public URL first → Fallback to signed URL if public fails
   - **Other files:** Use signed URL only (requires authentication)

3. **Error Handling:**
   - If public URL fails to load, automatically tries signed URL
   - If both fail, shows error icon

## File Path Example

For a file path like:
```
cfae7073-0116-47b8-863b-363851958479/picture_1764724210473.JPG
```

The component will:
1. Detect it's a picture file (contains "picture" and ends with image extension)
2. Generate public URL: `https://[project].supabase.co/storage/v1/object/public/documents/cfae7073-0116-47b8-863b-363851958479/picture_1764724210473.JPG`
3. Try to load it
4. If it fails (403/404), automatically fallback to signed URL

## Troubleshooting

### Pictures Still Not Showing

1. **Check if policy is applied:**
   ```sql
   SELECT * FROM pg_policies 
   WHERE tablename = 'objects' 
   AND policyname = 'Public can view pictures for tracking';
   ```

2. **Check file path format:**
   - Should be: `{userId}/picture_{timestamp}.{ext}`
   - Example: `cfae7073-0116-47b8-863b-363851958479/picture_1764724210473.JPG`

3. **Check browser console:**
   - Look for error messages
   - Check network tab for 403/404 errors

4. **Verify bucket is not fully public:**
   - The bucket should remain private (`public: false`)
   - Only pictures should be accessible via the policy

### Policy Not Working

If the policy doesn't work, you can temporarily make the entire bucket public:
1. Go to Supabase Dashboard > Storage > documents > Settings
2. Toggle "Public bucket" to ON
3. **Note:** This makes ALL files public, not just pictures (less secure)

## Security Notes

- Only picture files matching the pattern are publicly accessible
- Other documents (PDFs, diplomas, etc.) still require authentication
- The policy uses case-insensitive matching for file extensions
- Public URLs don't expire (unlike signed URLs which expire after 1 hour)
