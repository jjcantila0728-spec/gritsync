-- Testimonials Table
-- This table stores user-submitted success stories and testimonials
-- Users can submit testimonials which are reviewed by admins before publishing

CREATE TABLE IF NOT EXISTS testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  service VARCHAR(100) NOT NULL DEFAULT 'NCLEX Processing',
  testimony TEXT NOT NULL,
  image_url TEXT,
  rating INTEGER NOT NULL DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_testimonials_status ON testimonials(status);
CREATE INDEX IF NOT EXISTS idx_testimonials_featured ON testimonials(featured) WHERE featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_testimonials_approved ON testimonials(status, submitted_at) WHERE status = 'approved';

-- Enable RLS
ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;

-- Anonymous users can submit testimonials (insert only)
CREATE POLICY "testimonials_insert_anon"
  ON testimonials
  FOR INSERT
  TO anon
  WITH CHECK (
    status = 'pending' AND
    featured = false AND
    approved_at IS NULL AND
    approved_by IS NULL
  );

-- Authenticated users can also submit testimonials
CREATE POLICY "testimonials_insert_authenticated"
  ON testimonials
  FOR INSERT
  TO authenticated
  WITH CHECK (
    status = 'pending' AND
    featured = false AND
    approved_at IS NULL AND
    approved_by IS NULL
  );

-- Anyone can view approved testimonials
CREATE POLICY "testimonials_select_approved"
  ON testimonials
  FOR SELECT
  TO anon, authenticated
  USING (status = 'approved');

-- Admins can view all testimonials
CREATE POLICY "testimonials_select_admin"
  ON testimonials
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admins can update testimonials (approve/reject/feature)
CREATE POLICY "testimonials_update_admin"
  ON testimonials
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Admins can delete testimonials
CREATE POLICY "testimonials_delete_admin"
  ON testimonials
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- Service role has full access
CREATE POLICY "testimonials_service_role_all"
  ON testimonials
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT INSERT ON testimonials TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON testimonials TO authenticated;
GRANT ALL ON testimonials TO service_role;

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_testimonials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS testimonials_updated_at_trigger ON testimonials;
CREATE TRIGGER testimonials_updated_at_trigger
  BEFORE UPDATE ON testimonials
  FOR EACH ROW
  EXECUTE FUNCTION update_testimonials_updated_at();

-- Add comment for documentation
COMMENT ON TABLE testimonials IS 'User-submitted success stories and testimonials for the Success Stories page';
COMMENT ON COLUMN testimonials.status IS 'pending: awaiting review, approved: visible on site, rejected: not shown';
COMMENT ON COLUMN testimonials.featured IS 'Featured testimonials may be highlighted or shown prominently';
