-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'admin')),
  first_name TEXT,
  last_name TEXT,
  grit_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Applications table
CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Personal Information
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT NOT NULL,
  mobile_number TEXT NOT NULL,
  email TEXT NOT NULL,
  gender TEXT NOT NULL,
  marital_status TEXT NOT NULL,
  single_full_name TEXT,
  date_of_birth TEXT NOT NULL,
  birth_place TEXT NOT NULL,
  country_of_birth TEXT,
  
  -- Address Information
  house_number TEXT NOT NULL,
  street_name TEXT NOT NULL,
  city TEXT NOT NULL,
  province TEXT NOT NULL,
  country TEXT NOT NULL,
  zipcode TEXT NOT NULL,
  
  -- Elementary School
  elementary_school TEXT NOT NULL,
  elementary_city TEXT NOT NULL,
  elementary_province TEXT,
  elementary_country TEXT,
  elementary_years_attended TEXT NOT NULL,
  elementary_start_date TEXT NOT NULL,
  elementary_end_date TEXT NOT NULL,
  
  -- High School
  high_school TEXT NOT NULL,
  high_school_city TEXT NOT NULL,
  high_school_province TEXT,
  high_school_country TEXT,
  high_school_years_attended TEXT NOT NULL,
  high_school_start_date TEXT NOT NULL,
  high_school_end_date TEXT NOT NULL,
  high_school_graduated TEXT,
  high_school_diploma_type TEXT,
  high_school_diploma_date TEXT,
  
  -- Nursing School
  nursing_school TEXT NOT NULL,
  nursing_school_city TEXT NOT NULL,
  nursing_school_province TEXT,
  nursing_school_country TEXT,
  nursing_school_years_attended TEXT NOT NULL,
  nursing_school_start_date TEXT NOT NULL,
  nursing_school_end_date TEXT NOT NULL,
  nursing_school_major TEXT,
  nursing_school_diploma_date TEXT,
  
  -- Documents
  picture_path TEXT NOT NULL,
  diploma_path TEXT NOT NULL,
  passport_path TEXT NOT NULL,
  
  -- Additional fields
  signature TEXT,
  payment_type TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'rejected')),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Quotations table
-- Note: user_id is nullable to allow public/guest quotations without authentication
CREATE TABLE IF NOT EXISTS quotations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL for public/guest quotations
  amount DECIMAL(10, 2) NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  service TEXT,
  state TEXT,
  payment_type TEXT CHECK (payment_type IN ('full', 'staggered')),
  line_items JSONB,
  client_first_name TEXT,
  client_last_name TEXT,
  client_email TEXT,
  client_mobile TEXT,
  validity_date TIMESTAMP WITH TIME ZONE, -- Quote expiration date (30 days from creation by default)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Details table - stores user's saved application details
CREATE TABLE IF NOT EXISTS user_details (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  first_name TEXT,
  middle_name TEXT,
  last_name TEXT,
  mobile_number TEXT,
  email TEXT,
  gender TEXT,
  marital_status TEXT,
  single_full_name TEXT,
  date_of_birth TEXT,
  birth_place TEXT,
  house_number TEXT,
  street_name TEXT,
  city TEXT,
  province TEXT,
  country TEXT,
  zipcode TEXT,
  elementary_school TEXT,
  elementary_city TEXT,
  elementary_province TEXT,
  elementary_country TEXT,
  elementary_years_attended TEXT,
  elementary_start_date TEXT,
  elementary_end_date TEXT,
  high_school TEXT,
  high_school_city TEXT,
  high_school_province TEXT,
  high_school_country TEXT,
  high_school_years_attended TEXT,
  high_school_start_date TEXT,
  high_school_end_date TEXT,
  high_school_graduated TEXT,
  high_school_diploma_type TEXT,
  high_school_diploma_date TEXT,
  nursing_school TEXT,
  nursing_school_city TEXT,
  nursing_school_province TEXT,
  nursing_school_country TEXT,
  nursing_school_years_attended TEXT,
  nursing_school_start_date TEXT,
  nursing_school_end_date TEXT,
  nursing_school_major TEXT,
  nursing_school_diploma_date TEXT,
  signature TEXT,
  payment_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Documents table - stores user's uploaded documents
CREATE TABLE IF NOT EXISTS user_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (
    document_type IN (
      'picture', 
      'diploma', 
      'passport',
      'mandatory_course_infection_control',
      'mandatory_course_child_abuse'
    )
    OR document_type LIKE 'mandatory_course_%'
  ),
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Application Payments table
CREATE TABLE IF NOT EXISTS application_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('step1', 'step2', 'full')),
  amount DECIMAL(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'cancelled')),
  payment_method TEXT,
  transaction_id TEXT,
  stripe_payment_intent_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Receipts table
CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id UUID NOT NULL REFERENCES application_payments(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receipt_number TEXT UNIQUE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  payment_type TEXT NOT NULL,
  items JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Processing Accounts table
CREATE TABLE IF NOT EXISTS processing_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  account_type TEXT NOT NULL CHECK (account_type IN ('gmail', 'gritsync', 'pearson_vue', 'custom')),
  name TEXT,
  link TEXT,
  email TEXT NOT NULL,
  password TEXT NOT NULL,
  security_question_1 TEXT,
  security_question_2 TEXT,
  security_question_3 TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Application Timeline Steps table
CREATE TABLE IF NOT EXISTS application_timeline_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  step_key TEXT NOT NULL,
  step_name TEXT NOT NULL,
  parent_step TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  data JSONB,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(application_id, step_key)
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('timeline_update', 'status_change', 'payment', 'general')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Settings table - stores admin settings
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Services table - stores service configurations (pricing, line items)
CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  service_name TEXT NOT NULL,
  state TEXT NOT NULL,
  payment_type TEXT CHECK (payment_type IN ('full', 'staggered')),
  line_items JSONB NOT NULL,
  total_full DECIMAL(10, 2),
  total_step1 DECIMAL(10, 2),
  total_step2 DECIMAL(10, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(service_name, state, payment_type)
);

-- Service document requirements table
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

-- Password Reset Tokens table (Supabase handles this, but keeping for compatibility)
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for documents bucket
-- Note: These policies may already exist from fix-storage-policies.sql
-- Drop existing policies first to avoid conflicts
DO $$ 
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects'
    AND (
      policyname LIKE '%documents%' 
      OR policyname LIKE '%document%'
    )
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
  END LOOP;
END $$;

-- Create storage policies (using is_admin_user() function to avoid RLS recursion)
-- Note: is_admin_user() function should be created by fix-permissions-definitive.sql
-- If it doesn't exist, create it here
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  );
END;
$$;

CREATE POLICY "Users can upload their own documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can upload all documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' AND
  public.is_admin_user()
);

CREATE POLICY "Admins can view all documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' AND
  public.is_admin_user()
);

CREATE POLICY "Admins can delete all documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents' AND
  public.is_admin_user()
);

-- Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_timeline_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_required_documents ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view their own profile"
ON users FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON users FOR UPDATE
USING (auth.uid() = id);

