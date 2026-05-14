-- ============================================================================
-- Unify user profile data into a single source of truth: `user_details`
-- ----------------------------------------------------------------------------
-- Target: local PostgreSQL (no Supabase). The app uses node-postgres against
-- $DATABASE_URL via server/db.ts; this script is plain Postgres SQL.
--
-- How to run:
--   psql "$DATABASE_URL" -f scripts/migrations/2026-05-12_unify_user_profile_data.sql
--
-- (Or inside the container:
--   docker compose exec db psql -U $POSTGRES_USER $POSTGRES_DB \
--     -f /scripts/migrations/2026-05-12_unify_user_profile_data.sql )
--
-- Before this migration:
--   * MyDetails  (/app/my-details)         wrote to `user_details`
--   * Apply Form (/app/application/new)    wrote a duplicate copy to `applications`
-- The two could (and did) drift out of sync.
--
-- After this migration:
--   * `user_details` is the canonical store for ALL shared profile fields
--     (personal info, address, education, signature).
--   * `users.first_name / last_name / middle_name` remains the canonical
--     store for the user's name (joins with user_details on user_id).
--   * `applications` keeps only application-specific data going forward
--     (status, payment_type, document paths, grit_app_id, signature snapshot).
--     Existing rows keep their copied columns for history; new rows from
--     /app/application/new still populate them but the read path now prefers
--     user_details.
--
-- Idempotent: safe to run multiple times.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Extend `user_details` with every profile field the two forms collect.
-- ----------------------------------------------------------------------------

-- Personal information
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS first_name              TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS middle_name             TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS last_name               TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS email                   TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS mobile_number           TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS marital_status          TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS single_full_name        TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS birth_place             TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS country_of_birth        TEXT;

-- Address (note: `city`, `country` already exist in init.sql baseline)
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS house_number            TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS street_name             TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS province                TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS zipcode                 TEXT;

-- Elementary school
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS elementary_school           TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS elementary_city             TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS elementary_province         TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS elementary_country          TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS elementary_years_attended   TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS elementary_start_date       DATE;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS elementary_end_date         DATE;

-- High school
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS high_school                 TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS high_school_city            TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS high_school_province        TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS high_school_country         TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS high_school_years_attended  TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS high_school_start_date      DATE;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS high_school_end_date        DATE;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS high_school_graduated       TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS high_school_diploma_type    TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS high_school_diploma_date    DATE;

-- Nursing school
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS nursing_school                 TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS nursing_school_city            TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS nursing_school_province        TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS nursing_school_country         TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS nursing_school_years_attended  TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS nursing_school_start_date      DATE;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS nursing_school_end_date        DATE;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS nursing_school_major           TEXT;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS nursing_school_diploma_date    DATE;

-- Misc profile
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS signature              TEXT;

-- ----------------------------------------------------------------------------
-- 2. Backfill `user_details` from any application the user has submitted
--    so existing applicants immediately see their data in /app/my-details
--    and the admin View Profile modal — without needing to re-enter it.
--    For users with multiple applications, the LATEST one wins.
-- ----------------------------------------------------------------------------

