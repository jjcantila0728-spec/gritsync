# Quick Supabase Deployment

Since automatic deployment requires additional setup, here's the fastest way to deploy everything to Supabase:

## 🚀 Quick Deployment Steps

### 1. Deploy Database Schema (2 minutes)

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard/project/warfdcbvnapietbkpild/sql/new
   - Or: Dashboard > SQL Editor > New query

2. **Copy Schema**
   - Open `supabase/schema.sql` in your code editor
   - Select all (Ctrl+A) and copy (Ctrl+C)

3. **Paste and Run**
   - Paste into SQL Editor
   - Click "Run" button (or Ctrl+Enter)
   - Wait for "Success. No rows returned"

✅ **Done!** All tables, policies, triggers, and functions are now created.

### 2. Create Storage Bucket (30 seconds)

1. **Go to Storage**
   - Click "Storage" in left sidebar
   - Click "New bucket" button

2. **Configure**
   - **Name**: `documents`
   - **Public**: ❌ Unchecked (keep it Private)
   - Click "Create bucket"

✅ **Done!** Storage is ready. Policies are already set by the schema.

### 3. Create Admin User (1 minute)

1. **Start Your App**
   ```bash
   npm run dev
   ```

2. **Register**
   - Go to http://localhost:5173/register
   - Create an account
   - This creates a user in Supabase Auth

3. **Make Admin**
   - Go to: https://supabase.com/dashboard/project/warfdcbvnapietbkpild/auth/users
   - Find your email
   - Copy the **User UID** (the UUID)

4. **Update Role**
   - Go to SQL Editor
   - Run:
     ```sql
     UPDATE users SET role = 'admin' WHERE id = 'paste-your-uid-here';
     ```
   - Click "Run"

✅ **Done!** You're now an admin.

### 4. Test Everything (1 minute)

1. **Test Page**
   - Visit: http://localhost:5173/test-supabase
   - All tests should show ✅

2. **Test Login**
   - Log out and log back in
   - Should redirect to admin dashboard

✅ **Done!** Everything is working.

## ⚡ Total Time: ~5 minutes

That's it! Your Supabase setup is complete.

## 📋 Optional: Edge Functions (For Stripe)

If you need Stripe payments:

1. **Install Supabase CLI** (one-time)
   - Windows: Download from https://github.com/supabase/cli/releases
   - Or use: `scoop install supabase` (if you have Scoop)

2. **Login and Link**
   ```bash
   supabase login
   supabase link --project-ref warfdcbvnapietbkpild
   ```

3. **Deploy Functions**
   ```bash
   supabase functions deploy create-payment-intent
   supabase functions deploy stripe-webhook
   ```

4. **Set Secrets**
   ```bash
   supabase secrets set STRIPE_SECRET_KEY=sk_live_...
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-key
   ```

## ✅ Verification Checklist

After deployment, verify:

- [ ] All tables visible in Table Editor
- [ ] Storage bucket "documents" exists
- [ ] Can register/login
- [ ] Can upload files
- [ ] Test page shows all green
- [ ] Admin functions work

## 🎉 You're Done!

Your Supabase is fully set up and ready to use!

