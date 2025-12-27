-- Migration 006: Fix all free users to have exactly 2 credits

-- Update all free plan users to have exactly 2 credits
-- This ensures consistency even if migration 004 already ran with DEFAULT 3
UPDATE companies 
SET credits_remaining = 2
WHERE plan = 'free';

