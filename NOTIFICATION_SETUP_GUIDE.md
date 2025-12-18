# Quick Setup Guide: Smart Notification System

## 🚀 Quick Start (5 minutes)

### Step 1: Deploy Database Changes
Run the SQL migration to add notification triggers and functions:

```bash
# Option A: Using Supabase CLI
supabase db push supabase/add-smart-notifications.sql

# Option B: Using Supabase Dashboard
# 1. Go to your Supabase project
# 2. Navigate to SQL Editor
# 3. Copy and paste contents from supabase/add-smart-notifications.sql
# 4. Click "Run"
```

### Step 2: Test the System
The notification system is now active! Test it:

1. **Log in as a user without uploaded documents**
   - Run: `SELECT generate_document_reminders();` in SQL editor
   - You should see a notification with a red badge

2. **Create an application with pending payment**
   - Wait 3 days OR manually update the payment's `created_at` date
   - Run: `SELECT generate_payment_reminders();`
   - Check for payment reminder notification

3. **Test real-time updates**
   - Update any timeline step to "completed"
   - Notification should appear immediately (no refresh needed)

### Step 3: Set Up Automated Reminders (Optional)

#### Using Supabase pg_cron (Recommended)

```sql
-- Enable pg_cron (may require superuser access)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily reminder checks
SELECT cron.schedule('document-reminders', '0 9 * * *', 'SELECT generate_document_reminders()');
SELECT cron.schedule('profile-reminders', '0 10 * * *', 'SELECT generate_profile_completion_reminders()');
SELECT cron.schedule('payment-reminders', '0 14 * * *', 'SELECT generate_payment_reminders()');
SELECT cron.schedule('credentialing-reminders', '0 11 * * *', 'SELECT notify_credentialing_reminder()');
```

#### Using External Cron Job

If you prefer external scheduling:

```bash
# Create a script: scripts/run-notifications.sh
#!/bin/bash
echo "Running notification reminders..."

# Use Supabase API or direct SQL connection
psql "$DATABASE_URL" -c "SELECT generate_document_reminders();"
psql "$DATABASE_URL" -c "SELECT generate_profile_completion_reminders();"
psql "$DATABASE_URL" -c "SELECT generate_payment_reminders();"
psql "$DATABASE_URL" -c "SELECT notify_credentialing_reminder();"

echo "Notification reminders completed"
```

```bash
# Make it executable
chmod +x scripts/run-notifications.sh

# Add to crontab (runs daily at 9 AM)
crontab -e
# Add this line:
0 9 * * * /path/to/scripts/run-notifications.sh >> /var/log/notifications.log 2>&1
```

## 🎨 UI Features

### Notification Bell
- **Red badge** with white number shows unread count
- **Animated pulse** to grab attention
- **99+** displayed for counts over 99

### Dropdown Menu
- **Click notification** to go to relevant page
- **Automatic read marking** when clicked
- **Mark all as read** button
- **Real-time updates** without refresh

### Notification Types & Colors
- 🔵 **Documents** - Blue file icon
- 🟢 **Payments** - Green credit card icon
- 🟣 **Timeline** - Purple clock icon
- 🟠 **Profile** - Orange user icon
- ⚫ **General** - Gray bell icon

## 📊 Monitoring & Maintenance

### Check Notification Status
```sql
-- See recent notifications
SELECT * FROM notifications 
ORDER BY created_at DESC 
LIMIT 20;

-- Check unread notifications per user
SELECT user_id, COUNT(*) as unread_count
FROM notifications
WHERE read = false
GROUP BY user_id;

-- Find users with missing documents
SELECT * FROM check_missing_documents('<user-id>');

-- Check if profile is incomplete
SELECT check_incomplete_profile('<user-id>');
```

### Manual Trigger (For Testing)
```sql
-- Generate all reminders immediately
SELECT generate_document_reminders();
SELECT generate_profile_completion_reminders();
SELECT generate_payment_reminders();
SELECT notify_credentialing_reminder();
```

