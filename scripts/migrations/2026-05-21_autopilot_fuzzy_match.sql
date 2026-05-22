-- Cost-control upgrade for the social autopilot's learning loop.
--
-- Before: cached-reply reuse only fired when the inbound text EXACTLY
-- matched a previously-answered inbound. That hit rate is low — "magkano
-- po total?" and "magkano po ba ang total nyo?" never matched even
-- though the answer is identical.
--
-- After: we trigram-match the inbound against operator-approved
-- (score >= 1) past replies. Strong matches reuse the approved reply
-- and skip the OpenAI call entirely. Effective ~60-80% cache hit rate
-- once the operator has thumbed-up a couple dozen replies, which is the
-- whole point of the continuous-learning loop.
--
-- pg_trgm ships with Postgres and is enabled with CREATE EXTENSION; no
-- new packages required. The GIN index gives O(log n) similarity lookups
-- even as the examples table grows.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS social_autopilot_examples_inbound_trgm_idx
  ON social_autopilot_examples
  USING gin (LOWER(inbound_text) gin_trgm_ops);
