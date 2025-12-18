# Storage Upload and File Path Resolution Fix

## Issues Fixed

1. **Storage RLS Policy Errors (400 Bad Request)**
   - Admin users couldn't upload files to user folders
   - Compiled PDF uploads were failing due to RLS policies

2. **File Path Resolution Issues**
   - Picture files not found (e.g., looking for `picture_1764724210473.JPG` but file is `ead_photos_krizzamae_cantila.jpg`)
   - Passport files not found due to path mismatches
   - CompileAllDocuments function couldn't find files with different naming patterns

## Solutions Implemented

### 1. Fixed File Path Resolution (`src/pages/ApplicationDetail.tsx`)

Enhanced the `CompileAllDocuments` function to:
- **Search through all user documents** by pattern matching when the original file path fails
- **Match files by document type** (picture, ead_photos, passport)
- **Match files by filename patterns** (contains "picture", "photo", "passport", etc.)
- **Try multiple alternative paths** before giving up
- **Use most recent file** if multiple matches found

**How it works:**
```typescript
// When a file isn't found at the expected path, the function now:
1. Searches all user documents for matching patterns
2. Matches by document_type (picture, ead_photos, passport)
3. Matches by filename containing relevant keywords
4. Tries each match until one works
5. Falls back to application.picture_path/passport_path if available
```

### 2. Fixed Storage RLS Policies (`supabase/migrations/fix-storage-admin-upload-policies.sql`)

Created comprehensive storage policies that:
- Allow users to upload/view/update/delete their own documents
- **Allow admins to upload/view/update/delete ANY document** (critical fix)
- Use `SECURITY DEFINER` function `is_admin_user()` to avoid RLS recursion
- Check admin status from both `raw_user_meta_data` and `app_metadata`

**Key Policies Added:**
- `Admins can upload all documents` - Allows admins to upload to any user folder
- `Admins can view all documents` - Allows admins to view any user's documents
- `Admins can update all documents` - Allows admins to update any user's documents
- `Admins can delete all documents` - Allows admins to delete any user's documents

## How to Apply Fixes

### Step 1: Run Storage Policy Migration

1. Open **Supabase Dashboard → SQL Editor**
2. Copy and paste the entire contents of:
   ```
   supabase/migrations/fix-storage-admin-upload-policies.sql
   ```
3. Click **Run** (or press F5)
4. Verify that 8 policies were created (check the verification query at the end)

### Step 2: Verify Admin Status

If you're still getting RLS errors after running the migration:

1. Check your admin status:
   ```sql
   SELECT 
     auth.uid() as current_user_id,
     public.is_admin_user() as is_admin;
   ```
   
2. If `is_admin` returns `false`, update your user metadata:
   ```sql
   -- Update your user's role in auth.users
   UPDATE auth.users
   SET raw_user_meta_data = jsonb_set(
     COALESCE(raw_user_meta_data, '{}'::jsonb),
     '{role}',
     '"admin"'
   )
   WHERE id = auth.uid();
   ```

3. **Refresh your session** (log out and log back in) to get a new JWT token with updated role

### Step 3: Test File Compilation

1. Navigate to an EAD application detail page
2. Try compiling all documents
3. The system should now:
   - Find picture files even if they have different names (e.g., `ead_photos_*.jpg`)
   - Find passport files with various naming patterns
   - Successfully upload compiled PDFs to storage

## Testing

After applying fixes, test:

1. **File Compilation**
   - Go to EAD application → Timeline → Compile All Documents
   - Should find all files including picture and passport
   - Should successfully compile PDF

2. **Storage Upload**
   - Upload should work without RLS errors
   - Compiled PDF should be saved to storage
   - Admin should be able to upload to any user's folder

3. **File Path Resolution**
   - Should find files with names like `ead_photos_*.jpg`
   - Should find files with names like `picture_*.JPG`
   - Should handle case-insensitive matching

## Troubleshooting

### Still Getting RLS Errors?

1. **Check your admin status:**
   ```sql
   SELECT public.is_admin_user();
   ```

2. **Verify policies exist:**
   ```sql
   SELECT policyname 
   FROM pg_policies
   WHERE schemaname = 'storage'
     AND tablename = 'objects'
     AND policyname LIKE '%admin%';
   ```

3. **Check storage bucket exists:**
   ```sql
   SELECT * FROM storage.buckets WHERE id = 'documents';
   ```

4. **Refresh your session** - Log out and log back in to refresh JWT token

### Files Still Not Found?

1. Check that files exist in storage:
   - Go to Supabase Dashboard → Storage → documents bucket
   - Verify files exist in user's folder

2. Check file naming patterns:
   - Look at actual filenames in storage
   - The new code should handle various patterns, but verify they match

3. Check console logs:
   - Look for `CompileAllDocuments: Found picture at alternative path` messages
   - This confirms the pattern matching is working

## Files Changed

1. `src/pages/ApplicationDetail.tsx` - Enhanced file path resolution
2. `supabase/migrations/fix-storage-admin-upload-policies.sql` - New migration for storage policies

## Notes

- The file path resolution is now more robust and handles various naming conventions
- Admin users can now upload files to any user's folder, which is necessary for admin operations
- The fix maintains security - users can only access their own files, admins can access all files






