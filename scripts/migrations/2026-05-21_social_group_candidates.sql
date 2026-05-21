-- Tracks Facebook groups the operator is researching to join. Meta killed
-- public group search via the Graph API for new apps, so this table is the
-- workflow's "list of leads" — operator pastes the URL, status moves from
-- researching → requested → joined, and the Groups tab surfaces the list
-- alongside groups the user already admins.

CREATE TABLE IF NOT EXISTS social_group_candidates (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id            TEXT,                -- extracted from facebook.com/groups/<id>/ when available
  name                TEXT NOT NULL,
  url                 TEXT,
  notes               TEXT,
  status              TEXT NOT NULL DEFAULT 'researching',
  created_by_user_id  UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS social_group_candidates_status_idx
  ON social_group_candidates (status);
CREATE INDEX IF NOT EXISTS social_group_candidates_created_at_idx
  ON social_group_candidates (created_at DESC);
