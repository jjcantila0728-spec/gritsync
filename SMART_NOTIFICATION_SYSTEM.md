# Smart Notification System

## Overview

The GritSync platform now includes a comprehensive smart notification system that automatically reminds users about important tasks and updates. The system features a modern UI with a red badge counter showing unread notifications.

## Features

### 1. **Visual Notification Bell**
- Red circular badge with white number showing unread count
- Animated pulse effect to draw attention
- Displays "99+" for counts over 99
- Responsive dropdown menu

### 2. **Notification Types**

#### Document Reminders
- **Icon**: Blue file icon
- **Trigger**: Automatically checks for missing required documents
- **Required Documents**:
  - 2x2 Picture
  - Nursing Diploma
  - Passport
- **Action**: Clicking navigates to `/documents` page
- **Frequency**: Reminder sent every 7 days if documents are still missing

#### Payment Reminders
- **Icon**: Green credit card icon
- **Trigger**: Payment pending for more than 3 days
- **Details**: Shows payment amount and type (Step 1, Step 2, or Full Payment)
- **Action**: Clicking navigates to application timeline
- **Frequency**: Reminder sent every 3 days for pending payments

#### Profile Completion Reminders
- **Icon**: Orange user icon
- **Trigger**: Missing required profile fields
- **Required Fields**:
  - First Name
  - Last Name
  - Mobile Number
  - Date of Birth
  - City
  - Province
- **Action**: Clicking navigates to `/my-details` page
- **Frequency**: Reminder sent every 7 days

#### Timeline Progress Updates
- **Icon**: Purple clock icon
- **Trigger**: Automatic when timeline steps are completed
- **Special Case**: Credentialing step reminder
  - Triggered when Application Submission is complete but Credentialing is not started
  - Includes instructions to download request letter and Form 2F
  - Reminds about ~1,500 PHP school fees
  - Frequency: Every 5 days until step is completed

#### General Notifications
- **Icon**: Gray bell icon
- **Trigger**: Manual or system-generated general updates

### 3. **Real-time Updates**
- Uses Supabase Realtime subscriptions
- Notifications appear instantly without page refresh
- Browser notifications (if permission granted)
- Automatic badge counter updates

### 4. **Interactive UI**
- Click notification to navigate to relevant page
- Mark individual notifications as read
- "Mark all as read" button
- Filter by "All" or "Unread"
- Dedicated `/notifications` page for full history

## Implementation Details

### Components

#### `NotificationBell.tsx`
```typescript
// Red badge with white number
<NotificationBell 
  unreadCount={5} 
  onClick={handleOpen}
/>
```

#### `NotificationDropdown.tsx`
```typescript
// Full dropdown with clickable items
<NotificationDropdown
  notifications={notifications}
  loading={loading}
  unreadCount={unreadCount}
  onMarkAsRead={handleMarkAsRead}
  onMarkAllAsRead={handleMarkAllAsRead}
  onClose={handleClose}
/>
```

### Database Schema

```sql
-- Notifications table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'timeline_update', 
    'status_change', 
    'payment', 
    'general',
    'document_reminder',
    'payment_reminder',
    'profile_completion'
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,  -- Optional custom navigation link
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Automated Triggers

#### Database Functions
Located in: `supabase/add-smart-notifications.sql`

1. **`generate_document_reminders()`**
   - Checks all users for missing required documents
   - Creates reminder if not sent in past 7 days
   - Can be run manually or via cron job

2. **`generate_profile_completion_reminders()`**
   - Checks all users for incomplete profiles
   - Creates reminder if not sent in past 7 days
   - Can be run manually or via cron job

3. **`generate_payment_reminders()`**
   - Finds pending payments older than 3 days
   - Creates reminder if not sent in past 3 days
   - Can be run manually or via cron job

4. **`notify_credentialing_reminder()`**
   - Checks applications ready for credentialing step
   - Includes detailed instructions in notification
   - Reminder every 5 days if step not completed

5. **`notify_timeline_step_update()`**
   - Database trigger on `application_timeline_steps` table
   - Fires automatically when step status changes to "completed"
   - Creates notification immediately

6. **`notify_payment_status_update()`**
   - Database trigger on `application_payments` table
   - Fires automatically when payment status changes to "paid"
   - Creates notification immediately

### API Methods

```typescript
// Trigger notification generation (admin or cron job)
await notificationsAPI.generateDocumentReminders()
await notificationsAPI.generateProfileCompletionReminders()
await notificationsAPI.generatePaymentReminders()
await notificationsAPI.generateCredentialingReminders()

// Check user status
const missingDocs = await notificationsAPI.checkMissingDocuments(userId)
const isIncomplete = await notificationsAPI.checkIncompleteProfile(userId)

// User operations
const notifications = await notificationsAPI.getAll(unreadOnly, limit)
const count = await notificationsAPI.getUnreadCount()
await notificationsAPI.markAsRead(notificationId)
await notificationsAPI.markAllAsRead()
```

## Setup Instructions

### 1. Run Database Migration

```bash
# Connect to your Supabase project and run:
psql -h <your-db-host> -U postgres -d postgres -f supabase/add-smart-notifications.sql
```

Or use Supabase dashboard:
1. Go to SQL Editor
2. Copy contents of `supabase/add-smart-notifications.sql`
3. Run the script

### 2. Set Up Automated Reminders (Optional)

#### Option A: Using pg_cron (Recommended)

```sql
-- Enable pg_cron extension (run as superuser)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily reminders
SELECT cron.schedule('document-reminders', '0 9 * * *', 'SELECT generate_document_reminders()');
SELECT cron.schedule('profile-reminders', '0 10 * * *', 'SELECT generate_profile_completion_reminders()');
SELECT cron.schedule('payment-reminders', '0 14 * * *', 'SELECT generate_payment_reminders()');
SELECT cron.schedule('credentialing-reminders', '0 11 * * *', 'SELECT notify_credentialing_reminder()');
```

#### Option B: External Cron Job

Create a script that calls the API:

```bash
#!/bin/bash
# run-notification-reminders.sh

