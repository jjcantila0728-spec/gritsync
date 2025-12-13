# 🚨 SETUP REQUIRED: EAD Payment Service

## Current Issue

You're seeing this error on the payments page:
```
EAD payment service not configured. Please contact support.
```

This is because the EAD service configuration hasn't been created in the database yet.

## ✅ Solution (Takes 2 Minutes)

### Step 1: Open Supabase Dashboard

1. Go to https://supabase.com/dashboard
2. Login to your account
3. Select your **GritSync** project

### Step 2: Open SQL Editor

1. Click **"SQL Editor"** in the left sidebar (icon looks like `</>`)
2. Click **"New Query"** button

### Step 3: Run the Setup Script

1. Open the file: **`RUN_THIS_IN_SUPABASE.sql`**
2. Copy ALL the contents
3. Paste into the Supabase SQL Editor
4. Click **"Run"** button (or press Cmd/Ctrl + Enter)

### Step 4: Verify Success

You should see a result table showing:
```
id: svc_ead_ny_full
service_name: EAD Processing
state: New York
payment_type: full
total_full: 663.00
```

If you see this, **you're done!** ✅

### Step 5: Refresh the Page

1. Go back to: http://localhost:5000/applications/AP9B83G6Y8HQNH/payments
2. Refresh the page (F5 or Cmd+R)
3. The error should be gone and you'll see the payment details!

---

## 📊 What This Does

This SQL script creates a service configuration in your database that tells the application:

- **Service Name**: EAD Processing
- **State**: New York
- **Payment Type**: Full Payment (one-time payment)
- **Line Items**:
  1. USCIS Form I-765 Filing Fee: $410
  2. Biometric Services Fee: $85
  3. GritSync Service Fee: $150 (taxable, +$18 tax)
- **Total**: $663

The application uses this configuration to:
- Display correct payment amounts
- Show line item breakdown
- Calculate taxes automatically
- Process payments via Stripe or mobile banking

---

## 🎯 Quick Visual Guide

```
You are here:
┌─────────────────────────────────────────────┐
│ ERROR: Service not configured               │
│ ❌ http://localhost:5000/applications/      │
│    AP9B83G6Y8HQNH/payments                  │
└─────────────────────────────────────────────┘
                   │
                   ▼
         ┌─────────────────────┐
         │ Run SQL Script      │
         │ in Supabase        │
         └─────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│ ✅ Service Created in Database              │
│ • EAD Processing - New York - Full: $663   │
└─────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│ ✅ Page Works!                              │
│ Shows payment details with line items      │
│ User can pay via card or mobile banking    │
└─────────────────────────────────────────────┘
```

---

## 🆘 Troubleshooting

### Can't find Supabase SQL Editor?
- Look in the left sidebar for an icon that looks like `</>`
- It's usually between "Database" and "Storage"

### SQL script fails?
- Make sure you copied the ENTIRE contents of `RUN_THIS_IN_SUPABASE.sql`
- Check that you're in the correct project (GritSync)
- Try running the script again

### Still seeing the error after running script?
1. Verify the service was created:
   - Go to Supabase SQL Editor
   - Run: `SELECT * FROM services WHERE service_name = 'EAD Processing';`
   - You should see 1 row
2. Hard refresh the page: Ctrl+Shift+R (or Cmd+Shift+R on Mac)
3. Clear browser cache and reload

---

## 📝 Files You Need

1. **`RUN_THIS_IN_SUPABASE.sql`** ← Run this in Supabase SQL Editor
2. **`setup_ead_service.sql`** (same content, different name)

Both files contain the same SQL script. Use whichever is easier for you!

---

## ✨ After Setup

Once the service is configured, you can:
- View it in Admin Settings → Services
- Edit the pricing if needed
- Add more services for different states
- The system will automatically use it for all EAD applications

---

**Need Help?** Check the console for errors or contact support with:
- The error message you're seeing
- Screenshot of the Supabase query result
- Your Supabase project ID

