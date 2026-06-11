-- AdminCareers.tsx / CareerListing.tsx and database.types.ts expect these
-- columns on careers, but the table (init.sql) only had
-- title/department/location/type/description/requirements/is_active.
-- Saving a career 500'd with "Could not find the 'application_deadline'
-- column of 'careers' in the schema cache".

ALTER TABLE careers
  ADD COLUMN IF NOT EXISTS responsibilities         TEXT,
  ADD COLUMN IF NOT EXISTS employment_type          TEXT,
  ADD COLUMN IF NOT EXISTS salary_range             TEXT,
  ADD COLUMN IF NOT EXISTS is_featured              BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS application_deadline     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS application_instructions TEXT,
  ADD COLUMN IF NOT EXISTS partner_agency_id        INTEGER REFERENCES partner_agencies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS views_count              INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS applications_count       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_by               UUID REFERENCES users(id) ON DELETE SET NULL;

-- Ask PostgREST (Supabase API layer) to reload its schema cache so the new
-- columns are visible immediately without waiting for the periodic refresh.
NOTIFY pgrst, 'reload schema';