WITH latest_app AS (
  SELECT DISTINCT ON (user_id)
    user_id,
    first_name, middle_name, last_name,
    mobile_number, email,
    gender, marital_status, single_full_name,
    date_of_birth, birth_place, country_of_birth,
    house_number, street_name, city, province, country, zipcode,
    elementary_school, elementary_city, elementary_province, elementary_country,
    elementary_years_attended, elementary_start_date, elementary_end_date,
    high_school, high_school_city, high_school_province, high_school_country,
    high_school_years_attended, high_school_start_date, high_school_end_date,
    high_school_graduated, high_school_diploma_type, high_school_diploma_date,
    nursing_school, nursing_school_city, nursing_school_province, nursing_school_country,
    nursing_school_years_attended, nursing_school_start_date, nursing_school_end_date,
    nursing_school_major, nursing_school_diploma_date,
    signature
  FROM applications
  ORDER BY user_id, created_at DESC
)
INSERT INTO user_details (
  user_id,
  first_name, middle_name, last_name,
  mobile_number, email,
  gender, marital_status, single_full_name,
  date_of_birth, birth_place, country_of_birth,
  house_number, street_name, city, province, country, zipcode,
  elementary_school, elementary_city, elementary_province, elementary_country,
  elementary_years_attended, elementary_start_date, elementary_end_date,
  high_school, high_school_city, high_school_province, high_school_country,
  high_school_years_attended, high_school_start_date, high_school_end_date,
  high_school_graduated, high_school_diploma_type, high_school_diploma_date,
  nursing_school, nursing_school_city, nursing_school_province, nursing_school_country,
  nursing_school_years_attended, nursing_school_start_date, nursing_school_end_date,
  nursing_school_major, nursing_school_diploma_date,
  signature
)
SELECT
  user_id,
  first_name, middle_name, last_name,
  mobile_number, email,
  gender, marital_status, single_full_name,
  -- date_of_birth on applications is sometimes TEXT MM/DD/YYYY — try to coerce.
  CASE
    WHEN date_of_birth IS NULL OR date_of_birth = '' THEN NULL
    WHEN date_of_birth ~ '^\d{4}-\d{2}-\d{2}'         THEN date_of_birth::DATE
    WHEN date_of_birth ~ '^\d{2}/\d{2}/\d{4}$'        THEN TO_DATE(date_of_birth, 'MM/DD/YYYY')
    ELSE NULL
  END,
  birth_place, country_of_birth,
  house_number, street_name, city, province, country, zipcode,
  elementary_school, elementary_city, elementary_province, elementary_country,
  elementary_years_attended,
  CASE WHEN elementary_start_date ~ '^\d{4}-\d{2}-\d{2}' THEN elementary_start_date::DATE ELSE NULL END,
  CASE WHEN elementary_end_date   ~ '^\d{4}-\d{2}-\d{2}' THEN elementary_end_date::DATE   ELSE NULL END,
  high_school, high_school_city, high_school_province, high_school_country,
  high_school_years_attended,
  CASE WHEN high_school_start_date ~ '^\d{4}-\d{2}-\d{2}' THEN high_school_start_date::DATE ELSE NULL END,
  CASE WHEN high_school_end_date   ~ '^\d{4}-\d{2}-\d{2}' THEN high_school_end_date::DATE   ELSE NULL END,
  high_school_graduated, high_school_diploma_type,
  CASE WHEN high_school_diploma_date ~ '^\d{4}-\d{2}-\d{2}' THEN high_school_diploma_date::DATE ELSE NULL END,
  nursing_school, nursing_school_city, nursing_school_province, nursing_school_country,
  nursing_school_years_attended,
  CASE WHEN nursing_school_start_date ~ '^\d{4}-\d{2}-\d{2}' THEN nursing_school_start_date::DATE ELSE NULL END,
  CASE WHEN nursing_school_end_date   ~ '^\d{4}-\d{2}-\d{2}' THEN nursing_school_end_date::DATE   ELSE NULL END,
  nursing_school_major,
  CASE WHEN nursing_school_diploma_date ~ '^\d{4}-\d{2}-\d{2}' THEN nursing_school_diploma_date::DATE ELSE NULL END,
  signature
