# 🚀 Start Deployment - Serverless Migration

## Quick Start (Copy & Paste These Commands)

### Step 1: Verify Prerequisites (2 minutes)

```powershell
# Check Supabase CLI
supabase --version

# If not installed:
npm install -g supabase

# Login (if not already)
supabase login
```

### Step 2: Link Your Project (1 minute)

```powershell
# Get your project ref from: Supabase Dashboard → Settings → General
# Replace YOUR_PROJECT_REF with your actual project ref
supabase link --project-ref YOUR_PROJECT_REF
```

### Step 3: Deploy Edge Function (2 minutes)

```powershell
# Deploy the new admin-login-as function
supabase functions deploy admin-login-as
```

### Step 4: Set Secrets (3 minutes)

```powershell
# Get these from Supabase Dashboard → Settings → API
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
supabase secrets set FRONTEND_URL=https://yourdomain.com

# If using Stripe (get from Stripe Dashboard)
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
```

### Step 5: Update .env File (1 minute)

Open `.env` and **remove** this line:
```env
VITE_API_URL=http://localhost:3001/api
```

### Step 6: Build Frontend (2 minutes)

```powershell
npm run build
```

### Step 7: Deploy Frontend (5 minutes)

Deploy the `dist/` folder to your hosting provider (Vercel, Netlify, etc.)

---

## ✅ Verification Checklist

After deployment, verify:

- [ ] Edge Function deployed: `supabase functions list`
- [ ] Secrets set: `supabase secrets list`
- [ ] Frontend builds: `npm run build` (no errors)
- [ ] Frontend deployed to hosting
- [ ] Test login/register
- [ ] Test dashboard
- [ ] Test admin login-as
- [ ] Test file uploads
- [ ] Test payments

---

## 🆘 Need Help?

- **Detailed Guide:** See `DEPLOYMENT_ACTION_PLAN.md`
- **Quick Reference:** See `QUICK_START_DEPLOYMENT.md`
- **Troubleshooting:** See troubleshooting sections in guides

---

## 🎯 You're Ready!

Start with Step 1 above and work through each step. The entire deployment should take about 15-20 minutes.
