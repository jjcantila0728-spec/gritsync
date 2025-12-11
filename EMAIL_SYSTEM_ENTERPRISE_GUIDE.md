# Enterprise Email System - Complete Guide

## Overview

GritSync now features a comprehensive, enterprise-grade email management system built with Resend. This system provides complete email tracking, analytics, and management capabilities for administrators.

## Features

### 🎯 Core Features

1. **Email History & Tracking**
   - Complete audit trail of all sent emails
   - Real-time status tracking (pending, sent, delivered, failed, bounced)
   - Advanced filtering and search capabilities
   - Export to CSV for reporting

2. **Email Analytics**
   - Delivery rate statistics
   - Failure rate analysis
   - Average send time metrics
   - Visual analytics dashboard
   - Historical performance tracking

3. **Compose & Send**
   - Rich email composer with HTML support
   - Email templates integration
   - Recipient management
   - Email categorization and tagging
   - Automatic logging of all sent emails

4. **Email Logs Database**
   - Complete email metadata storage
   - Provider response tracking
   - Error tracking and retry capabilities
   - Associated record linking (applications, quotations, etc.)

5. **Retry Failed Emails**
   - Automatic retry capability for failed emails
   - Configurable retry limits
   - Detailed error messages

## Architecture

### Database Schema

#### `email_logs` Table
Stores all outgoing emails with complete metadata:

```sql
- id (UUID)
- recipient_email (TEXT)
- recipient_name (TEXT)
- recipient_user_id (UUID, FK to users)
- subject (TEXT)
- body_html (TEXT)
- body_text (TEXT)
- sender_email (TEXT)
- sender_name (TEXT)
- sent_by_user_id (UUID, FK to users)
- email_type (ENUM: transactional, notification, marketing, manual, automated)
- email_category (TEXT)
- status (ENUM: pending, sent, delivered, failed, bounced, complained)
- email_provider (TEXT)
- provider_message_id (TEXT)
- provider_response (JSONB)
- error_message (TEXT)
- error_code (TEXT)
- retry_count (INTEGER)
- max_retries (INTEGER)
- application_id (UUID, FK)
- quotation_id (UUID, FK)
- donation_id (UUID, FK)
- sponsorship_id (UUID, FK)
- metadata (JSONB)
- tags (TEXT[])
- created_at (TIMESTAMP)
- sent_at (TIMESTAMP)
- delivered_at (TIMESTAMP)
- failed_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### `email_analytics` Materialized View
Provides aggregated statistics for fast analytics:

```sql
- date
- email_type
- email_category
- status
- count
- sent_count
- delivered_count
- failed_count
- bounced_count
- avg_send_time_seconds
```

### API Endpoints

#### Email Logs API (`src/lib/email-api.ts`)

```typescript
// Get all email logs with filtering
emailLogsAPI.getAll(options?: {
  page?: number
  pageSize?: number
  status?: string
  emailType?: string
  emailCategory?: string
  search?: string
  startDate?: string
  endDate?: string
  recipientUserId?: string
})

// Get single email log
emailLogsAPI.getById(id: string)

// Get email logs by user
emailLogsAPI.getByUserId(userId: string, limit?: number)

// Get email logs by application
emailLogsAPI.getByApplicationId(applicationId: string)

// Get email statistics
emailLogsAPI.getStats(options?: {
  startDate?: string
  endDate?: string
  emailType?: string
})

// Get analytics data
emailLogsAPI.getAnalytics(days?: number)

// Retry failed email
emailLogsAPI.retry(id: string)

// Delete email log
emailLogsAPI.delete(id: string)

