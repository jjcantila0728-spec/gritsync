-- Career promotional landing pages: each career stores an array of
-- storage paths for promotional images (required at creation in the
-- admin UI; first image is the hero/OG image on /career/:id).
ALTER TABLE careers
  ADD COLUMN IF NOT EXISTS promo_images JSONB NOT NULL DEFAULT '[]';

-- Application reporting: agencies that accept applicant reports through
-- their own external form (e.g. an Airtable form) store its URL here.
-- The admin "Report" action opens this form; agencies without one fall
-- back to the email-based forward flow.
ALTER TABLE partner_agencies
  ADD COLUMN IF NOT EXISTS report_form_url TEXT;

NOTIFY pgrst, 'reload schema';
