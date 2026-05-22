-- 24/7 autopilot for the social AI agents (Mika, Kuya Jay).
--
-- Three small tables:
--
-- 1. social_autopilot_state — per-agent on/off + cadence + last-run snapshot.
--    Keyed by agent name so we can grow to Strat/Scout later. Singleton-ish:
--    one row per agent. The server scheduler ticks every minute and fires
--    any agent whose `last_run_at + interval_minutes` has elapsed.
--
-- 2. social_autopilot_log — append-only run history. Each scheduler tick
--    that does work writes one row with the summary (sent count + per-thread
--    results). Operator UI surfaces the most recent N to audit + spot
--    recurring errors (token expiry, rate limits, policy skips).
--
-- 3. social_autopilot_examples — the continuous-learning store. Every
--    successful reply Mika or Kuya Jay sends is logged here with a neutral
--    score (0). Operator can thumbs-up (score +1) or thumbs-down (-1) any
--    reply; the agent's next draft call pulls the top recent +1 examples as
--    few-shot context, so the agent's voice progressively matches what the
--    operator has approved.

CREATE TABLE IF NOT EXISTS social_autopilot_state (
  agent             TEXT PRIMARY KEY,            -- 'inbox' (Mika) | 'comments' (Kuya Jay)
  enabled           BOOLEAN NOT NULL DEFAULT FALSE,
  interval_minutes  INTEGER NOT NULL DEFAULT 5,  -- inbox=5min, comments=7min recommended defaults
  max_per_run       INTEGER NOT NULL DEFAULT 8,  -- safety cap so one tick can't burn unlimited tokens
  last_run_at       TIMESTAMPTZ,
  last_run_summary  JSONB,                       -- { sent_count, total, errors }
  consecutive_errors INTEGER NOT NULL DEFAULT 0, -- exponential backoff signal
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO social_autopilot_state (agent, interval_minutes, max_per_run)
  VALUES ('inbox', 5, 8), ('comments', 7, 12)
  ON CONFLICT (agent) DO NOTHING;

CREATE TABLE IF NOT EXISTS social_autopilot_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent       TEXT NOT NULL,
  ran_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_count  INTEGER NOT NULL DEFAULT 0,
  candidates  INTEGER NOT NULL DEFAULT 0,
  results     JSONB NOT NULL DEFAULT '[]'::jsonb,
  error       TEXT,                              -- top-level error if the whole tick blew up
  duration_ms INTEGER
);

CREATE INDEX IF NOT EXISTS social_autopilot_log_agent_ran_at_idx
  ON social_autopilot_log (agent, ran_at DESC);

CREATE TABLE IF NOT EXISTS social_autopilot_examples (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent           TEXT NOT NULL,                 -- 'inbox' | 'comments'
  account_id      UUID,                          -- social_accounts.id (nullable for comments cross-account)
  thread_or_post  TEXT,                          -- thread_id (Mika) or post_id (Kuya Jay)
  inbound_text    TEXT NOT NULL,                 -- what the user said / commented
  reply_text      TEXT NOT NULL,                 -- what the agent sent
  score           INTEGER NOT NULL DEFAULT 0,    -- -1 / 0 / +1
  scored_by       UUID,                          -- operator who graded
  scored_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS social_autopilot_examples_agent_score_idx
  ON social_autopilot_examples (agent, score DESC, created_at DESC);
