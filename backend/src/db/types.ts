// Database entity types matching the schema

export interface Company {
  id: string
  clerk_user_id: string
  company_name: string
  plan: 'free' | 'pro' | 'enterprise'
  credits_remaining: number
  lemon_squeezy_customer_id: string | null
  lemon_squeezy_subscription_id: string | null
  trial_ends_at: string | null
  subscription_status: 'free' | 'active' | 'canceled' | 'past_due' | 'trialing'
  created_at: string
}

export interface Interview {
  id: string
  company_id: string
  job_title: string
  job_description: string | null
  instructions: string | null
  unique_link: string
  time_limit_minutes: number | null
  starter_code: string | null
  created_at: string
}

export interface Submission {
  id: string
  interview_id: string
  candidate_name: string
  candidate_email: string
  code: string | null
  language: string | null
  submitted_at: string
  started_at: string | null
  status: string
  paste_count: number
  tab_switch_count: number
  tab_switch_times: string[]
  last_activity: string | null
  suspicious_activity: boolean
}

export interface ChatMessage {
  id: string
  submission_id: string
  session_id: string
  sender: string
  message: string
  timestamp: string
  is_probing_question: boolean
}

export interface AIAnalysis {
  id: string
  submission_id: string
  score: number
  summary: string
  strengths: string[]
  improvements: string[]
  generated_at: string
}

// Input types for creation/updates

export interface CreateCompanyInput {
  clerk_user_id: string
  company_name: string
}

export interface CreateInterviewInput {
  company_id: string
  job_title: string
  job_description?: string
  instructions?: string
  unique_link: string
  time_limit_minutes?: number
  starter_code?: string
}

export interface CreateSubmissionInput {
  interview_id: string
  candidate_name: string
  candidate_email: string
  code?: string
  language?: string
  started_at?: string
}

export interface AddChatMessageInput {
  submission_id: string
  session_id: string
  sender: string
  message: string
  is_probing_question?: boolean
}

export interface CreateAIAnalysisInput {
  submission_id: string
  score: number
  summary: string
  strengths: string[]
  improvements: string[]
}

// Credit management types
export interface CreditCheckResult {
  allowed: boolean
  creditsRemaining: number
  reason?: string
}

