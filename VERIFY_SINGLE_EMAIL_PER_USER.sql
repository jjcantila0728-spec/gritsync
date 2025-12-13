-- Verification Script: Check One Email Per User Rule

-- 1. Check for violations (users with multiple active client emails)
SELECT 
  '⚠️ VIOLATIONS' as status,
  u.id as user_id,
  u.first_name || ' ' || u.last_name as full_name,
  COUNT(ea.id) as active_email_count,
  STRING_AGG(ea.email_address, ', ' ORDER BY ea.created_at) as active_emails
FROM users u
JOIN email_addresses ea ON ea.user_id = u.id
WHERE ea.address_type = 'client'
  AND ea.is_active = TRUE
GROUP BY u.id, u.first_name, u.last_name
HAVING COUNT(ea.id) > 1
ORDER BY active_email_count DESC;

-- 2. Show all users with their client email status
SELECT 
  'User Email Status' as info,
  u.id as user_id,
  u.first_name || ' ' || u.last_name as full_name,
  u.role,
  COUNT(ea.id) FILTER (WHERE ea.is_active = TRUE) as active_emails,
  COUNT(ea.id) FILTER (WHERE ea.is_active = FALSE) as inactive_emails,
  COUNT(ea.id) as total_emails,
  STRING_AGG(
    CASE 
      WHEN ea.is_active THEN '✓ ' || ea.email_address
      ELSE '✗ ' || ea.email_address
    END,
    E'\n'
    ORDER BY ea.created_at DESC
  ) as all_emails
FROM users u
LEFT JOIN email_addresses ea ON ea.user_id = u.id AND ea.address_type = 'client'
WHERE u.role = 'client'
GROUP BY u.id, u.first_name, u.last_name, u.role
ORDER BY 
  active_emails DESC,
  u.created_at DESC;

-- 3. Check unique index exists
SELECT 
  'Index Check' as info,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'email_addresses'
  AND indexname = 'idx_one_active_client_email_per_user';

-- 4. Check trigger exists
SELECT 
  'Trigger Check' as info,
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trigger_enforce_single_active_client_email';

-- 5. Summary statistics
SELECT 
  'Summary' as info,
  COUNT(DISTINCT user_id) as users_with_client_emails,
  COUNT(*) FILTER (WHERE is_active = TRUE) as active_client_emails,
  COUNT(*) FILTER (WHERE is_active = FALSE) as inactive_client_emails,
  COUNT(*) as total_client_emails,
  COUNT(DISTINCT user_id) FILTER (
    WHERE EXISTS (
      SELECT 1 FROM email_addresses ea2
      WHERE ea2.user_id = email_addresses.user_id
        AND ea2.address_type = 'client'
        AND ea2.is_active = TRUE
    )
  ) as users_with_active_email,
  CASE 
    WHEN COUNT(*) FILTER (WHERE is_active = TRUE) = COUNT(DISTINCT user_id) FILTER (
      WHERE EXISTS (
        SELECT 1 FROM email_addresses ea2
        WHERE ea2.user_id = email_addresses.user_id
          AND ea2.address_type = 'client'
          AND ea2.is_active = TRUE
      )
    )
    THEN '✅ CORRECT (one active email per user)'
    ELSE '❌ VIOLATION (some users have multiple active emails)'
  END as status
FROM email_addresses
WHERE address_type = 'client';

