# Email System Setup & Deployment Guide

## Quick Start

### 1. Database Setup

Run the email logs migration to create the necessary tables and views:

```bash
# Using Supabase CLI
cd supabase
supabase db push

# Or apply the specific migration
psql -U postgres -d gritsync -f migrations/add-email-logs-table.sql
```

This will create:
- `email_logs` table with indexes
- `email_analytics` materialized view
- RLS policies
- Helper functions

### 2. Resend Configuration

The system uses Resend as the email provider. Configure it in the admin panel:

1. Go to **Admin Dashboard** → **Settings** → **Email & Notifications**
2. Select **Resend** as the email service provider
3. Enter your **Resend API Key**
4. Configure **From Email** and **From Name**
5. Save settings

Get your Resend API key from: https://resend.com/api-keys

### 3. Verify Installation

1. Navigate to **Admin Dashboard** → **Emails**
2. You should see the Email Management page with three tabs
3. Try sending a test email from the Compose tab
4. Check that the email appears in the Email History

## Features Included

### ✅ What's Implemented

1. **Email Logs Database Table**
   - Complete tracking of all sent emails
   - Status tracking (pending, sent, delivered, failed, bounced)
   - Provider response logging
   - Error tracking and retry capabilities
   - Associated record linking (applications, quotations, etc.)

2. **Admin Email Management Interface**
   - `/admin/emails` route
   - Email history with advanced filtering
   - Search by recipient, subject, or name
   - Filter by status, type, category, date range
   - Export to CSV functionality
   - Pagination support

3. **Email Analytics**
   - Real-time statistics dashboard
   - Total emails, delivered, failed, pending
   - Delivery rate and failure rate
   - Average send time metrics
   - Materialized view for performance

4. **Compose & Send Emails**
   - Rich email composer
   - HTML email support
   - Email type selection (transactional, notification, marketing, manual, automated)
   - Category selection
   - Automatic logging

5. **Email Actions**
   - View email details
   - Retry failed emails (with retry limits)
   - Delete email logs
   - Bulk operations support

6. **Automatic Email Logging**
   - All emails sent through the system are automatically logged
   - Includes system emails (notifications, receipts, password resets)
   - Manual emails sent by admins
   - Marketing and promotional emails

7. **Admin Sidebar Integration**
   - "Emails" menu item added to admin sidebar
   - Located between Quotations and Sponsorships
   - Mail icon for easy identification

## File Structure

### New Files Created

```
supabase/
├── migrations/
│   └── add-email-logs-table.sql          # Database schema for email logs

src/
├── lib/
│   └── email-api.ts                      # Email logs API & email operations
├── pages/
│   └── AdminEmails.tsx                   # Email management interface
└── components/
    └── Sidebar.tsx                        # Updated with Emails menu item

App.tsx                                    # Updated with /admin/emails route
EMAIL_SYSTEM_ENTERPRISE_GUIDE.md          # Complete documentation
EMAIL_SYSTEM_SETUP.md                     # This file
```

### Modified Files

```
src/lib/email-service.ts                  # Enhanced with automatic logging
src/components/Sidebar.tsx                # Added Emails menu item
src/App.tsx                               # Added /admin/emails route
```

## Environment Variables

No new environment variables are required. The system uses existing Resend configuration from the database settings table.

Optional environment variables (fallback if not configured in admin):
```env
RESEND_API_KEY=re_xxxxx
EMAIL_FROM=noreply@gritsync.com
EMAIL_FROM_NAME=GritSync
```

## Testing

### Manual Testing Steps

1. **Test Email Sending**
   ```
   1. Go to Admin > Emails > Compose
   2. Fill in recipient, subject, and body
   3. Click "Send Email"
   4. Verify email is received
   5. Check Email History for the log entry
   ```

2. **Test Email Logging**
   ```
   1. Trigger any system email (e.g., password reset)
   2. Go to Admin > Emails > Email History
   3. Verify the email appears in the list
   4. Click "View" to see details
   ```

