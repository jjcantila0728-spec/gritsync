# Fix for Picture Not Showing Issue

## Problem
The SQL policy was applied successfully, but pictures are still not showing. This is because:

1. **Private buckets don't support public URLs**: Even with RLS policies allowing `anon` access, the `/storage/v1/object/public/...` endpoint only works if the bucket itself is public.

2. **Signed URLs may require authentication**: For anonymous users, `createSignedUrl` might fail even if the policy allows access.

## Solution Options

### Option 1: Make the Bucket Public (Recommended for Pictures)

Since pictures need to be publicly accessible for tracking, make the bucket public but keep RLS policies for security:

1. Go to **Supabase Dashboard > Storage > documents**
2. Click **Settings** (gear icon)
3. Toggle **"Public bucket"** to **ON**
4. The RLS policy will still restrict access to only picture files

**Why this works:**
- Public URLs will work: `https://[project].supabase.co/storage/v1/object/public/documents/...`
- RLS policies still enforce that only pictures are accessible
- Other files (PDFs, etc.) are still protected by RLS

### Option 2: Keep Bucket Private and Use Server Endpoint

If you want to keep the bucket private, create a server endpoint that generates signed URLs for anonymous users:

```javascript
// server/routes/files.js or similar
router.get('/picture/:path(*)', async (req, res) => {
  const filePath = req.params.path
  const supabase = getSupabaseClient() // Uses service role or anon key
  
  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(filePath, 3600)
  
  if (error) {
    return res.status(404).json({ error: 'File not found' })
  }
  
  res.redirect(data.signedUrl)
})
```

Then update `DocumentImagePreview` to use this endpoint for pictures.

### Option 3: Verify Policy Pattern Matches File Path

Check if your file path matches the policy pattern:

**File path example:**
```
cfae7073-0116-47b8-863b-363851958479/picture_1764724210473.JPG
```

**Policy pattern checks:**
- `LOWER(name) LIKE '%/picture_%.jpg'` - Matches `/picture_*.jpg` (lowercase)
- `LOWER(name) LIKE '%/picture_%.jpeg'` - Matches `/picture_*.jpeg`
- `LOWER(name) LIKE '%/picture_%.png'` - Matches `/picture_*.png`
- `LOWER(name) ~ '.*/picture.*\.(jpg|jpeg|png)$'` - Matches any path with "picture" and image extension

**Your file should match** because:
- Path contains `/picture_`
- Extension is `.JPG` (will be lowercased in policy check)

## Quick Test

1. **Check browser console** for errors:
   - Open DevTools (F12)
   - Go to Console tab
   - Look for errors like:
     - `Failed to get signed URL`
     - `403 Forbidden`
     - `404 Not Found`

2. **Check Network tab**:
   - Look for requests to Supabase storage
   - Check the response status code
   - 403 = Permission denied (policy issue)
   - 404 = File not found (path issue)
   - 200 = Success (but might be CORS issue)

3. **Test the policy directly**:
   ```sql
   -- Run in Supabase SQL Editor
   SELECT 
     name,
     bucket_id,
     CASE 
       WHEN LOWER(name) LIKE '%/picture_%.jpg' THEN 'MATCHES JPG'
       WHEN LOWER(name) LIKE '%/picture_%.jpeg' THEN 'MATCHES JPEG'
       WHEN LOWER(name) LIKE '%/picture_%.png' THEN 'MATCHES PNG'
       WHEN LOWER(name) ~ '.*/picture.*\.(jpg|jpeg|png)$' THEN 'MATCHES REGEX'
       ELSE 'NO MATCH'
     END as policy_match
   FROM storage.objects
   WHERE bucket_id = 'documents'
   AND name LIKE '%picture%'
   LIMIT 10;
   ```

## Recommended Action

**Make the bucket public** (Option 1) because:
- Pictures need to be publicly accessible for tracking
- RLS policies still protect other files
- Simplest solution
- Public URLs are faster (no signing needed)

After making the bucket public, the `DocumentImagePreview` component will automatically use public URLs for pictures and they should display correctly.
