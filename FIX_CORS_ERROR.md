# Fix CORS Error for localhost:5000

## Problem
You're seeing this error:
```
Access to fetch at 'https://warfdcbvnapietbkpild.supabase.co/rest/v1/settings?select=*' 
from origin 'http://localhost:5000' has been blocked by CORS policy: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## Solution

The Supabase project needs to allow `http://localhost:5000` as an allowed origin.

### Steps to Fix:

1. **Go to your Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard
   - Select your project

2. **Open API Settings**
   - Go to: **Settings** → **API**
   - Scroll down to **"Allowed Origins"** or **"CORS Settings"**

3. **Add localhost:5000**
   - Click **"Add Origin"** or the **+** button
   - Enter: `http://localhost:5000`
   - Save the changes

4. **Restart your dev server**
   - Stop your Vite dev server (Ctrl+C)
   - Run `npm run dev` again

5. **Refresh your browser**
   - Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

## Alternative: Use a different port

If you can't modify Supabase settings, you can change the dev server port:

1. Update `vite.config.ts`:
   ```typescript
   server: {
     port: 3000, // Change from 5000 to 3000
     // ... rest of config
   }
   ```

2. Update any hardcoded references to `localhost:5000` in your code

## What Changed in the Code

I've improved error handling to:
- Show helpful error messages when CORS errors occur
- Provide instructions in the console
- Better error handling in `settings.ts` and `supabase.ts`

The code will now display helpful messages in the console when CORS errors are detected, guiding you to fix the issue in the Supabase dashboard.