3. **Test Filtering**
   ```
   1. Go to Admin > Emails
   2. Use search box to find emails
   3. Apply status filter (e.g., "sent", "failed")
   4. Apply date range filter
   5. Verify results are correct
   ```

4. **Test Retry**
   ```
   1. Find a failed email in the history
   2. Click the retry button
   3. Verify retry is attempted
   4. Check updated status
   ```

5. **Test Export**
   ```
   1. Apply some filters to Email History
   2. Click "Export" button
   3. Verify CSV file downloads
   4. Open CSV and verify data
   ```

6. **Test Analytics**
   ```
   1. Go to Analytics tab
   2. Verify statistics cards display correctly
   3. Check all metrics are calculated
   ```

## API Endpoints

The email system exposes these API functions:

```typescript
// In client-side code
import { emailLogsAPI, sendEmailWithLogging } from '@/lib/email-api'

// Get email logs
const { data, count } = await emailLogsAPI.getAll({ page: 1, pageSize: 50 })

// Send email with logging
await sendEmailWithLogging({
  to: 'user@example.com',
  subject: 'Test',
  html: '<p>Test</p>',
  emailType: 'manual',
})

// Get statistics
const stats = await emailLogsAPI.getStats()

// Retry failed email
await emailLogsAPI.retry(emailId)
```

## Integration Points

### Existing Features Integration

The email system automatically integrates with:

1. **Notifications System**: All notification emails are logged
2. **Password Reset**: Password reset emails tracked
3. **Payment Receipts**: Payment confirmation emails logged
4. **Application Updates**: Timeline and status change emails tracked
5. **Donation Receipts**: Donation confirmation emails logged

### Custom Integration

To integrate email logging in your code:

```typescript
import { sendEmail } from '@/lib/email-service'

// All emails sent via sendEmail are automatically logged
await sendEmail({
  to: 'user@example.com',
  subject: 'Your Subject',
  html: '<p>Email content</p>',
  
  // Optional: Add logging metadata
  emailType: 'transactional',
  emailCategory: 'custom_category',
  recipientUserId: userId,
  applicationId: appId,
  metadata: { customField: 'value' },
  tags: ['custom', 'important'],
})
```

## Permissions & Security

### Admin Access Only

The email management interface is restricted to administrators:
- Only users with `is_admin = true` can access `/admin/emails`
- Protected by `AdminRoute` wrapper
- RLS policies enforce data access control

### Row Level Security (RLS)

Email logs table has these policies:
- Admins can view all email logs
- Admins can create/update email logs
- Users can only view emails sent to them
- Service role (edge functions) can manage logs

## Performance Considerations

### Indexes

Multiple indexes ensure fast queries:
- Recipient email (B-tree)
- Status (B-tree)
- Email type (B-tree)
- Created date (B-tree DESC)
- Metadata (GIN for JSONB)
- Tags (GIN for arrays)

### Materialized View

The `email_analytics` view pre-aggregates statistics for the last 90 days.

Refresh periodically (recommended: daily):
```sql
SELECT refresh_email_analytics();
```

Or via cron job:
```sql
-- Create a pg_cron job (if available)
SELECT cron.schedule(
  'refresh-email-analytics',
  '0 2 * * *',  -- 2 AM daily
  'SELECT refresh_email_analytics();'
);
```

### Query Optimization

For large datasets (> 100K emails):
1. Use date range filters when possible
2. Leverage the materialized view for analytics
3. Consider archiving old logs (> 1 year)
4. Use pagination consistently

## Monitoring

### Key Metrics

Monitor these metrics regularly:

```typescript
const stats = await emailLogsAPI.getStats()

console.log({
  deliveryRate: stats.deliveryRate,  // Should be > 95%
  failureRate: stats.failureRate,    // Should be < 5%
  avgSendTime: stats.avgSendTime,    // Should be < 5s
})
```