FROM latest_app
ON CONFLICT (user_id) DO UPDATE SET
  -- Only fill columns that are currently NULL on user_details
  -- (do NOT overwrite values the user already saved via /app/my-details).
  first_name                    = COALESCE(user_details.first_name,                    EXCLUDED.first_name),
  middle_name                   = COALESCE(user_details.middle_name,                   EXCLUDED.middle_name),
  last_name                     = COALESCE(user_details.last_name,                     EXCLUDED.last_name),
  mobile_number                 = COALESCE(user_details.mobile_number,                 EXCLUDED.mobile_number),
  email                         = COALESCE(user_details.email,                         EXCLUDED.email),
  gender                        = COALESCE(user_details.gender,                        EXCLUDED.gender),
  marital_status                = COALESCE(user_details.marital_status,                EXCLUDED.marital_status),
  single_full_name              = COALESCE(user_details.single_full_name,              EXCLUDED.single_full_name),
  date_of_birth                 = COALESCE(user_details.date_of_birth,                 EXCLUDED.date_of_birth),
  birth_place                   = COALESCE(user_details.birth_place,                   EXCLUDED.birth_place),
  country_of_birth              = COALESCE(user_details.country_of_birth,              EXCLUDED.country_of_birth),
  house_number                  = COALESCE(user_details.house_number,                  EXCLUDED.house_number),
  street_name                   = COALESCE(user_details.street_name,                   EXCLUDED.street_name),
  city                          = COALESCE(user_details.city,                          EXCLUDED.city),
  province                      = COALESCE(user_details.province,                      EXCLUDED.province),
  country                       = COALESCE(user_details.country,                       EXCLUDED.country),
  zipcode                       = COALESCE(user_details.zipcode,                       EXCLUDED.zipcode),
  elementary_school             = COALESCE(user_details.elementary_school,             EXCLUDED.elementary_school),
  elementary_city               = COALESCE(user_details.elementary_city,               EXCLUDED.elementary_city),
  elementary_province           = COALESCE(user_details.elementary_province,           EXCLUDED.elementary_province),
  elementary_country            = COALESCE(user_details.elementary_country,            EXCLUDED.elementary_country),
  elementary_years_attended     = COALESCE(user_details.elementary_years_attended,     EXCLUDED.elementary_years_attended),
  elementary_start_date         = COALESCE(user_details.elementary_start_date,         EXCLUDED.elementary_start_date),
  elementary_end_date           = COALESCE(user_details.elementary_end_date,           EXCLUDED.elementary_end_date),
  high_school                   = COALESCE(user_details.high_school,                   EXCLUDED.high_school),
  high_school_city              = COALESCE(user_details.high_school_city,              EXCLUDED.high_school_city),
  high_school_province          = COALESCE(user_details.high_school_province,          EXCLUDED.high_school_province),
  high_school_country           = COALESCE(user_details.high_school_country,           EXCLUDED.high_school_country),
  high_school_years_attended    = COALESCE(user_details.high_school_years_attended,    EXCLUDED.high_school_years_attended),
  high_school_start_date        = COALESCE(user_details.high_school_start_date,        EXCLUDED.high_school_start_date),
  high_school_end_date          = COALESCE(user_details.high_school_end_date,          EXCLUDED.high_school_end_date),
  high_school_graduated         = COALESCE(user_details.high_school_graduated,         EXCLUDED.high_school_graduated),
  high_school_diploma_type      = COALESCE(user_details.high_school_diploma_type,      EXCLUDED.high_school_diploma_type),
  high_school_diploma_date      = COALESCE(user_details.high_school_diploma_date,      EXCLUDED.high_school_diploma_date),
  nursing_school                = COALESCE(user_details.nursing_school,                EXCLUDED.nursing_school),
  nursing_school_city           = COALESCE(user_details.nursing_school_city,           EXCLUDED.nursing_school_city),
  nursing_school_province       = COALESCE(user_details.nursing_school_province,       EXCLUDED.nursing_school_province),
  nursing_school_country        = COALESCE(user_details.nursing_school_country,        EXCLUDED.nursing_school_country),
  nursing_school_years_attended = COALESCE(user_details.nursing_school_years_attended, EXCLUDED.nursing_school_years_attended),
  nursing_school_start_date     = COALESCE(user_details.nursing_school_start_date,     EXCLUDED.nursing_school_start_date),
  nursing_school_end_date       = COALESCE(user_details.nursing_school_end_date,       EXCLUDED.nursing_school_end_date),
  nursing_school_major          = COALESCE(user_details.nursing_school_major,          EXCLUDED.nursing_school_major),
  nursing_school_diploma_date   = COALESCE(user_details.nursing_school_diploma_date,   EXCLUDED.nursing_school_diploma_date),
  signature                     = COALESCE(user_details.signature,                     EXCLUDED.signature),
  updated_at                    = NOW();

-- ----------------------------------------------------------------------------
-- 3. Backfill users.first_name / last_name / middle_name from the latest
--    application, so the user table is in sync too (it's the canonical
--    name source). Only fills nulls — never overwrites what users have set.
-- ----------------------------------------------------------------------------

WITH latest_app AS (
  SELECT DISTINCT ON (user_id)
    user_id, first_name, middle_name, last_name
  FROM applications
  ORDER BY user_id, created_at DESC
)
UPDATE users u
   SET first_name  = COALESCE(NULLIF(TRIM(u.first_name),  ''), la.first_name),
       middle_name = COALESCE(NULLIF(TRIM(u.middle_name), ''), la.middle_name),
       last_name   = COALESCE(NULLIF(TRIM(u.last_name),   ''), la.last_name),
       updated_at  = NOW()
  FROM latest_app la
 WHERE u.id = la.user_id
   AND (
        NULLIF(TRIM(COALESCE(u.first_name, '')), '') IS NULL
     OR NULLIF(TRIM(COALESCE(u.last_name,  '')), '') IS NULL
   );

COMMIT;

-- ============================================================================
-- Verification queries (run manually after migration):
--
--   -- How many users now have a user_details row?
--   SELECT COUNT(*) FROM user_details;
--
--   -- Are there users who have applications but still no user_details?
--   SELECT a.user_id FROM applications a
--    LEFT JOIN user_details d ON d.user_id = a.user_id
--    WHERE d.user_id IS NULL
--    GROUP BY a.user_id;
--
--   -- Spot-check a known user:
--   SELECT u.email, ud.first_name, ud.last_name, ud.house_number, ud.city
--     FROM users u
--     JOIN user_details ud ON ud.user_id = u.id
--    WHERE u.email = 'someone@example.com';
-- ============================================================================
