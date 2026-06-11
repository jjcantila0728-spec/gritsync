-- AdminCareers.tsx writes these columns on partner_agencies create/update,
-- but the table (init.sql) only has name/country/contact/email/notes/is_active.
-- Without them, /api/db/partner_agencies 500s with
-- "Could not find the 'address' column of 'partner_agencies' in the schema cache".

ALTER TABLE partner_agencies
  ADD COLUMN IF NOT EXISTS phone                TEXT,
  ADD COLUMN IF NOT EXISTS website              TEXT,
  ADD COLUMN IF NOT EXISTS address              TEXT,
  ADD COLUMN IF NOT EXISTS city                 TEXT,
  ADD COLUMN IF NOT EXISTS state                TEXT,
  ADD COLUMN IF NOT EXISTS zipcode              TEXT,
  ADD COLUMN IF NOT EXISTS contact_person_name  TEXT,
  ADD COLUMN IF NOT EXISTS contact_person_email TEXT,
  ADD COLUMN IF NOT EXISTS contact_person_phone TEXT;

-- Ask PostgREST (Supabase API layer) to reload its schema cache so the new
-- columns are visible immediately without waiting for the periodic refresh.
NOTIFY pgrst, 'reload schema';
