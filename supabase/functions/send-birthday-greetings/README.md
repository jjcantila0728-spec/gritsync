# Send Birthday Greetings Edge Function

This Edge Function automatically sends birthday greeting emails to clients whose birthday is today.

## Setup

### 1. Deploy the Function

```bash
supabase functions deploy send-birthday-greetings
```

### 2. Set Up Cron Job

Add this to your Supabase project's cron jobs (via Supabase Dashboard or SQL):

```sql
-- Run daily at 9:00 AM UTC
SELECT cron.schedule(
  'send-birthday-greetings',
  '0 9 * * *', -- 9 AM UTC daily
  $$
  SELECT
    net.http_post(
      url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-birthday-greetings',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);
```

Or use Supabase Dashboard:
1. Go to Database → Cron Jobs
2. Create new cron job
3. Schedule: `0 9 * * *` (9 AM UTC daily)
4. SQL Command: See above

### 3. Configure Email Settings

Make sure email settings are configured in admin notification settings:
- Resend API key
- From email and name
- Greeting messages (optional)

## How It Works

1. Function runs daily (via cron)
2. Queries `user_details` table for users with birthdays today
3. Filters to only clients (not admins)
4. Gets greeting message from settings (time-based if custom greetings enabled)
5. Sends birthday email to each client

## Manual Testing

You can manually trigger the function:

```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-birthday-greetings \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

## Requirements

- Users must have `date_of_birth` set in `user_details` table
- Format: `YYYY-MM-DD`
- Email must be configured (Resend API key)
- Users must have role = 'client'