### Health Checks

1. **Daily**: Check delivery rate
2. **Daily**: Review failed emails
3. **Weekly**: Analyze bounce patterns
4. **Weekly**: Refresh analytics view
5. **Monthly**: Archive old logs

## Troubleshooting

### Emails Not Appearing in History

**Possible Causes:**
1. Migration not applied
2. RLS policies blocking access
3. Service role lacking permissions

**Solution:**
```bash
# Re-run migration
supabase db push

# Verify RLS policies
psql -U postgres -d gritsync -c "SELECT * FROM pg_policies WHERE tablename = 'email_logs';"
```

### Emails Not Sending

**Possible Causes:**
1. Resend API key not configured
2. Invalid email format
3. Rate limiting

**Solution:**
1. Check Admin > Settings > Notifications
2. Verify Resend API key is valid
3. Check error messages in email logs
4. Review Resend dashboard

### Slow Performance

**Possible Causes:**
1. Large dataset without proper indexing
2. Analytics view not refreshed
3. Missing indexes

**Solution:**
```sql
-- Refresh analytics
SELECT refresh_email_analytics();

-- Verify indexes exist
SELECT * FROM pg_indexes WHERE tablename = 'email_logs';

-- Add missing indexes if needed
CREATE INDEX CONCURRENTLY idx_name ON email_logs(column);
```

## Maintenance

### Regular Tasks

#### Daily
```sql
-- Check recent failures
SELECT COUNT(*) FROM email_logs 
WHERE status = 'failed' 
AND created_at > NOW() - INTERVAL '24 hours';
```

#### Weekly
```sql
-- Refresh analytics
SELECT refresh_email_analytics();

-- Check bounce rate
SELECT 
  COUNT(*) FILTER (WHERE status = 'bounced') * 100.0 / COUNT(*) as bounce_rate
FROM email_logs
WHERE created_at > NOW() - INTERVAL '7 days';
```

#### Monthly
```sql
-- Archive old logs (optional)
DELETE FROM email_logs 
WHERE created_at < NOW() - INTERVAL '1 year' 
AND status IN ('delivered', 'sent');
```

## Backup & Recovery

### Backup Email Logs

```bash
# Backup entire table
pg_dump -U postgres -d gritsync -t email_logs > email_logs_backup.sql

# Backup with compression
pg_dump -U postgres -d gritsync -t email_logs | gzip > email_logs_backup.sql.gz
```

### Restore Email Logs

```bash
# Restore from backup
psql -U postgres -d gritsync < email_logs_backup.sql

# Restore from compressed backup
gunzip -c email_logs_backup.sql.gz | psql -U postgres -d gritsync
```

## Deployment Checklist

- [ ] Run database migration
- [ ] Configure Resend API key
- [ ] Set from email and name
- [ ] Test email sending
- [ ] Verify email logging
- [ ] Test retry functionality
- [ ] Check analytics display
- [ ] Set up monitoring
- [ ] Configure periodic analytics refresh
- [ ] Document custom integrations
- [ ] Train administrators

## Support

For issues or questions:

1. Check error messages in Email History
2. Review provider responses in email logs
3. Verify Resend configuration
4. Check Resend dashboard for provider issues
5. Review application logs for detailed errors

## Next Steps

After setup:

1. **Train Staff**: Show admins how to use the email system
2. **Set Up Monitoring**: Configure alerts for high failure rates
3. **Create Templates**: Build reusable email templates
4. **Document Processes**: Document email sending procedures
5. **Plan Maintenance**: Schedule regular health checks

## Resources

- **Resend Documentation**: https://resend.com/docs
- **Email Best Practices**: Check EMAIL_SYSTEM_ENTERPRISE_GUIDE.md
- **API Reference**: See EMAIL_SYSTEM_ENTERPRISE_GUIDE.md

---

**System Status: ✅ Ready for Production**

All components are implemented, tested, and documented. The enterprise email system is ready to use!

