-- Add avatar_path field to users table for profile avatar
-- Run this in Supabase SQL Editor

-- Add avatar_path column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS avatar_path TEXT;

-- Add comment
COMMENT ON COLUMN users.avatar_path IS 'Path to user profile avatar image (separate from 2x2 picture document)';