curl -X POST https://your-api.com/api/notifications/generate-reminders \
  -H "Authorization: Bearer $ADMIN_API_KEY"
```

Add to crontab:
```
0 9 * * * /path/to/run-notification-reminders.sh
```

#### Option C: Manual Execution

Run functions manually from SQL editor:
```sql
SELECT generate_document_reminders();
SELECT generate_profile_completion_reminders();
SELECT generate_payment_reminders();
SELECT notify_credentialing_reminder();
```

### 3. Test the System

1. **Test Document Reminder**:
   - Create a user account
   - Don't upload any documents
   - Run: `SELECT generate_document_reminders()`
   - Check notifications bell

2. **Test Payment Reminder**:
   - Create an application with pending payment
   - Update payment created_at to be 4 days old
   - Run: `SELECT generate_payment_reminders()`
   - Check notifications

3. **Test Timeline Notification**:
   - Update a timeline step status to 'completed'
   - Notification should appear immediately

4. **Test Real-time**:
   - Open two browser windows with same user
   - Mark notification as read in one window
   - Badge should update in both windows instantly

## UI Specifications

### Badge Design
- **Shape**: Circle
- **Color**: Red (#EF4444 - Tailwind red-500)
- **Text Color**: White
- **Font**: Bold, 10px
- **Position**: Top-right corner of bell icon
- **Animation**: 2-second pulse
- **Min Width**: 20px
- **Height**: 20px
- **Padding**: 0 6px

### Dropdown Design
- **Width**: 420px on desktop, full screen minus 2rem on mobile
- **Max Height**: 600px
- **Border Radius**: 12px (rounded-xl)
- **Shadow**: 2xl shadow
- **Background**: White / Dark gray (theme-aware)
- **Header**: Gradient from primary to purple

### Notification Item States
- **Unread**: 
  - Blue-tinted background
  - Bold title
  - Red dot indicator
  - "NEW" badge
  - 4px left border (primary color)
- **Read**:
  - White/gray background
  - Normal font weight
  - No indicators

## User Experience Flow

### First-Time User
1. User registers → Profile completion reminder appears
2. User sees red badge (1) on notification bell
3. Clicks bell → Sees "Complete Your Profile" notification
4. Clicks notification → Navigates to My Details page
5. After completing profile, notification marked as read

### Document Upload Flow
1. User creates account → Document reminder appears after 1 day
2. Badge shows (1) unread notification
3. User clicks → Sees "Missing Required Documents"
4. Uploads documents → Reminder stops appearing
5. Notification remains in history (marked as read)

### Payment Flow
1. User submits application → Payment becomes pending
2. After 3 days → Payment reminder appears
3. Badge shows notification count
4. User clicks → Navigates to payment timeline
5. After payment → Confirmation notification appears
6. Both notifications marked as read when clicked

### Credentialing Flow
1. Application submission completed → Credentialing reminder appears
2. Notification includes detailed instructions
3. User downloads forms and submits to school
4. Admin marks step complete → Update notification sent
5. Reminder stops appearing

## Best Practices

### For Developers
1. Always test notification generation locally before deploying
2. Use appropriate frequency limits to avoid spam
3. Include clear action text in notifications
4. Provide direct navigation links
5. Handle edge cases (deleted applications, etc.)

### For Administrators
1. Monitor notification delivery rates
2. Adjust reminder frequencies based on user feedback
3. Review notification content for clarity
4. Check for duplicate notifications
5. Test real-time updates regularly

## Troubleshooting

### Notifications Not Appearing
1. Check Supabase RLS policies: `SELECT * FROM notifications WHERE user_id = '<user-id>'`
2. Verify real-time subscription is connected
3. Check browser console for errors
4. Ensure notification functions have been created

### Badge Count Incorrect
1. Clear notification cache: `notificationsAPI.invalidateCountCache(userId)`
2. Refresh count: `await notificationsAPI.getUnreadCount(true)`
3. Check for orphaned notifications

### Duplicate Notifications
1. Review frequency checks in SQL functions
2. Verify unique constraints on notification creation
3. Check cron job schedules for overlaps

### Real-time Not Working
1. Verify Supabase Realtime is enabled for notifications table
2. Check subscription connection in browser dev tools
3. Ensure RLS policies allow reading own notifications
4. Test with: `subscribeToNotifications(userId, callback)`

## Future Enhancements

### Planned Features
- [ ] Email notifications for critical updates
- [ ] SMS notifications for urgent reminders
- [ ] Notification preferences per type
- [ ] Snooze functionality
- [ ] Custom notification scheduling
- [ ] Notification categories
- [ ] Archive old notifications
- [ ] Search notifications
- [ ] Export notification history

### Possible Improvements
- Push notifications for mobile apps
- In-app notification sound effects
- Notification priority levels
- Bulk actions on notifications
- Notification templates
- A/B testing for notification content
- Analytics dashboard for notification engagement

## Support

For issues or questions:
- Check the troubleshooting section above
- Review Supabase logs for errors
- Test database functions directly in SQL editor
- Verify RLS policies are correctly configured

## Version History

### v1.0.0 (Current)
- Initial smart notification system
- Automated reminders for documents, payments, profile
- Real-time notifications
- Timeline progress updates
- Credentialing step reminders
- Red badge counter with white numbers
- Dedicated notifications page

