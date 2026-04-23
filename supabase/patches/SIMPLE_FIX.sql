-- SIMPLE FIX - Minimal RLS setup that just works
-- Run this in Supabase SQL Editor

-- ============================================================================
-- STEP 1: Enable RLS on all tables
-- ============================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 2: Drop ALL existing policies (clean slate)
-- ============================================================================
DO $$ 
DECLARE r RECORD;
BEGIN
  -- Drop users policies
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'users') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON users', r.policyname);
  END LOOP;
  
  -- Drop applications policies
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'applications') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON applications', r.policyname);
  END LOOP;
  
  -- Drop quotations policies
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'quotations') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON quotations', r.policyname);
  END LOOP;
END $$;

-- ============================================================================
-- STEP 3: Create SIMPLE policies - Users can access their own data
-- ============================================================================

-- USERS TABLE
CREATE POLICY "users_select_own" ON users FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "users_update_own" ON users FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "users_insert_own" ON users FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- APPLICATIONS TABLE
CREATE POLICY "applications_select_own" ON applications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "applications_insert_own" ON applications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "applications_update_own" ON applications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- QUOTATIONS TABLE
CREATE POLICY "quotations_select_own" ON quotations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "quotations_insert_own" ON quotations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "quotations_update_own" ON quotations FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "quotations_delete_own" ON quotations FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================================
-- STEP 4: Grant permissions (CRITICAL)
-- ============================================================================
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.applications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotations TO authenticated;

-- ============================================================================
-- STEP 5: Ensure user profile exists
-- ============================================================================
INSERT INTO public.users (id, email, role, grit_id, created_at, updated_at)
SELECT 
  au.id,
  au.email,
  COALESCE((au.raw_user_meta_data->>'role')::text, 'client') as role,
  COALESCE(
    (SELECT grit_id FROM public.users WHERE id = au.id),
    'GRIT' || LPAD(FLOOR(100000 + RANDOM() * 900000)::TEXT, 6, '0')
  ) as grit_id,
  au.created_at,
  NOW()
FROM auth.users au
WHERE au.id = '03a0bd9f-c3e3-4b1d-ab74-93318b295f50'
  AND NOT EXISTS (SELECT 1 FROM public.users WHERE id = au.id)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STEP 6: Update trigger to store grit_id in auth metadata (for fast loading)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_grit_id TEXT;
  user_first_name TEXT;
  user_last_name TEXT;
  user_role TEXT;
BEGIN
  -- Generate unique GRIT-ID
  new_grit_id := COALESCE(
    (SELECT grit_id FROM public.users WHERE id = NEW.id),
    'GRIT' || LPAD(FLOOR(100000 + RANDOM() * 900000)::TEXT, 6, '0')
  );
  
  -- Extract names from metadata
  user_first_name := COALESCE(NEW.raw_user_meta_data->>'first_name', '');
  user_last_name := COALESCE(NEW.raw_user_meta_data->>'last_name', '');
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'client');
  
  -- Insert/update user profile
  INSERT INTO public.users (id, email, role, first_name, last_name, grit_id, created_at, updated_at)
  VALUES (NEW.id, NEW.email, user_role, NULLIF(TRIM(user_first_name), ''), NULLIF(TRIM(user_last_name), ''), new_grit_id, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      role = COALESCE(EXCLUDED.role, users.role),
      first_name = COALESCE(EXCLUDED.first_name, users.first_name),
      last_name = COALESCE(EXCLUDED.last_name, users.last_name),
      grit_id = COALESCE(EXCLUDED.grit_id, users.grit_id),
      updated_at = NOW();
  
  -- CRITICAL: Store grit_id and role in auth metadata for fast access
  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
    jsonb_build_object(
      'role', user_role,
      'grit_id', new_grit_id,
      'first_name', NULLIF(TRIM(user_first_name), ''),
      'last_name', NULLIF(TRIM(user_last_name), '')
    )
  WHERE id = NEW.id;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update existing users to have grit_id in metadata
UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
  jsonb_build_object('grit_id', (
    SELECT grit_id FROM public.users WHERE id = auth.users.id
  ))
WHERE raw_user_meta_data->>'grit_id' IS NULL
  AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.users.id);

-- ============================================================================
-- DONE!
-- ============================================================================
SELECT '✅ Simple RLS fix applied! Sign out and sign back in.' as message;

