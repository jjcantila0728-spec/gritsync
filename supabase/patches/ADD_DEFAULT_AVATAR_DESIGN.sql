-- Add default_avatar_design field to users table for default avatar design preference
-- Run this in Supabase SQL Editor

-- Add default_avatar_design column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS default_avatar_design TEXT DEFAULT 'default';

-- Add comment
COMMENT ON COLUMN users.default_avatar_design IS 'Default avatar design preference (default, vibrant, pastel, monochrome, etc.)';
