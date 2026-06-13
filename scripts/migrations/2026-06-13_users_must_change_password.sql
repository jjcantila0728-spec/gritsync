-- Adds the `must_change_password` flag used by the admin "issue temporary
-- password" flow. When an admin resets a client's password (because the client
-- forgot it), the account is stamped with must_change_password = true. The
-- client can log in once with the temporary password, but the app forces them
-- through a password-change screen before they can use anything else. The flag
-- is cleared the moment they set a new password (see /api/auth/update).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;
