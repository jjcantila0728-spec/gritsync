# Email Scheduling & Queue System - Implementation Summary

## ✅ Completed Components

### 1. Database Schema (`supabase/migrations/add-email-queue-table.sql`)
- ✅ `email_queue` table with full scheduling support
- ✅ Status tracking (pending, processing, sent, failed, cancelled)
- ✅ Retry logic with exponential backoff
- ✅ Priority levels (1-10)
- ✅ RLS policies for security
- ✅ Database functions:
  - `get_pending_emails_to_send()` - Get emails ready to send
  - `mark_email_processing()` - Mark as processing
  - `mark_email_sent()` - Mark as sent
  - `mark_email_failed()` - Handle failures with retry logic

### 2. Email Queue API (`src/lib/email-queue-api.ts`)
- ✅ `schedule()` - Schedule an email for future delivery
- ✅ `getAll()` - Get queued emails with filters
- ✅ `getById()` - Get single queued email
- ✅ `update()` - Update scheduled email
- ✅ `cancel()` - Cancel scheduled email
- ✅ `getPendingToSend()` - Get emails ready to send (worker)
- ✅ `markProcessing()` - Mark as processing (worker)
- ✅ `markSent()` - Mark as sent (worker)
- ✅ `markFailed()` - Mark as failed with retry (worker)
- ✅ `getStats()` - Get queue statistics
- ✅ `delete()` - Delete queued email

### 3. Edge Function (`supabase/functions/process-email-queue/index.ts`)
- ✅ Processes pending emails from queue
- ✅ Marks emails as processing
- ✅ Sends emails via send-email function
- ✅ Handles success/failure
- ✅ Implements retry logic
- ✅ Returns processing results

## 🚧 In Progress

### 4. UI Components (To Be Added)
- [ ] Add "Schedule" button to compose modal
- [ ] Add date/time picker for scheduling
- [ ] Create "Scheduled" tab in AdminEmails
- [ ] Display scheduled emails list
- [ ] Allow editing/cancelling scheduled emails
- [ ] Show queue statistics

### 5. Cron Job Setup (To Be Added)
- [ ] Create cron job to call process-email-queue function
- [ ] Configure schedule (e.g., every 5 minutes)
- [ ] Add to Supabase cron jobs

## 📋 Usage Examples

### Schedule an Email

```typescript
import { emailQueueAPI } from '@/lib/email-queue-api'

// Schedule email for tomorrow at 9 AM
const scheduledDate = new Date()
scheduledDate.setDate(scheduledDate.getDate() + 1)
scheduledDate.setHours(9, 0, 0, 0)

await emailQueueAPI.schedule({
  recipient_email: 'user@example.com',
  recipient_name: 'John Doe',
  subject: 'Scheduled Email',
  body_html: '<h1>Hello!</h1>',
  scheduled_for: scheduledDate.toISOString(),
  email_type: 'notification',
  priority: 5
})
```

### Get Scheduled Emails

```typescript
// Get all pending emails
const pending = await emailQueueAPI.getAll({ status: 'pending' })

// Get emails scheduled for today
const today = new Date()
today.setHours(0, 0, 0, 0)
const tomorrow = new Date(today)
tomorrow.setDate(tomorrow.getDate() + 1)

const todayEmails = await emailQueueAPI.getAll({
  scheduled_from: today.toISOString(),
  scheduled_to: tomorrow.toISOString()
})
```

### Cancel Scheduled Email

```typescript
await emailQueueAPI.cancel(queueId)
```

## 🔧 Setup Instructions

### 1. Run Database Migration

```sql
-- Run in Supabase SQL Editor
\i supabase/migrations/add-email-queue-table.sql
```

### 2. Deploy Edge Function

```bash
supabase functions deploy process-email-queue
```

### 3. Set Up Cron Job

Add to Supabase cron jobs (via Dashboard or SQL):

```sql
-- Run every 5 minutes
SELECT cron.schedule(
  'process-email-queue',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT
    net.http_post(
      url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-email-queue',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);
```

## 📊 Queue Statistics

The system tracks:
- Total queued emails
- Pending emails
- Processing emails
- Sent emails
- Failed emails
- Cancelled emails
- Scheduled for today
- Scheduled for this week

## 🔄 Retry Logic

Failed emails are automatically retried with exponential backoff:
- 1st retry: 1 minute later
- 2nd retry: 5 minutes later
- 3rd retry: 15 minutes later
- 4th+ retry: 1 hour later

After max retries (default: 3), email is marked as permanently failed.

## 🎯 Next Steps

1. **Add UI Components** - Schedule button and scheduled emails tab
2. **Set Up Cron Job** - Automatically process queue
3. **Add Analytics** - Track scheduling metrics
4. **Add Bulk Scheduling** - Schedule multiple emails
5. **Add Recurring Emails** - Schedule repeating emails

## 📝 Notes

- Emails are processed in priority order (1 = highest, 10 = lowest)
- Uses `FOR UPDATE SKIP LOCKED` to prevent duplicate processing
- Failed emails can be manually retried
- Scheduled emails can be edited before they're sent
- All scheduled emails are logged in email_logs when sent



