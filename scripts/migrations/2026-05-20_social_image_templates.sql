-- ============================================================================
-- Image-template library for the /admin/social Compose tab.
--
-- Replaces the single "master image prompt" with a CRUD-managed list of
-- named (name, prompt, preview_url) templates. Operators pick one when
-- generating posts; the template's prompt drives DALL·E. They can edit
-- the prompt and regenerate the preview, or add brand-new templates from
-- scratch.
--
-- Backs:
--   GET    /api/social/ai/image-templates
--   POST   /api/social/ai/image-templates                — create + render preview
--   PATCH  /api/social/ai/image-templates/:id            — update name/prompt
--   POST   /api/social/ai/image-templates/:id/regenerate — re-render preview
--   DELETE /api/social/ai/image-templates/:id
--
-- `preview_status` distinguishes the async render lifecycle. We render
-- synchronously in the POST handler today (single OpenAI call), so most
-- rows go straight to 'available'; the 'pending' state is reserved for
-- when we move to a background-worker model.
--
-- `is_default` marks the seeded "GritSync Master" template — operators
-- can override its prompt or preview, but it can't be deleted.
-- ============================================================================

CREATE TABLE IF NOT EXISTS social_image_templates (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 text        NOT NULL,
  prompt               text        NOT NULL,
  preview_url          text,
  preview_status       text        NOT NULL DEFAULT 'pending'
                                   CHECK (preview_status IN ('pending', 'available', 'failed')),
  preview_error        text,
  is_default           boolean     NOT NULL DEFAULT false,
  created_by_user_id   uuid        REFERENCES users(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT NOW(),
  updated_at           timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_image_templates_created_at
  ON social_image_templates (created_at DESC);

-- Only one row may carry the default flag — protects against accidental
-- multiple defaults if the seed runs twice.
CREATE UNIQUE INDEX IF NOT EXISTS uq_social_image_templates_default
  ON social_image_templates (is_default)
  WHERE is_default = true;