// Bulk delete
emailLogsAPI.bulkDelete(ids: string[])
```

### Email Service Updates

The email service (`src/lib/email-service.ts`) has been enhanced to automatically log all sent emails:

```typescript
// Enhanced sendEmail function with logging
sendEmail({
  to: string
  subject: string
  html: string
  text?: string
  from?: string
  // NEW: Logging parameters
  emailType?: 'transactional' | 'notification' | 'marketing' | 'manual' | 'automated'
  emailCategory?: string
  recipientUserId?: string
  recipientName?: string
  applicationId?: string
  quotationId?: string
  donationId?: string
  sponsorshipId?: string
  metadata?: Record<string, any>
  tags?: string[]
})
```

## Usage Guide

### For Administrators

#### Accessing the Email System

1. Navigate to **Admin Dashboard**
2. Click on **"Emails"** in the sidebar
3. The Email Management page will open with three tabs:
   - **Email History**: View all sent emails
   - **Analytics**: View email performance metrics
   - **Compose**: Send new emails

#### Viewing Email History

**Filters Available:**
- **Search**: Search by recipient email, subject, or name
- **Status**: Filter by email status (pending, sent, delivered, failed, bounced)
- **Type**: Filter by email type (transactional, notification, marketing, manual, automated)
- **Date Range**: Filter by start and end dates

**Actions Available:**
- **View**: See complete email details
- **Retry**: Retry failed emails (if retry limit not reached)
- **Delete**: Remove email log
- **Export**: Export filtered emails to CSV

#### Sending Emails

1. Click **"Compose Email"** button or go to the Compose tab
2. Fill in the required fields:
   - **Recipient Email** (required)
   - **Recipient Name** (optional)
   - **Subject** (required)
   - **Email Body** (required, HTML supported)
   - **Email Type** (manual, marketing, notification)
   - **Category** (custom, general, update, announcement)
3. Click **"Send Email"**
4. Email will be logged automatically and tracked

#### Viewing Analytics

The Analytics tab provides:
- **Total Emails**: Total number of emails sent
- **Delivered**: Successfully delivered emails
- **Failed**: Failed email attempts
- **Average Send Time**: Average time to send emails
- **Delivery Rate**: Percentage of successful deliveries
- **Failure Rate**: Percentage of failed emails

### For Developers

#### Sending Emails with Logging

All email functions now support automatic logging:

```typescript
import { sendEmail } from '@/lib/email-service'

// Send transactional email with logging
await sendEmail({
  to: 'user@example.com',
  subject: 'Welcome to GritSync!',
  html: '<h1>Welcome!</h1><p>Thank you for joining us.</p>',
  emailType: 'transactional',
  emailCategory: 'welcome',
  recipientName: 'John Doe',
  recipientUserId: userId,
  tags: ['onboarding', 'welcome'],
})
```

#### Using the Email API

```typescript
import { emailLogsAPI, sendEmailWithLogging } from '@/lib/email-api'

// Get recent emails
const { data, count } = await emailLogsAPI.getAll({
  page: 1,
  pageSize: 50,
  status: 'delivered',
})

// Get email statistics
const stats = await emailLogsAPI.getStats({
  startDate: '2024-01-01',
  endDate: '2024-12-31',
})

// Send email with full logging
await sendEmailWithLogging({
  to: 'user@example.com',
  subject: 'Custom Email',
  html: '<p>Email content</p>',
  emailType: 'manual',
  emailCategory: 'custom',
  applicationId: 'some-app-id',
  metadata: { customField: 'value' },
  tags: ['custom', 'important'],
})

// Retry a failed email
await emailLogsAPI.retry(emailId)
```

## Email Types & Categories

### Email Types

1. **transactional**: System-triggered emails (receipts, confirmations)
2. **notification**: Notification emails (status updates, reminders)
3. **marketing**: Marketing and promotional emails
4. **manual**: Manually sent by administrators
5. **automated**: Automated campaign emails

### Email Categories

- `welcome`: Welcome emails for new users
- `password_reset`: Password reset emails
- `payment_receipt`: Payment receipts
- `timeline_update`: Application timeline updates
- `status_change`: Application status changes
- `document_reminder`: Document upload reminders
- `profile_reminder`: Profile completion reminders
- `school_letter`: School letter generation
- `general`: General notifications
- `custom`: Custom emails

## Database Migrations

To set up the email logs table, run the migration:

```bash
# Apply the migration (Supabase)
supabase db push

