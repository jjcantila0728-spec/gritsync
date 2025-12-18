# Fix: OPENAI_API_KEY Not Configured Error

## ❌ Current Issue

You're getting this error:
```
Error: AI-powered PDF filling failed: OPENAI_API_KEY not configured
```

## 🔍 Why This Happens

The OpenAI API key in your local `.env` file is **NOT available** to Supabase Edge Functions. Edge functions run on Supabase's servers, not locally, so they need the key to be set as a **Supabase Secret**.

## ✅ Solution

You need to set the OpenAI API key as a Supabase Secret (not in .env file).

---

## 🚀 Quick Fix

### Option 1: Using Supabase Dashboard (Easiest)

1. **Go to your Supabase Dashboard**: https://supabase.com/dashboard
2. **Select your project**: `warfdcbvnapietbkpild`
3. **Go to**: Project Settings → Edge Functions → Secrets
4. **Click**: "Add new secret"
5. **Enter**:
   - Name: `OPENAI_API_KEY`
   - Value: Your OpenAI API key (from your .env file, starts with `sk-...`)
6. **Click**: "Save"

### Option 2: Using Supabase CLI

**If Supabase CLI is installed:**

```powershell
# Set the secret (replace with your actual key)
supabase secrets set OPENAI_API_KEY=sk-your-actual-openai-key-here
```

**If Supabase CLI is NOT installed:**

1. **Install Supabase CLI**:
   ```powershell
   npm install -g supabase
   ```

2. **Login to Supabase**:
   ```powershell
   supabase login
   ```

3. **Link to your project**:
   ```powershell
   supabase link --project-ref warfdcbvnapietbkpild
   ```

4. **Set the secret**:
   ```powershell
   supabase secrets set OPENAI_API_KEY=sk-your-actual-key
   ```

### Option 3: Using PowerShell Script (Interactive)

```powershell
# Run this script
.\set-openai-key.ps1
```

This will prompt you for your API key and set it securely.

---

## 📝 Where to Find Your OpenAI API Key

1. **Check your .env file** (in the root of E:\GRITSYNC)
2. **Or get it from OpenAI**:
   - Go to: https://platform.openai.com/api-keys
   - Copy your existing key OR create a new one
   - It starts with `sk-...`

---

## 🔄 After Setting the Secret

### Step 1: Deploy the Function

```powershell
supabase functions deploy fill-pdf-form-ai
```

### Step 2: Test It

1. Go to: `http://localhost:5000/applications/AP9B83G6Y8HQNH/timeline`
2. Click **"Generate G-1145"** button
3. Wait 3-8 seconds
4. PDF should download successfully!

---

## 🔍 Verify It's Set Correctly

### Check if secret is set:

```powershell
supabase secrets list
```

You should see:
```
OPENAI_API_KEY
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

### Check function logs:

```powershell
supabase functions logs fill-pdf-form-ai --tail
```

---

## 🆘 Still Having Issues?

### Error: "supabase command not found"

**Solution**: Install Supabase CLI
```powershell
npm install -g supabase
```

### Error: "Not logged in"

**Solution**: Login to Supabase
```powershell
supabase login
```

### Error: "Project not linked"

**Solution**: Link to your project
```powershell
supabase link --project-ref warfdcbvnapietbkpild
```

### Error: "Invalid API key"

**Solution**: Check your OpenAI API key
1. Go to: https://platform.openai.com/api-keys
2. Verify the key is active
3. Check you have credits available

---

## 📊 Complete Setup Checklist

- [ ] OpenAI API key obtained
- [ ] Supabase CLI installed (optional - can use dashboard)
- [ ] Secret set via dashboard OR CLI
- [ ] Function deployed: `supabase functions deploy fill-pdf-form-ai`
- [ ] Tested by clicking "Generate G-1145" button
- [ ] PDF downloads successfully

---

## 💡 Pro Tip

**Use the Supabase Dashboard method** (Option 1) if you're not comfortable with CLI - it's the easiest and most reliable way!

---

## 🎯 Expected Result

After setting the secret and deploying:

1. ✅ Click "Generate G-1145" → PDF downloads in 3-8 seconds
2. ✅ Click "Generate I-765" → PDF downloads with filled fields
3. ✅ Filenames: `Form G-1145 - ClientName - Date.pdf`
4. ✅ Forms saved to "Additional Documents"
5. ✅ Timeline steps mark as completed

---

**Next Step**: Choose Option 1 (Dashboard) or Option 2 (CLI) above and set your OpenAI API key! 🚀

