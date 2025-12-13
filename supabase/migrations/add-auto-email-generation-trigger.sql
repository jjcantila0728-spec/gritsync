-- Migration: Auto-generate client email addresses on user registration
-- This ensures that every new client user gets a personalized email address
-- Format: firstInitial + middleInitial + lastname@gritsync.com

-- Update the handle_new_user function to also create email address
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_grit_id TEXT;
  user_first_name TEXT;
  user_middle_name TEXT;
  user_last_name TEXT;
  user_role TEXT;
  v_user_id UUID;
BEGIN
  -- Generate unique GRIT-ID
  new_grit_id := generate_grit_id();
  
  -- Extract first_name, middle_name, and last_name from auth metadata
  user_first_name := COALESCE(
    NEW.raw_user_meta_data->>'first_name',
    SPLIT_PART(COALESCE(NEW.raw_user_meta_data->>'full_name', ''), ' ', 1)
  );
  
  user_middle_name := COALESCE(
    NEW.raw_user_meta_data->>'middle_name',
    ''
  );
  
  user_last_name := COALESCE(
    NEW.raw_user_meta_data->>'last_name',
    TRIM(SUBSTRING(COALESCE(NEW.raw_user_meta_data->>'full_name', '') 
      FROM LENGTH(SPLIT_PART(COALESCE(NEW.raw_user_meta_data->>'full_name', ''), ' ', 1)) + 2))
  );
  
  -- Get role from metadata
  user_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    'client'
  );
  
  -- Insert user profile with all required fields
  INSERT INTO public.users (
    id, 
    email, 
    role, 
    first_name,
    last_name,
    grit_id,
    created_at, 
    updated_at
  )
  VALUES (
    NEW.id, 
    NEW.email, 
    user_role,
    NULLIF(TRIM(user_first_name), ''),
    NULLIF(TRIM(user_last_name), ''),
    new_grit_id,
    NOW(), 
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    first_name = COALESCE(EXCLUDED.first_name, users.first_name),
    last_name = COALESCE(EXCLUDED.last_name, users.last_name),
    grit_id = COALESCE(EXCLUDED.grit_id, users.grit_id),
    role = COALESCE(EXCLUDED.role, users.role),
    updated_at = NOW()
  RETURNING id INTO v_user_id;
  
  -- Update auth metadata with role (for RLS checks without recursion)
  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
    jsonb_build_object('role', user_role)
  WHERE id = NEW.id;
  
  -- Auto-generate client email address if user is a client and has name
  IF user_role = 'client' AND NULLIF(TRIM(user_first_name), '') IS NOT NULL AND NULLIF(TRIM(user_last_name), '') IS NOT NULL THEN
    BEGIN
      PERFORM create_client_email_address(v_user_id);
      RAISE LOG 'Successfully created client email address for user %', v_user_id;
    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail the entire registration
      RAISE WARNING 'Failed to create client email address for user %: %', v_user_id, SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add middle_name column to users table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'middle_name'
  ) THEN
    ALTER TABLE public.users ADD COLUMN middle_name TEXT;
    COMMENT ON COLUMN users.middle_name IS 'Middle name for email generation';
  END IF;
END $$;

-- Create email addresses for existing client users who don't have one
DO $$
DECLARE
  user_record RECORD;
  generated_email TEXT;
BEGIN
  FOR user_record IN 
    SELECT u.id, u.first_name, u.middle_name, u.last_name, u.role
    FROM users u
    LEFT JOIN email_addresses ea ON ea.user_id = u.id AND ea.address_type = 'client'
    WHERE u.role = 'client' 
      AND u.first_name IS NOT NULL 
      AND u.last_name IS NOT NULL
      AND ea.id IS NULL
  LOOP
    BEGIN
      generated_email := create_client_email_address(user_record.id);
      RAISE NOTICE 'Created email % for user %', generated_email, user_record.id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to create email for user %: %', user_record.id, SQLERRM;
    END;
  END LOOP;
END $$;

COMMENT ON FUNCTION public.handle_new_user IS 'Automatically creates user profile and client email address on registration';

