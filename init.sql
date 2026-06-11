-- =============================================================================
-- GritSync — Local PostgreSQL Database Initialisation Script
-- Run once to create the database and all tables before starting the server.
--
-- Usage (from a terminal):
--   psql -U postgres -c "CREATE DATABASE gritsync;"
--   psql -U postgres -d gritsync -f init.sql
--
-- Or run the helper script:
--   node scripts/init-db.js
-- =============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- USERS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                           TEXT NOT NULL,
  gritsync_email                  TEXT,
  personal_email                  TEXT,
  password_hash                   TEXT NOT NULL,
  first_name                      TEXT,
  last_name                       TEXT,
  middle_name                     TEXT,
  mobile                          TEXT,
  role                            TEXT NOT NULL DEFAULT 'client',
  grit_id                         TEXT UNIQUE,
  avatar_path                     TEXT,
  is_active                       BOOLEAN NOT NULL DEFAULT true,
  email_verified                  BOOLEAN NOT NULL DEFAULT false,
  email_verification_token        TEXT,
  email_verification_expires_at   TIMESTAMPTZ,
  email_otp                       TEXT,
  email_otp_expires_at            TIMESTAMPTZ,
  welcome_email_sent_at           TIMESTAMPTZ,
  last_seen_at                    TIMESTAMPTZ,
  referral_code                   TEXT,
  referred_by                     UUID REFERENCES users(id) ON DELETE SET NULL,
  advisor_id                      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx          ON users (LOWER(email));
CREATE UNIQUE INDEX IF NOT EXISTS users_personal_email_idx ON users (LOWER(personal_email)) WHERE personal_email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_mobile_idx         ON users (mobile) WHERE mobile IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code_idx  ON users (referral_code) WHERE referral_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_referred_by_idx           ON users (referred_by);
CREATE INDEX IF NOT EXISTS users_advisor_id_idx            ON users (advisor_id);

-- ---------------------------------------------------------------------------
-- PASSWORD RESET TOKENS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         SERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- USER DETAILS  (personal info used in applications)
-- ---------------------------------------------------------------------------
-- `user_details` is the canonical store for shared profile data. Both
-- /app/my-details and /app/application/new write to this table so they
-- stay 100% in sync. The names (first/middle/last) remain on the `users`
-- table — everything else profile-related lives here.
CREATE TABLE IF NOT EXISTS user_details (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Personal information (names live in `users` but mirrored here for legacy reads)
  first_name                      TEXT,
  middle_name                     TEXT,
  last_name                       TEXT,
  email                           TEXT,
  mobile_number                   TEXT,
  gender                          TEXT,
  marital_status                  TEXT,
  single_full_name                TEXT,
  date_of_birth                   DATE,
  birth_place                     TEXT,
  country_of_birth                TEXT,

  -- Address
  house_number                    TEXT,
  street_name                     TEXT,
  city                            TEXT,
  province                        TEXT,
  country                         TEXT,
  zipcode                         TEXT,

  -- Elementary school
  elementary_school               TEXT,
  elementary_city                 TEXT,
  elementary_province             TEXT,
  elementary_country              TEXT,
  elementary_years_attended       TEXT,
  elementary_start_date           DATE,
  elementary_end_date             DATE,

  -- High school
  high_school                     TEXT,
  high_school_city                TEXT,
  high_school_province            TEXT,
  high_school_country             TEXT,
  high_school_years_attended      TEXT,
  high_school_start_date          DATE,
  high_school_end_date            DATE,
  high_school_graduated           TEXT,
  high_school_diploma_type        TEXT,
  high_school_diploma_date        DATE,

  -- Nursing school
  nursing_school                  TEXT,
  nursing_school_city             TEXT,
  nursing_school_province         TEXT,
  nursing_school_country          TEXT,
  nursing_school_years_attended   TEXT,
  nursing_school_start_date       DATE,
  nursing_school_end_date         DATE,
  nursing_school_major            TEXT,
  nursing_school_diploma_date     DATE,

  -- Signature & misc legacy fields kept for back-compat
  signature                       TEXT,
  nationality                     TEXT,
  passport_number                 TEXT,
  passport_expiry                 DATE,
  address                         TEXT,
  state                           TEXT,
  zip                             TEXT,
  ssn                             TEXT,
  license_number                  TEXT,
  license_state                   TEXT,
  license_expiry                  DATE,
  school_name                     TEXT,
  graduation_year                 INTEGER,
  degree                          TEXT,
  major                           TEXT,
  extra                           JSONB,

  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS user_details_user_id_idx ON user_details(user_id);

-- ---------------------------------------------------------------------------
-- USER DOCUMENTS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  file_path     TEXT NOT NULL,
  file_name     TEXT,
  file_size     INTEGER,
  mime_type     TEXT,
  status        TEXT NOT NULL DEFAULT 'pending',
  notes         TEXT,
  reviewed_by   UUID REFERENCES users(id),
  reviewed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS user_documents_user_id_idx ON user_documents(user_id);

-- ---------------------------------------------------------------------------
-- USER PREFERENCES
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_preferences (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key        TEXT NOT NULL,
  value      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, key)
);

-- ---------------------------------------------------------------------------
-- SETTINGS  (admin-managed key/value store)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  id         SERIAL PRIMARY KEY,
  key        TEXT NOT NULL UNIQUE,
  value      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- SERVICES
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS services (
  id               TEXT PRIMARY KEY,
  service_name     TEXT NOT NULL,
  state            TEXT NOT NULL DEFAULT 'All States',
  payment_type     TEXT NOT NULL DEFAULT 'full',
  description      TEXT,
  line_items       JSONB,
  total_full       NUMERIC(10,2),
  total_installment NUMERIC(10,2),
  installment_months INTEGER,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(service_name, state, payment_type)
);

