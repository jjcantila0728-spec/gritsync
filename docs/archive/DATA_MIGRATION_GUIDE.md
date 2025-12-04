# Data Migration Guide: SQLite to Supabase

This guide helps you migrate existing data from SQLite to Supabase PostgreSQL.

## Prerequisites

1. Supabase project created and schema deployed
2. Access to your SQLite database file (`gritsync.db`)
3. SQLite command-line tools or a database viewer

## Migration Steps

### 1. Export Data from SQLite

#### Option A: Using SQLite CLI

```bash
# Export users (excluding passwords - handled by Supabase Auth)
sqlite3 gritsync.db "SELECT id, email, role, full_name, grit_id, created_at, updated_at FROM users;" > users_export.csv

# Export applications
sqlite3 gritsync.db "SELECT * FROM applications;" > applications_export.csv

# Export quotations
sqlite3 gritsync.db "SELECT * FROM quotations;" > quotations_export.csv

# Export user_details
sqlite3 gritsync.db "SELECT * FROM user_details;" > user_details_export.csv

# Export other tables similarly
```

#### Option B: Using a Database Viewer

Use a tool like DB Browser for SQLite to export data as CSV or SQL.

### 2. Transform Data for Supabase

#### Users Migration

**Important**: Users must be created through Supabase Auth first, then their profiles updated.

```sql
-- Step 1: Create users in Supabase Auth (via Supabase Dashboard or API)
-- Step 2: Update user profiles
UPDATE users 
SET 
  role = 'client', -- or 'admin'
  full_name = 'John Doe',
  grit_id = 'GRIT123'
WHERE id = 'user-uuid-from-supabase-auth';
```

#### Applications Migration

```sql
-- Applications can be inserted directly
-- Note: Convert TEXT dates to proper DATE format
-- Convert file paths to Supabase Storage format: userId/filename

INSERT INTO applications (
  id, user_id, first_name, middle_name, last_name,
  mobile_number, email, gender, marital_status,
  single_full_name, date_of_birth, birth_place,
  country_of_birth, house_number, street_name,
  city, province, country, zipcode,
  -- ... all other fields
  picture_path, diploma_path, passport_path,
  status, created_at, updated_at
)
SELECT 
  id, user_id, first_name, middle_name, last_name,
  mobile_number, email, gender, marital_status,
  single_full_name, date_of_birth, birth_place,
  country_of_birth, house_number, street_name,
  city, province, country, zipcode,
  -- Convert file paths if needed
  picture_path, diploma_path, passport_path,
  status, created_at, updated_at
FROM temp_applications;
```

#### File Path Migration

If your SQLite database has file paths in the old format, you need to:

1. **Upload files to Supabase Storage**:
   - Files are currently in `server/uploads/`
   - Upload them to Supabase Storage bucket `documents`
   - Maintain the same path structure: `userId/filename`

2. **Update file paths in database**:
   ```sql
   -- If paths need updating (e.g., from absolute to relative)
   UPDATE applications
   SET picture_path = REPLACE(picture_path, '/full/path/to/', '')
   WHERE picture_path LIKE '/full/path/to/%';
   ```

### 3. Import Data into Supabase

#### Using Supabase SQL Editor

1. Go to Supabase Dashboard > SQL Editor
2. Paste your INSERT statements
3. Execute the SQL

#### Using CSV Import

1. Go to Supabase Dashboard > Table Editor
2. Select the table
3. Click "Insert" > "Import data from CSV"
4. Upload your CSV file
5. Map columns correctly

### 4. Migrate Files to Supabase Storage

#### Manual Upload

1. Go to Supabase Dashboard > Storage > documents bucket
2. Create folders for each user (using user ID)
3. Upload files maintaining the structure:
   ```
   documents/
     userId1/
       picture_timestamp.jpg
       diploma_timestamp.pdf
       passport_timestamp.jpg
     userId2/
       ...
   ```

#### Automated Script (Node.js)

