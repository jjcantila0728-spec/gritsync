# 🎉 Birthday Greetings - Setup Guide

## ✅ Implementation Complete

Automatic birthday greetings have been implemented! The system will automatically send birthday emails to clients whose birthday is today.

---

## 📋 What's Been Created

1. **Edge Function:** `supabase/functions/send-birthday-greetings/index.ts`
   - Queries users with birthdays today
   - Sends personalized birthday greeting emails
   - Uses time-based greetings from admin settings

2. **Cron Job Migration:** `supabase/migrations/setup_birthday_greetings_cron.sql`
   - Sets up daily scheduled execution
   - Runs at 9:00 AM UTC daily

3. **Documentation:** `supabase/functions/send-birthday-greetings/README.md`

---

## 🚀 Setup Instructions

### Step 1: Deploy the Edge Function

```bash
supabase functions deploy send-birthday-greetings
```

### Step 2: Set Up Cron Job

**Option A: Using Supabase Dashboard (Recommended)**

1. Go to your Supabase Dashboard
2. Navigate to **Database** → **Cron Jobs**
3. Click **Create Cron Job**
4. Configure:
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
3. Run the migration:
   ```bash
   supabase db push
   ```

### Step 3: Configure Email Settings

1. Go to `http://localhost:3000/admin/settings/notifications`
2. Configure:
   - Resend API key
   - From email and name
   - (Optional) Custom greeting messages

### Step 4: Ensure Users Have Birthdays

Users need to have `date_of_birth` set in the `user_details` table:
- Format: `YYYY-MM-DD` (e.g., `1990-05-15`)
- Can be set via user profile or application form

---

## 🧪 Testing

### Manual Test

You can manually trigger the function to test:

```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-birthday-greetings \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

Or use Supabase Dashboard:
1. Go to **Edge Functions** → **send-birthday-greetings**
2. Click **Invoke**
3. Check the response

### Test with Today's Birthday

1. Create a test user with today's date as birthday
2. Set `date_of_birth` in `user_details` table to today (format: `YYYY-MM-DD`)
3. Ensure user role is `client`
4. Manually trigger the function
5. Check email inbox

---

## 📧 How It Works

1. **Daily Execution:** Cron job runs at 9:00 AM UTC
2. **Query Users:** Finds users with birthdays today (MM-DD match)
3. **Filter Clients:** Only sends to users with role = 'client'
4. **Get Greeting:** Uses time-based greeting from settings (if enabled)
5. **Send Emails:** Sends personalized birthday greeting to each client

### Birthday Matching Logic

- Compares `MM-DD` part of `date_of_birth` with today's date
- Ignores the year (so it works every year)
- Example: If `date_of_birth = '1990-05-15'` and today is May 15, email will be sent

### Greeting Selection

- If custom greetings enabled: Uses time-based greeting (morning/afternoon/evening)
- If custom greetings disabled: Uses "Happy Birthday!"
- Greetings are configured in admin notification settings

---

## 📝 Requirements

- ✅ Edge Function deployed
- ✅ Cron job configured
- ✅ Email service configured (Resend API key)
- ✅ Users have `date_of_birth` in `user_details` table
- ✅ Users have role = 'client'

---

## 🔍 Monitoring

### Check Cron Job Status

```sql
SELECT * FROM cron.job WHERE jobname = 'send-birthday-greetings';
```

### Check Function Logs

```bash
supabase functions logs send-birthday-greetings
```

### View Recent Executions

Check Supabase Dashboard → Edge Functions → send-birthday-greetings → Logs

---

## 🐛 Troubleshooting

### No Emails Sent

1. **Check email configuration:**
   - Verify Resend API key is set
   - Test email sending manually

2. **Check user data:**
   - Ensure users have `date_of_birth` set
   - Verify date format is `YYYY-MM-DD`
   - Check user role is `client`

3. **Check function logs:**
   ```bash
   supabase functions logs send-birthday-greetings
   ```

### Cron Job Not Running

1. **Verify cron job exists:**
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'send-birthday-greetings';
   ```

2. **Check pg_cron extension:**
   ```sql
   CREATE EXTENSION IF NOT EXISTS pg_cron;
   ```

3. **Verify schedule:**
   - Should be `0 9 * * *` (9 AM UTC daily)
   - Adjust timezone if needed

### Function Errors

1. Check function logs for errors
2. Verify service role key is correct
3. Ensure function is deployed
4. Check network connectivity

---

## ⚙️ Customization

### Change Schedule

Edit the cron schedule in the migration file:
- `0 9 * * *` = 9:00 AM UTC daily
- `0 0 * * *` = Midnight UTC daily
- `0 9 * * 1` = 9:00 AM UTC every Monday

### Change Greeting Time

Edit the `getTimeBasedGreeting` function in the Edge Function to adjust time ranges:
- Morning: before 12:00 PM
- Afternoon: 12:00 PM - 6:00 PM
- Evening: after 6:00 PM

### Customize Email Template

Edit the `generateBirthdayEmail` function in the Edge Function to customize the email design.

---

## ✅ Verification Checklist

- [ ] Edge Function deployed
- [ ] Cron job created and scheduled
- [ ] Email service configured (Resend API key)
- [ ] Test user created with today's birthday
- [ ] Manual test successful
- [ ] Email received in inbox
- [ ] Cron job running (check after scheduled time)

---

## 🎉 Summary

✅ **Birthday greetings are now automated!**

- Function created and ready to deploy
- Cron job migration ready
- Sends personalized birthday emails daily
- Uses admin-configured greetings
- Only sends to clients (not admins)

**Next Steps:**
1. Deploy the function
2. Set up the cron job
3. Test with a user who has today's birthday
4. Monitor logs to ensure it's working

---

**Status:** 🟢 **READY TO DEPLOY**
