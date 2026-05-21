-- ============================================================================
-- Persist the actual image prompt sent to DALL·E / gpt-image for each
-- Content Bank row. Lets the BankItemModal show the operator exactly
-- what prompt produced the image — useful for debugging "why does this
-- one look off" and for one-click reuse via Copy.
--
-- The /generate-batch endpoint sets this on insert. Existing rows have
-- NULL until a fresh generation re-fills the column.
-- ============================================================================

ALTER TABLE social_content_bank
  ADD COLUMN IF NOT EXISTS image_prompt text;
