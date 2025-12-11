-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Companies table
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_user_id TEXT NOT NULL,
  company_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create unique index on clerk_user_id if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'companies' 
    AND indexname = 'companies_clerk_user_id_unique'
  ) THEN
    CREATE UNIQUE INDEX companies_clerk_user_id_unique ON companies(clerk_user_id);
  END IF;
END $$;

-- Interviews table
CREATE TABLE IF NOT EXISTS interviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  job_title TEXT NOT NULL,
  job_description TEXT,
  instructions TEXT,
  unique_link TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on company_id if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'interviews' 
    AND indexname = 'interviews_company_id_idx'
  ) THEN
    CREATE INDEX interviews_company_id_idx ON interviews(company_id);
  END IF;
END $$;

-- Create unique index on unique_link if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'interviews' 
    AND indexname = 'interviews_unique_link_unique'
  ) THEN
    CREATE UNIQUE INDEX interviews_unique_link_unique ON interviews(unique_link);
  END IF;
END $$;

-- Submissions table
CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  candidate_name TEXT NOT NULL,
  candidate_email TEXT NOT NULL,
  code TEXT,
  language VARCHAR(50),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(50) NOT NULL DEFAULT 'pending'
);

-- Create index on interview_id if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'submissions' 
    AND indexname = 'submissions_interview_id_idx'
  ) THEN
    CREATE INDEX submissions_interview_id_idx ON submissions(interview_id);
  END IF;
END $$;

-- Create index on submitted_at if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'submissions' 
    AND indexname = 'submissions_submitted_at_idx'
  ) THEN
    CREATE INDEX submissions_submitted_at_idx ON submissions(submitted_at);
  END IF;
END $$;

-- Create index on status if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'submissions' 
    AND indexname = 'submissions_status_idx'
  ) THEN
    CREATE INDEX submissions_status_idx ON submissions(status);
  END IF;
END $$;

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  sender VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on submission_id if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'chat_messages' 
    AND indexname = 'chat_messages_submission_id_idx'
  ) THEN
    CREATE INDEX chat_messages_submission_id_idx ON chat_messages(submission_id);
  END IF;
END $$;

-- Create index on session_id if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'chat_messages' 
    AND indexname = 'chat_messages_session_id_idx'
  ) THEN
    CREATE INDEX chat_messages_session_id_idx ON chat_messages(session_id);
  END IF;
END $$;

-- Create index on timestamp if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'chat_messages' 
    AND indexname = 'chat_messages_timestamp_idx'
  ) THEN
    CREATE INDEX chat_messages_timestamp_idx ON chat_messages(timestamp);
  END IF;
END $$;

-- AI analysis table
CREATE TABLE IF NOT EXISTS ai_analysis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  summary TEXT NOT NULL,
  strengths JSONB NOT NULL DEFAULT '[]'::jsonb,
  improvements JSONB NOT NULL DEFAULT '[]'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create unique index on submission_id if it doesn't exist (one analysis per submission)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'ai_analysis' 
    AND indexname = 'ai_analysis_submission_id_unique'
  ) THEN
    CREATE UNIQUE INDEX ai_analysis_submission_id_unique ON ai_analysis(submission_id);
  END IF;
END $$;

