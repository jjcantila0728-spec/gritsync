-- Check if received_emails table has any data
SELECT 
  COUNT(*) as total_emails,
  COUNT(DISTINCT to_email) as unique_recipients,
  COUNT(*) FILTER (WHERE is_deleted = false) as active_emails,
  COUNT(*) FILTER (WHERE is_read = false AND is_deleted = false) as unread_emails
FROM received_emails;

-- Show sample emails
SELECT 
  id,
  resend_id,
  from_email,
  to_email,
  subject,
  received_at,
  is_read,
  is_deleted,
  recipient_user_id,
  recipient_email_address_id
FROM received_emails
ORDER BY received_at DESC
LIMIT 10;

-- Check for emails to the client address
SELECT 
  id,
  from_email,
  to_email,
  subject,
  received_at,
  recipient_user_id,
  recipient_email_address_id
FROM received_emails
WHERE to_email = 'klcantila1@gritsync.com'
  AND is_deleted = false
ORDER BY received_at DESC;

