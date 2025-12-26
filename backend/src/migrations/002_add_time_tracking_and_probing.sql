-- Migration 002: Add time tracking and probing question support

-- Add time_limit_minutes to interviews table
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS time_limit_minutes INTEGER DEFAULT 60;

-- Add started_at to submissions table for tracking when candidate started
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

-- Add is_probing_question flag to chat_messages table
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS is_probing_question BOOLEAN DEFAULT FALSE;

-- Create index on started_at for performance
CREATE INDEX IF NOT EXISTS submissions_started_at_idx ON submissions(started_at);