-- ---------------------------------------------------------------------------
-- SERVICE REQUIRED DOCUMENTS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_required_documents (
  id            SERIAL PRIMARY KEY,
  service_id    TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  label         TEXT,
  required      BOOLEAN NOT NULL DEFAULT true,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- APPLICATIONS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS applications (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grit_app_id      TEXT UNIQUE,
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_id       TEXT REFERENCES services(id),
  application_type TEXT NOT NULL DEFAULT 'nclex',
  status           TEXT NOT NULL DEFAULT 'pending',
  state            TEXT,
  notes            TEXT,
  admin_notes      TEXT,
  payment_type     TEXT,
  promo_code       TEXT,
  discount_amount  NUMERIC(10,2),
  total_amount     NUMERIC(10,2),
  paid_amount      NUMERIC(10,2),
  extra            JSONB,
  submitted_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS applications_user_id_idx ON applications(user_id);
CREATE INDEX IF NOT EXISTS applications_status_idx  ON applications(status);

-- ---------------------------------------------------------------------------
-- APPLICATION PAYMENTS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS application_payments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id   UUID REFERENCES applications(id) ON DELETE SET NULL,
  amount           NUMERIC(10,2) NOT NULL,
  currency         TEXT NOT NULL DEFAULT 'usd',
  payment_type     TEXT,
  status           TEXT NOT NULL DEFAULT 'pending',
  payment_method   TEXT,
  stripe_intent_id TEXT,
  receipt_url      TEXT,
  notes            TEXT,
  due_date         DATE,
  paid_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS application_payments_application_id_idx ON application_payments(application_id);

-- ---------------------------------------------------------------------------
-- APPLICATION TIMELINE STEPS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS application_timeline_steps (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  step_number    INTEGER NOT NULL,
  title          TEXT NOT NULL,
  description    TEXT,
  status         TEXT NOT NULL DEFAULT 'pending',
  documents      JSONB,
  notes          TEXT,
  admin_notes    TEXT,
  completed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS timeline_steps_application_id_idx ON application_timeline_steps(application_id);

-- ---------------------------------------------------------------------------
-- NOTIFICATIONS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  body       TEXT,
  type       TEXT NOT NULL DEFAULT 'info',
  is_read    BOOLEAN NOT NULL DEFAULT false,
  link       TEXT,
  extra      JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);

-- ---------------------------------------------------------------------------
-- QUOTATIONS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quotations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  full_name      TEXT,
  email          TEXT,
  mobile         TEXT,
  state          TEXT,
  service_type   TEXT,
  notes          TEXT,
  amount         NUMERIC(10,2),
  status         TEXT NOT NULL DEFAULT 'pending',
  stripe_intent_id TEXT,
  paid_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- PROMO CODES
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS promo_codes (
  id                 SERIAL PRIMARY KEY,
  code               TEXT NOT NULL UNIQUE,
  discount_type      TEXT NOT NULL DEFAULT 'percent',
  discount_value     NUMERIC(10,2) NOT NULL,
  max_uses           INTEGER,
  uses_count         INTEGER NOT NULL DEFAULT 0,
  min_amount         NUMERIC(10,2),
  applicable_types   TEXT[],
  expires_at         TIMESTAMPTZ,
  is_active          BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- PARTNER AGENCIES
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS partner_agencies (
  id                   SERIAL PRIMARY KEY,
  name                 TEXT NOT NULL,
  country              TEXT,
  contact              TEXT,
  email                TEXT,
  phone                TEXT,
  website              TEXT,
  address              TEXT,
  city                 TEXT,
  state                TEXT,
  zipcode              TEXT,
  contact_person_name  TEXT,
  contact_person_email TEXT,
  contact_person_phone TEXT,
  notes                TEXT,
  is_active            BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- NCLEX SPONSORSHIPS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nclex_sponsorships (
  id             SERIAL PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sponsor_name   TEXT,
  sponsor_email  TEXT,
  sponsor_mobile TEXT,
  amount         NUMERIC(10,2),
  status         TEXT NOT NULL DEFAULT 'pending',
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- PROCESSING ACCOUNTS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS processing_accounts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_type   TEXT NOT NULL,
  username       TEXT,
  password_hint  TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS processing_accounts_user_id_idx ON processing_accounts(user_id);

-- ---------------------------------------------------------------------------
-- TESTIMONIALS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS testimonials (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  role        TEXT,
  content     TEXT NOT NULL,
  rating      INTEGER DEFAULT 5,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- CAREERS  &  CAREER APPLICATIONS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS careers (
  id                       SERIAL PRIMARY KEY,
  title                    TEXT NOT NULL,
  department               TEXT,
  location                 TEXT,
  type                     TEXT DEFAULT 'full-time',
  description              TEXT,
  requirements             TEXT,
  responsibilities         TEXT,
  employment_type          TEXT,
  salary_range             TEXT,
  is_featured              BOOLEAN NOT NULL DEFAULT false,
  application_deadline     TIMESTAMPTZ,
  application_instructions TEXT,
  partner_agency_id        INTEGER REFERENCES partner_agencies(id) ON DELETE SET NULL,
  views_count              INTEGER NOT NULL DEFAULT 0,
  applications_count       INTEGER NOT NULL DEFAULT 0,
  created_by               UUID REFERENCES users(id) ON DELETE SET NULL,
  is_active                BOOLEAN NOT NULL DEFAULT true,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS career_applications (
  id                        SERIAL PRIMARY KEY,
  career_id                 INTEGER REFERENCES careers(id) ON DELETE SET NULL,
  user_id                   UUID REFERENCES users(id) ON DELETE SET NULL,
  full_name                 TEXT,
  first_name                TEXT,
  last_name                 TEXT,
  email                     TEXT NOT NULL,
  mobile                    TEXT,
  mobile_number             TEXT,
  date_of_birth             DATE,
  country                   TEXT,
  nursing_school            TEXT,
  graduation_date           DATE,
  years_of_experience       TEXT,
  current_employment_status TEXT,
  license_number            TEXT,
  license_state             TEXT,
  resume_path               TEXT,
  cover_letter              TEXT,
  cover_letter_path         TEXT,
  additional_documents_path TEXT,
  partner_agency_id         INTEGER REFERENCES partner_agencies(id) ON DELETE SET NULL,
  forwarded_to_agency_at    TIMESTAMPTZ,
  forwarded_email_sent      BOOLEAN NOT NULL DEFAULT false,
  status                    TEXT NOT NULL DEFAULT 'pending',
  notes                     TEXT,
  admin_notes               TEXT,
  reviewed_by               UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at               TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- DONATIONS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS donations (
  id               SERIAL PRIMARY KEY,
  donor_name       TEXT,
  donor_email      TEXT,
  amount           NUMERIC(10,2) NOT NULL,
  currency         TEXT NOT NULL DEFAULT 'usd',
  message          TEXT,
  stripe_intent_id TEXT,
  status           TEXT NOT NULL DEFAULT 'pending',
  donated_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- MESSAGES  (also created in startup migrations — safe duplicate via IF NOT EXISTS)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
  subject      TEXT,
  body         TEXT NOT NULL,
  is_read      BOOLEAN NOT NULL DEFAULT false,
  read_at      TIMESTAMPTZ,
  edited_at    TIMESTAMPTZ,
  deleted_at   TIMESTAMPTZ,
  attachments  JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id    ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at   ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_pair         ON messages(sender_id, recipient_id, created_at);

-- ---------------------------------------------------------------------------
-- CONVERSATIONS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_ids UUID[],
  last_message   TEXT,
  last_message_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- EMAIL ADDRESSES
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_addresses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  address     TEXT NOT NULL,
  label       TEXT,
  is_primary  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS email_addresses_user_id_idx ON email_addresses(user_id);

-- ---------------------------------------------------------------------------
-- EMAIL LOGS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_logs (
  id           SERIAL PRIMARY KEY,
  to_address   TEXT NOT NULL,
  from_address TEXT,
  subject      TEXT,
  body         TEXT,
  status       TEXT NOT NULL DEFAULT 'sent',
  error        TEXT,
  sent_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- EMAIL TEMPLATES
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_templates (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  subject    TEXT NOT NULL,
  html_body  TEXT NOT NULL,
  text_body  TEXT,
  variables  TEXT[],
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- EMAIL QUEUE
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_queue (
  id             SERIAL PRIMARY KEY,
  to_address     TEXT NOT NULL,
  from_address   TEXT,
  subject        TEXT,
  html_body      TEXT,
  text_body      TEXT,
  status         TEXT NOT NULL DEFAULT 'pending',
  retry_count    INTEGER NOT NULL DEFAULT 0,
  scheduled_at   TIMESTAMPTZ,
  processed_at   TIMESTAMPTZ,
  error          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- EMAIL ANALYTICS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_analytics (
  id          SERIAL PRIMARY KEY,
  email_id    INTEGER REFERENCES email_logs(id) ON DELETE SET NULL,
  event_type  TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- EMAIL SUBSCRIBERS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_subscribers (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  first_name    TEXT,
  last_name     TEXT,
  is_subscribed BOOLEAN NOT NULL DEFAULT true,
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- SUBSCRIBER STATS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscriber_stats (
  id                SERIAL PRIMARY KEY,
  date              DATE NOT NULL UNIQUE,
  new_subscribers   INTEGER NOT NULL DEFAULT 0,
  unsubscribes      INTEGER NOT NULL DEFAULT 0,
  total_subscribers INTEGER NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------------------
-- NEWSLETTER SUBSCRIPTIONS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS newsletter_subscriptions (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  first_name    TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- EMAIL SIGNATURES
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_signatures (
  id         SERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  html       TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- BUSINESS LOGOS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS business_logos (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  file_path   TEXT NOT NULL,
  is_default  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- SESSIONS  (application-level sessions, not auth)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data       JSONB,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- EXCHANGE RATES
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exchange_rates (
  id           SERIAL PRIMARY KEY,
  from_currency TEXT NOT NULL,
  to_currency  TEXT NOT NULL,
  rate         NUMERIC(18,6) NOT NULL,
  fetched_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(from_currency, to_currency)
);

-- ---------------------------------------------------------------------------
-- VISA BULLETIN CACHE
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS visa_bulletin_cache (
  id           SERIAL PRIMARY KEY,
  month        TEXT NOT NULL,
  year         INTEGER NOT NULL,
  data         JSONB NOT NULL,
  fetched_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(month, year)
);

-- ---------------------------------------------------------------------------
-- VISA BULLETIN EMAIL LOG
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS visa_bulletin_email_log (
  id         SERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- FILE STORAGE  (binary file data stored in PostgreSQL)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS file_storage (
  id           SERIAL PRIMARY KEY,
  storage_key  TEXT NOT NULL UNIQUE,
  data         BYTEA NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  file_size    INTEGER,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS file_storage_key_idx ON file_storage(storage_key);

-- ---------------------------------------------------------------------------
-- QUESTION BANK  (also created in startup migrations)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS question_bank (
  id                  SERIAL PRIMARY KEY,
  question_text       TEXT NOT NULL,
  question_type       TEXT NOT NULL DEFAULT 'single',
  content_area        TEXT,
  subcategory         TEXT,
  difficulty          TEXT NOT NULL DEFAULT 'medium',
  cognitive_level     TEXT DEFAULT 'Application',
  is_ngn              BOOLEAN NOT NULL DEFAULT false,
  options             JSONB,
  correct_answer      JSONB,
  rationale           TEXT,
  tags                TEXT[],
  case_study_group    VARCHAR(100),
  case_study_scenario TEXT,
  case_study_id       INTEGER,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- TEST SESSIONS  (also created in startup migrations)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS test_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  mode            TEXT NOT NULL DEFAULT 'practice',
  num_questions   INTEGER NOT NULL DEFAULT 75,
  content_areas   TEXT[],
  difficulty      TEXT,
  status          TEXT NOT NULL DEFAULT 'in_progress',
  time_limit      INTEGER,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  score           NUMERIC(5,2),
  total_questions INTEGER,
  correct_count   INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- SESSION RESPONSES  (also created in startup migrations)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS session_responses (
  id                  SERIAL PRIMARY KEY,
  session_id          UUID NOT NULL REFERENCES test_sessions(id) ON DELETE CASCADE,
  question_id         INTEGER NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
  answer              JSONB,
  is_correct          BOOLEAN,
  time_spent          INTEGER,
  marked_for_review   BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS session_responses_session_id_idx ON session_responses(session_id);

-- ---------------------------------------------------------------------------
-- CASE STUDIES  (also created in startup migrations)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS case_studies (
  id           SERIAL PRIMARY KEY,
  title        TEXT NOT NULL,
  scenario     TEXT NOT NULL,
  content_area TEXT,
  difficulty   TEXT DEFAULT 'medium',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- USER QUESTION BOOKMARKS  (also created in startup migrations)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_question_bookmarks (
  id          SERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_uqb_user_id ON user_question_bookmarks(user_id);

-- ---------------------------------------------------------------------------
-- NCLEX PAYMENT SUBMISSIONS  (also created in startup migrations)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nclex_payment_submissions (
  id              SERIAL PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan            VARCHAR(20) NOT NULL,
  payment_method  VARCHAR(50),
  payment_reference VARCHAR(200),
  payment_amount  NUMERIC(10,2),
  screenshot_url  TEXT,
  notes           TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  reviewed_by     UUID REFERENCES users(id),
  reviewed_at     TIMESTAMP,
  review_notes    TEXT,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- validate_promo_code  (PostgreSQL function called by the API)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION validate_promo_code(
  p_code TEXT,
  p_amount NUMERIC,
  p_service_fee_amount NUMERIC DEFAULT NULL,
  p_application_type TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_promo   promo_codes%ROWTYPE;
  v_discount NUMERIC;
  v_result  JSONB;
BEGIN
  SELECT * INTO v_promo FROM promo_codes WHERE UPPER(code) = UPPER(p_code) AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid or inactive promo code');
  END IF;

  IF v_promo.expires_at IS NOT NULL AND v_promo.expires_at < NOW() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Promo code has expired');
  END IF;

  IF v_promo.max_uses IS NOT NULL AND v_promo.uses_count >= v_promo.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Promo code has reached its usage limit');
  END IF;

  IF v_promo.min_amount IS NOT NULL AND p_amount < v_promo.min_amount THEN
    RETURN jsonb_build_object('valid', false, 'error', format('Minimum order amount of $%s required', v_promo.min_amount));
  END IF;

  IF v_promo.discount_type = 'percent' THEN
    v_discount := ROUND(p_amount * (v_promo.discount_value / 100.0), 2);
  ELSE
    v_discount := LEAST(v_promo.discount_value, p_amount);
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'code', v_promo.code,
    'discount_type', v_promo.discount_type,
    'discount_value', v_promo.discount_value,
    'discount_amount', v_discount,
    'final_amount', GREATEST(0, p_amount - v_discount)
  );
END;
$$;

-- =============================================================================
-- Additional tables required by the admin email / workflow / analytics / docs
-- features. Added after the initial schema; safe to re-run (IF NOT EXISTS).
-- =============================================================================

-- ---- columns added to existing tables -------------------------------------
ALTER TABLE business_logos  ADD COLUMN IF NOT EXISTS usage_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE business_logos  ADD COLUMN IF NOT EXISTS associated_email TEXT;
ALTER TABLE business_logos  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS usage_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general';
ALTER TABLE email_signatures ADD COLUMN IF NOT EXISTS usage_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE email_subscribers ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE email_subscribers ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'subscribed';
ALTER TABLE email_subscribers ADD COLUMN IF NOT EXISTS unsubscribe_reason TEXT;
ALTER TABLE email_subscribers ADD COLUMN IF NOT EXISTS email_preferences JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE email_subscribers ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE email_subscribers ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE email_subscribers ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE email_subscribers ADD COLUMN IF NOT EXISTS last_email_sent_at TIMESTAMPTZ;
ALTER TABLE email_subscribers ADD COLUMN IF NOT EXISTS email_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE email_subscribers ADD COLUMN IF NOT EXISTS open_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE email_subscribers ADD COLUMN IF NOT EXISTS click_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE email_subscribers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE email_subscribers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE email_queue ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE email_queue ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ;
ALTER TABLE email_queue ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE email_queue ADD COLUMN IF NOT EXISTS provider_message_id TEXT;
ALTER TABLE email_queue ADD COLUMN IF NOT EXISTS provider_response JSONB;
ALTER TABLE email_queue ADD COLUMN IF NOT EXISTS error_message TEXT;

-- ---- notification types (admin-managed catalogue) -------------------------
CREATE TABLE IF NOT EXISTS notification_types (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key             TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  description     TEXT,
  icon            TEXT,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  default_enabled BOOLEAN NOT NULL DEFAULT true,
  config          JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- payment receipts ------------------------------------------------------
CREATE TABLE IF NOT EXISTS receipts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id     UUID REFERENCES application_payments(id) ON DELETE SET NULL,
  user_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
  receipt_number TEXT NOT NULL UNIQUE,
  amount         NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency       TEXT NOT NULL DEFAULT 'usd',
  items          JSONB NOT NULL DEFAULT '[]'::jsonb,
  payment_type   TEXT,
  payment_method TEXT,
  pdf_path       TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS receipts_payment_id_idx ON receipts(payment_id);

-- ---- cross-device signature handoff ---------------------------------------
CREATE TABLE IF NOT EXISTS temporary_signatures (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id         TEXT NOT NULL,
  application_id      UUID REFERENCES applications(id) ON DELETE CASCADE,
  document_name      TEXT,
  signature_data_url TEXT NOT NULL,
  is_consumed        BOOLEAN NOT NULL DEFAULT false,
  consumed_at        TIMESTAMPTZ,
  expires_at         TIMESTAMPTZ NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS temporary_signatures_session_idx ON temporary_signatures(session_id);

-- ---- received emails (inbound mail stored from a webhook) -----------------
CREATE TABLE IF NOT EXISTS received_emails (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resend_id                   TEXT,
  from_email                  TEXT NOT NULL,
  from_name                   TEXT,
  to_email                    TEXT NOT NULL,
  cc                          TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  bcc                         TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  reply_to                    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  subject                     TEXT,
  html_body                   TEXT,
  text_body                   TEXT,
  message_id                  TEXT,
  headers                     JSONB NOT NULL DEFAULT '{}'::jsonb,
  attachments                 JSONB NOT NULL DEFAULT '[]'::jsonb,
  received_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_read                     BOOLEAN NOT NULL DEFAULT false,
  is_deleted                  BOOLEAN NOT NULL DEFAULT false,
  recipient_user_id           UUID REFERENCES users(id) ON DELETE SET NULL,
  recipient_email_address_id  UUID REFERENCES email_addresses(id) ON DELETE SET NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS received_emails_to_email_idx ON received_emails(to_email);
CREATE INDEX IF NOT EXISTS received_emails_recipient_idx ON received_emails(recipient_user_id);

-- ---- email campaigns / newsletters ----------------------------------------
CREATE TABLE IF NOT EXISTS email_campaigns (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT NOT NULL,
  description          TEXT,
  subject              TEXT NOT NULL,
  body_html            TEXT NOT NULL DEFAULT '',
  body_text            TEXT,
  campaign_type        TEXT NOT NULL DEFAULT 'newsletter',
  recipient_type       TEXT NOT NULL DEFAULT 'subscribers',
  recipient_segment    JSONB NOT NULL DEFAULT '{}'::jsonb,
  recipient_list       TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  recipient_count      INTEGER NOT NULL DEFAULT 0,
  scheduled_for        TIMESTAMPTZ,
  timezone             TEXT,
  status               TEXT NOT NULL DEFAULT 'draft',
  send_rate            INTEGER NOT NULL DEFAULT 0,
  from_email_address_id UUID REFERENCES email_addresses(id) ON DELETE SET NULL,
  reply_to             TEXT,
  sent_count           INTEGER NOT NULL DEFAULT 0,
  delivered_count      INTEGER NOT NULL DEFAULT 0,
  opened_count         INTEGER NOT NULL DEFAULT 0,
  clicked_count        INTEGER NOT NULL DEFAULT 0,
  bounced_count        INTEGER NOT NULL DEFAULT 0,
  unsubscribed_count   INTEGER NOT NULL DEFAULT 0,
  failed_count         INTEGER NOT NULL DEFAULT 0,
  open_rate            NUMERIC(6,2) NOT NULL DEFAULT 0,
  click_rate           NUMERIC(6,2) NOT NULL DEFAULT 0,
  bounce_rate          NUMERIC(6,2) NOT NULL DEFAULT 0,
  created_by_user_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at              TIMESTAMPTZ,
  completed_at         TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS email_campaign_recipients (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id         UUID NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  subscriber_id       UUID,
  recipient_email     TEXT NOT NULL,
  recipient_name      TEXT,
  status              TEXT NOT NULL DEFAULT 'pending',
  sent_at             TIMESTAMPTZ,
  delivered_at        TIMESTAMPTZ,
  opened_at           TIMESTAMPTZ,
  clicked_at          TIMESTAMPTZ,
  bounced_at          TIMESTAMPTZ,
  unsubscribed_at     TIMESTAMPTZ,
  opened_count        INTEGER NOT NULL DEFAULT 0,
  clicked_count       INTEGER NOT NULL DEFAULT 0,
  last_opened_at      TIMESTAMPTZ,
  last_clicked_at     TIMESTAMPTZ,
  click_links         JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message       TEXT,
  provider_message_id TEXT,
  provider_response   JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS email_campaign_recipients_campaign_idx ON email_campaign_recipients(campaign_id);

-- ---- A/B tests for email campaigns ----------------------------------------
CREATE TABLE IF NOT EXISTS email_ab_tests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id         UUID REFERENCES email_campaigns(id) ON DELETE SET NULL,
  name                TEXT NOT NULL,
  description         TEXT,
  test_type           TEXT NOT NULL DEFAULT 'subject',
  variants            JSONB NOT NULL DEFAULT '[]'::jsonb,
  sample_size         INTEGER,
  sample_percentage   NUMERIC(6,2),
  winner_criteria     TEXT NOT NULL DEFAULT 'open_rate',
  winner_variant      TEXT,
  test_duration_hours INTEGER,
  auto_send_winner    BOOLEAN NOT NULL DEFAULT false,
  status              TEXT NOT NULL DEFAULT 'draft',
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  winner_selected_at  TIMESTAMPTZ,
  confidence_level    NUMERIC(6,2),
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_ab_test_results (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ab_test_id         UUID NOT NULL REFERENCES email_ab_tests(id) ON DELETE CASCADE,
  variant_name       TEXT NOT NULL,
  sent_count         INTEGER NOT NULL DEFAULT 0,
  delivered_count    INTEGER NOT NULL DEFAULT 0,
  opened_count       INTEGER NOT NULL DEFAULT 0,
  clicked_count      INTEGER NOT NULL DEFAULT 0,
  bounced_count      INTEGER NOT NULL DEFAULT 0,
  unsubscribed_count INTEGER NOT NULL DEFAULT 0,
  converted_count    INTEGER NOT NULL DEFAULT 0,
  open_rate          NUMERIC(6,2) NOT NULL DEFAULT 0,
  click_rate         NUMERIC(6,2) NOT NULL DEFAULT 0,
  bounce_rate        NUMERIC(6,2) NOT NULL DEFAULT 0,
  conversion_rate    NUMERIC(6,2) NOT NULL DEFAULT 0,
  engagement_score   NUMERIC(6,2) NOT NULL DEFAULT 0,
  avg_time_to_open   INTEGER,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ab_test_id, variant_name)
);

CREATE TABLE IF NOT EXISTS email_ab_test_recipients (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ab_test_id       UUID NOT NULL REFERENCES email_ab_tests(id) ON DELETE CASCADE,
  variant_name     TEXT NOT NULL,
  recipient_email  TEXT NOT NULL,
  recipient_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  email_log_id     INTEGER,
  sent_at          TIMESTAMPTZ,
  opened_at        TIMESTAMPTZ,
  clicked_at       TIMESTAMPTZ,
  converted_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS email_ab_test_recipients_test_idx ON email_ab_test_recipients(ab_test_id);

-- ---- automated workflows ---------------------------------------------------
CREATE TABLE IF NOT EXISTS workflows (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT NOT NULL,
  description          TEXT,
  is_active            BOOLEAN NOT NULL DEFAULT true,
  trigger_type         TEXT NOT NULL,
  trigger_conditions   JSONB NOT NULL DEFAULT '{}'::jsonb,
  actions              JSONB NOT NULL DEFAULT '[]'::jsonb,
  execution_order      TEXT NOT NULL DEFAULT 'sequential',
  stop_on_error        BOOLEAN NOT NULL DEFAULT true,
  auto_assign_enabled  BOOLEAN NOT NULL DEFAULT false,
  assignment_rules     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_executed_at     TIMESTAMPTZ,
  execution_count      INTEGER NOT NULL DEFAULT 0,
  success_count        INTEGER NOT NULL DEFAULT 0,
  failure_count        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id       UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  trigger_type      TEXT NOT NULL,
  trigger_event_id  TEXT,
  trigger_data      JSONB NOT NULL DEFAULT '{}'::jsonb,
  status            TEXT NOT NULL DEFAULT 'pending',
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  error_message     TEXT,
  actions_executed  INTEGER NOT NULL DEFAULT 0,
  actions_succeeded INTEGER NOT NULL DEFAULT 0,
  actions_failed    INTEGER NOT NULL DEFAULT 0,
  execution_log     JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS workflow_runs_workflow_idx ON workflow_runs(workflow_id);

CREATE TABLE IF NOT EXISTS workflow_triggers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id       UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  schedule_type     TEXT NOT NULL DEFAULT 'daily',
  schedule_config   JSONB NOT NULL DEFAULT '{}'::jsonb,
  timezone          TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  next_trigger_at   TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- analytics: cached results + saved custom reports ---------------------
CREATE TABLE IF NOT EXISTS analytics_cache (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key   TEXT NOT NULL UNIQUE,
  cache_data  JSONB NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS custom_reports (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT NOT NULL,
  description        TEXT,
  report_config      JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_public          BOOLEAN NOT NULL DEFAULT false,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_run_at        TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS report_schedules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id       UUID NOT NULL REFERENCES custom_reports(id) ON DELETE CASCADE,
  schedule_type   TEXT NOT NULL DEFAULT 'daily',
  schedule_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  recipients      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  format          TEXT NOT NULL DEFAULT 'pdf',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  last_run_at     TIMESTAMPTZ,
  next_run_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- read-only views the frontend queries ---------------------------------
CREATE OR REPLACE VIEW active_email_addresses AS
  SELECT * FROM email_addresses;

CREATE OR REPLACE VIEW ab_test_stats AS
  SELECT
    COUNT(*) FILTER (WHERE status = 'draft')     AS draft_count,
    COUNT(*) FILTER (WHERE status = 'running')   AS running_count,
    COUNT(*) FILTER (WHERE status = 'completed') AS completed_count,
    COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled_count,
    COUNT(*)                                     AS total_count,
    COALESCE(AVG(test_duration_hours), 0)        AS avg_test_duration_hours,
    COUNT(*) FILTER (WHERE winner_variant IS NOT NULL) AS tests_with_winners
  FROM email_ab_tests;

-- =============================================================================
-- RPC functions (called via POST /api/db/rpc/:fn). Analytics functions return
-- a JSON object; automation/usage helpers return void or a small result.
-- =============================================================================

-- generic counter bump used by the email subscriber tracking code
CREATE OR REPLACE FUNCTION increment(table_name TEXT, row_id TEXT, column_name TEXT, increment_by INTEGER DEFAULT 1)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE allowed TEXT[] := ARRAY['email_subscribers'];
BEGIN
  IF NOT (table_name = ANY(allowed)) THEN RETURN; END IF;
  EXECUTE format('UPDATE %I SET %I = COALESCE(%I,0) + $1 WHERE id::text = $2', table_name, column_name, column_name)
    USING increment_by, row_id;
END; $$;

CREATE OR REPLACE FUNCTION increment_logo_usage(p_logo_id TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN UPDATE business_logos SET usage_count = COALESCE(usage_count,0) + 1 WHERE id::text = p_logo_id; END; $$;

CREATE OR REPLACE FUNCTION increment_template_usage(p_template_id TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN UPDATE email_templates SET usage_count = COALESCE(usage_count,0) + 1 WHERE id::text = p_template_id; END; $$;

-- email queue automation -----------------------------------------------------
CREATE OR REPLACE FUNCTION get_pending_emails_to_send(limit_count INTEGER DEFAULT 50)
RETURNS SETOF email_queue LANGUAGE sql AS $$
  SELECT * FROM email_queue WHERE status = 'pending' ORDER BY created_at ASC LIMIT limit_count;
$$;

CREATE OR REPLACE FUNCTION mark_email_processing(queue_id INTEGER)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN UPDATE email_queue SET status = 'processing' WHERE id = queue_id; END; $$;

CREATE OR REPLACE FUNCTION mark_email_sent(queue_id INTEGER, provider_message_id TEXT DEFAULT NULL, provider_response JSONB DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN UPDATE email_queue SET status = 'sent', sent_at = NOW(), provider_message_id = $2, provider_response = $3 WHERE id = queue_id; END; $$;

CREATE OR REPLACE FUNCTION mark_email_failed(queue_id INTEGER, error_message TEXT DEFAULT NULL, provider_response JSONB DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN UPDATE email_queue SET status = 'failed', failed_at = NOW(), error_message = $2, provider_response = $3 WHERE id = queue_id; END; $$;

-- campaign / workflow / ab-test bookkeeping ---------------------------------
CREATE OR REPLACE FUNCTION update_campaign_stats(p_campaign_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  UPDATE email_campaigns c SET
    sent_count       = (SELECT COUNT(*) FROM email_campaign_recipients r WHERE r.campaign_id = c.id AND r.status <> 'pending'),
    opened_count     = (SELECT COUNT(*) FROM email_campaign_recipients r WHERE r.campaign_id = c.id AND r.opened_at IS NOT NULL),
    clicked_count    = (SELECT COUNT(*) FROM email_campaign_recipients r WHERE r.campaign_id = c.id AND r.clicked_at IS NOT NULL),
    bounced_count    = (SELECT COUNT(*) FROM email_campaign_recipients r WHERE r.campaign_id = c.id AND r.status = 'bounced'),
    updated_at = NOW()
  WHERE c.id = p_campaign_id;
  UPDATE email_campaigns SET
    open_rate   = CASE WHEN sent_count > 0 THEN ROUND(100.0 * opened_count / sent_count, 2) ELSE 0 END,
    click_rate  = CASE WHEN sent_count > 0 THEN ROUND(100.0 * clicked_count / sent_count, 2) ELSE 0 END,
    bounce_rate = CASE WHEN sent_count > 0 THEN ROUND(100.0 * bounced_count / sent_count, 2) ELSE 0 END
  WHERE id = p_campaign_id;
END; $$;

CREATE OR REPLACE FUNCTION log_workflow_run(p_workflow_id UUID, p_trigger_type TEXT, p_trigger_event_id TEXT DEFAULT NULL, p_trigger_data JSONB DEFAULT '{}'::jsonb)
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO workflow_runs (workflow_id, trigger_type, trigger_event_id, trigger_data, status, started_at)
  VALUES (p_workflow_id, p_trigger_type, p_trigger_event_id, p_trigger_data, 'running', NOW())
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION update_workflow_stats(p_workflow_id UUID, p_success BOOLEAN)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  UPDATE workflows SET
    execution_count = COALESCE(execution_count,0) + 1,
    success_count   = COALESCE(success_count,0) + (CASE WHEN p_success THEN 1 ELSE 0 END),
    failure_count   = COALESCE(failure_count,0) + (CASE WHEN p_success THEN 0 ELSE 1 END),
    last_executed_at = NOW()
  WHERE id = p_workflow_id;
END; $$;

CREATE OR REPLACE FUNCTION get_active_workflows_for_trigger(p_trigger_type TEXT)
RETURNS SETOF workflows LANGUAGE sql AS $$
  SELECT * FROM workflows WHERE is_active = true AND trigger_type = p_trigger_type ORDER BY created_at ASC;
$$;

CREATE OR REPLACE FUNCTION calculate_ab_test_metrics(p_ab_test_id UUID)
RETURNS SETOF email_ab_test_results LANGUAGE sql AS $$ SELECT * FROM email_ab_test_results WHERE ab_test_id = p_ab_test_id; $$;

CREATE OR REPLACE FUNCTION determine_ab_test_winner(p_ab_test_id UUID)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE v_winner TEXT;
BEGIN
  SELECT variant_name INTO v_winner FROM email_ab_test_results WHERE ab_test_id = p_ab_test_id ORDER BY open_rate DESC, click_rate DESC LIMIT 1;
  RETURN v_winner;
END; $$;

-- subscriber segments --------------------------------------------------------
CREATE OR REPLACE FUNCTION get_subscriber_count_by_segment(p_segment JSONB DEFAULT '{}'::jsonb)
RETURNS INTEGER LANGUAGE sql AS $$ SELECT COUNT(*)::int FROM email_subscribers WHERE COALESCE(status,'subscribed') = 'subscribed'; $$;

CREATE OR REPLACE FUNCTION get_subscribers_for_segment(p_segment JSONB DEFAULT '{}'::jsonb)
RETURNS SETOF email_subscribers LANGUAGE sql AS $$ SELECT * FROM email_subscribers WHERE COALESCE(status,'subscribed') = 'subscribed'; $$;

CREATE OR REPLACE FUNCTION unsubscribe_email(p_email TEXT, p_reason TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN UPDATE email_subscribers SET status='unsubscribed', is_subscribed=false, unsubscribed_at=NOW(), unsubscribe_reason=p_reason WHERE LOWER(email)=LOWER(p_email); END; $$;

CREATE OR REPLACE FUNCTION resubscribe_email(p_email TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN UPDATE email_subscribers SET status='subscribed', is_subscribed=true, unsubscribed_at=NULL, unsubscribe_reason=NULL WHERE LOWER(email)=LOWER(p_email); END; $$;

CREATE OR REPLACE FUNCTION update_email_preferences(p_email TEXT, p_preferences JSONB)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN UPDATE email_subscribers SET email_preferences = p_preferences, updated_at = NOW() WHERE LOWER(email)=LOWER(p_email); END; $$;

-- template / signature rendering helpers ------------------------------------
CREATE OR REPLACE FUNCTION render_email_template(p_template_id TEXT, p_variables JSONB DEFAULT '{}'::jsonb)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE v_t email_templates%ROWTYPE;
BEGIN
  SELECT * INTO v_t FROM email_templates WHERE id::text = p_template_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('subject','', 'html','', 'text',''); END IF;
  RETURN jsonb_build_object('subject', v_t.subject, 'html', v_t.html_body, 'text', COALESCE(v_t.text_body,''));
END; $$;

CREATE OR REPLACE FUNCTION generate_signature_html(p_signature_id TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE v_html TEXT;
BEGIN SELECT html INTO v_html FROM email_signatures WHERE id::text = p_signature_id; RETURN COALESCE(v_html,''); END; $$;

CREATE OR REPLACE FUNCTION refresh_email_analytics()
RETURNS VOID LANGUAGE plpgsql AS $$ BEGIN RETURN; END; $$;

-- reminder generation (returns the number of notifications created) ----------
CREATE OR REPLACE FUNCTION generate_document_reminders()
RETURNS INTEGER LANGUAGE plpgsql AS $$ BEGIN RETURN 0; END; $$;

CREATE OR REPLACE FUNCTION generate_payment_reminders()
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE v_count INTEGER := 0;
BEGIN
  INSERT INTO notifications (user_id, type, title, message)
  SELECT DISTINCT a.user_id, 'payment_reminder', 'Payment reminder', 'You have a pending payment for your application.'
  FROM application_payments p JOIN applications a ON a.id = p.application_id
  WHERE p.status = 'pending' AND a.user_id IS NOT NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
EXCEPTION WHEN OTHERS THEN RETURN 0;
END; $$;

CREATE OR REPLACE FUNCTION generate_profile_completion_reminders()
RETURNS INTEGER LANGUAGE plpgsql AS $$ BEGIN RETURN 0; END; $$;

CREATE OR REPLACE FUNCTION check_missing_documents(p_user_id UUID)
RETURNS JSONB LANGUAGE sql AS $$ SELECT '[]'::jsonb; $$;

CREATE OR REPLACE FUNCTION check_incomplete_profile(p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql AS $$
  SELECT NOT EXISTS (SELECT 1 FROM user_details WHERE user_id = p_user_id);
$$;

CREATE OR REPLACE FUNCTION notify_credentialing_reminder(p_application_id UUID DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql AS $$ BEGIN RETURN; END; $$;

-- analytics dashboards -------------------------------------------------------
CREATE OR REPLACE FUNCTION get_application_analytics(p_start_date TIMESTAMPTZ DEFAULT NULL, p_end_date TIMESTAMPTZ DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE s TIMESTAMPTZ := COALESCE(p_start_date, NOW() - INTERVAL '30 days'); e TIMESTAMPTZ := COALESCE(p_end_date, NOW());
BEGIN
  RETURN jsonb_build_object(
    'total',     (SELECT COUNT(*) FROM applications WHERE created_at BETWEEN s AND e),
    'pending',   (SELECT COUNT(*) FROM applications WHERE status = 'pending' AND created_at BETWEEN s AND e),
    'completed', (SELECT COUNT(*) FROM applications WHERE status IN ('completed','Completed') AND created_at BETWEEN s AND e),
    'rejected',  (SELECT COUNT(*) FROM applications WHERE status = 'rejected' AND created_at BETWEEN s AND e),
    'by_status', COALESCE((SELECT jsonb_object_agg(status, c) FROM (SELECT status, COUNT(*) c FROM applications WHERE created_at BETWEEN s AND e GROUP BY status) t), '{}'::jsonb),
    'by_day',    COALESCE((SELECT jsonb_agg(jsonb_build_object('date', d, 'count', c) ORDER BY d) FROM (SELECT date_trunc('day', created_at)::date d, COUNT(*) c FROM applications WHERE created_at BETWEEN s AND e GROUP BY 1) t), '[]'::jsonb)
  );
END; $$;

CREATE OR REPLACE FUNCTION get_financial_analytics(p_start_date TIMESTAMPTZ DEFAULT NULL, p_end_date TIMESTAMPTZ DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE s TIMESTAMPTZ := COALESCE(p_start_date, NOW() - INTERVAL '30 days'); e TIMESTAMPTZ := COALESCE(p_end_date, NOW());
BEGIN
  RETURN jsonb_build_object(
    'total_revenue',      (SELECT COALESCE(SUM(amount),0) FROM application_payments WHERE status = 'paid' AND created_at BETWEEN s AND e),
    'pending_revenue',    (SELECT COALESCE(SUM(amount),0) FROM application_payments WHERE status = 'pending' AND created_at BETWEEN s AND e),
    'payment_count',      (SELECT COUNT(*) FROM application_payments WHERE status = 'paid' AND created_at BETWEEN s AND e),
    'donations_total',    (SELECT COALESCE(SUM(amount),0) FROM donations WHERE status IN ('paid','completed','succeeded') AND created_at BETWEEN s AND e),
    'quotations_total',   (SELECT COALESCE(SUM(amount),0) FROM quotations WHERE status = 'paid' AND created_at BETWEEN s AND e),
    'by_day',             COALESCE((SELECT jsonb_agg(jsonb_build_object('date', d, 'amount', amt) ORDER BY d) FROM (SELECT date_trunc('day', created_at)::date d, SUM(amount) amt FROM application_payments WHERE status='paid' AND created_at BETWEEN s AND e GROUP BY 1) t), '[]'::jsonb)
  );
END; $$;

CREATE OR REPLACE FUNCTION get_user_analytics(p_start_date TIMESTAMPTZ DEFAULT NULL, p_end_date TIMESTAMPTZ DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE s TIMESTAMPTZ := COALESCE(p_start_date, NOW() - INTERVAL '30 days'); e TIMESTAMPTZ := COALESCE(p_end_date, NOW());
BEGIN
  RETURN jsonb_build_object(
    'total_users',  (SELECT COUNT(*) FROM users),
    'new_users',    (SELECT COUNT(*) FROM users WHERE created_at BETWEEN s AND e),
    'clients',      (SELECT COUNT(*) FROM users WHERE role = 'client'),
    'admins',       (SELECT COUNT(*) FROM users WHERE role = 'admin'),
    'verified',     (SELECT COUNT(*) FROM users WHERE email_verified = true),
    'by_day',       COALESCE((SELECT jsonb_agg(jsonb_build_object('date', d, 'count', c) ORDER BY d) FROM (SELECT date_trunc('day', created_at)::date d, COUNT(*) c FROM users WHERE created_at BETWEEN s AND e GROUP BY 1) t), '[]'::jsonb)
  );
END; $$;

CREATE OR REPLACE FUNCTION get_document_analytics(p_start_date TIMESTAMPTZ DEFAULT NULL, p_end_date TIMESTAMPTZ DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE s TIMESTAMPTZ := COALESCE(p_start_date, NOW() - INTERVAL '30 days'); e TIMESTAMPTZ := COALESCE(p_end_date, NOW());
BEGIN
  RETURN jsonb_build_object(
    'total_documents',    (SELECT COUNT(*) FROM user_documents),
    'uploaded_in_range',  (SELECT COUNT(*) FROM user_documents WHERE created_at BETWEEN s AND e),
    'pending_review',     (SELECT COUNT(*) FROM user_documents WHERE status = 'pending'),
    'approved',           (SELECT COUNT(*) FROM user_documents WHERE status IN ('approved','verified')),
    'by_type',            COALESCE((SELECT jsonb_object_agg(document_type, c) FROM (SELECT document_type, COUNT(*) c FROM user_documents GROUP BY document_type) t), '{}'::jsonb)
  );
END; $$;

-- =============================================================================
-- SCHEMA MIGRATIONS — idempotent, safe to re-run.
-- Keeps existing databases aligned with what the app expects.
-- =============================================================================

-- ── services: staggered-payment + tax fields used by Admin → Settings → Services
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS total_step1 NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS total_step2 NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS tax_amount  NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS tax_step1   NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS tax_step2   NUMERIC(10,2);

-- ── service_required_documents: columns expected by the admin UI
ALTER TABLE service_required_documents
  ADD COLUMN IF NOT EXISTS service_type     TEXT,
  ADD COLUMN IF NOT EXISTS name             TEXT,
  ADD COLUMN IF NOT EXISTS accepted_formats TEXT[] NOT NULL DEFAULT ARRAY['.pdf','.jpg','.jpeg','.png'],
  ADD COLUMN IF NOT EXISTS sort_order       INTEGER NOT NULL DEFAULT 0;

-- The new admin UI keys requirements by service_type, not service_id; relax the
-- legacy FK column so inserts without a service_id are allowed.
ALTER TABLE service_required_documents
  ALTER COLUMN service_id DROP NOT NULL;

-- Backfill the new `name` column from the legacy `label` column if it exists
-- and is non-empty.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_required_documents' AND column_name = 'label'
  ) THEN
    EXECUTE 'UPDATE service_required_documents SET name = COALESCE(NULLIF(name, ''''), label) WHERE name IS NULL OR name = ''''';
  END IF;
END $$;

-- ── test_sessions / session_responses: the NCLEX question-bank routes write
-- columns the base schema doesn't define (session_type, settings,
-- time_started/completed, questions_answered, correct_answers — and on
-- session_responses: user_answer, answered_at, question_order). Without these
-- every /api/questions endpoint blows up with "column does not exist".
ALTER TABLE test_sessions
  ADD COLUMN IF NOT EXISTS session_type        TEXT,
  ADD COLUMN IF NOT EXISTS settings            JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS time_started        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS time_completed      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS questions_answered  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS correct_answers     INTEGER NOT NULL DEFAULT 0;

ALTER TABLE session_responses
  ADD COLUMN IF NOT EXISTS user_answer     JSONB,
  ADD COLUMN IF NOT EXISTS answered_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS question_order  INTEGER;

CREATE INDEX IF NOT EXISTS session_responses_answered_at_idx
  ON session_responses(session_id, answered_at);

-- ── user_documents: legacy `filename` alias + `uploaded_at` timestamp the
-- admin client UI writes during upload. The base schema only has file_name +
-- created_at; without these aliases, the insert in userDocumentsAPI.upload()
-- fails with "column filename of relation user_documents does not exist".
ALTER TABLE user_documents
  ADD COLUMN IF NOT EXISTS filename    TEXT,
  ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ;

UPDATE user_documents
SET uploaded_at = COALESCE(uploaded_at, created_at, NOW())
WHERE uploaded_at IS NULL;

ALTER TABLE user_documents
  ALTER COLUMN uploaded_at SET DEFAULT NOW();

-- ── promo_codes: columns the admin Promo Codes settings page reads/writes.
-- The legacy schema (`uses_count`, `expires_at`, `applicable_types`) stays in
-- place for the validate_promo_code() RPC; these aliases give the admin UI the
-- columns it expects (description, application_type, current_uses, valid_*).
ALTER TABLE promo_codes
  ADD COLUMN IF NOT EXISTS description      TEXT,
  ADD COLUMN IF NOT EXISTS application_type TEXT,
  ADD COLUMN IF NOT EXISTS current_uses     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valid_from       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS valid_until      TIMESTAMPTZ;

-- Keep the legacy and new "expiry" / "uses" columns in sync so the RPC and the
-- admin UI never disagree about the same promo code.
CREATE OR REPLACE FUNCTION promo_codes_sync_columns()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Sync expiry: whichever side was set, mirror to the other.
  IF NEW.valid_until IS DISTINCT FROM OLD.valid_until OR TG_OP = 'INSERT' THEN
    NEW.expires_at := COALESCE(NEW.valid_until, NEW.expires_at);
  END IF;
  IF NEW.expires_at IS DISTINCT FROM OLD.expires_at OR TG_OP = 'INSERT' THEN
    NEW.valid_until := COALESCE(NEW.valid_until, NEW.expires_at);
  END IF;
  -- Sync usage counters.
  IF NEW.current_uses IS DISTINCT FROM OLD.current_uses OR TG_OP = 'INSERT' THEN
    NEW.uses_count := COALESCE(NEW.current_uses, NEW.uses_count, 0);
  END IF;
  IF NEW.uses_count IS DISTINCT FROM OLD.uses_count OR TG_OP = 'INSERT' THEN
    NEW.current_uses := COALESCE(NEW.uses_count, NEW.current_uses, 0);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS promo_codes_sync_columns_trg ON promo_codes;
CREATE TRIGGER promo_codes_sync_columns_trg
  BEFORE INSERT OR UPDATE ON promo_codes
  FOR EACH ROW EXECUTE FUNCTION promo_codes_sync_columns();

-- One-time backfill so existing rows have the new columns populated.
UPDATE promo_codes
SET valid_until  = COALESCE(valid_until, expires_at),
    current_uses = COALESCE(current_uses, uses_count, 0);

-- ── users: avatar design preference selected by the user
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS default_avatar_design TEXT;

-- ── email_addresses: full-feature mail-system shape used by the admin email
-- pages and Header.tsx. The bare baseline created above only has
-- {id,user_id,address,label,is_primary,...}; expand it here.
ALTER TABLE email_addresses
  ADD COLUMN IF NOT EXISTS email_address        TEXT,
  ADD COLUMN IF NOT EXISTS display_name         TEXT,
  ADD COLUMN IF NOT EXISTS is_system_address    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS address_type         TEXT NOT NULL DEFAULT 'client',
  ADD COLUMN IF NOT EXISTS department           TEXT,
  ADD COLUMN IF NOT EXISTS is_active            BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_verified          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_send             BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_receive          BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS forward_to_email     TEXT,
  ADD COLUMN IF NOT EXISTS auto_reply_enabled   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_reply_message   TEXT,
  ADD COLUMN IF NOT EXISTS notes                TEXT,
  ADD COLUMN IF NOT EXISTS metadata             JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS verified_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_used_at         TIMESTAMPTZ;

-- System (admin/support/department) addresses have no owning user.
ALTER TABLE email_addresses
  ALTER COLUMN user_id DROP NOT NULL;

-- The legacy `address` column is unused by the app (writes go to
-- `email_address`); relax NOT NULL so new inserts succeed.
ALTER TABLE email_addresses
  ALTER COLUMN address DROP NOT NULL;

-- Backfill the new `email_address` column from the legacy `address`.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'email_addresses' AND column_name = 'address'
  ) THEN
    EXECUTE 'UPDATE email_addresses
                SET email_address = COALESCE(NULLIF(email_address, ''''), address)
              WHERE email_address IS NULL OR email_address = ''''';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS email_addresses_address_type_idx ON email_addresses(address_type);
CREATE INDEX IF NOT EXISTS email_addresses_email_address_idx ON email_addresses(email_address);
CREATE INDEX IF NOT EXISTS email_addresses_is_active_idx     ON email_addresses(is_active);

-- ── email_signatures: the app filters on `is_active`; the baseline shape
-- only has `is_default`. Add `is_active` so the filter resolves.
ALTER TABLE email_signatures
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- ── email_logs: full-feature log shape used by src/lib/email-api.ts and
-- src/lib/email-service.ts. Baseline only had {id, to/from_address, subject,
-- body, status, error, sent_at}; expand to match the EmailLog interface.
ALTER TABLE email_logs
  ADD COLUMN IF NOT EXISTS recipient_email        TEXT,
  ADD COLUMN IF NOT EXISTS recipient_name         TEXT,
  ADD COLUMN IF NOT EXISTS recipient_user_id      UUID,
  ADD COLUMN IF NOT EXISTS body_html              TEXT,
  ADD COLUMN IF NOT EXISTS body_text              TEXT,
  ADD COLUMN IF NOT EXISTS sender_email           TEXT,
  ADD COLUMN IF NOT EXISTS sender_name            TEXT,
  ADD COLUMN IF NOT EXISTS sent_by_user_id        UUID,
  ADD COLUMN IF NOT EXISTS email_type             TEXT,
  ADD COLUMN IF NOT EXISTS email_category         TEXT,
  ADD COLUMN IF NOT EXISTS email_provider         TEXT,
  ADD COLUMN IF NOT EXISTS provider_message_id    TEXT,
  ADD COLUMN IF NOT EXISTS provider_response      JSONB,
  ADD COLUMN IF NOT EXISTS error_message          TEXT,
  ADD COLUMN IF NOT EXISTS error_code             TEXT,
  ADD COLUMN IF NOT EXISTS retry_count            INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_retries            INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS application_id         UUID,
  ADD COLUMN IF NOT EXISTS quotation_id           UUID,
  ADD COLUMN IF NOT EXISTS donation_id            UUID,
  ADD COLUMN IF NOT EXISTS sponsorship_id         UUID,
  ADD COLUMN IF NOT EXISTS metadata               JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS tags                   TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS from_email_address_id  UUID,
  ADD COLUMN IF NOT EXISTS to_email_address_id    UUID,
  ADD COLUMN IF NOT EXISTS delivered_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name='email_logs' AND column_name='to_address' AND is_nullable='NO') THEN
    EXECUTE 'ALTER TABLE email_logs ALTER COLUMN to_address DROP NOT NULL';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS email_logs_from_email_address_id_idx ON email_logs(from_email_address_id);
CREATE INDEX IF NOT EXISTS email_logs_to_email_address_id_idx   ON email_logs(to_email_address_id);
CREATE INDEX IF NOT EXISTS email_logs_recipient_user_id_idx     ON email_logs(recipient_user_id);
CREATE INDEX IF NOT EXISTS email_logs_status_idx                ON email_logs(status);
CREATE INDEX IF NOT EXISTS email_logs_created_at_idx            ON email_logs(created_at DESC);

-- ── GS Method automation agents: per-agent run-history tables. Referenced by
-- server/routes/agents.ts (the /runs history endpoint) and written by
-- server/agents/lib/persist.ts. All three share the same shape. Without these,
-- the agent history endpoints 500 with "relation does not exist".
CREATE TABLE IF NOT EXISTS mandatory_course_runs (
  id             UUID PRIMARY KEY,
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  started_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  status         TEXT NOT NULL DEFAULT 'pending',
  started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at       TIMESTAMPTZ,
  result         JSONB NOT NULL DEFAULT '{}'::jsonb,
  events         JSONB NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX IF NOT EXISTS mandatory_course_runs_application_id_idx ON mandatory_course_runs(application_id);

CREATE TABLE IF NOT EXISTS ny_application_runs (
  id             UUID PRIMARY KEY,
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  started_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  status         TEXT NOT NULL DEFAULT 'pending',
  started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at       TIMESTAMPTZ,
  result         JSONB NOT NULL DEFAULT '{}'::jsonb,
  events         JSONB NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX IF NOT EXISTS ny_application_runs_application_id_idx ON ny_application_runs(application_id);

CREATE TABLE IF NOT EXISTS pv_application_runs (
  id             UUID PRIMARY KEY,
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  started_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  status         TEXT NOT NULL DEFAULT 'pending',
  started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at       TIMESTAMPTZ,
  result         JSONB NOT NULL DEFAULT '{}'::jsonb,
  events         JSONB NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX IF NOT EXISTS pv_application_runs_application_id_idx ON pv_application_runs(application_id);

-- =============================================================================
-- Done!  Start the server with:  npm run dev
-- =============================================================================
