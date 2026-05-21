-- ============================================================================
-- Audit log for the image-AI master-prompt refinement loop.
--
-- Backs POST /api/social/ai/refine-master-prompt — every successful
-- refinement is appended here so we can trace how the operator's master
-- prompt evolved over time, what context the model saw at each step,
-- and roll back to a prior version if a refinement turned out worse.
--
-- The endpoint's INSERT is best-effort (wrapped in .catch), so this
-- migration is non-blocking: if the table is missing the refinement
-- still works, the log row just isn't recorded.
-- ============================================================================

CREATE TABLE IF NOT EXISTS social_ai_prompt_refinements (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        REFERENCES users(id) ON DELETE SET NULL,
  source_prompt   text        NOT NULL,
  refined_prompt  text        NOT NULL,
  reasoning       text,
  topic           text,
  goal_brief      text,
  created_at      timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_ai_prompt_refinements_created_at
  ON social_ai_prompt_refinements (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_social_ai_prompt_refinements_user_id
  ON social_ai_prompt_refinements (user_id)
  WHERE user_id IS NOT NULL;
