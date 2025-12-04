# 🚀 Push Everything to Supabase - Complete Guide

This guide will help you deploy all changes to your Supabase project.

## ⚡ Fastest Method (Recommended)

### Step 1: Deploy Database Schema (2 minutes)

1. **Open Supabase SQL Editor**
   ```
   https://supabase.com/dashboard/project/warfdcbvnapietbkpild/sql/new
   ```

2. **Copy Schema**
   - Open file: `supabase/schema.sql`
   - Select ALL (Ctrl+A)
   - Copy (Ctrl+C)

3. **Paste and Run**
   - Paste into SQL Editor
   - Click **"Run"** button
   - Wait for success message

✅ **Done!** All tables, policies, triggers, and functions are created.

---

### Step 2: Create Storage Bucket

**Option A: Automatic (if you have service role key)**
```bash
# Add to .env:
# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

node deploy-storage.js
```

**Option B: Manual (Recommended)**
1. Go to: https://supabase.com/dashboard/project/warfdcbvnapietbkpild/storage/buckets
2. Click **"New bucket"**
3. Name: `documents`
4. Public: ❌ **Unchecked** (Private)
5. Click **"Create bucket"**

✅ **Done!** Storage is ready.

---

### Step 3: Create Admin User

1. **Register in App**
   - Start: `npm run dev`
   - Go to: http://localhost:5173/register
   - Create account

2. **Make Admin**
   - Go to: https://supabase.com/dashboard/project/warfdcbvnapietbkpild/auth/users
   - Find your email, copy **User UID**
   - Go to SQL Editor, run:
     ```sql
     UPDATE users SET role = 'admin' WHERE id = 'your-uid-here';
     ```

✅ **Done!** You're an admin.

---

### Step 4: Test Everything

Visit: http://localhost:5173/test-supabase

All tests should show ✅

---

## 📋 What Gets Deployed

### Database Schema (`supabase/schema.sql`)
- ✅ All tables (users, applications, quotations, etc.)
- ✅ Row Level Security (RLS) policies
- ✅ Storage policies
- ✅ Triggers and functions
- ✅ Indexes for performance

### Storage
- ✅ `documents` bucket (private)
- ✅ Storage policies for file access

### Edge Functions (Optional)
- ✅ `create-payment-intent` (for Stripe)
- ✅ `stripe-webhook` (for payment processing)

---

## 🔧 Alternative: Use Supabase CLI

If you prefer CLI deployment:

1. **Install Supabase CLI**
   - Windows: Download from https://github.com/supabase/cli/releases
   - Extract and add to PATH

2. **Login and Link**
   ```bash
   supabase login
   supabase link --project-ref warfdcbvnapietbkpild
   ```

3. **Deploy Schema**
   ```bash
   # Copy schema.sql content and run in SQL Editor
   # Or use: supabase db push (if you have migrations set up)
   ```

4. **Deploy Functions**
   ```bash
   supabase functions deploy create-payment-intent
   supabase functions deploy stripe-webhook
   ```

---

## ✅ Verification

After deployment, check:

- [ ] Tables visible in Table Editor
- [ ] Storage bucket exists
- [ ] Can register/login
- [ ] Test page shows all green
- [ ] File uploads work
- [ ] Admin functions work

---

## 🎯 Quick Links

- **SQL Editor**: https://supabase.com/dashboard/project/warfdcbvnapietbkpild/sql/new
- **Storage**: https://supabase.com/dashboard/project/warfdcbvnapietbkpild/storage/buckets
- **Users**: https://supabase.com/dashboard/project/warfdcbvnapietbkpild/auth/users
- **Test Page**: http://localhost:5173/test-supabase

---

## ⚠️ Important Notes

1. **Schema must be deployed via Dashboard** - This is the most reliable method
2. **Storage bucket must be Private** - Security requirement
3. **Service role key is sensitive** - Never commit to git
4. **Users must be created through Auth** - Can't migrate passwords directly

---

## 🆘 Troubleshooting

**Schema errors?**
- Check SQL Editor error messages
- Some "already exists" errors are normal
- Verify each statement executed

**Storage issues?**
- Verify bucket name is exactly "documents"
- Check it's set to Private
- Policies are auto-created by schema

**Auth problems?**
- Verify user exists in Authentication > Users
- Check user role in users table
- Try logging out and back in

---

## 🎉 You're Done!

Your Supabase is fully deployed and ready to use!

For detailed instructions, see:
- `DEPLOY_NOW.md` - Step-by-step guide
- `quick-deploy-supabase.md` - Quick reference
- `FINAL_SUPABASE_SETUP.md` - Complete setup guide

