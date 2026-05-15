-- Adds the otp / otp_expires_at columns used by /api/auth/reset-password-request.
-- Original init.sql only had (user_id, token, expires_at, used, created_at);
-- the route was updated to also store a 6-digit OTP for users who prefer to
-- enter a code rather than click a link.

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id              SERIAL PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token           TEXT NOT NULL UNIQUE,
  expires_at      TIMESTAMPTZ NOT NULL,
  used            BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  otp             TEXT,
  otp_expires_at  TIMESTAMPTZ
);

ALTER TABLE password_reset_tokens
  ADD COLUMN IF NOT EXISTS otp            TEXT,
  ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token   ON password_reset_tokens(token);
