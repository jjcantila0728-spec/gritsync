-- ============================================================================
-- Add `service_integrations` — single-row-per-provider table that holds the
-- OAuth refresh token + metadata for server-owned third-party connections
-- (currently just Google Drive for AI-generated media storage).
-- ----------------------------------------------------------------------------
-- Why one row per provider? The admin connects ONE Google account that owns
-- the "GritSync Social" Drive folder. Every operator's image/video uploads
-- flow through that single connection. If we later need per-user Drive
-- connections, we'd add a `user_id` column and drop the unique constraint.
--
-- How to run:
--   node scripts/run-migration.cjs scripts/migrations/2026-05-20_service_integrations.sql
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS service_integrations (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider                  TEXT NOT NULL,
  connected_account_email   TEXT,
  refresh_token             TEXT NOT NULL,
  access_token              TEXT,
  token_expires_at          TIMESTAMPTZ,
  scopes                    TEXT,
  metadata                  JSONB NOT NULL DEFAULT '{}'::jsonb,
  connected_by_user_id      UUID,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT service_integrations_provider_check
    CHECK (provider IN ('google_drive'))
);

CREATE UNIQUE INDEX IF NOT EXISTS service_integrations_provider_uq
  ON service_integrations (provider);

COMMIT;
