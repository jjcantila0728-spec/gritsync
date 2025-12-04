# 🚀 Deploy to Supabase NOW - Step by Step

Follow these steps to deploy everything to your Supabase project.

## Step 1: Deploy Database Schema ⚡ (2 minutes)

1. **Open SQL Editor**
   - Go to: https://supabase.com/dashboard/project/warfdcbvnapietbkpild/sql/new
   - Or: Dashboard → SQL Editor → New query

2. **Copy Schema File**
   - Open `supabase/schema.sql` in your editor
   - Select ALL (Ctrl+A) and Copy (Ctrl+C)

3. **Paste and Execute**
   - Paste into SQL Editor
   - Click **"Run"** button (or press Ctrl+Enter)
   - Wait for: **"Success. No rows returned"**

✅ **Schema deployed!** All tables, policies, triggers created.

---

## Step 2: Create Storage Bucket ⚡ (30 seconds)

1. **Go to Storage**
   - Click **"Storage"** in left sidebar
   - Click **"New bucket"** button

2. **Create Bucket**
   - **Name**: `documents`
   - **Public bucket**: ❌ **Unchecked** (must be Private)
   - Click **"Create bucket"**

✅ **Storage ready!** Policies are auto-created by schema.

---

## Step 3: Verify Setup ✅ (1 minute)

1. **Check Tables**
   - Go to **Table Editor**
   - You should see: users, applications, quotations, etc.

2. **Check Storage**
   - Go to **Storage**
   - You should see "documents" bucket

3. **Test in App**
   - Start app: `npm run dev`
   - Visit: http://localhost:5173/test-supabase
   - All tests should pass ✅

---

## Step 4: Create Admin User 👤 (1 minute)

1. **Register**
   - Go to: http://localhost:5173/register
   - Create an account

2. **Get User ID**
   - Go to: https://supabase.com/dashboard/project/warfdcbvnapietbkpild/auth/users
   - Find your email
   - **Copy the User UID** (UUID)

3. **Make Admin**
   - Go to **SQL Editor**
   - Run:
     ```sql
     UPDATE users SET role = 'admin' WHERE id = 'paste-your-uid-here';
     ```
   - Click **"Run"**

4. **Test Admin Access**
   - Log out and log back in
   - Should see admin dashboard

✅ **You're an admin!**

---

## 🎉 Done! Your Supabase is Live

Total time: **~5 minutes**

### What's Working Now:
- ✅ Database with all tables
- ✅ Storage for files
- ✅ Authentication
- ✅ Row Level Security
- ✅ All APIs functional

### Optional: Edge Functions (For Stripe)

If you need Stripe payments, deploy Edge Functions:

```bash
# Install Supabase CLI (Windows)
# Download from: https://github.com/supabase/cli/releases
# Or use: scoop install supabase

# Then:
supabase login
supabase link --project-ref warfdcbvnapietbkpild
supabase functions deploy create-payment-intent
supabase functions deploy stripe-webhook
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-key
```

---

## 📋 Quick Reference

**SQL Editor**: https://supabase.com/dashboard/project/warfdcbvnapietbkpild/sql/new

**Storage**: https://supabase.com/dashboard/project/warfdcbvnapietbkpild/storage/buckets

**Users**: https://supabase.com/dashboard/project/warfdcbvnapietbkpild/auth/users

**Test Page**: http://localhost:5173/test-supabase

---

## 🆘 Need Help?

- Schema errors? Check SQL Editor for error messages
- Storage issues? Verify bucket name is exactly "documents"
- Auth problems? Check user exists in Authentication > Users
- Test failures? Check browser console for errors

