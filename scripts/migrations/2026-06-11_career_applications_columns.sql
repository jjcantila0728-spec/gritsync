-- Career.tsx (public application form), AdminCareers.tsx, and
-- database.types.ts expect a much richer career_applications shape than
-- init.sql defined (full_name/mobile/cover_letter/notes only). Same
-- schema-cache failure mode as partner_agencies and careers.

ALTER TABLE career_applications
  ADD COLUMN IF NOT EXISTS user_id                   UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS first_name                TEXT,
  ADD COLUMN IF NOT EXISTS last_name                 TEXT,
  ADD COLUMN IF NOT EXISTS mobile_number             TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth             DATE,
  ADD COLUMN IF NOT EXISTS country                   TEXT,
  ADD COLUMN IF NOT EXISTS nursing_school            TEXT,
  ADD COLUMN IF NOT EXISTS graduation_date           DATE,
  ADD COLUMN IF NOT EXISTS years_of_experience       TEXT,
  ADD COLUMN IF NOT EXISTS current_employment_status TEXT,
  ADD COLUMN IF NOT EXISTS license_number            TEXT,
  ADD COLUMN IF NOT EXISTS license_state             TEXT,
  ADD COLUMN IF NOT EXISTS cover_letter_path         TEXT,
  ADD COLUMN IF NOT EXISTS additional_documents_path TEXT,
  ADD COLUMN IF NOT EXISTS partner_agency_id         INTEGER REFERENCES partner_agencies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS forwarded_to_agency_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS forwarded_email_sent      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_notes               TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by               UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at               TIMESTAMPTZ;

-- New inserts send first_name/last_name instead of full_name; the legacy
-- NOT NULL would reject them.
ALTER TABLE career_applications ALTER COLUMN full_name DROP NOT NULL;

-- Ask PostgREST (Supabase API layer) to reload its schema cache so the new
-- columns are visible immediately without waiting for the periodic refresh.
NOTIFY pgrst, 'reload schema';
