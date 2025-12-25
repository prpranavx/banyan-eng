import { getDb } from '../db.js'
import type {
  Company,
  Interview,
  Submission,
  ChatMessage,
  AIAnalysis,
  CreateCompanyInput,
  CreateInterviewInput,
  CreateSubmissionInput,
  AddChatMessageInput,
  CreateAIAnalysisInput
} from './types.js'

// Companies Functions

export async function getOrCreateCompany(
  clerkUserId: string,
  companyName?: string
): Promise<Company> {
  const db = getDb()
  
  try {
    // Try to get existing company
    const existing = await db.query<Company>(
      'SELECT * FROM companies WHERE clerk_user_id = $1',
      [clerkUserId]
    )

    if (existing.rows.length > 0) {
      return existing.rows[0]
    }

    // Company doesn't exist, need to create it
    if (!companyName) {
      throw new Error('companyName is required when creating a new company')
    }

    const result = await db.query<Company>(
      `INSERT INTO companies (clerk_user_id, company_name)
       VALUES ($1, $2)
       RETURNING *`,
      [clerkUserId, companyName]
    )

    if (result.rows.length === 0) {
      throw new Error('Failed to create company')
    }

    return result.rows[0]
  } catch (error) {
    console.error('Error in getOrCreateCompany:', error)
    throw error
  }
}

export async function getCompanyByClerkId(clerkUserId: string): Promise<Company | null> {
  const db = getDb()

  try {
    const result = await db.query<Company>(
      'SELECT * FROM companies WHERE clerk_user_id = $1',
      [clerkUserId]
    )

    return result.rows.length > 0 ? result.rows[0] : null
  } catch (error) {
    console.error('Error in getCompanyByClerkId:', error)
    throw error
  }
}

// Interviews Functions

export async function createInterview(input: CreateInterviewInput): Promise<Interview> {
  const db = getDb()

  try {
    const result = await db.query<Interview>(
      `INSERT INTO interviews (company_id, job_title, job_description, instructions, unique_link, time_limit_minutes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        input.company_id,
        input.job_title,
        input.job_description || null,
        input.instructions || null,
        input.unique_link,
        input.time_limit_minutes || 60
      ]
    )

    if (result.rows.length === 0) {
      throw new Error('Failed to create interview')
    }

    return result.rows[0]
  } catch (error) {
    console.error('Error in createInterview:', error)
    throw error
  }
}

export async function getInterviewById(id: string): Promise<Interview | null> {
  const db = getDb()

  try {
    const result = await db.query<Interview>(
      'SELECT * FROM interviews WHERE id = $1',
      [id]
    )

    return result.rows.length > 0 ? result.rows[0] : null
  } catch (error) {
    console.error('Error in getInterviewById:', error)
    throw error
  }
}

export async function getInterviewByLink(uniqueLink: string): Promise<Interview | null> {
  const db = getDb()

  try {
    const result = await db.query<Interview>(
      'SELECT * FROM interviews WHERE unique_link = $1',
      [uniqueLink]
    )

    return result.rows.length > 0 ? result.rows[0] : null
  } catch (error) {
    console.error('Error in getInterviewByLink:', error)
    throw error
  }
}

export async function getInterviewsByCompany(companyId: string): Promise<Interview[]> {
  const db = getDb()

  try {
    const result = await db.query<Interview>(
      'SELECT * FROM interviews WHERE company_id = $1 ORDER BY created_at DESC',
      [companyId]
    )

    return result.rows
  } catch (error) {
    console.error('Error in getInterviewsByCompany:', error)
    throw error
  }
}

// Submissions Functions

export async function createSubmission(input: CreateSubmissionInput): Promise<Submission> {
  const db = getDb()

  try {
    const result = await db.query<Submission>(
      `INSERT INTO submissions (interview_id, candidate_name, candidate_email, code, language, started_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        input.interview_id,
        input.candidate_name,
        input.candidate_email,
        input.code || null,
        input.language || null,
        input.started_at || new Date().toISOString()
      ]
    )

    if (result.rows.length === 0) {
      throw new Error('Failed to create submission')
    }

    return result.rows[0]
  } catch (error) {
    console.error('Error in createSubmission:', error)
    throw error
  }
}

export async function getSubmissionById(id: string): Promise<Submission | null> {
  const db = getDb()

  try {
    const result = await db.query<Submission>(
      'SELECT * FROM submissions WHERE id = $1',
      [id]
    )

    return result.rows.length > 0 ? result.rows[0] : null
  } catch (error) {
    console.error('Error in getSubmissionById:', error)
    throw error
  }
}

export async function getSubmissionByEmailAndInterview(
  email: string,
  interviewId: string
): Promise<Submission | null> {
  const db = getDb()

  try {
    const result = await db.query<Submission>(
      'SELECT * FROM submissions WHERE candidate_email = $1 AND interview_id = $2 ORDER BY started_at DESC LIMIT 1',
      [email, interviewId]
    )

    return result.rows.length > 0 ? result.rows[0] : null
  } catch (error) {
    console.error('Error in getSubmissionByEmailAndInterview:', error)
    throw error
  }
}

