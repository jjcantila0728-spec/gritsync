-- ─────────────────────────────────────────────────────────────────────────────
-- NCLEX schema (ported from Prisma).
-- All ids are TEXT (cuid/uuid generated app-side) to mirror Prisma `@default(cuid())`.
-- JSON columns are JSONB. Timestamps are TIMESTAMPTZ with DEFAULT NOW().
-- ─────────────────────────────────────────────────────────────────────────────

-- Case studies
CREATE TABLE IF NOT EXISTS nclex_case_studies (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  scenario    TEXT NOT NULL,
  tabs        JSONB NOT NULL DEFAULT '[]'::jsonb,
  case_type   TEXT NOT NULL,                  -- CaseStudyType: UNFOLDING | STANDALONE
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nclex_case_studies_is_active ON nclex_case_studies(is_active);
CREATE INDEX IF NOT EXISTS idx_nclex_case_studies_created_at ON nclex_case_studies(created_at DESC);

-- Questions (the live, approved bank)
CREATE TABLE IF NOT EXISTS nclex_questions (
  id              TEXT PRIMARY KEY,
  bank            TEXT NOT NULL,              -- QuestionBank: CLASSIC | NGN
  format          TEXT NOT NULL,              -- QuestionFormat
  case_study_id   TEXT REFERENCES nclex_case_studies(id) ON DELETE SET NULL,
  item_number     INTEGER,
  stem            TEXT NOT NULL,
  options         JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_answer  JSONB NOT NULL,
  rationale       TEXT NOT NULL,
  additional_info TEXT,
  topic           TEXT,
  subtopic        TEXT,
  difficulty      DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  discrimination  DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  rationale_image TEXT,
  stem_image      TEXT,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nclex_questions_active            ON nclex_questions(is_active);
CREATE INDEX IF NOT EXISTS idx_nclex_questions_bank              ON nclex_questions(bank);
CREATE INDEX IF NOT EXISTS idx_nclex_questions_format            ON nclex_questions(format);
CREATE INDEX IF NOT EXISTS idx_nclex_questions_topic             ON nclex_questions(topic);
CREATE INDEX IF NOT EXISTS idx_nclex_questions_case_study        ON nclex_questions(case_study_id);
CREATE INDEX IF NOT EXISTS idx_nclex_questions_created_at        ON nclex_questions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nclex_questions_difficulty        ON nclex_questions(difficulty);

-- Pending case studies (AI-generated, awaiting review)
CREATE TABLE IF NOT EXISTS nclex_pending_case_studies (
  id               TEXT PRIMARY KEY,
  title            TEXT NOT NULL,
  scenario         TEXT NOT NULL,
  tabs             JSONB NOT NULL DEFAULT '[]'::jsonb,
  case_type        TEXT NOT NULL,             -- CaseStudyType
  status           TEXT NOT NULL DEFAULT 'PENDING',  -- PendingStatus: PENDING | APPROVED | REJECTED
  generated_by     TEXT NOT NULL DEFAULT 'claude',
  generation_batch TEXT,
  rejection_note   TEXT,
  ai_raw           TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nclex_pending_case_studies_status ON nclex_pending_case_studies(status);
CREATE INDEX IF NOT EXISTS idx_nclex_pending_case_studies_batch  ON nclex_pending_case_studies(generation_batch);

-- Pending questions (AI-generated, awaiting review)
CREATE TABLE IF NOT EXISTS nclex_pending_questions (
  id                    TEXT PRIMARY KEY,
  bank                  TEXT NOT NULL,
  format                TEXT NOT NULL,
  stem                  TEXT NOT NULL,
  stem_image            TEXT,
  options               JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_answer        JSONB NOT NULL,
  rationale             TEXT NOT NULL,
  additional_info       TEXT,
  rationale_image       TEXT,
  topic                 TEXT,
  subtopic              TEXT,
  difficulty            DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  discrimination        DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  status                TEXT NOT NULL DEFAULT 'PENDING',
  generated_by          TEXT NOT NULL DEFAULT 'claude',
  generation_batch      TEXT,
  rejection_note        TEXT,
  ai_raw                TEXT,
  cognitive_skill       TEXT,
  item_number           INTEGER,
  pending_case_study_id TEXT REFERENCES nclex_pending_case_studies(id) ON DELETE SET NULL,
  metadata              JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nclex_pending_questions_status      ON nclex_pending_questions(status);
CREATE INDEX IF NOT EXISTS idx_nclex_pending_questions_batch       ON nclex_pending_questions(generation_batch);
CREATE INDEX IF NOT EXISTS idx_nclex_pending_questions_case_study  ON nclex_pending_questions(pending_case_study_id);

-- Sessions (a user's exam attempt)
CREATE TABLE IF NOT EXISTS nclex_sessions (
  id              TEXT PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exam_type       TEXT NOT NULL,              -- NclexExamType
  status          TEXT NOT NULL DEFAULT 'IN_PROGRESS',  -- NclexExamStatus
  current_theta   DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  standard_error  DOUBLE PRECISION NOT NULL DEFAULT 1.5,
  current_index   INTEGER NOT NULL DEFAULT 0,
  correct_count   INTEGER NOT NULL DEFAULT 0,
  question_pool   JSONB,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  time_limit      INTEGER,
  result          JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nclex_sessions_user_id     ON nclex_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_nclex_sessions_status      ON nclex_sessions(status);
CREATE INDEX IF NOT EXISTS idx_nclex_sessions_exam_type   ON nclex_sessions(exam_type);
CREATE INDEX IF NOT EXISTS idx_nclex_sessions_created_at  ON nclex_sessions(created_at DESC);

-- Session items (per-question responses in a session)
CREATE TABLE IF NOT EXISTS nclex_session_items (
  id           TEXT PRIMARY KEY,
  session_id   TEXT NOT NULL REFERENCES nclex_sessions(id) ON DELETE CASCADE,
  question_id  TEXT NOT NULL REFERENCES nclex_questions(id) ON DELETE RESTRICT,
  item_index   INTEGER NOT NULL,
  response     JSONB,
  is_correct   BOOLEAN,
  time_spent   INTEGER,
  answered_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nclex_session_items_session    ON nclex_session_items(session_id);
CREATE INDEX IF NOT EXISTS idx_nclex_session_items_question   ON nclex_session_items(question_id);
CREATE INDEX IF NOT EXISTS idx_nclex_session_items_answered   ON nclex_session_items(answered_at);

-- Profiles (per-user NCLEX prep state)
CREATE TABLE IF NOT EXISTS nclex_profiles (
  id                      TEXT PRIMARY KEY,
  user_id                 UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  exam_date               TIMESTAMPTZ,
  tier                    TEXT NOT NULL DEFAULT 'FREE',          -- NclexTier
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
CREATE INDEX IF NOT EXISTS idx_nclex_profiles_tier          ON nclex_profiles(tier);
CREATE INDEX IF NOT EXISTS idx_nclex_profiles_upgrade_req   ON nclex_profiles(upgrade_requested);

-- Exit exam access (per-user grant)
CREATE TABLE IF NOT EXISTS nclex_exit_access (
  id             TEXT PRIMARY KEY,
  user_id        UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  granted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payment_ref    TEXT,
  granted_by_id  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- NCLEX-specific testimonials (separate from the public `testimonials` table to
-- avoid colliding with the existing schema; Prisma stored these in the same
-- table but the public one uses different columns).
CREATE TABLE IF NOT EXISTS nclex_testimonials (
  id                    TEXT PRIMARY KEY,
  client_name           TEXT NOT NULL,
  designation           TEXT,
  location              TEXT,
  content               TEXT NOT NULL,
  rating                INTEGER NOT NULL DEFAULT 5,
  is_featured           BOOLEAN NOT NULL DEFAULT FALSE,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  is_pending            BOOLEAN NOT NULL DEFAULT FALSE,
  submitted_by_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nclex_testimonials_pending ON nclex_testimonials(is_pending);
CREATE INDEX IF NOT EXISTS idx_nclex_testimonials_active  ON nclex_testimonials(is_active);

-- NCLEX site settings (key/value JSON store, separate from the public `settings`
-- table to avoid collisions with the existing app's settings rows).
CREATE TABLE IF NOT EXISTS nclex_site_settings (
  id          TEXT PRIMARY KEY,
  key         TEXT NOT NULL UNIQUE,
  value       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
