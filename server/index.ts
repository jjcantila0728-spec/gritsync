import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { json, urlencoded } from 'express'
import authRoutes from './routes/auth'
import queryRoutes from './routes/query'
import paymentRoutes from './routes/payments'
import emailRoutes from './routes/emails'
import questionRoutes, { autoSeedIfEmpty } from './routes/questions'
import storageRoutes from './routes/storage'
import contactRoutes from './routes/contact'
import messageRoutes from './routes/messages'
import referralRoutes from './routes/referrals'
import socialRoutes, { processDuePosts } from './routes/social'
import socialAiRoutes from './routes/social-ai'
import nclexRoutes from './routes/nclex'
import processingAccountsRoutes from './routes/processing-accounts'
// agentsRoutes uses Playwright (Chromium) which cannot run in Vercel serverless.
// Loaded dynamically below — skipped entirely when process.env.VERCEL is set.
import { query } from './db'
import { getSeedQuestions } from './data/nclex-seed'

async function bootstrapDatabaseIfEmpty() {
  // Check whether the database has been initialised yet (users table must exist).
  const res = await query(`
    SELECT COUNT(*) AS cnt
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'users'
  `)
  const exists = parseInt(res.rows[0]?.cnt ?? '0', 10) > 0
  if (exists) return  // already initialised — nothing to do

  console.log('[bootstrap] Fresh database detected — running full schema initialisation…')

  // Resolve paths relative to the project root.  In Vercel lambdas, process.cwd()
  // returns /var/task which is the project root; locally it is the repo root too.
  const root = process.cwd()
  const sqlFiles = [
    path.join(root, 'init.sql'),
    path.join(root, 'server', 'sql', 'nclex-schema.sql'),
  ]

  for (const file of sqlFiles) {
    if (!fs.existsSync(file)) {
      console.warn(`[bootstrap] SQL file not found, skipping: ${file}`)
      continue
    }
    const sql = fs.readFileSync(file, 'utf8')
    console.log(`[bootstrap] Executing ${path.basename(file)} …`)
    try {
      await query(sql)
      console.log(`[bootstrap] ✅  ${path.basename(file)} done`)
    } catch (err: any) {
      // Non-fatal: IF NOT EXISTS guards most statements; log and continue.
      console.warn(`[bootstrap] ⚠️  ${path.basename(file)} error (may be partial):`, err.message)
    }
  }

  console.log('[bootstrap] Database initialisation complete.')
}

