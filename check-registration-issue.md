# 🔍 Registration Issue Checklist

Your `.env` file exists and has credentials. Let's diagnose the registration issue:

## Quick Checks

### 1. Restart Dev Server
After creating/updating `.env`, you MUST restart:
```bash
# Stop server (Ctrl+C)
npm run dev
```

### 2. Check Browser Console
- Open DevTools (F12)
- Go to Console tab
- Try registering
- Look for errors

### 3. Check Network Tab
- Open DevTools > Network
- Try registering
- Look for failed requests to Supabase
- Check the request URL and response

### 4. Test Connection
```bash
npm run test:supabase
```

## Common Registration Errors

### Error: "Missing Supabase environment variables"
**Cause:** Dev server not restarted after creating .env
**Fix:** Restart dev server

### Error: "Failed to fetch" or Network Error
**Cause:** 
- Supabase URL incorrect
- CORS issue
- Network connectivity
**Fix:**
- Verify URL: `https://warfdcbvnapietbkpild.supabase.co`
- Check browser network tab
- Try in incognito mode

### Error: "Invalid API key"
**Cause:** Wrong anon key
**Fix:**
- Get key from: Dashboard > Settings > API > anon public
- Make sure it's the full key (starts with `eyJ...`)

### Error: "Email already registered"
**Cause:** User exists
**Fix:**
- Try logging in instead
- Or delete user from Dashboard > Authentication > Users

### Error: "User profile not created"
**Cause:** Trigger not working
**Fix:**
- Run `QUICK_FIX_LOGIN.sql` in SQL Editor

### Error: "RLS policy violation"
**Cause:** Missing INSERT policy
**Fix:**
- Run `QUICK_FIX_LOGIN.sql` in SQL Editor

## Step-by-Step Debug

1. **Run connection test:**
   ```bash
   npm run test:supabase
   ```

2. **Check Supabase Dashboard:**
   - Go to: https://supabase.com/dashboard/project/warfdcbvnapietbkpild
   - Check Authentication > Users (see if any users exist)
   - Check Table Editor > users (see if profiles exist)

3. **Check Email Confirmation:**
   - Dashboard > Authentication > Settings
   - Turn OFF "Enable email confirmations" (for testing)
   - Save

4. **Try registration in browser:**
   - Open: http://localhost:5173/register
   - Fill form
   - Watch browser console (F12)
   - Check Network tab for requests

5. **Check what happens:**
   - Does form submit?
   - Any errors in console?
   - Any network errors?
   - Does user appear in Supabase Dashboard?

## Manual Test

Test registration directly:

1. **Open browser console** (F12)
2. **Paste this:**
   ```javascript
   const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm')
   const supabase = createClient(
     'https://warfdcbvnapietbkpild.supabase.co',
     'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhcmZkY2J2bmFwaWV0YmtwaWxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwODMzNzEsImV4cCI6MjA3OTY1OTM3MX0.aoDKJXq7NIppYn2szlanf4PsekGsQMqRv-gYA_cX7KI'
   )
   const { data, error } = await supabase.auth.signUp({
     email: 'test@example.com',
     password: 'Test123!'
   })
   console.log('Result:', { data, error })
   ```
3. **Check result** - This will show if Supabase connection works

## Still Not Working?

Share:
1. Browser console errors
2. Network tab errors
3. Result of `npm run test:supabase`
4. What happens when you try to register

