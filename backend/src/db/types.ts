// Database entity types matching the schema

export interface Company {
  id: string
  clerk_user_id: string
  company_name: string
  created_at: string
}

export interface Interview {
  id: string
  company_id: string
  job_title: string
  job_description: string | null
  instructions: string | null
  unique_link: string
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
  status: string
}

export interface ChatMessage {
  id: string
  submission_id: string
  session_id: string
  sender: string
  message: string
  timestamp: string
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
}

export interface CreateSubmissionInput {
  interview_id: string
  candidate_name: string
  candidate_email: string
  code?: string
  language?: string
}

export interface AddChatMessageInput {
  submission_id: string
  session_id: string
  sender: string
  message: string
}

export interface CreateAIAnalysisInput {
  submission_id: string
  score: number
  summary: string
  strengths: string[]
  improvements: string[]
}

