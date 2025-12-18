-- ALL-IN-ONE: Diagnose and Fix Krizza Mae Cantila's Email
-- This script shows current state, then fixes everything

-- ========================================
-- STEP 1: DIAGNOSTIC
-- ========================================

-- Show current user record
SELECT 
  'User Record' as info,
  id,
  first_name,
  middle_name,
  last_name,
  email as auth_email
FROM users
WHERE (first_name ILIKE '%krizza%' OR first_name ILIKE '%mae%')
  AND last_name ILIKE '%cantila%';

-- Show all emails for this user
SELECT 
  'All Email Addresses' as info,
  ea.email_address,
  ea.is_active,
  ea.is_primary,
  ea.is_verified,
  ea.created_at
FROM users u
JOIN email_addresses ea ON ea.user_id = u.id
WHERE (u.first_name ILIKE '%krizza%' OR u.first_name ILIKE '%mae%')
  AND u.last_name ILIKE '%cantila%'
  AND ea.address_type = 'client'
ORDER BY ea.created_at DESC;

-- ========================================
-- STEP 2: FIXING
-- ========================================

DO $$
DECLARE
  v_user_id UUID;
  v_fixed BOOLEAN := FALSE;
BEGIN
  -- Get user ID
  SELECT id INTO v_user_id
  FROM users
  WHERE (first_name ILIKE '%krizza%' OR first_name ILIKE '%mae%')
    AND last_name ILIKE '%cantila%'
  LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '❌ User Krizza Mae Cantila not found!';
  END IF;
  
  RAISE NOTICE '✅ Found user ID: %', v_user_id;
  
  -- Step 1: Fix user's name
  UPDATE users
  SET 
    first_name = 'Krizza Mae',
    middle_name = NULL,
    updated_at = NOW()
  WHERE id = v_user_id;
  RAISE NOTICE '✅ Updated user name: first_name = "Krizza Mae", middle_name = NULL';
  
  -- Step 2: Deactivate all existing client emails
  UPDATE email_addresses
  SET 
    is_active = FALSE,
    is_primary = FALSE,
    updated_at = NOW()
  WHERE user_id = v_user_id
    AND address_type = 'client';
  RAISE NOTICE '✅ Deactivated all existing client emails';
  
  -- Step 3: Handle kmcantila@gritsync.com if it exists elsewhere
  UPDATE email_addresses
  SET 
    is_active = FALSE,
    is_primary = FALSE,
    updated_at = NOW()
  WHERE email_address = 'kmcantila@gritsync.com'
    AND user_id != v_user_id;
  
  -- Step 4: Insert or update kmcantila@gritsync.com
  INSERT INTO email_addresses (
    email_address,
    display_name,
    user_id,
    is_system_address,
    address_type,
    is_active,
    is_verified,
    is_primary,
    can_send,
    can_receive
  ) VALUES (
    'kmcantila@gritsync.com',
    'Krizza Mae Cantila',
    v_user_id,
    FALSE,
    'client',
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    TRUE
  )
  ON CONFLICT (email_address) DO UPDATE
  SET 
    user_id = v_user_id,
    is_active = TRUE,
    is_primary = TRUE,
    is_verified = TRUE,
    can_send = TRUE,
    can_receive = TRUE,
    display_name = 'Krizza Mae Cantila',
    updated_at = NOW();
  
  RAISE NOTICE '✅ Created/Updated email: kmcantila@gritsync.com';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ FIX COMPLETE!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  
END $$;

-- ========================================
-- STEP 3: VERIFICATION
-- ========================================

-- Verify the result
SELECT 
  'Final Result' as info,
  u.first_name || ' ' || u.last_name as full_name,
  ea.email_address,
  ea.is_active,
  ea.is_primary,
  ea.is_verified,
  CASE 
    WHEN ea.email_address = 'kmcantila@gritsync.com' AND ea.is_active = TRUE
    THEN '✅ CORRECT'
    ELSE '❌ NEEDS ATTENTION'
  END as status
FROM users u
JOIN email_addresses ea ON ea.user_id = u.id
WHERE (u.first_name ILIKE '%krizza%' OR u.first_name ILIKE '%mae%')
  AND u.last_name ILIKE '%cantila%'
  AND ea.address_type = 'client'
  AND ea.is_active = TRUE;

-- ========================================
-- Check the row above - should show:
-- email_address: kmcantila@gritsync.com
-- is_active: true
-- is_primary: true
-- status: ✅ CORRECT
-- ========================================

