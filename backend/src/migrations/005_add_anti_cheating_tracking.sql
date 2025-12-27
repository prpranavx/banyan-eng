-- Migration 005: Add anti-cheating tracking to submissions

-- Add anti-cheating tracking columns to submissions table
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS paste_count INTEGER DEFAULT 0;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS tab_switch_count INTEGER DEFAULT 0;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS tab_switch_times JSONB DEFAULT '[]'::jsonb;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS last_activity TIMESTAMPTZ;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS suspicious_activity BOOLEAN DEFAULT false;

-- Create index on suspicious_activity for filtering
CREATE INDEX IF NOT EXISTS submissions_suspicious_idx ON submissions(suspicious_activity);