-- Helper function to check if user is admin (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE POLICY "Admins can view all users"
ON users FOR SELECT
USING (public.is_admin());

CREATE POLICY "Admins can update all users"
ON users FOR UPDATE
USING (public.is_admin());

-- Applications policies
CREATE POLICY "Users can view their own applications"
ON applications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own applications"
ON applications FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all applications"
ON applications FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

CREATE POLICY "Admins can update applications"
ON applications FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Quotations policies

-- Anonymous users can insert quotations with NULL user_id (for public quotes)
CREATE POLICY "Allow anonymous quotation inserts"
ON quotations FOR INSERT
TO anon
WITH CHECK (user_id IS NULL);

-- Anonymous users can read all quotations (for quote viewing by ID)
CREATE POLICY "Allow anonymous quotation reads by email"
ON quotations FOR SELECT
TO anon
USING (true);

-- Anonymous users can update quotations with NULL user_id
CREATE POLICY "Allow anonymous quotation updates"
ON quotations FOR UPDATE
TO anon
USING (user_id IS NULL)
WITH CHECK (user_id IS NULL);

-- Authenticated users can view their own quotations and public quotations (NULL user_id)
CREATE POLICY "Users can view their own quotations"
ON quotations FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can create their own quotations"
ON quotations FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own quotations"
ON quotations FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own quotations"
ON quotations FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all quotations
CREATE POLICY "Admins can view all quotations"
ON quotations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Admins can update all quotations
CREATE POLICY "Admins can update all quotations"
ON quotations FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Admins can delete all quotations
CREATE POLICY "Admins can delete all quotations"
ON quotations FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- User Details policies
CREATE POLICY "Users can view their own details"
ON user_details FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own details"
ON user_details FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own details"
ON user_details FOR UPDATE
USING (auth.uid() = user_id);

-- User Documents policies
CREATE POLICY "Users can view their own documents"
ON user_documents FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own documents"
ON user_documents FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own documents"
ON user_documents FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own documents"
ON user_documents FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all documents"
ON user_documents FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

CREATE POLICY "Admins can insert documents for any user"
ON user_documents FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

CREATE POLICY "Admins can update all documents"
ON user_documents FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

CREATE POLICY "Admins can delete all documents"
ON user_documents FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Application Payments policies
CREATE POLICY "Users can view their own payments"
ON application_payments FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own payments"
ON application_payments FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all payments"
ON application_payments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

CREATE POLICY "Admins can update all payments"
ON application_payments FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Receipts policies
CREATE POLICY "Users can view their own receipts"
ON receipts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all receipts"
ON receipts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Processing Accounts policies
CREATE POLICY "Users can view accounts for their applications"
ON processing_accounts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM applications
    WHERE applications.id = processing_accounts.application_id
    AND applications.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all accounts"
ON processing_accounts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

CREATE POLICY "Admins can insert accounts"
ON processing_accounts FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

CREATE POLICY "Admins can update accounts"
ON processing_accounts FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Application Timeline Steps policies
CREATE POLICY "Users can view steps for their applications"
ON application_timeline_steps FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM applications
    WHERE applications.id = application_timeline_steps.application_id
    AND applications.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all steps"
ON application_timeline_steps FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

CREATE POLICY "Admins can insert steps"
ON application_timeline_steps FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

CREATE POLICY "Admins can update steps"
ON application_timeline_steps FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Notifications policies
CREATE POLICY "Users can view their own notifications"
ON notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
ON notifications FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
ON notifications FOR INSERT
WITH CHECK (true);

-- Settings policies
CREATE POLICY "Everyone can view settings"
ON settings FOR SELECT
USING (true);

CREATE POLICY "Admins can update settings"
ON settings FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

CREATE POLICY "Admins can insert settings"
ON settings FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Services policies
CREATE POLICY "Everyone can view services"
ON services FOR SELECT
USING (true);

CREATE POLICY "Admins can manage services"
ON services FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

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

-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, role)
  VALUES (NEW.id, NEW.email, 'client');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function on new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_applications_updated_at ON applications;
CREATE TRIGGER update_applications_updated_at
  BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_quotations_updated_at ON quotations;
CREATE TRIGGER update_quotations_updated_at
  BEFORE UPDATE ON quotations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_details_updated_at ON user_details;
CREATE TRIGGER update_user_details_updated_at
  BEFORE UPDATE ON user_details
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_application_payments_updated_at ON application_payments;
CREATE TRIGGER update_application_payments_updated_at
  BEFORE UPDATE ON application_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_processing_accounts_updated_at ON processing_accounts;
CREATE TRIGGER update_processing_accounts_updated_at
  BEFORE UPDATE ON processing_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_application_timeline_steps_updated_at ON application_timeline_steps;
CREATE TRIGGER update_application_timeline_steps_updated_at
  BEFORE UPDATE ON application_timeline_steps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_services_updated_at ON services;
CREATE TRIGGER update_services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_quotations_user_id ON quotations(user_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status);
CREATE INDEX IF NOT EXISTS idx_quotations_validity_date ON quotations(validity_date) WHERE validity_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quotations_created_at ON quotations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_application_payments_user_id ON application_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_application_payments_application_id ON application_payments(application_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_application_timeline_steps_application_id ON application_timeline_steps(application_id);
CREATE INDEX IF NOT EXISTS idx_processing_accounts_application_id ON processing_accounts(application_id);
CREATE INDEX IF NOT EXISTS idx_user_documents_document_type ON user_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_user_documents_user_id ON user_documents(user_id);

-- Partial unique index: Ensure users can only have one of each required document type
CREATE UNIQUE INDEX IF NOT EXISTS user_documents_user_type_unique 
ON user_documents(user_id, document_type) 
WHERE document_type IN ('picture', 'diploma', 'passport');
