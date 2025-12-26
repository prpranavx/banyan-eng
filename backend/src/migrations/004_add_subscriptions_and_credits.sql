-- Migration 004: Add subscription and credits support

-- Add subscription and credits columns to companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS plan VARCHAR(50) DEFAULT 'free';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS credits_remaining INTEGER DEFAULT 3;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS lemon_squeezy_customer_id TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS lemon_squeezy_subscription_id TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'free';

-- Set trial expiration for existing free users (14 days from now)
UPDATE companies 
SET trial_ends_at = NOW() + INTERVAL '14 days'
WHERE plan = 'free' AND trial_ends_at IS NULL;

-- Set credits for existing users who don't have them (only NULL, not 0)
UPDATE companies 
SET credits_remaining = 3
WHERE credits_remaining IS NULL;

-- Create index on plan for filtering
CREATE INDEX IF NOT EXISTS companies_plan_idx ON companies(plan);

-- Add constraint to prevent negative credits
ALTER TABLE companies 
ADD CONSTRAINT credits_remaining_non_negative 
CHECK (credits_remaining >= 0);