```javascript
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role for admin access
)

async function migrateFiles() {
  const uploadsDir = './server/uploads'
  const users = fs.readdirSync(uploadsDir)
  
  for (const userId of users) {
    const userDir = path.join(uploadsDir, userId)
    if (!fs.statSync(userDir).isDirectory()) continue
    
    const files = fs.readdirSync(userDir)
    
    for (const file of files) {
      const filePath = path.join(userDir, file)
      const storagePath = `${userId}/${file}`
      
      const fileBuffer = fs.readFileSync(filePath)
      
      const { error } = await supabase.storage
        .from('documents')
        .upload(storagePath, fileBuffer, {
          contentType: getContentType(file),
          upsert: true
        })
      
      if (error) {
        console.error(`Error uploading ${storagePath}:`, error)
      } else {
        console.log(`Uploaded ${storagePath}`)
      }
    }
  }
}

function getContentType(filename) {
  const ext = path.extname(filename).toLowerCase()
  const types = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.pdf': 'application/pdf',
  }
  return types[ext] || 'application/octet-stream'
}

migrateFiles()
```

### 5. Verify Migration

1. **Check record counts**:
   ```sql
   SELECT 
     (SELECT COUNT(*) FROM users) as users_count,
     (SELECT COUNT(*) FROM applications) as applications_count,
     (SELECT COUNT(*) FROM quotations) as quotations_count;
   ```

2. **Test file access**:
   - Try viewing files in the application
   - Verify signed URLs work
   - Check file permissions

3. **Test functionality**:
   - Login with migrated users
   - View applications
   - Access documents

## Data Type Conversions

### SQLite to PostgreSQL

| SQLite | PostgreSQL | Notes |
|--------|------------|-------|
| TEXT | TEXT | Same |
| INTEGER | INTEGER/BIGINT | Same |
| REAL | DECIMAL(10,2) | For money |
| DATETIME | TIMESTAMP WITH TIME ZONE | Convert format |
| BOOLEAN | BOOLEAN | 0/1 to true/false |

### Date Format Conversion

```sql
-- SQLite: '2024-01-15 10:30:00'
-- PostgreSQL: '2024-01-15 10:30:00+00'

-- Convert in migration:
UPDATE applications
SET created_at = created_at || '+00'
WHERE created_at NOT LIKE '%+%';
```

### UUID Conversion

If your SQLite uses TEXT IDs and Supabase uses UUIDs:

```sql
-- Generate new UUIDs
UPDATE applications
SET id = gen_random_uuid()
WHERE id NOT SIMILAR TO '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
```

## Important Notes

1. **User Authentication**: Users must be created through Supabase Auth. You cannot migrate passwords directly.

2. **File Paths**: Ensure file paths match Supabase Storage structure (`userId/filename`)

3. **Foreign Keys**: Make sure user IDs in related tables match Supabase Auth user IDs

4. **RLS Policies**: After migration, verify RLS policies allow proper access

5. **Backup**: Always backup your SQLite database before migration

## Troubleshooting

### Issue: Foreign Key Violations
- **Solution**: Import tables in order (users first, then applications, etc.)

### Issue: File Not Found
- **Solution**: Verify files are uploaded to Supabase Storage with correct paths

### Issue: Permission Denied
- **Solution**: Check RLS policies and user roles

### Issue: Date Format Errors
- **Solution**: Convert dates to ISO format: `YYYY-MM-DD HH:MM:SS+00`

## Post-Migration Checklist

- [ ] All users can log in (may need password reset)
- [ ] All applications are visible
- [ ] All files are accessible
- [ ] Quotations work correctly
- [ ] Payments function properly
- [ ] Admin functions work
- [ ] RLS policies are correct
- [ ] File uploads work
- [ ] File downloads work

## Need Help?

- Check Supabase logs in Dashboard
- Use `/test-supabase` page to verify connections
- Review RLS policies in Supabase Dashboard
- Check browser console for errors

