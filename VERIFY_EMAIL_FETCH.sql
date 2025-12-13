-- VERIFICATION QUERY - Check what the app should be fetching
-- This matches exactly what the frontend is querying

-- First, get the user ID from auth
SELECT id, email 
FROM auth.users 
WHERE email = 'kmcantila@gmail.com';

-- Now check what the frontend query returns
-- This is EXACTLY what NCLEXApplication.tsx is querying
SELECT ea.email_address, ea.address_type, ea.is_primary, ea.is_active
FROM email_addresses ea
WHERE ea.user_id = (SELECT id FROM auth.users WHERE email = 'kmcantila@gmail.com')
  AND ea.address_type = 'client'
  AND ea.is_primary = true;

-- Check ALL email addresses for this user (to see what exists)
SELECT 
  ea.id,
  ea.email_address,
  ea.address_type,
  ea.is_primary,
  ea.is_active,
  ea.can_send,
  ea.can_receive,
  ea.created_at
FROM email_addresses ea
WHERE ea.user_id = (SELECT id FROM auth.users WHERE email = 'kmcantila@gmail.com')
ORDER BY ea.created_at DESC;

-- Verify the view as well
SELECT *
FROM active_email_addresses
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'kmcantila@gmail.com');

-- Check RLS policies on email_addresses table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'email_addresses';

