-- NCLEX schema migration.
--
-- Documents and (re)creates the 10 tables + 7 enums that back /api/nclex.
-- Safe to run on an already-populated database — every CREATE uses
-- IF NOT EXISTS, and enums are wrapped in DO blocks that ignore
-- duplicate_object errors.
--
-- Run with: node scripts/run-migration.cjs scripts/migrations/2026-05-15_nclex_schema.sql

-- ─── enums ───────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE nclex_tier AS ENUM ('FREE', 'PREMIUM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE question_bank_kind AS ENUM ('CLASSIC', 'NGN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE question_format AS ENUM (
    'MCQ', 'SATA', 'ORDERED_RESPONSE', 'FILL_IN_BLANK', 'HIGHLIGHT_TEXT',
    'BOW_TIE', 'DROP_DOWN', 'MATRIX_MCQ', 'MATRIX_SATA', 'DRAG_DROP'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE nclex_exam_type AS ENUM ('READINESS_ASSESSMENT', 'CAT', 'TUTORIAL', 'EXIT_EXAM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE nclex_exam_status AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE case_study_type AS ENUM ('UNFOLDING', 'STANDALONE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE pending_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── case studies ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nclex_case_studies (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  scenario    TEXT NOT NULL,
  tabs        JSONB NOT NULL DEFAULT '[]'::jsonb,
  case_type   case_study_type NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nclex_case_studies_active ON nclex_case_studies (is_active);

-- ─── questions ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nclex_questions (
  id              TEXT PRIMARY KEY,
  bank            question_bank_kind NOT NULL,
  format          question_format NOT NULL,
  case_study_id   TEXT REFERENCES nclex_case_studies(id) ON DELETE SET NULL,
  item_number     INT,
  stem            TEXT NOT NULL,
  stem_image      TEXT,
  options         JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_answer  JSONB NOT NULL,
  rationale       TEXT NOT NULL,
  rationale_image TEXT,
  additional_info TEXT,
  topic           TEXT,
  subtopic        TEXT,
  difficulty      DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  discrimination  DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nclex_questions_bank        ON nclex_questions (bank);
CREATE INDEX IF NOT EXISTS idx_nclex_questions_format      ON nclex_questions (format);
CREATE INDEX IF NOT EXISTS idx_nclex_questions_topic       ON nclex_questions (topic);
CREATE INDEX IF NOT EXISTS idx_nclex_questions_active      ON nclex_questions (is_active);
CREATE INDEX IF NOT EXISTS idx_nclex_questions_case_study  ON nclex_questions (case_study_id);

-- ─── pending case studies (AI review queue) ──────────────────────────────────

CREATE TABLE IF NOT EXISTS nclex_pending_case_studies (
  id               TEXT PRIMARY KEY,
  title            TEXT NOT NULL,
  scenario         TEXT NOT NULL,
  tabs             JSONB NOT NULL DEFAULT '[]'::jsonb,
  case_type        case_study_type NOT NULL,
  status           pending_status NOT NULL DEFAULT 'PENDING',
  generated_by     TEXT NOT NULL DEFAULT 'claude',
  generation_batch TEXT,
  rejection_note   TEXT,
  ai_raw           TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pending_case_studies_status ON nclex_pending_case_studies (status);
CREATE INDEX IF NOT EXISTS idx_pending_case_studies_batch  ON nclex_pending_case_studies (generation_batch);

-- ─── pending questions (AI review queue) ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS nclex_pending_questions (
  id                     TEXT PRIMARY KEY,
  bank                   question_bank_kind NOT NULL,
  format                 question_format NOT NULL,
  stem                   TEXT NOT NULL,
  stem_image             TEXT,
  options                JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_answer         JSONB NOT NULL,
  rationale              TEXT NOT NULL,
  rationale_image        TEXT,
  additional_info        TEXT,
  topic                  TEXT,
  subtopic               TEXT,
  difficulty             DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  discrimination         DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  status                 pending_status NOT NULL DEFAULT 'PENDING',
  generated_by           TEXT NOT NULL DEFAULT 'claude',
  generation_batch       TEXT,
  rejection_note         TEXT,
  ai_raw                 TEXT,
  cognitive_skill        TEXT,
  item_number            INT,
  pending_case_study_id  TEXT REFERENCES nclex_pending_case_studies(id) ON DELETE CASCADE,
  metadata               JSONB,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pending_questions_status    ON nclex_pending_questions (status);
CREATE INDEX IF NOT EXISTS idx_pending_questions_batch     ON nclex_pending_questions (generation_batch);
CREATE INDEX IF NOT EXISTS idx_pending_questions_case      ON nclex_pending_questions (pending_case_study_id);

-- ─── exam sessions + session items ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nclex_sessions (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exam_type       nclex_exam_type NOT NULL,
  status          nclex_exam_status NOT NULL DEFAULT 'IN_PROGRESS',
  current_theta   DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  standard_error  DOUBLE PRECISION NOT NULL DEFAULT 1.5,
  current_index   INT NOT NULL DEFAULT 0,
  correct_count   INT NOT NULL DEFAULT 0,
  question_pool   JSONB,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  time_limit      INT,
  result          JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nclex_sessions_user    ON nclex_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_nclex_sessions_status  ON nclex_sessions (status);
CREATE INDEX IF NOT EXISTS idx_nclex_sessions_type    ON nclex_sessions (exam_type);

CREATE TABLE IF NOT EXISTS nclex_session_items (
  id            TEXT PRIMARY KEY,
  session_id    TEXT NOT NULL REFERENCES nclex_sessions(id) ON DELETE CASCADE,
  question_id   TEXT NOT NULL REFERENCES nclex_questions(id) ON DELETE CASCADE,
  item_index    INT NOT NULL,
  response      JSONB,
  is_correct    BOOLEAN,
  time_spent    INT,
  answered_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_session_items_session  ON nclex_session_items (session_id);
CREATE INDEX IF NOT EXISTS idx_session_items_question ON nclex_session_items (question_id);

-- ─── per-user NCLEX profile (tier, exam date, upgrade requests) ──────────────

CREATE TABLE IF NOT EXISTS nclex_profiles (
  id                      TEXT PRIMARY KEY,
  user_id                 TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  exam_date               TIMESTAMPTZ,
  tier                    nclex_tier NOT NULL DEFAULT 'FREE',
  tier_expires_at         TIMESTAMPTZ,
  payment_ref             TEXT,
  granted_by_id           TEXT,
  special_access          JSONB NOT NULL DEFAULT '[]'::jsonb,
  upgrade_requested       BOOLEAN NOT NULL DEFAULT FALSE,
  upgrade_payment_ref     TEXT,
  upgrade_payment_method  TEXT,
  upgrade_receipt_path    TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nclex_profiles_tier     ON nclex_profiles (tier);
CREATE INDEX IF NOT EXISTS idx_nclex_profiles_upgrade  ON nclex_profiles (upgrade_requested);

-- ─── exit-exam paid access ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nclex_exit_access (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  granted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payment_ref    TEXT,
  granted_by_id  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── site settings + testimonials (NCLEX-scoped key/value store) ─────────────

CREATE TABLE IF NOT EXISTS nclex_site_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nclex_testimonials (
  id                    TEXT PRIMARY KEY,
  client_name           TEXT NOT NULL,
  designation           TEXT,
  location              TEXT,
  content               TEXT NOT NULL,
  rating                INT NOT NULL DEFAULT 5,
  is_featured           BOOLEAN NOT NULL DEFAULT FALSE,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  is_pending            BOOLEAN NOT NULL DEFAULT TRUE,
  submitted_by_user_id  TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nclex_testimonials_pending ON nclex_testimonials (is_pending);
CREATE INDEX IF NOT EXISTS idx_nclex_testimonials_active  ON nclex_testimonials (is_active);

-- ─── seed default site settings rows ─────────────────────────────────────────

INSERT INTO nclex_site_settings (key, value) VALUES
  ('nclex_subscription_plans', '{"plans":[],"paymentInstructions":"","gcashNumber":"","gcashName":""}'::jsonb),
  ('nclex_videos',             '{"videos":[]}'::jsonb)
ON CONFLICT (key) DO NOTHING;
