# 🔧 Fix Registration Issues

If you can't register, follow these steps:

## Step 1: Check Environment Variables

1. **Check if .env file exists**
   - Look for `.env` in your project root
   - If it doesn't exist, create it

2. **Add Supabase credentials**
   ```env
   VITE_SUPABASE_URL=https://warfdcbvnapietbkpild.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

3. **Get your anon key**
   - Go to: https://supabase.com/dashboard/project/warfdcbvnapietbkpild/settings/api
   - Copy the **anon public** key
   - Paste it in `.env` file

4. **Restart dev server**
   ```bash
   # Stop the server (Ctrl+C)
   # Then restart:
   npm run dev
   ```

## Step 2: Test Connection

Run the connection test:

```bash
node test-supabase-connection.js
```

This will tell you:
- ✅ If environment variables are set
- ✅ If connection works
- ✅ If Auth service is accessible
- ✅ If Storage is accessible
- ✅ If registration endpoint works

## Step 3: Check Supabase Settings

1. **Disable Email Confirmation** (for testing)
   - Go to: Dashboard > Authentication > Settings
   - Find "Enable email confirmations"
   - Turn it **OFF** (for development)
   - Click "Save"

2. **Check Project Status**
   - Go to: Dashboard > Settings > General
   - Verify project is **Active**
   - Check if there are any warnings

## Step 4: Check Browser Console

1. **Open DevTools**
   - Press F12
   - Go to Console tab

2. **Try to register**
   - Fill in registration form
   - Click Register
   - Look for errors in console

3. **Common errors:**
   - `Missing Supabase environment variables` → Check .env file
   - `Failed to fetch` → Check network tab, verify URL
   - `Invalid API key` → Check anon key is correct
   - `Email already registered` → User exists, try login instead

## Step 5: Verify Database Setup

1. **Check if users table exists**
   - Go to: Dashboard > Table Editor
   - Look for `users` table
   - If missing, deploy schema.sql

2. **Check if trigger exists**
   - Go to: SQL Editor
   - Run:
     ```sql
     SELECT * FROM information_schema.triggers 
     WHERE trigger_name = 'on_auth_user_created';
     ```
   - Should return 1 row
   - If empty, run `QUICK_FIX_LOGIN.sql`

## Step 6: Manual Registration Test

Test registration directly in SQL Editor:

1. **Create user in auth.users** (via Supabase Auth API or Dashboard)
2. **Check if profile was created**
   ```sql
   SELECT * FROM users ORDER BY created_at DESC LIMIT 1;
   ```
3. **If profile missing, create it manually:**
   ```sql
   -- Get user ID from auth.users first
   SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 1;
   
   -- Then create profile (replace with actual ID)
   INSERT INTO users (id, email, role, created_at, updated_at)
   VALUES (
     'paste-user-id-here',
     'user@example.com',
     'client',
     NOW(),
     NOW()
   );
   ```

## Common Issues & Fixes

### Issue: "Missing Supabase environment variables"
**Fix:**
- Create `.env` file in project root
- Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Restart dev server

### Issue: "Failed to fetch" or Network Error
**Fix:**
- Check Supabase URL is correct
- Check internet connection
- Verify Supabase project is active
- Check browser network tab for CORS errors

### Issue: "Invalid API key"
**Fix:**
- Verify anon key is correct (not service role key)
- Copy from: Dashboard > Settings > API > anon public
- Make sure no extra spaces in .env file

### Issue: "Email already registered"
**Fix:**
- User exists in auth.users
- Try logging in instead
- Or delete user from Dashboard > Authentication > Users

### Issue: "User profile not created"
**Fix:**
- Run `QUICK_FIX_LOGIN.sql` to fix trigger
- Or manually create profile (see Step 6)

### Issue: "RLS policy violation"
**Fix:**
- Verify RLS policies are deployed
- Check `QUICK_FIX_LOGIN.sql` was run
- Ensure INSERT policy exists for users table

## Quick Diagnostic Commands

```bash
# Test connection
node test-supabase-connection.js

# Check environment variables
node -e "console.log(process.env.VITE_SUPABASE_URL)"
node -e "console.log(process.env.VITE_SUPABASE_ANON_KEY)"
```

## Still Not Working?

1. **Check Supabase Dashboard Logs**
   - Dashboard > Logs
   - Look for errors

2. **Check Browser Network Tab**
   - Open DevTools > Network
   - Try registering
   - Look for failed requests
   - Check request/response details

3. **Verify Schema is Deployed**
   - Run schema.sql in SQL Editor
   - Verify all tables exist

4. **Test with Simple Script**
   ```javascript
   import { createClient } from '@supabase/supabase-js'
   const supabase = createClient(
     'https://warfdcbvnapietbkpild.supabase.co',
     'your-anon-key'
   )
   const { data, error } = await supabase.auth.signUp({
     email: 'test@example.com',
     password: 'Test123!'
   })
   console.log(data, error)
   ```

## Success Indicators

✅ Connection test passes
✅ Can see users table in Table Editor
✅ Browser console shows no errors
✅ Registration form submits without errors
✅ User appears in Authentication > Users
✅ Profile created in users table