export async function getSubmissionsByInterview(interviewId: string): Promise<Submission[]> {
  const db = getDb()

  try {
    const result = await db.query<Submission>(
      'SELECT * FROM submissions WHERE interview_id = $1 ORDER BY submitted_at DESC',
      [interviewId]
    )

    return result.rows
  } catch (error) {
    console.error('Error in getSubmissionsByInterview:', error)
    throw error
  }
}

export async function updateSubmissionCode(
  id: string,
  code: string,
  language?: string
): Promise<Submission> {
  const db = getDb()

  try {
    const result = await db.query<Submission>(
      `UPDATE submissions
       SET code = $1, language = $2
       WHERE id = $3
       RETURNING *`,
      [code, language || null, id]
    )

    if (result.rows.length === 0) {
      throw new Error(`Submission with id ${id} not found`)
    }

    return result.rows[0]
  } catch (error) {
    console.error('Error in updateSubmissionCode:', error)
    throw error
  }
}

export async function updateSubmissionStatus(id: string, status: string): Promise<Submission> {
  const db = getDb()

  try {
    // If marking as completed, also set submitted_at
    const query = status === 'completed'
      ? `UPDATE submissions
         SET status = $1, submitted_at = NOW()
         WHERE id = $2
         RETURNING *`
      : `UPDATE submissions
         SET status = $1
         WHERE id = $2
         RETURNING *`

    const result = await db.query<Submission>(
      query,
      [status, id]
    )

    if (result.rows.length === 0) {
      throw new Error(`Submission with id ${id} not found`)
    }

    return result.rows[0]
  } catch (error) {
    console.error('Error in updateSubmissionStatus:', error)
    throw error
  }
}

// Chat Functions

export async function addChatMessage(input: AddChatMessageInput): Promise<ChatMessage> {
  const db = getDb()

  try {
    const result = await db.query<ChatMessage>(
      `INSERT INTO chat_messages (submission_id, session_id, sender, message, is_probing_question)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [input.submission_id, input.session_id, input.sender, input.message, input.is_probing_question || false]
    )

    if (result.rows.length === 0) {
      throw new Error('Failed to create chat message')
    }

    return result.rows[0]
  } catch (error) {
    console.error('Error in addChatMessage:', error)
    throw error
  }
}

export async function getChatMessages(submissionId: string): Promise<ChatMessage[]> {
  const db = getDb()

  try {
    const result = await db.query<ChatMessage>(
      'SELECT * FROM chat_messages WHERE submission_id = $1 ORDER BY timestamp ASC',
      [submissionId]
    )

    return result.rows
  } catch (error) {
    console.error('Error in getChatMessages:', error)
    throw error
  }
}

// AI Analysis Functions

export async function createAIAnalysis(input: CreateAIAnalysisInput): Promise<AIAnalysis> {
  const db = getDb()

  try {
    // Explicitly stringify arrays to ensure proper JSON format for PostgreSQL JSONB
    const strengthsJson = JSON.stringify(input.strengths || [])
    const improvementsJson = JSON.stringify(input.improvements || [])
    
    const result = await db.query<{
      id: string
      submission_id: string
      score: number
      summary: string
      strengths: string[] | unknown
      improvements: string[] | unknown
      generated_at: string
    }>(
      `INSERT INTO ai_analysis (submission_id, score, summary, strengths, improvements)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
       RETURNING *`,
      [
        input.submission_id,
        input.score,
        input.summary,
        strengthsJson,
        improvementsJson
      ]
    )

    if (result.rows.length === 0) {
      throw new Error('Failed to create AI analysis')
    }

    const row = result.rows[0]
    // pg library automatically converts JSONB back to JavaScript arrays
    return {
      id: row.id,
      submission_id: row.submission_id,
      score: row.score,
      summary: row.summary,
      strengths: Array.isArray(row.strengths) ? row.strengths : [],
      improvements: Array.isArray(row.improvements) ? row.improvements : [],
      generated_at: row.generated_at
    }
  } catch (error) {
    console.error('Error in createAIAnalysis:', error)
    // Check if it's a unique constraint violation
    if (error instanceof Error && error.message.includes('unique')) {
      throw new Error(`Analysis already exists for submission ${input.submission_id}`)
    }
    throw error
  }
}

export async function getAIAnalysisBySubmission(submissionId: string): Promise<AIAnalysis | null> {
  const db = getDb()

  try {
    const result = await db.query<{
      id: string
      submission_id: string
      score: number
      summary: string
      strengths: string[]
      improvements: string[]
      generated_at: string
    }>(
      'SELECT * FROM ai_analysis WHERE submission_id = $1',
      [submissionId]
    )

    if (result.rows.length === 0) {
      return null
    }

    const row = result.rows[0]
    // Convert JSONB arrays back to TypeScript arrays
    return {
      id: row.id,
      submission_id: row.submission_id,
      score: row.score,
      summary: row.summary,
      strengths: Array.isArray(row.strengths) ? row.strengths : [],
      improvements: Array.isArray(row.improvements) ? row.improvements : [],
      generated_at: row.generated_at
    }
  } catch (error) {
    console.error('Error in getAIAnalysisBySubmission:', error)
    throw error
  }
}