async function runStartupMigrations() {
  // Always run the bootstrap first — safe no-op if the DB is already initialised.
  await bootstrapDatabaseIfEmpty()

  try {
    // Fix test_sessions.user_id type: ensure it is UUID to match users.id.
    // PostgreSQL cannot automatically cast integer→uuid using ALTER COLUMN SET DATA TYPE,
    // so we use DROP COLUMN + ADD COLUMN. Any rows with non-uuid user_ids are cleared
    // (sessions from before auth was UUID-based have no valid owner anyway).
    const colTypeResult = await query(
      `SELECT data_type FROM information_schema.columns
       WHERE table_name = 'test_sessions' AND column_name = 'user_id'`
    )
    const currentType = colTypeResult.rows[0]?.data_type
    if (currentType && currentType !== 'uuid') {
      console.log(`Migrating test_sessions.user_id from ${currentType.toUpperCase()} to UUID...`)
      // Delete rows that cannot be migrated (integer ids have no uuid equivalent)
      await query(`DELETE FROM test_sessions WHERE user_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'`)
      await query(`ALTER TABLE test_sessions DROP COLUMN user_id`)
      await query(`ALTER TABLE test_sessions ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE`)
      console.log('test_sessions.user_id migrated to UUID successfully.')
    }
  } catch (err) {
    console.warn('Startup migration warning (test_sessions user_id type fix):', err)
  }

  try {
    // Existing columns
    await query(`ALTER TABLE session_responses ADD COLUMN IF NOT EXISTS marked_for_review BOOLEAN DEFAULT false`)

    // Case study support columns
    await query(`ALTER TABLE question_bank ADD COLUMN IF NOT EXISTS case_study_group VARCHAR(100)`)
    await query(`ALTER TABLE question_bank ADD COLUMN IF NOT EXISTS case_study_scenario TEXT`)

    // Payment submissions table
    await query(`
      CREATE TABLE IF NOT EXISTS nclex_payment_submissions (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        plan VARCHAR(20) NOT NULL,
        payment_method VARCHAR(50),
        payment_reference VARCHAR(200),
        payment_amount NUMERIC(10,2),
        notes TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        reviewed_by UUID REFERENCES users(id),
        reviewed_at TIMESTAMP,
        review_notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)

    // Payment screenshot column
    await query(`ALTER TABLE nclex_payment_submissions ADD COLUMN IF NOT EXISTS screenshot_url TEXT`)

    // Auto-seed question bank if fewer than 10 questions exist
    const countResult = await query(`SELECT COUNT(*) FROM question_bank WHERE is_active = true`)
    const count = parseInt(countResult.rows[0].count, 10)
    if (count < 10) {
      console.log(`Question bank has only ${count} questions — auto-seeding...`)
      const questions = getSeedQuestions()
      let inserted = 0
      for (const q of questions) {
        try {
          await query(
            `INSERT INTO question_bank
               (question_text, question_type, content_area, subcategory, difficulty,
                cognitive_level, is_ngn, options, correct_answer, rationale, tags,
                case_study_group, case_study_scenario, is_active)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,true)`,
            [
              q.question_text, q.question_type, q.content_area, q.subcategory || null,
              q.difficulty, q.cognitive_level || 'Application', q.is_ngn,
              JSON.stringify(q.options), JSON.stringify(q.correct_answer),
              q.rationale, q.tags ? q.tags.split(',').map((t: string) => t.trim()) : null,
              q.case_study_group || null, q.case_study_scenario || null,
            ]
          )
          inserted++
        } catch (seedErr: any) {
          console.warn('Seed insert warning:', seedErr.message)
        }
      }
      console.log(`Auto-seeded ${inserted} questions into the question bank.`)
    }
  } catch (err) {
    console.warn('Startup migration warning (marked_for_review):', err)
  }

  try {
    await query(`
      CREATE TABLE IF NOT EXISTS case_studies (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        scenario TEXT NOT NULL,
        content_area TEXT,
        difficulty TEXT DEFAULT 'medium',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)
  } catch (err) {
    console.warn('Startup migration warning (case_studies table):', err)
  }

  try {
    await query(`ALTER TABLE question_bank ADD COLUMN IF NOT EXISTS case_study_id INTEGER REFERENCES case_studies(id) ON DELETE SET NULL`)
  } catch (err) {
    console.warn('Startup migration warning (case_study_id column):', err)
  }

  try {
    await query(`ALTER TABLE case_studies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`)
  } catch (err) {
    console.warn('Startup migration warning (case_studies updated_at):', err)
  }

  try {
    await query(`
      CREATE TABLE IF NOT EXISTS user_question_bookmarks (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        question_id INTEGER NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, question_id)
      )
    `)
    await query(`CREATE INDEX IF NOT EXISTS idx_uqb_user_id ON user_question_bookmarks(user_id)`)
  } catch (err) {
    console.warn('Startup migration warning (user_question_bookmarks table):', err)
  }

  await autoSeedIfEmpty()

  // NCLEX schema (imported from grit) — idempotent CREATE TABLE statements.
  try {
    const here = path.dirname(fileURLToPath(import.meta.url))
    const sqlPath = path.join(here, 'sql', 'nclex-schema.sql')
    if (fs.existsSync(sqlPath)) {
      const sql = fs.readFileSync(sqlPath, 'utf8')
      await query(sql)
    }
  } catch (err) {
    console.warn('Startup migration warning (nclex-schema.sql):', err)
  }

  // Messages table migration — fully idempotent, never drops data
  try {
    // 1. Ensure the table exists with the minimal required shape
    await query(`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
        subject TEXT,
        body TEXT NOT NULL,
        is_read BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
    // 2. Additive column additions for existing tables
    await query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS subject TEXT`)
    await query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ`)
    await query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ`)
    await query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`)
    await query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachments JSONB`)
    // Presence: track when each user was last seen online
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ`)
    // 3. Indexes
    await query(`CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id)`)
    await query(`CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON messages(recipient_id)`)
    await query(`CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at)`)
    await query(`CREATE INDEX IF NOT EXISTS idx_messages_pair ON messages(sender_id, recipient_id, created_at)`)
    console.log('Messages table ready.')
  } catch (err) {
    console.warn('Startup migration warning (messages table):', err)
  }

  // `applications` table — historical mirror columns. The /app/application/new
  // form still writes a full snapshot of the applicant's profile to the
  // applications row for audit/history purposes (see NCLEXApplication.tsx).
  // user_details remains the canonical store for these fields, but the
  // applications table must still accept the writes.
  try {
    await query(`
      ALTER TABLE applications
        ADD COLUMN IF NOT EXISTS first_name                  TEXT,
        ADD COLUMN IF NOT EXISTS middle_name                 TEXT,
        ADD COLUMN IF NOT EXISTS last_name                   TEXT,
        ADD COLUMN IF NOT EXISTS email                       TEXT,
        ADD COLUMN IF NOT EXISTS mobile_number               TEXT,
        ADD COLUMN IF NOT EXISTS gender                      TEXT,
        ADD COLUMN IF NOT EXISTS marital_status              TEXT,
        ADD COLUMN IF NOT EXISTS single_full_name            TEXT,
        ADD COLUMN IF NOT EXISTS date_of_birth               TEXT,
        ADD COLUMN IF NOT EXISTS birth_place                 TEXT,
        ADD COLUMN IF NOT EXISTS country_of_birth            TEXT,
        ADD COLUMN IF NOT EXISTS house_number                TEXT,
        ADD COLUMN IF NOT EXISTS street_name                 TEXT,
        ADD COLUMN IF NOT EXISTS city                        TEXT,
        ADD COLUMN IF NOT EXISTS province                    TEXT,
        ADD COLUMN IF NOT EXISTS country                     TEXT,
        ADD COLUMN IF NOT EXISTS zipcode                     TEXT,
        ADD COLUMN IF NOT EXISTS elementary_school           TEXT,
        ADD COLUMN IF NOT EXISTS elementary_city             TEXT,
        ADD COLUMN IF NOT EXISTS elementary_province         TEXT,
        ADD COLUMN IF NOT EXISTS elementary_country          TEXT,
        ADD COLUMN IF NOT EXISTS elementary_years_attended   TEXT,
        ADD COLUMN IF NOT EXISTS elementary_start_date       TEXT,
        ADD COLUMN IF NOT EXISTS elementary_end_date         TEXT,
        ADD COLUMN IF NOT EXISTS high_school                 TEXT,
        ADD COLUMN IF NOT EXISTS high_school_city            TEXT,
        ADD COLUMN IF NOT EXISTS high_school_province        TEXT,
        ADD COLUMN IF NOT EXISTS high_school_country         TEXT,
        ADD COLUMN IF NOT EXISTS high_school_years_attended  TEXT,
        ADD COLUMN IF NOT EXISTS high_school_start_date      TEXT,
        ADD COLUMN IF NOT EXISTS high_school_end_date        TEXT,
        ADD COLUMN IF NOT EXISTS high_school_graduated       TEXT,
        ADD COLUMN IF NOT EXISTS high_school_diploma_type    TEXT,
        ADD COLUMN IF NOT EXISTS high_school_diploma_date    TEXT,
        ADD COLUMN IF NOT EXISTS nursing_school                 TEXT,
        ADD COLUMN IF NOT EXISTS nursing_school_city            TEXT,
        ADD COLUMN IF NOT EXISTS nursing_school_province        TEXT,
        ADD COLUMN IF NOT EXISTS nursing_school_country         TEXT,
        ADD COLUMN IF NOT EXISTS nursing_school_years_attended  TEXT,
        ADD COLUMN IF NOT EXISTS nursing_school_start_date      TEXT,
        ADD COLUMN IF NOT EXISTS nursing_school_end_date        TEXT,
        ADD COLUMN IF NOT EXISTS nursing_school_major           TEXT,
        ADD COLUMN IF NOT EXISTS nursing_school_diploma_date    TEXT,
        ADD COLUMN IF NOT EXISTS signature                      TEXT,
        ADD COLUMN IF NOT EXISTS picture_path                   TEXT,
        ADD COLUMN IF NOT EXISTS diploma_path                   TEXT,
        ADD COLUMN IF NOT EXISTS passport_path                  TEXT
    `)
    console.log('Applications mirror columns ready.')
  } catch (err) {
    console.warn('Startup migration warning (applications legacy columns):', err)
  }

  // `processing_accounts` — the admin "Application → Processing Accounts" tab
  // (and client-side processingAccountsAPI in api-service.ts) writes against a
  // newer shape than the bare init.sql baseline. Extend the table additively so
  // both code paths work and the dynamic /api/db filter on application_id
  // resolves.
  try {
    await query(`
      ALTER TABLE processing_accounts
        ADD COLUMN IF NOT EXISTS application_id      UUID REFERENCES applications(id) ON DELETE CASCADE,
        ADD COLUMN IF NOT EXISTS name                TEXT,
        ADD COLUMN IF NOT EXISTS link                TEXT,
        ADD COLUMN IF NOT EXISTS email               TEXT,
        ADD COLUMN IF NOT EXISTS password            TEXT,
        ADD COLUMN IF NOT EXISTS security_question_1 TEXT,
        ADD COLUMN IF NOT EXISTS security_question_2 TEXT,
        ADD COLUMN IF NOT EXISTS security_question_3 TEXT,
        ADD COLUMN IF NOT EXISTS status              TEXT NOT NULL DEFAULT 'inactive',
        ADD COLUMN IF NOT EXISTS created_by          UUID REFERENCES users(id) ON DELETE SET NULL
    `)
    // The legacy `user_id` column was NOT NULL but the new write path scopes
    // accounts to applications, not users — relax the constraint so admin
    // inserts succeed.
    await query(`ALTER TABLE processing_accounts ALTER COLUMN user_id DROP NOT NULL`)
    await query(`CREATE INDEX IF NOT EXISTS processing_accounts_application_id_idx ON processing_accounts(application_id)`)
    await query(`CREATE INDEX IF NOT EXISTS processing_accounts_account_type_idx ON processing_accounts(account_type)`)
    console.log('Processing accounts columns ready.')
  } catch (err) {
    console.warn('Startup migration warning (processing_accounts):', err)
  }

  // `application_payments` — the modern payment flow (Stripe, GCash, mobile
  // banking, manual receipts) writes a richer column set than the slim init.sql
  // baseline. Add every column the client / admin write paths reference so
  // the dynamic /api/db update succeeds.
  try {
    await query(`
      ALTER TABLE application_payments
        ADD COLUMN IF NOT EXISTS user_id                       UUID REFERENCES users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS transaction_id                TEXT,
        ADD COLUMN IF NOT EXISTS stripe_payment_intent_id      TEXT,
        ADD COLUMN IF NOT EXISTS proof_url                     TEXT,
        ADD COLUMN IF NOT EXISTS proof_of_payment_file_path    TEXT,
        ADD COLUMN IF NOT EXISTS receipt_file_path             TEXT,
        ADD COLUMN IF NOT EXISTS invoice_file_path             TEXT,
        ADD COLUMN IF NOT EXISTS gcash_number                  TEXT,
        ADD COLUMN IF NOT EXISTS gcash_reference               TEXT,
        ADD COLUMN IF NOT EXISTS service_fee_amount            NUMERIC(10,2),
        ADD COLUMN IF NOT EXISTS usd_to_php_rate               NUMERIC(12,4),
        ADD COLUMN IF NOT EXISTS admin_note                    TEXT,
        ADD COLUMN IF NOT EXISTS approved_by                   UUID REFERENCES users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS approved_at                   TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS rejected_by                   UUID REFERENCES users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS rejected_at                   TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS rejection_reason              TEXT
    `)
    // Backfill the canonical column from the legacy one so rows that were
    // uploaded before the rename are still visible in the admin payments view.
    await query(`
      UPDATE application_payments
         SET proof_of_payment_file_path = proof_url
       WHERE proof_of_payment_file_path IS NULL
         AND proof_url IS NOT NULL
    `)
    await query(`CREATE INDEX IF NOT EXISTS application_payments_status_idx ON application_payments(status)`)
    await query(`CREATE INDEX IF NOT EXISTS application_payments_user_id_idx ON application_payments(user_id)`)
    console.log('Application payments columns ready.')
  } catch (err) {
    console.warn('Startup migration warning (application_payments):', err)
  }

  // Social accounts + scheduled posts (admin social-media management)
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS social_accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        platform TEXT NOT NULL,
        display_name TEXT NOT NULL,
        platform_user_id TEXT NOT NULL,
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        token_expires_at TIMESTAMPTZ,
        profile_url TEXT,
        avatar_url TEXT,
        scopes TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        status TEXT NOT NULL DEFAULT 'connected',
        last_error TEXT,
        connected_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        connected_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(platform, platform_user_id)
      )
    `)
    await query(`CREATE INDEX IF NOT EXISTS idx_social_accounts_platform ON social_accounts(platform)`)
    await query(`
      CREATE TABLE IF NOT EXISTS social_posts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_ids UUID[] NOT NULL,
        content TEXT NOT NULL,
        media_urls JSONB DEFAULT '[]'::jsonb,
        scheduled_at TIMESTAMPTZ,
        published_at TIMESTAMPTZ,
        status TEXT NOT NULL DEFAULT 'draft',
        results JSONB DEFAULT '{}'::jsonb,
        created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    await query(`CREATE INDEX IF NOT EXISTS idx_social_posts_status ON social_posts(status)`)
    await query(`CREATE INDEX IF NOT EXISTS idx_social_posts_scheduled_at ON social_posts(scheduled_at)`)

    // Content Bank — generated posts (caption + media) live here until they're
    // scheduled or discarded. Backs the new "Compose" generator flow.
    await query(`
      CREATE TABLE IF NOT EXISTS social_content_bank (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        caption TEXT NOT NULL,
        media_url TEXT,
        media_type TEXT NOT NULL DEFAULT 'image',
        prediction_id TEXT,
        source_topic TEXT,
        enhanced_prompt TEXT,
        generation_settings JSONB DEFAULT '{}'::jsonb,
        status TEXT NOT NULL DEFAULT 'available',
        created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    // source_image_url is added separately so existing installs migrate forward.
    // It stores the still frame fed to the video model when generating
    // image-to-video, so the bank UI can preview it while Replicate renders.
    await query(`ALTER TABLE social_content_bank ADD COLUMN IF NOT EXISTS source_image_url TEXT`)
    await query(`CREATE INDEX IF NOT EXISTS idx_social_content_bank_status ON social_content_bank(status)`)
    await query(`CREATE INDEX IF NOT EXISTS idx_social_content_bank_created_at ON social_content_bank(created_at DESC)`)
    console.log('Social tables ready.')
  } catch (err) {
    console.warn('Startup migration warning (social tables):', err)
  }

  // GS Method automation agents — per-agent run-history tables. Referenced by
  // routes/agents.ts (the /runs history endpoint) and written by
  // agents/lib/persist.ts. All three share the same shape.
  try {
    for (const table of ['mandatory_course_runs', 'ny_application_runs', 'pv_application_runs']) {
      await query(`
        CREATE TABLE IF NOT EXISTS ${table} (
          id             UUID PRIMARY KEY,
          application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
          started_by     UUID REFERENCES users(id) ON DELETE SET NULL,
          status         TEXT NOT NULL DEFAULT 'pending',
          started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          ended_at       TIMESTAMPTZ,
          result         JSONB NOT NULL DEFAULT '{}'::jsonb,
          events         JSONB NOT NULL DEFAULT '[]'::jsonb
        )
      `)
      await query(`CREATE INDEX IF NOT EXISTS ${table}_application_id_idx ON ${table}(application_id)`)
    }
    console.log('Agent run-history tables ready.')
  } catch (err) {
    console.warn('Startup migration warning (agent run tables):', err)
  }

  // ── Email admin features — bring legacy tables up to the shape the UI APIs
  // expect, add the analytics view, and seed default templates.
  try {
    // email_signatures: extend the bare baseline shape to the full one used by
    // src/lib/email-signatures-api.ts. Backfill signature_html from the legacy
    // `html` column for any existing rows.
    await query(`
      ALTER TABLE email_signatures
        ADD COLUMN IF NOT EXISTS signature_html       TEXT,
        ADD COLUMN IF NOT EXISTS signature_text       TEXT,
        ADD COLUMN IF NOT EXISTS signature_type       TEXT NOT NULL DEFAULT 'personal',
        ADD COLUMN IF NOT EXISTS is_active            BOOLEAN NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS font_family          TEXT,
        ADD COLUMN IF NOT EXISTS font_size            INTEGER,
        ADD COLUMN IF NOT EXISTS text_color           TEXT,
        ADD COLUMN IF NOT EXISTS link_color           TEXT,
        ADD COLUMN IF NOT EXISTS full_name            TEXT,
        ADD COLUMN IF NOT EXISTS job_title            TEXT,
        ADD COLUMN IF NOT EXISTS department           TEXT,
        ADD COLUMN IF NOT EXISTS company_name         TEXT,
        ADD COLUMN IF NOT EXISTS email                TEXT,
        ADD COLUMN IF NOT EXISTS phone                TEXT,
        ADD COLUMN IF NOT EXISTS mobile               TEXT,
        ADD COLUMN IF NOT EXISTS website              TEXT,
        ADD COLUMN IF NOT EXISTS address              TEXT,
        ADD COLUMN IF NOT EXISTS social_links         JSONB NOT NULL DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS logo_url             TEXT,
        ADD COLUMN IF NOT EXISTS logo_width           INTEGER,
        ADD COLUMN IF NOT EXISTS logo_height          INTEGER,
        ADD COLUMN IF NOT EXISTS show_logo            BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS show_disclaimer      BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS disclaimer_text      TEXT,
        ADD COLUMN IF NOT EXISTS show_company_tagline BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS company_tagline      TEXT,
        ADD COLUMN IF NOT EXISTS custom_css           TEXT,
        ADD COLUMN IF NOT EXISTS metadata             JSONB NOT NULL DEFAULT '{}'::jsonb
    `)
    // Backfill signature_html from legacy `html`, then relax NOT NULL on `html`
    // so new rows (which only write signature_html) succeed.
    await query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_name='email_signatures' AND column_name='html') THEN
          EXECUTE 'UPDATE email_signatures
                      SET signature_html = COALESCE(NULLIF(signature_html,''''), html)
                    WHERE signature_html IS NULL OR signature_html = ''''';
          EXECUTE 'ALTER TABLE email_signatures ALTER COLUMN html DROP NOT NULL';
        END IF;
      END $$
    `)
    // user_id is NOT NULL by default but the admin UI inserts company-wide
    // signatures without an owner — relax the constraint.
    await query(`ALTER TABLE email_signatures ALTER COLUMN user_id DROP NOT NULL`)

    // email_templates: extend baseline to the full shape used by
    // src/lib/email-templates-api.ts.
    await query(`
      ALTER TABLE email_templates
        ADD COLUMN IF NOT EXISTS description         TEXT,
        ADD COLUMN IF NOT EXISTS slug                TEXT,
        ADD COLUMN IF NOT EXISTS html_content        TEXT,
        ADD COLUMN IF NOT EXISTS text_content        TEXT,
        ADD COLUMN IF NOT EXISTS template_type       TEXT NOT NULL DEFAULT 'user_created',
        ADD COLUMN IF NOT EXISTS thumbnail_url       TEXT,
        ADD COLUMN IF NOT EXISTS preview_url         TEXT,
        ADD COLUMN IF NOT EXISTS is_default          BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS version             INTEGER NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS parent_template_id  INTEGER REFERENCES email_templates(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS last_used_at        TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS created_by          UUID REFERENCES users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS updated_by          UUID REFERENCES users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS tags                TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
        ADD COLUMN IF NOT EXISTS metadata            JSONB NOT NULL DEFAULT '{}'::jsonb
    `)
    // Backfill html_content from the legacy html_body so existing rows still
    // render, then relax NOT NULL on the legacy columns.
    await query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_name='email_templates' AND column_name='html_body') THEN
          EXECUTE 'UPDATE email_templates
                      SET html_content = COALESCE(NULLIF(html_content,''''), html_body)
                    WHERE html_content IS NULL OR html_content = ''''';
          EXECUTE 'ALTER TABLE email_templates ALTER COLUMN html_body DROP NOT NULL';
        END IF;
      END $$
    `)
    // The frontend filters/orders by slug; make sure every row has one.
    await query(`
      UPDATE email_templates
      SET slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))
      WHERE slug IS NULL OR slug = ''
    `)
    await query(`CREATE UNIQUE INDEX IF NOT EXISTS email_templates_slug_idx ON email_templates(slug) WHERE slug IS NOT NULL`)

    // email_queue: extend baseline to the full shape used by
    // src/lib/email-queue-api.ts.
    await query(`
      ALTER TABLE email_queue
        ADD COLUMN IF NOT EXISTS recipient_email        TEXT,
        ADD COLUMN IF NOT EXISTS recipient_name         TEXT,
        ADD COLUMN IF NOT EXISTS recipient_user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS body_html              TEXT,
        ADD COLUMN IF NOT EXISTS body_text              TEXT,
        ADD COLUMN IF NOT EXISTS sender_email           TEXT,
        ADD COLUMN IF NOT EXISTS sender_name            TEXT,
        ADD COLUMN IF NOT EXISTS from_email_address_id  UUID,
        ADD COLUMN IF NOT EXISTS scheduled_for          TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS timezone               TEXT NOT NULL DEFAULT 'UTC',
        ADD COLUMN IF NOT EXISTS email_type             TEXT,
        ADD COLUMN IF NOT EXISTS email_category         TEXT,
        ADD COLUMN IF NOT EXISTS priority               INTEGER NOT NULL DEFAULT 5,
        ADD COLUMN IF NOT EXISTS application_id         UUID,
        ADD COLUMN IF NOT EXISTS quotation_id           UUID,
        ADD COLUMN IF NOT EXISTS donation_id            UUID,
        ADD COLUMN IF NOT EXISTS sponsorship_id         UUID,
        ADD COLUMN IF NOT EXISTS max_retries            INTEGER NOT NULL DEFAULT 3,
        ADD COLUMN IF NOT EXISTS metadata               JSONB NOT NULL DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS tags                   TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
        ADD COLUMN IF NOT EXISTS created_by_user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
    `)
    // Backfill new columns from legacy ones and relax NOT NULL on legacy ones.
    await query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_name='email_queue' AND column_name='to_address') THEN
          EXECUTE 'UPDATE email_queue
                      SET recipient_email = COALESCE(NULLIF(recipient_email,''''), to_address)
                    WHERE recipient_email IS NULL OR recipient_email = ''''';
          EXECUTE 'ALTER TABLE email_queue ALTER COLUMN to_address DROP NOT NULL';
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_name='email_queue' AND column_name='html_body') THEN
          EXECUTE 'UPDATE email_queue
                      SET body_html = COALESCE(NULLIF(body_html,''''), html_body)
                    WHERE body_html IS NULL OR body_html = ''''';
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_name='email_queue' AND column_name='scheduled_at') THEN
          EXECUTE 'UPDATE email_queue
                      SET scheduled_for = COALESCE(scheduled_for, scheduled_at)
                    WHERE scheduled_for IS NULL';
        END IF;
      END $$
    `)

    // email_analytics: the original table tracks one event per row but the UI
    // expects a daily-aggregated shape (date, email_type, status, *_count).
    // Replace with a VIEW computed from email_logs so the UI works without
    // a separate denormalised table to maintain.
    await query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables
                    WHERE table_schema='public' AND table_name='email_analytics' AND table_type='BASE TABLE') THEN
          EXECUTE 'DROP TABLE email_analytics CASCADE';
        END IF;
      END $$
    `)
    await query(`
      CREATE OR REPLACE VIEW email_analytics AS
      SELECT
        DATE(created_at)             AS date,
        COALESCE(email_type, 'unknown') AS email_type,
        COALESCE(status, 'unknown')  AS status,
        COUNT(*)                     AS count,
        COUNT(*) FILTER (WHERE status IN ('sent','delivered')) AS sent_count,
        COUNT(*) FILTER (WHERE status = 'delivered')           AS delivered_count,
        COUNT(*) FILTER (WHERE status = 'failed')              AS failed_count,
        COUNT(*) FILTER (WHERE status = 'bounced')             AS bounced_count,
        COUNT(*) FILTER (WHERE status = 'pending')             AS pending_count
      FROM email_logs
      GROUP BY DATE(created_at), email_type, status
    `)

    // Seed a baseline set of default email templates so /admin/emails/templates
    // is never empty. Inserts are idempotent on `name`.
    const defaults: Array<{
      name: string; slug: string; category: string; subject: string;
      html: string; description: string; variables: string[];
    }> = [
      {
        name: 'Welcome Email',
        slug: 'welcome',
        category: 'welcome',
        subject: 'Welcome to GritSync, {{first_name}}!',
        description: 'Sent to new users right after signup.',
        variables: ['first_name', 'last_name', 'login_url'],
        html: `<p>Hi {{first_name}},</p><p>Welcome to GritSync. We're glad to have you with us.</p><p><a href="{{login_url}}">Sign in to your dashboard</a></p><p>— The GritSync team</p>`,
      },
      {
        name: 'Email Verification',
        slug: 'email-verification',
        category: 'transactional',
        subject: 'Verify your GritSync email',
        description: 'Confirm a newly registered email address.',
        variables: ['first_name', 'verification_url'],
        html: `<p>Hi {{first_name}},</p><p>Please confirm your email by clicking the link below:</p><p><a href="{{verification_url}}">Verify my email</a></p>`,
      },
      {
        name: 'Password Reset',
        slug: 'password-reset',
        category: 'transactional',
        subject: 'Reset your GritSync password',
        description: 'Sent when a user requests a password reset.',
        variables: ['first_name', 'reset_url'],
        html: `<p>Hi {{first_name}},</p><p>You requested a password reset. Click below to choose a new password — this link expires in 1 hour.</p><p><a href="{{reset_url}}">Reset password</a></p><p>If you didn't request this, you can ignore this email.</p>`,
      },
      {
        name: 'Application Submitted',
        slug: 'application-submitted',
        category: 'transactional',
        subject: 'We received your {{service_name}} application',
        description: 'Confirms a new application has been submitted.',
        variables: ['first_name', 'service_name', 'application_id', 'tracking_url'],
        html: `<p>Hi {{first_name}},</p><p>We have received your <strong>{{service_name}}</strong> application (ref #{{application_id}}). Our team will review it shortly.</p><p><a href="{{tracking_url}}">Track your application</a></p>`,
      },
      {
        name: 'Application Status Update',
        slug: 'application-status-update',
        category: 'notification',
        subject: 'Your application status has changed: {{status}}',
        description: 'Notifies a user when their application status updates.',
        variables: ['first_name', 'application_id', 'status', 'message', 'tracking_url'],
        html: `<p>Hi {{first_name}},</p><p>Your application (#{{application_id}}) is now <strong>{{status}}</strong>.</p><p>{{message}}</p><p><a href="{{tracking_url}}">View the timeline</a></p>`,
      },
      {
        name: 'Payment Confirmation',
        slug: 'payment-confirmation',
        category: 'transactional',
        subject: 'Payment received — thank you, {{first_name}}',
        description: 'Receipt for a successful payment.',
        variables: ['first_name', 'amount', 'currency', 'reference', 'receipt_url'],
        html: `<p>Hi {{first_name}},</p><p>We've received your payment of <strong>{{amount}} {{currency}}</strong>. Reference: {{reference}}.</p><p><a href="{{receipt_url}}">Download your receipt</a></p>`,
      },
      {
        name: 'Payment Reminder',
        slug: 'payment-reminder',
        category: 'reminder',
        subject: 'Friendly reminder: payment due',
        description: 'Reminds a user that a payment is due.',
        variables: ['first_name', 'amount', 'currency', 'due_date', 'pay_url'],
        html: `<p>Hi {{first_name}},</p><p>This is a friendly reminder that your payment of <strong>{{amount}} {{currency}}</strong> is due on {{due_date}}.</p><p><a href="{{pay_url}}">Pay now</a></p>`,
      },
      {
        name: 'Document Request',
        slug: 'document-request',
        category: 'notification',
        subject: 'Action needed: upload your {{document_name}}',
        description: 'Asks a user to upload a missing document.',
        variables: ['first_name', 'document_name', 'upload_url'],
        html: `<p>Hi {{first_name}},</p><p>To keep your application moving, we need you to upload your <strong>{{document_name}}</strong>.</p><p><a href="{{upload_url}}">Upload now</a></p>`,
      },
      {
        name: 'Quotation Issued',
        slug: 'quotation-issued',
        category: 'transactional',
        subject: 'Your GritSync quotation is ready',
        description: 'Delivers a new quotation to the recipient.',
        variables: ['first_name', 'quotation_number', 'total', 'currency', 'quote_url'],
        html: `<p>Hi {{first_name}},</p><p>Your quotation <strong>#{{quotation_number}}</strong> is ready — total {{total}} {{currency}}.</p><p><a href="{{quote_url}}">Open your quotation</a></p>`,
      },
      {
        name: 'NCLEX Sponsorship Approved',
        slug: 'nclex-sponsorship-approved',
        category: 'announcement',
        subject: 'Great news — your sponsorship is approved!',
        description: 'Tells an applicant they were approved for an NCLEX sponsorship.',
        variables: ['first_name', 'next_steps_url'],
        html: `<p>Hi {{first_name}},</p><p>Congratulations — you've been approved for an NCLEX sponsorship 🎉</p><p><a href="{{next_steps_url}}">See your next steps</a></p>`,
      },
      {
        name: 'Newsletter Update',
        slug: 'newsletter-update',
        category: 'marketing',
        subject: 'This week at GritSync',
        description: 'Generic newsletter template.',
        variables: ['first_name', 'unsubscribe_url'],
        html: `<p>Hi {{first_name}},</p><p>Here's what's new at GritSync this week…</p><hr><p style="font-size:11px;color:#888">Don't want these? <a href="{{unsubscribe_url}}">Unsubscribe</a>.</p>`,
      },
      {
        name: 'Generic Announcement',
        slug: 'generic-announcement',
        category: 'announcement',
        subject: '{{subject_line}}',
        description: 'Reusable announcement layout.',
        variables: ['first_name', 'subject_line', 'message_body', 'cta_label', 'cta_url'],
        html: `<p>Hi {{first_name}},</p><p>{{message_body}}</p><p><a href="{{cta_url}}">{{cta_label}}</a></p>`,
      },
    ]
    for (const t of defaults) {
      await query(
        `INSERT INTO email_templates
           (name, slug, subject, html_body, html_content, text_body, text_content,
            variables, description, category, template_type, is_active, is_default,
            usage_count)
         VALUES ($1,$2,$3,$4,$4,'','',$5::text[],$6,$7,'system',true,false,0)
         ON CONFLICT (name) DO UPDATE
           SET slug         = EXCLUDED.slug,
               subject      = EXCLUDED.subject,
               html_body    = EXCLUDED.html_body,
               html_content = EXCLUDED.html_content,
               variables    = EXCLUDED.variables,
               description  = EXCLUDED.description,
               category     = EXCLUDED.category,
               template_type= EXCLUDED.template_type,
               is_active    = true,
               updated_at   = NOW()`,
        [t.name, t.slug, t.subject, t.html, t.variables, t.description, t.category]
      )
    }
    console.log('Email admin tables migrated and default templates seeded.')
  } catch (err) {
    console.warn('Startup migration warning (email admin tables):', err)
  }

  // Referral / partner-role columns (affiliate & advisor)
  try {
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT`)
    await query(`CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code_idx ON users(referral_code) WHERE referral_code IS NOT NULL`)
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES users(id) ON DELETE SET NULL`)
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS advisor_id UUID REFERENCES users(id) ON DELETE SET NULL`)
    await query(`CREATE INDEX IF NOT EXISTS users_referred_by_idx ON users(referred_by)`)
    await query(`CREATE INDEX IF NOT EXISTS users_advisor_id_idx ON users(advisor_id)`)
    await query(`INSERT INTO settings (key, value) VALUES ('referralBonusPercent', '10') ON CONFLICT (key) DO NOTHING`)
    console.log('Referral columns ready.')
  } catch (err) {
    console.warn('Startup migration warning (referral columns):', err)
  }

  // Notifications schema alignment — the app code (client + server) writes/reads
  // `message`, `read`, and `application_id`. Legacy installs created the table
  // with `body`, `is_read`, and no `application_id`, which causes 500s on every
  // notification read/write. Rename + add idempotently.
  try {
    const hasBody = await query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'body'`
    )
    if (hasBody.rowCount && hasBody.rowCount > 0) {
      await query(`ALTER TABLE notifications RENAME COLUMN body TO message`)
    }
    const hasIsRead = await query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'is_read'`
    )
    if (hasIsRead.rowCount && hasIsRead.rowCount > 0) {
      await query(`ALTER TABLE notifications RENAME COLUMN is_read TO read`)
    }
    await query(`
      ALTER TABLE notifications
      ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES applications(id) ON DELETE CASCADE
    `)
    await query(`CREATE INDEX IF NOT EXISTS notifications_application_id_idx ON notifications(application_id)`)
    console.log('Notifications schema aligned.')
  } catch (err) {
    console.warn('Startup migration warning (notifications schema):', err)
  }

  // Applications schema alignment — the form, PDF-fill code, admin pages, and
  // receipt flow all read identity + document-path fields directly off the
  // applications row. The live schema is missing these columns, which causes
  // INSERTs to fail with "column X of relation applications does not exist"
  // and SELECTs to return undefined. Add them back idempotently as nullable.
  try {
    const cols: Array<[string, string]> = [
      ['applicant_name', 'TEXT'],
      ['service_type', 'TEXT'],
      ['state_of_application', 'TEXT'],
      ['first_name', 'TEXT'],
      ['middle_name', 'TEXT'],
      ['last_name', 'TEXT'],
      ['email', 'TEXT'],
      ['mobile_number', 'TEXT'],
      ['picture_path', 'TEXT'],
      ['diploma_path', 'TEXT'],
      ['passport_path', 'TEXT'],
      ['province', 'TEXT'],
      ['city', 'TEXT'],
      ['country', 'TEXT'],
      ['zipcode', 'TEXT'],
      ['elementary_school', 'TEXT'],
      ['gender', 'TEXT'],
      ['marital_status', 'TEXT'],
    ]
    for (const [name, type] of cols) {
      await query(`ALTER TABLE applications ADD COLUMN IF NOT EXISTS "${name}" ${type}`)
    }
    console.log('Applications schema aligned.')
  } catch (err) {
    console.warn('Startup migration warning (applications schema):', err)
  }

  // application_timeline_steps schema alignment — the client reads/writes
  // `step_key` (string identifier per timeline step, e.g. "letter_generated"),
  // `step_name` (human label), `data` (jsonb scratchpad), and `parent_step`
  // (for nested timeline steps). The upsert flow uses ON CONFLICT
  // (application_id, step_key), which requires a UNIQUE constraint —
  // a plain index is rejected by PG with "no unique or exclusion constraint
  // matching the ON CONFLICT specification".
  try {
    await query(`ALTER TABLE application_timeline_steps ADD COLUMN IF NOT EXISTS step_key TEXT`)
    await query(`ALTER TABLE application_timeline_steps ADD COLUMN IF NOT EXISTS step_name TEXT`)
    await query(`ALTER TABLE application_timeline_steps ADD COLUMN IF NOT EXISTS data JSONB`)
    await query(`ALTER TABLE application_timeline_steps ADD COLUMN IF NOT EXISTS parent_step TEXT`)
    // The original baseline made step_number / title NOT NULL, but the modern
    // upsert path (timelineStepsAPI.update) keys rows by step_key and never
    // sends those legacy fields — relax the NULL constraints so inserts on
    // upsert-miss succeed instead of returning 500.
    await query(`ALTER TABLE application_timeline_steps ALTER COLUMN step_number DROP NOT NULL`)
    await query(`ALTER TABLE application_timeline_steps ALTER COLUMN title DROP NOT NULL`)
    // Drop the prior non-unique index if present, then create a unique one so
    // ON CONFLICT (application_id, step_key) resolves. PG treats NULL step_key
    // values as distinct, so existing legacy rows (step_key IS NULL) don't
    // collide with each other.
    await query(`DROP INDEX IF EXISTS ats_app_step_key_idx`)
    await query(`CREATE UNIQUE INDEX IF NOT EXISTS application_timeline_steps_app_step_uidx ON application_timeline_steps(application_id, step_key)`)
    console.log('Application timeline steps schema aligned.')
  } catch (err) {
    console.warn('Startup migration warning (application_timeline_steps schema):', err)
  }

  // Mandatory Courses Agent (GS Method → Mandatory Course tab)
  // Per-question answer cache + per-run history. The answer cache lets the
  // agent skip the LLM on subsequent runs (questions repeat across applicants).
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS mandatory_course_answers (
        question_hash    TEXT PRIMARY KEY,
        course_slug      TEXT NOT NULL,
        question_text    TEXT NOT NULL,
        options          JSONB NOT NULL,
        answer_text      TEXT NOT NULL,
        verified         BOOLEAN NOT NULL DEFAULT false,
        source           TEXT NOT NULL DEFAULT 'ai',
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
    await query(`CREATE INDEX IF NOT EXISTS mandatory_course_answers_course_slug_idx ON mandatory_course_answers(course_slug)`)
    await query(`
      CREATE TABLE IF NOT EXISTS mandatory_course_runs (
        id              UUID PRIMARY KEY,
        application_id  UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
        started_by      UUID REFERENCES users(id) ON DELETE SET NULL,
        status          TEXT NOT NULL,
        started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ended_at        TIMESTAMPTZ,
        result          JSONB,
        events          JSONB
      )
    `)
    await query(`CREATE INDEX IF NOT EXISTS mandatory_course_runs_app_idx ON mandatory_course_runs(application_id, started_at DESC)`)
    console.log('Mandatory Courses agent tables ready.')
  } catch (err) {
    console.warn('Startup migration warning (mandatory_course tables):', err)
  }

  // NY Application + PV Application agent run tables (same shape as the
  // mandatory_course_runs table — keyed by id, scoped to application_id).
  try {
    for (const table of ['ny_application_runs', 'pv_application_runs']) {
      await query(`
        CREATE TABLE IF NOT EXISTS ${table} (
          id              UUID PRIMARY KEY,
          application_id  UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
          started_by      UUID REFERENCES users(id) ON DELETE SET NULL,
          status          TEXT NOT NULL,
          started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          ended_at        TIMESTAMPTZ,
          result          JSONB,
          events          JSONB
        )
      `)
      await query(`CREATE INDEX IF NOT EXISTS ${table}_app_idx ON ${table}(application_id, started_at DESC)`)
    }
    console.log('NY/PV application run tables ready.')
  } catch (err) {
    console.warn('Startup migration warning (ny/pv application run tables):', err)
  }

  // One-shot cleanup: collapse any duplicate user_documents rows for
  // agent-saved document types down to a single row per (user, type) —
  // keep the most recently uploaded one. Earlier agent runs sometimes left
  // two rows behind which made the DocumentsTab show stacked thumbnails.
  try {
    const cleanup = await query(`
      WITH ranked AS (
        SELECT id,
               row_number() OVER (
                 PARTITION BY user_id, document_type
                 ORDER BY uploaded_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
               ) AS rn
          FROM user_documents
         WHERE document_type LIKE 'mandatory_course_%'
            OR document_type LIKE 'ny_application_%'
            OR document_type LIKE 'pv_application_%'
      )
      DELETE FROM user_documents
       WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
    `)
    if (cleanup.rowCount && cleanup.rowCount > 0) {
      console.log(`Dedup'd ${cleanup.rowCount} duplicate agent-saved user_documents row(s).`)
    }
  } catch (err) {
    console.warn('Startup migration warning (user_documents dedup):', err)
  }

  // Donations schema alignment — donate flow writes donor_phone, is_anonymous,
  // payment_method, and stripe_payment_intent_id. Legacy schema has
  // stripe_intent_id only; add the modern name and backfill from the legacy
  // column so historical donations keep their reference.
  try {
    await query(`ALTER TABLE donations ADD COLUMN IF NOT EXISTS donor_phone TEXT`)
    await query(`ALTER TABLE donations ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN NOT NULL DEFAULT false`)
    await query(`ALTER TABLE donations ADD COLUMN IF NOT EXISTS payment_method TEXT`)
    await query(`ALTER TABLE donations ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT`)
    // Donations can be earmarked to a specific NCLEX sponsorship application.
    // nclex_sponsorships.id is `integer`, so the FK column must match.
    await query(`ALTER TABLE donations ADD COLUMN IF NOT EXISTS sponsorship_id INTEGER REFERENCES nclex_sponsorships(id) ON DELETE SET NULL`)
    await query(`CREATE INDEX IF NOT EXISTS donations_sponsorship_id_idx ON donations(sponsorship_id)`)
    // Backfill the new column from the legacy one, when both exist.
    const legacy = await query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name='donations' AND column_name='stripe_intent_id'`
    )
    if (legacy.rowCount && legacy.rowCount > 0) {
      await query(`
        UPDATE donations
           SET stripe_payment_intent_id = stripe_intent_id
         WHERE stripe_payment_intent_id IS NULL AND stripe_intent_id IS NOT NULL
      `)
    }
    console.log('Donations schema aligned.')
  } catch (err) {
    console.warn('Startup migration warning (donations schema):', err)
  }
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || process.env.SERVER_PORT || 3001
const isProd = process.env.NODE_ENV === 'production'

app.use(cors({
  origin: true,
  credentials: true,
}))
app.use(json({ limit: '10mb' }))
app.use(urlencoded({ extended: true, limit: '10mb' }))

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API Routes
app.use('/api/auth', authRoutes)
app.use('/api/db', queryRoutes)
app.use('/api/payments', paymentRoutes)
app.use('/api/emails', emailRoutes)
app.use('/api/questions', questionRoutes)
app.use('/api/storage', storageRoutes)
app.use('/api/contact', contactRoutes)
app.use('/api/messages', messageRoutes)
app.use('/api/referrals', referralRoutes)
app.use('/api/social', socialRoutes)
app.use('/api/social/ai', socialAiRoutes)
app.use('/api/nclex', nclexRoutes)
app.use('/api/processing-accounts', processingAccountsRoutes)
// Playwright-based agents: only available outside Vercel serverless
if (!process.env.VERCEL) {
  import('./routes/agents').then(({ default: agentsRoutes }) => {
    app.use('/api/agents', agentsRoutes)
  }).catch((err) => {
    console.warn('Agents route failed to load (Playwright may be missing):', err.message)
  })
}

// On Vercel the Vite build is served as static files by the CDN; the Express
// app only handles /api/* routes.  Locally / on self-hosted servers we still
// serve the compiled frontend from dist/.
if (isProd && !process.env.VERCEL) {
  const distPath = path.join(__dirname, '..', 'dist')
  app.use(express.static(distPath))
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
} else if (!isProd) {
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' })
  })
}

// Error handler
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('Server error:', err)
  res.status(500).json({ error: err.message || 'Internal server error' })
})

if (process.env.VERCEL) {
  // Serverless: run migrations on cold-start; skip listen() and the
  // setInterval scheduler (not supported in ephemeral functions).
  runStartupMigrations().catch((err) =>
    console.error('Startup migrations error (Vercel cold-start):', err)
  )
} else {
  app.listen(PORT, () => {
    console.log(`API Server running on port ${PORT} (${isProd ? 'production' : 'development'})`)
    runStartupMigrations()
      .catch((err) => {
        console.error('Unhandled error in startup migrations (non-fatal):', err)
      })
      .finally(() => {
        // Poll for due scheduled social posts every minute.
        setInterval(() => {
          processDuePosts().catch((err) => console.error('Scheduled post tick failed:', err))
        }, 60_000)
      })
  })
}

export default app
