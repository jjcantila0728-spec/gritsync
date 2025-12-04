# Manual Supabase Deployment Guide

Since automatic deployment requires Supabase CLI setup, here's how to deploy everything manually through the Supabase Dashboard.

## Step 1: Deploy Database Schema

1. **Go to Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard/project/warfdcbvnapietbkpild
   - Or go to your project dashboard

2. **Open SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New query"

3. **Deploy Schema**
   - Open the file `supabase/schema.sql` in your project
   - Copy the entire contents
   - Paste into the SQL Editor
   - Click "Run" or press Ctrl+Enter
   - Wait for execution to complete
   - You should see "Success. No rows returned"

4. **Verify Tables Created**
   - Go to "Table Editor" in the left sidebar
   - You should see all tables:
     - users
     - applications
     - quotations
     - user_details
     - user_documents
     - application_payments
     - receipts
     - processing_accounts
     - application_timeline_steps
     - notifications
     - settings
     - services
     - password_reset_tokens

## Step 2: Create Storage Bucket

1. **Go to Storage**
   - Click "Storage" in the left sidebar
   - Click "New bucket"

2. **Configure Bucket**
   - **Name**: `documents`
   - **Public bucket**: ❌ Unchecked (Private)
   - **File size limit**: 50 MB (or your preference)
   - **Allowed MIME types**: (optional, can leave empty)
   - Click "Create bucket"

3. **Verify Storage Policies**
   - The schema.sql already includes storage policies
   - They should be automatically created
   - Go to Storage > Policies to verify

## Step 3: Verify RLS Policies

1. **Check Row Level Security**
   - Go to "Table Editor"
   - Click on any table (e.g., "users")
   - Click "Policies" tab
   - You should see policies listed
   - All tables should have RLS enabled

## Step 4: Test Database Connection

1. **Test Query**
   - Go to SQL Editor
   - Run: `SELECT COUNT(*) FROM users;`
   - Should return 0 (no users yet)

2. **Test Storage**
   - Go to Storage > documents
   - Try uploading a test file
   - Should work if policies are correct

## Step 5: Create First Admin User

1. **Sign Up Through App**
   - Start your app: `npm run dev`
   - Go to `/register`
   - Create an account
   - This will create a user in Supabase Auth

2. **Make User Admin**
   - Go to Supabase Dashboard > Authentication > Users
   - Find your user email
   - Copy the User UID

3. **Update Role**
   - Go to SQL Editor
   - Run:
     ```sql
     UPDATE users 
     SET role = 'admin' 
     WHERE id = 'paste-your-user-uid-here';
     ```
   - Click "Run"

4. **Verify**
   - Log out and log back in
   - You should now have admin access

## Step 6: Deploy Edge Functions (Optional - For Stripe)

### Install Supabase CLI

```bash
npm install -g supabase
```

### Login and Link

```bash
supabase login
supabase link --project-ref warfdcbvnapietbkpild
```

### Deploy Functions

```bash
supabase functions deploy create-payment-intent
supabase functions deploy stripe-webhook
```

### Set Secrets

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_your_key
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_your_secret
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Step 7: Test Everything

1. **Test Page**
   - Visit: `http://localhost:5173/test-supabase`
   - All tests should pass

2. **Test Authentication**
   - Register new user
   - Login
   - Password reset

3. **Test File Upload**
   - Go to Documents page
   - Upload a file
   - Verify it appears

4. **Test Application**
   - Create new application
   - Upload files
   - Submit application

## Troubleshooting

### Schema Errors

**Error**: "relation already exists"
- **Solution**: This is normal if you've run the schema before. The `IF NOT EXISTS` clauses handle this.

**Error**: "permission denied"
- **Solution**: Make sure you're using the SQL Editor (has admin privileges)

### Storage Errors

**Error**: "Bucket already exists"
- **Solution**: That's fine, the bucket is already created

**Error**: "Policy creation failed"
- **Solution**: Check that the bucket name is exactly "documents"
- Policies are in the schema.sql - they should auto-create

### RLS Errors

**Error**: "new row violates row-level security policy"
- **Solution**: Check that:
  1. User is authenticated
  2. RLS policies are correct
  3. User role is set correctly

## Quick Verification Queries

Run these in SQL Editor to verify setup:

```sql
-- Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- Check storage bucket
SELECT name, public 
FROM storage.buckets;

-- Check storage policies
SELECT * FROM pg_policies 
WHERE schemaname = 'storage';
```

## Success Indicators

✅ All tables visible in Table Editor
✅ Storage bucket "documents" exists and is private
✅ RLS enabled on all tables
✅ Policies visible in each table's Policies tab
✅ Can create user through app
✅ Can upload files
✅ Test page shows all green

## Need Help?

- Check Supabase Dashboard logs
- Use `/test-supabase` page
- Review error messages in browser console
- Check Supabase documentation: https://supabase.com/docs

