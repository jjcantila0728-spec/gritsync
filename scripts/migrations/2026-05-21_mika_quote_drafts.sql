-- Mika's quote-via-Messenger flow.
--
-- Mika can now offer to draft a quote inside a DM. She slot-fills across
-- multiple turns (first name, last name, email, mobile, taker type,
-- payment type), creates the quotation, emails it to the client, and
-- replies in-thread with the quote link.
--
-- We track per-thread state in `social_quote_drafts` so a server restart
-- mid-conversation doesn't lose the slots, and so we don't accidentally
-- re-create a quote on the same thread that's already been served.

CREATE TABLE IF NOT EXISTS social_quote_drafts (
  thread_id        TEXT PRIMARY KEY,                 -- Meta conversation id
  account_id       UUID,                             -- social_accounts.id
  status           TEXT NOT NULL DEFAULT 'collecting', -- 'collecting' | 'created' | 'cancelled'
  slots            JSONB NOT NULL DEFAULT '{}'::jsonb,
  quote_id         UUID,                             -- quotations.id once status='created'
  last_message_id  TEXT,                             -- de-dup hook: don't re-process same inbound
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS social_quote_drafts_status_idx
  ON social_quote_drafts (status);
