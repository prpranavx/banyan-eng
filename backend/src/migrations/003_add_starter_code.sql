-- Migration 003: Add starter code support
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS starter_code TEXT;