# Or manually run the SQL file
psql -U postgres -d gritsync < supabase/migrations/add-email-logs-table.sql
```

## Row Level Security (RLS)

The email logs table has the following RLS policies:

1. **Admins can view all email logs**: Full read access for administrators
2. **Admins can create email logs**: Admins can manually create logs
3. **Admins can update email logs**: For status updates and corrections
4. **Users can view their own email logs**: Users can see emails sent to them
5. **Service role can manage email logs**: Edge functions can create/update logs

## Performance Optimizations

### Indexes

Multiple indexes are created for fast querying:
- `idx_email_logs_recipient_email`: Fast lookup by recipient
- `idx_email_logs_status`: Filter by status
- `idx_email_logs_email_type`: Filter by type
- `idx_email_logs_created_at`: Time-based queries
- `idx_email_logs_metadata`: JSONB searching
- `idx_email_logs_tags`: Array tag searching

### Materialized View

The `email_analytics` materialized view provides pre-aggregated statistics for the last 90 days, significantly improving analytics query performance.

Refresh the view periodically:

```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY email_analytics;
```

Or use the helper function:

```sql
SELECT refresh_email_analytics();
```

## Monitoring & Maintenance

### Key Metrics to Monitor

1. **Delivery Rate**: Should be > 95%
2. **Failure Rate**: Should be < 5%
3. **Bounce Rate**: Should be < 2%
4. **Average Send Time**: Should be < 5 seconds

### Regular Maintenance Tasks

1. **Archive Old Logs**: Archive email logs older than 1 year
2. **Refresh Analytics**: Refresh materialized view daily
3. **Clean Up Failed Emails**: Review and handle permanently failed emails
4. **Monitor Bounces**: Investigate high bounce rates

### Troubleshooting

#### High Failure Rate

1. Check Resend API key configuration
2. Verify email service settings in Admin > Settings > Notifications
3. Review error messages in failed email logs
4. Check provider response for specific errors

#### Emails Not Being Logged

1. Verify database migration was applied
2. Check RLS policies are active
3. Ensure service role has proper permissions
4. Review application logs for errors

#### Slow Analytics

1. Refresh materialized view: `SELECT refresh_email_analytics()`
2. Check index health
3. Consider partitioning for very large datasets (> 1M records)

## Best Practices

### For Administrators

1. **Regular Monitoring**: Check email statistics daily
2. **Clean Bounces**: Remove bounced email addresses from recipient lists
3. **Template Usage**: Use email templates for consistency
4. **Test Before Mass Send**: Always test emails before bulk sending
5. **Tag Organization**: Use consistent tagging for easy filtering

### For Developers

1. **Always Include Context**: Pass `applicationId`, `userId`, etc. for tracking
2. **Use Appropriate Types**: Choose correct `emailType` and `emailCategory`
3. **Add Metadata**: Include relevant metadata for debugging
4. **Tag Wisely**: Use tags for easy filtering and reporting
5. **Error Handling**: Always handle email send failures gracefully
6. **Async Sending**: Don't block user actions waiting for emails

## Security Considerations

1. **PII Protection**: Email content may contain sensitive information
2. **Access Control**: Only admins can view all email logs
3. **Data Retention**: Consider implementing automatic data purging
4. **Audit Trail**: All email actions are logged
5. **Secure Transmission**: All emails sent via secure channels (Resend)

## Integration with Existing Features

The email system integrates with:

- **Applications**: Track all application-related emails
- **Quotations**: Link emails to quotation records
- **Donations**: Track donation receipt emails
- **Sponsorships**: Link sponsorship-related communications
- **Notifications**: All in-app notifications with email
- **User Management**: Track user-specific email history

## Future Enhancements

Planned features:

1. **Advanced Analytics Dashboard**: Charts and graphs
2. **Email Templates Manager**: Visual template editor
3. **Scheduled Emails**: Queue emails for future sending
4. **Bulk Email Campaigns**: Send to multiple recipients
5. **A/B Testing**: Test email variations
6. **Delivery Webhooks**: Real-time delivery status from Resend
7. **Bounce Management**: Automatic bounce handling
8. **Unsubscribe Management**: Handle email preferences

## API Reference

### Complete Email API

```typescript
// Email Logs API
import { emailLogsAPI } from '@/lib/email-api'

// Get all with pagination
const result = await emailLogsAPI.getAll({ page: 1, pageSize: 50 })

// Get by ID
const log = await emailLogsAPI.getById(emailId)

// Get by user
const userLogs = await emailLogsAPI.getByUserId(userId)

// Get by application
const appLogs = await emailLogsAPI.getByApplicationId(appId)

// Get statistics
const stats = await emailLogsAPI.getStats()

// Get analytics
const analytics = await emailLogsAPI.getAnalytics(30) // last 30 days

// Create log
const newLog = await emailLogsAPI.create(logData)

// Update log
const updated = await emailLogsAPI.update(logId, updates)

// Retry failed
const success = await emailLogsAPI.retry(emailId)

// Delete
await emailLogsAPI.delete(emailId)

// Bulk delete
await emailLogsAPI.bulkDelete([id1, id2, id3])

// Get count by status
const counts = await emailLogsAPI.getCountByStatus()

// Get recent failed
const failed = await emailLogsAPI.getRecentFailed(20)
```

## Support & Help

For issues or questions:

1. Check the troubleshooting section above
2. Review error messages in email logs
3. Verify Resend configuration in Admin Settings
4. Check the Resend dashboard for provider-side issues
5. Review application logs for detailed error information

## Changelog

### v1.0.0 (December 2024)
- Initial release of enterprise email system
- Email logs database table
- Admin email management interface
- Email analytics and statistics
- Automatic email logging
- Retry failed emails capability
- Export to CSV functionality
- Integration with existing email service

---

**Built with ❤️ for GritSync**

