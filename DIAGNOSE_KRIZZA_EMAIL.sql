-- Diagnostic: Check Krizza's current email status

-- 1. Check user record
SELECT 
  '=== USER RECORD ===' as section,
  id,
  first_name,
  middle_name,
  last_name,
  email as auth_email,
  role,
  created_at
FROM users
WHERE (first_name ILIKE '%krizza%' OR first_name ILIKE '%mae%')
  AND last_name ILIKE '%cantila%';

-- 2. Check ALL email addresses for this user
SELECT 
  '=== ALL EMAIL ADDRESSES ===' as section,
  ea.id,
  ea.email_address,
  ea.address_type,
  ea.is_active,
  ea.is_primary,
  ea.is_verified,
  ea.can_send,
  ea.can_receive,
  ea.created_at,
  ea.updated_at
FROM users u
JOIN email_addresses ea ON ea.user_id = u.id
WHERE (u.first_name ILIKE '%krizza%' OR u.first_name ILIKE '%mae%')
  AND u.last_name ILIKE '%cantila%'
ORDER BY ea.created_at DESC;

-- 3. Check what email should be generated
SELECT 
  '=== EXPECTED EMAIL ===' as section,
  u.first_name,
  u.middle_name,
  u.last_name,
  generate_client_email(u.first_name, u.middle_name, u.last_name) as should_be_email,
  'kmcantila@gritsync.com' as expected_email,
  CASE 
    WHEN generate_client_email(u.first_name, u.middle_name, u.last_name) = 'kmcantila@gritsync.com'
    THEN '✅ MATCHES'
    ELSE '❌ DOES NOT MATCH'
  END as status
FROM users u
WHERE (u.first_name ILIKE '%krizza%' OR u.first_name ILIKE '%mae%')
  AND u.last_name ILIKE '%cantila%';

-- 4. Check if kmcantila@gritsync.com exists anywhere
SELECT 
  '=== CHECK IF EMAIL EXISTS ===' as section,
  email_address,
  user_id,
  address_type,
  is_active,
  is_primary,
  (SELECT first_name || ' ' || last_name FROM users WHERE id = email_addresses.user_id) as owner
FROM email_addresses
WHERE email_address LIKE '%kmcantila%'
   OR email_address LIKE '%cantila%';

-- 5. Check for conflicts
SELECT 
  '=== POTENTIAL CONFLICTS ===' as section,
  email_address,
  COUNT(*) as count,
  STRING_AGG(user_id::text, ', ') as user_ids
FROM email_addresses
WHERE email_address LIKE '%cantila%'
GROUP BY email_address
HAVING COUNT(*) > 1;

