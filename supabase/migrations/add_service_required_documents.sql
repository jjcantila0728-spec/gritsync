-- Migration: Add Service Document Requirements
-- This adds a table for managing required documents per service/application type (NCLEX, EAD, etc.)

CREATE TABLE IF NOT EXISTS service_required_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_type TEXT NOT NULL,
  document_type TEXT NOT NULL,
  name TEXT NOT NULL,
  accepted_formats TEXT[] NOT NULL DEFAULT ARRAY['.pdf', '.jpg', '.jpeg', '.png'],
  required BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(service_type, document_type)
);

COMMENT ON TABLE service_required_documents IS 'Required documents configuration per service/application type';

-- Default NCLEX documents
INSERT INTO service_required_documents (service_type, document_type, name, accepted_formats, required, sort_order)
VALUES
  ('NCLEX', 'picture', '2x2 Picture', ARRAY['image/*'], TRUE, 0),
  ('NCLEX', 'diploma', 'Nursing Diploma', ARRAY['.pdf', '.jpg', '.jpeg', '.png'], TRUE, 1),
  ('NCLEX', 'passport', 'Passport', ARRAY['.pdf', '.jpg', '.jpeg', '.png'], TRUE, 2)
ON CONFLICT (service_type, document_type) DO NOTHING;

-- Default EAD (I-765) documents
INSERT INTO service_required_documents (service_type, document_type, name, accepted_formats, required, sort_order)
VALUES
  ('EAD', 'ead_photos', 'Two passport-sized photographs (2x2 inches) meeting USCIS requirements (attached in a small envelope and labeled with your name)', ARRAY['image/*'], TRUE, 0),
  ('EAD', 'ead_passport', 'Clear Copy of your passport biographical page', ARRAY['.pdf', '.jpg', '.jpeg', '.png'], TRUE, 1),
  ('EAD', 'ead_h4_visa', 'Copy of your H-4 visa stamp', ARRAY['.pdf', '.jpg', '.jpeg', '.png'], TRUE, 2),
  ('EAD', 'ead_i94', 'Copy of your most recent I-94 Arrival/Departure Record', ARRAY['.pdf', '.jpg', '.jpeg', '.png'], TRUE, 3),
  ('EAD', 'ead_marriage_certificate', 'Copy of your marriage certificate to establish your relationship with the H-1B principal beneficiary', ARRAY['.pdf', '.jpg', '.jpeg', '.png'], TRUE, 4),
  ('EAD', 'ead_spouse_i797', 'Copy of your spouse''s H-1B approval notice (Form I-797)', ARRAY['.pdf', '.jpg', '.jpeg', '.png'], TRUE, 5),
  ('EAD', 'ead_spouse_i140', 'Copy of your spouse''s approved Form I-140, Immigrant Petition for Alien Worker', ARRAY['.pdf', '.jpg', '.jpeg', '.png'], TRUE, 6),
  ('EAD', 'ead_employer_letter', 'Copy of your spouse''s employer verification letter', ARRAY['.pdf', '.jpg', '.jpeg', '.png'], TRUE, 7),
  ('EAD', 'ead_paystub', 'Recent paystub', ARRAY['.pdf', '.jpg', '.jpeg', '.png'], TRUE, 8)
ON CONFLICT (service_type, document_type) DO NOTHING;

-- Enable row level security for the table
ALTER TABLE service_required_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view service document requirements"
ON service_required_documents FOR SELECT
USING (true);

CREATE POLICY "Admins can manage service document requirements"
ON service_required_documents FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