### Clean Up Old Notifications (Optional)
```sql
-- Archive notifications older than 90 days
DELETE FROM notifications 
WHERE created_at < NOW() - INTERVAL '90 days' 
AND read = true;
```

## 🔧 Configuration

### Adjust Reminder Frequencies

Edit `supabase/add-smart-notifications.sql`:

```sql
-- Change document reminder from 7 days to 5 days
WHERE created_at > NOW() - INTERVAL '7 days'
-- Change to:
WHERE created_at > NOW() - INTERVAL '5 days'

-- Change payment reminder from 3 days to 2 days
WHERE ap.created_at < NOW() - INTERVAL '3 days'
-- Change to:
WHERE ap.created_at < NOW() - INTERVAL '2 days'
```

### Customize Notification Messages

In the SQL functions, update the message templates:

```sql
-- Example: Change document reminder message
INSERT INTO notifications (user_id, type, title, message, link, read)
VALUES (
  v_user.id,
  'document_reminder',
  'Missing Required Documents',
  'Custom message here with emoji! 📄',
  '/documents',
  FALSE
);
```

## 🐛 Troubleshooting

### Problem: Notifications not appearing
**Solution:**
```sql
-- 1. Check if functions exist
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%notification%';

-- 2. Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'notifications';

-- 3. Test notification creation manually
INSERT INTO notifications (user_id, type, title, message, read)
VALUES ('<your-user-id>', 'general', 'Test', 'Testing notifications', false);
```

### Problem: Badge count wrong
**Solution:**
```typescript
// In browser console
await notificationsAPI.invalidateCountCache()
await notificationsAPI.getUnreadCount(true)
```

### Problem: Real-time not working
**Solution:**
1. Check Supabase dashboard → Database → Replication
2. Ensure `notifications` table has replication enabled
3. Check browser console for connection errors
4. Verify RLS policies allow SELECT for own notifications

### Problem: Duplicate notifications
**Solution:**
```sql
-- Check for duplicates
SELECT type, user_id, title, COUNT(*) as count
FROM notifications
WHERE created_at > NOW() - INTERVAL '1 day'
GROUP BY type, user_id, title
HAVING COUNT(*) > 1;

-- The SQL functions already have frequency checks
-- Ensure cron jobs aren't running multiple times
SELECT * FROM cron.job;
```

## 📱 Testing Checklist

- [ ] Document reminder appears for users without documents
- [ ] Payment reminder appears for pending payments >3 days old
- [ ] Profile reminder appears for incomplete profiles
- [ ] Credentialing reminder appears when app submission complete
- [ ] Timeline notifications appear when steps completed
- [ ] Red badge shows correct unread count
- [ ] Clicking notification navigates to correct page
- [ ] Marking as read updates badge immediately
- [ ] Real-time updates work across browser tabs
- [ ] Notifications page shows all notifications
- [ ] Filter by unread works correctly
- [ ] Mark all as read works

## 🎯 Next Steps

1. **Deploy the database migration** ✅
2. **Test with a few users** ✅
3. **Set up automated reminders** (optional but recommended)
4. **Monitor notification engagement**
5. **Adjust frequencies based on user feedback**
6. **Consider adding email notifications** (future enhancement)

## 📚 Full Documentation

For detailed information, see [SMART_NOTIFICATION_SYSTEM.md](./SMART_NOTIFICATION_SYSTEM.md)

## ✨ Features Summary

✅ **Automated Reminders**
- Documents missing (every 7 days)
- Payments pending (every 3 days)
- Profile incomplete (every 7 days)
- Credentialing step (every 5 days)

✅ **Real-time Notifications**
- Timeline progress updates
- Payment confirmations
- Status changes

✅ **Smart UI**
- Red badge with white number
- Animated pulse effect
- One-click navigation
- Auto-read marking

✅ **User-Friendly**
- Clear action items
- Direct links to pages
- Easy to dismiss
- Full history view

---

**Ready to go! 🎉** The notification system is now active and will help keep your users engaged and informed.

