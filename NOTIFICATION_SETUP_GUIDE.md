# 📧 Notification System Setup Guide

## ⚠️ Important: Two Different Types of Files

### 1. **SQL Migrations** (Run in SQL Editor)
- `supabase/migrations/create_notification_types_table.sql`
- `supabase/migrations/migrate_existing_notifications.sql`

### 2. **Edge Functions** (Deploy via CLI)
- `supabase/functions/send-birthday-greetings/index.ts` ← This is TypeScript, NOT SQL!

---

## 🚀 Setup Steps

### Step 1: Run SQL Migrations (5 minutes)

**Option A: Using Supabase Dashboard (Recommended)**

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Click **"New query"**
3. **First Migration:** Copy and paste the entire contents of:
   - `supabase/migrations/create_notification_types_table.sql`
   - Click **"Run"** (or press Ctrl+Enter)
4. **Second Migration:** Copy and paste the entire contents of:
   - `supabase/migrations/migrate_existing_notifications.sql`
   - Click **"Run"**

**Option B: Using Supabase CLI**

```powershell
# Push all migrations
supabase db push
```

**Verify:**
```sql
-- Run this in SQL Editor to verify
SELECT * FROM notification_types;
```

You should see all your notifications listed.

---

### Step 2: Deploy Edge Function (2 minutes)

**The `index.ts` file is a Deno Edge Function, NOT SQL!**

```powershell
# Deploy the birthday greetings function
supabase functions deploy send-birthday-greetings
```

**Verify:**
```powershell
# List all deployed functions
supabase functions list
```

You should see `send-birthday-greetings` in the list.

---

### Step 3: Set Up Cron Job (5 minutes)

**Option A: Using Supabase Dashboard**

1. Go to **Database** → **Cron Jobs**
2. Click **"Create Cron Job"**
3. Configure:
   - **Name:** `send-birthday-greetings`
   - **Schedule:** `0 9 * * *` (9:00 AM UTC daily)
   - **SQL Command:**
   ```sql
   SELECT
     net.http_post(
       url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-birthday-greetings',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
       ),
       body := '{}'::jsonb
     ) AS request_id;
   ```
   - Replace `YOUR_PROJECT_REF` with your actual project reference
   - Replace `YOUR_SERVICE_ROLE_KEY` with your service role key

**Option B: Using SQL Migration**

1. Edit `supabase/migrations/setup_birthday_greetings_cron.sql`
2. Replace placeholders with your actual values
3. Run in SQL Editor

---

## ✅ Verification Checklist

- [ ] SQL migrations run successfully
- [ ] `notification_types` table exists
- [ ] Notifications visible in frontend at `/admin/settings/notifications`
- [ ] Edge Function `send-birthday-greetings` deployed
- [ ] Cron job created and scheduled
- [ ] Email configuration set in admin settings

---

## 🐛 Common Errors

### Error: "syntax error at or near '{'"
**Cause:** Trying to run TypeScript file as SQL  
**Solution:** Deploy Edge Functions using `supabase functions deploy`, not SQL Editor

### Error: "relation notification_types does not exist"
**Cause:** Migration not run yet  
**Solution:** Run `create_notification_types_table.sql` first

### Error: "function send-birthday-greetings not found"
**Cause:** Edge Function not deployed  
**Solution:** Run `supabase functions deploy send-birthday-greetings`

---

## 📝 Summary

1. **SQL Migrations** → Run in SQL Editor or `supabase db push`
2. **Edge Functions** → Deploy using `supabase functions deploy`
3. **Cron Jobs** → Set up in Database → Cron Jobs or via SQL migration

**Never run TypeScript files (.ts) in the SQL Editor!**
