import express from 'express'
import cors from 'cors'
import { v4 as uuidv4 } from 'uuid'
import OpenAI from 'openai'
import { clerkClient } from '@clerk/clerk-sdk-node'
import type { Session, SendMessageRequest, EvaluateRequest, EvaluationResult } from './types.js'
import type { Interview, Submission } from './db/types.js'
import { getDb } from './db.js'
import {
  getOrCreateCompany,
  getCompanyByClerkId,
  createInterview,
  getInterviewById,
  getInterviewByLink,
  getInterviewsByCompany,
  createSubmission,
  getSubmissionById,
  getSubmissionByEmailAndInterview,
  getSubmissionsByInterview,
  updateSubmissionCode,
  updateSubmissionStatus,
  addChatMessage,
  getChatMessages,
  createAIAnalysis,
  getAIAnalysisBySubmission
} from './db/queries.js'
import { executeCode, type CodeExecutionRequest } from './code-execution/modal.js'

const app = express()
const PORT = parseInt(process.env.PORT || '3000', 10)

// Allow CORS from any origin (injected scripts from proxy will call this)
app.use(cors({
  origin: '*',
  credentials: false
}))
app.use(express.json())

// Trust proxy for accurate IP addresses
app.set('trust proxy', true)

// Rate limiter for code execution (10 requests per minute per IP)
interface RateLimitEntry {
  count: number
  resetAt: number
}
const rateLimiter = new Map<string, RateLimitEntry>()

function getClientIP(req: express.Request): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.ip ||
    req.socket.remoteAddress ||
    'unknown'
  )
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const limit = rateLimiter.get(ip)

  if (!limit || now > limit.resetAt) {
    rateLimiter.set(ip, { count: 1, resetAt: now + 60000 }) // 60 seconds
    return true
  }

  if (limit.count >= 10) {
    return false
  }

  limit.count++
  return true
}

// Cleanup old rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [ip, limit] of rateLimiter.entries()) {
    if (now > limit.resetAt) {
      rateLimiter.delete(ip)
    }
  }
}, 5 * 60 * 1000)

// Timeout helper function
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  const timeoutPromise = new Promise<T>((_, reject) => {
    setTimeout(() => reject(new Error('Execution timeout')), timeoutMs)
  })
  return Promise.race([promise, timeoutPromise])
}

// Validate required environment variables
function validateEnvironmentVariables() {
  const required = [
    { key: 'DATABASE_URL', description: 'PostgreSQL database connection string' },
    { key: 'OPENAI_API_KEY', description: 'OpenAI API key for AI features' },
    { key: 'CLERK_SECRET_KEY', description: 'Clerk secret key for authentication' }
  ]

  const missing: string[] = []
  const warnings: string[] = []

  for (const { key, description } of required) {
    if (!process.env[key]) {
      missing.push(`${key} (${description})`)
    }
  }

  // Check optional variables
  if (!process.env.PORT) {
    warnings.push('PORT not set, defaulting to 3000')
  }
  if (!process.env.FRONTEND_URL) {
    warnings.push('FRONTEND_URL not set, candidate links may not work correctly')
  }

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:')
    missing.forEach(v => console.error(`   - ${v}`))
    console.error('\nPlease set these in your .env file. See .env.example for reference.')
    process.exit(1)
  }

  if (warnings.length > 0) {
    console.warn('⚠️  Environment variable warnings:')
    warnings.forEach(w => console.warn(`   - ${w}`))
  }
}

// Validate environment variables before proceeding
validateEnvironmentVariables()

console.log('Initializing OpenAI with key:', process.env.OPENAI_API_KEY ? 'present' : 'missing')
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// Test database connection on startup
const dbTestPromise = (async () => {
  try {
    const db = getDb()
    await db.query('SELECT NOW()')
    console.log('✅ Database connection: OK')
  } catch (error) {
    console.error('❌ Database connection: FAILED')
    console.error('Error:', error)
    console.error('Make sure DATABASE_URL is set correctly in your .env file')
    process.exit(1)
  }
})()

// Helper function to get or create submission for an interview
async function getOrCreateSubmissionForInterview(
  interviewId: string,
  candidateName: string = 'Anonymous',
  candidateEmail: string = 'anonymous@example.com'
) {
  // Check if submission already exists for this interview
  const existingSubmissions = await getSubmissionsByInterview(interviewId)
  if (existingSubmissions.length > 0) {
    // Return the most recent submission (first one since ordered by DESC)
    return existingSubmissions[0]
  }

  // Create new submission
  return await createSubmission({
    interview_id: interviewId,
    candidate_name: candidateName,
    candidate_email: candidateEmail
  })
}

// Helper function to build evaluation prompt from submission and transcript
function buildEvaluationPrompt(submission: Submission, transcript: string): string {
  if (transcript.trim().length < 50 && submission.code) {
    return `Analyze this coding interview submission and provide a JSON evaluation with:
- score (0-100)
- summary (brief overview)
- strengths (array of strings)
- improvements (array of strings)

Candidate Code:
${submission.code}

Language: ${submission.language || 'Not specified'}

Transcript:
${transcript || 'No conversation yet'}

Respond with valid JSON only.`
  } else {
    return `Analyze this coding interview transcript and provide a JSON evaluation with:
- score (0-100)
- summary (brief overview)
- strengths (array of strings)
- improvements (array of strings)

Transcript:
${transcript || 'No conversation yet'}

${submission.code ? `Candidate Code:\n${submission.code}\n\nLanguage: ${submission.language || 'Not specified'}` : ''}

Respond with valid JSON only.`
  }
}

// Helper function to check if candidate meaningfully participated
function shouldEvaluate(chatMessages: Array<{sender: string, message: string}>, submission: Submission): boolean {
  // Check if candidate has sent at least one message
  const hasCandidateMessages = chatMessages.some(m => m.sender === 'user')
  
  // Check if there's meaningful code (more than just whitespace/single character)
  const hasMeaningfulCode = submission.code !== null && submission.code.trim().length > 10
  
  // Only evaluate if candidate participated OR provided meaningful code
  return hasCandidateMessages || hasMeaningfulCode
}

// Helper function to create a zero-score evaluation for non-participating candidates
async function createZeroScoreEvaluation(submission: Submission, reason: string): Promise<void> {
  await createAIAnalysis({
    submission_id: submission.id,
    score: 0,
    summary: `No meaningful participation: ${reason}. Candidate submitted without engaging in the interview or providing substantial code.`,
    strengths: [],
    improvements: [
      'Candidate did not respond to interview questions',
      'No meaningful code was submitted',
      'No demonstration of problem-solving approach'
    ]
  })
}

const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized - Missing token' })
    }

    const token = authHeader.substring(7)
    const decoded = await clerkClient.verifyToken(token)
    
    if (!decoded) {
      return res.status(401).json({ error: 'Unauthorized - Invalid token' })
    }

    (req as any).auth = decoded
    next()
  } catch (error) {
    console.error('Auth error:', error)
    return res.status(401).json({ error: 'Unauthorized' })
  }
}

app.post('/api/generate-session', requireAuth, async (req, res) => {
  try {
    const auth = (req as any).auth
    const clerkUserId = auth.userId || auth.sub || auth.id

    if (!clerkUserId) {
      return res.status(401).json({ error: 'Unable to identify user' })
    }

    // Get or create company
    // Ensure we always have a company name (fallback chain with validation)
    let companyName = req.body.companyName
    if (!companyName || companyName.trim() === '') {
      companyName = auth.emailAddresses?.[0]?.emailAddress
    }
    if (!companyName || companyName.trim() === '') {
      companyName = 'My Company'
    }
    
    // Final validation - should never be empty at this point
    if (!companyName || companyName.trim() === '') {
      console.error('Failed to determine company name for user:', clerkUserId)
      return res.status(400).json({ error: 'Unable to determine company name. Please provide a company name.' })
    }
    
    const company = await getOrCreateCompany(clerkUserId, companyName.trim())

    // Generate unique link for the interview
    const uniqueLink = uuidv4()
    const jobTitle = req.body.jobTitle || 'Coding Interview'

    // Create interview
    const interview = await createInterview({
      company_id: company.id,
      job_title: jobTitle,
      job_description: req.body.jobDescription || null,
      instructions: req.body.instructions || null,
      unique_link: uniqueLink,
      time_limit_minutes: req.body.timeLimitMinutes || 60
    })

    console.log(`Created new interview: ${interview.id}`)

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5000'
    const candidateLink = `${frontendUrl}/interview/${interview.unique_link}`
    res.json({ sessionId: interview.id, candidateLink })
  } catch (error) {
    console.error('Error in generate-session:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.post('/api/submissions', async (req, res) => {
  try {
    const { interviewId, candidateName, candidateEmail } = req.body

    if (!interviewId || !candidateName || !candidateEmail) {
      return res.status(400).json({ error: 'Missing required fields: interviewId, candidateName, candidateEmail' })
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(candidateEmail)) {
      return res.status(400).json({ error: 'Invalid email format' })
    }

    // Get interview by unique_link (interviewId is actually uniqueLink)
    const interview = await getInterviewByLink(interviewId)
    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' })
    }

    // Check if submission already exists for this email and interview
    const existingSubmission = await getSubmissionByEmailAndInterview(
      candidateEmail,
      interview.id
    )

    if (existingSubmission) {
      // Resume existing session
      return res.json({ 
        submissionId: existingSubmission.id,
        resumed: true
      })
    }

    // Create new submission
    const submission = await createSubmission({
      interview_id: interview.id,
      candidate_name: candidateName,
      candidate_email: candidateEmail,
      started_at: new Date().toISOString()
    })

    res.json({ submissionId: submission.id })
  } catch (error) {
    console.error('Error in create submission:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Public endpoint to get interview details by unique link (for candidates)
app.get('/api/interviews/link/:uniqueLink', async (req, res) => {
  try {
    const { uniqueLink } = req.params
    const interview = await getInterviewByLink(uniqueLink)
    
    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' })
    }
    
    // Return only public fields (no company_id, job_description, etc.)
    res.json({
      id: interview.id,
      job_title: interview.job_title,
      instructions: interview.instructions,
      unique_link: interview.unique_link,
      time_limit_minutes: interview.time_limit_minutes
    })
  } catch (error) {
    console.error('Error fetching interview by link:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Public endpoint to get submission details (for candidates to resume)
app.get('/api/submissions/:submissionId', async (req, res) => {
  try {
    const { submissionId } = req.params
    const submission = await getSubmissionById(submissionId)
    
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' })
    }
    
    // Return only public fields
    res.json({
      id: submission.id,
      code: submission.code,
      language: submission.language,
      status: submission.status,
      started_at: submission.started_at
    })
  } catch (error) {
    console.error('Error in get submission:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.patch('/api/submissions/:submissionId', async (req, res) => {
  try {
    const { submissionId } = req.params
    const { code, language } = req.body

    if (code === undefined) {
      return res.status(400).json({ error: 'Missing required field: code' })
    }

    // Verify submission exists
    const existingSubmission = await getSubmissionById(submissionId)
    if (!existingSubmission) {
      return res.status(404).json({ error: 'Submission not found' })
    }

    // Update submission code and language
    await updateSubmissionCode(submissionId, code || '', language || null)

    res.json({ success: true })
  } catch (error) {
    console.error('Error in update submission:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Public endpoint for candidates to submit their interview
app.post('/api/submissions/:submissionId/submit', async (req, res) => {
  try {
    const { submissionId } = req.params

    // Verify submission exists
    const submission = await getSubmissionById(submissionId)
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' })
    }

    // Check if already submitted
    if (submission.status === 'completed') {
      return res.status(400).json({ error: 'Interview has already been submitted' })
    }

    // Update submission status to completed
    await updateSubmissionStatus(submissionId, 'completed')

    // Check if analysis already exists
    const existingAnalysis = await getAIAnalysisBySubmission(submission.id)
    if (existingAnalysis) {
      return res.json({ 
        success: true,
        message: 'Interview submitted successfully.'
      })
    }

    // Get chat messages synchronously to check participation
    const chatMessages = await getChatMessages(submission.id)
    
    // Check if candidate meaningfully participated
    if (!shouldEvaluate(chatMessages, submission)) {
      // Create zero-score evaluation synchronously
      const reason = !chatMessages.some(m => m.sender === 'user') 
        ? 'No responses to interview questions'
        : 'No meaningful code submitted'
      
      await createZeroScoreEvaluation(submission, reason)
      console.log('Created zero-score evaluation for submission:', submission.id)
      
      return res.json({ 
        success: true,
        message: 'Interview submitted successfully.'
      })
    }

    // Trigger evaluation asynchronously (same logic as /api/evaluate)
    ;(async () => {
      try {
        const transcript = chatMessages
          .map(m => `${m.sender.toUpperCase()}: ${m.message}`)
          .join('\n\n')

        // Build evaluation prompt using shared helper function
        const evaluationPrompt = buildEvaluationPrompt(submission, transcript)

        console.log('Auto-evaluating submission:', submission.id)
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: evaluationPrompt }],
          response_format: { type: 'json_object' }
        })

        const resultText = completion.choices[0]?.message?.content || '{}'
        let evaluation
        try {
          evaluation = JSON.parse(resultText)
        } catch (parseError) {
          console.error('Failed to parse evaluation JSON:', resultText)
          return
        }

        // Validate evaluation has required fields
        if (typeof evaluation.score !== 'number' || evaluation.score < 0 || evaluation.score > 100) {
          console.error('Invalid evaluation score:', evaluation)
          return
        }
        if (!evaluation.summary) {
          evaluation.summary = 'No summary available'
        }
        if (!Array.isArray(evaluation.strengths)) {
          evaluation.strengths = []
        }
        if (!Array.isArray(evaluation.improvements)) {
          evaluation.improvements = []
        }

        // Save analysis to database
        await createAIAnalysis({
          submission_id: submission.id,
          score: evaluation.score,
          summary: evaluation.summary,
          strengths: evaluation.strengths,
          improvements: evaluation.improvements
        })

        console.log('Auto-evaluation completed for submission:', submission.id)
      } catch (error) {
        console.error('Error in auto-evaluation:', error)
      }
    })()

    res.json({ 
      success: true,
      message: 'Interview submitted successfully. Evaluation in progress...'
    })
  } catch (error) {
    console.error('Error in submit interview:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.post('/api/code/execute', async (req, res) => {
  try {
    const { code, language } = req.body

    // Validate request body
    if (code === undefined) {
      return res.status(400).json({
        error: 'Missing required field: code',
        success: false,
        output: ''
      })
    }

    if (language === undefined) {
      return res.status(400).json({
        error: 'Missing required field: language',
        success: false,
        output: ''
      })
    }

    // Validate language
    const validLanguages = ['python', 'javascript', 'c', 'cpp', 'java']
    if (!validLanguages.includes(language)) {
      return res.status(400).json({
        error: `Invalid language. Must be one of: ${validLanguages.join(', ')}`,
        success: false,
        output: ''
      })
    }

    // Validate code is a string
    if (typeof code !== 'string') {
      return res.status(400).json({
        error: 'Code must be a string',
        success: false,
        output: ''
      })
    }

    // Check rate limit
    const clientIP = getClientIP(req)
    if (!checkRateLimit(clientIP)) {
      return res.status(429).json({
        error: 'Rate limit exceeded. Please try again later.',
        success: false,
        output: ''
      })
    }

    // Execute code with 10-second timeout
    try {
      const executionRequest: CodeExecutionRequest = {
        code,
        language
      }

      const result = await withTimeout(
        executeCode(executionRequest),
        10000 // 10 seconds
      )

      res.json(result)
    } catch (error) {
      // Handle timeout or execution errors
      if (error instanceof Error && error.message === 'Execution timeout') {
        return res.json({
          output: '',
          error: 'Execution timeout after 10 seconds',
          success: false
        })
      }

      // Other execution errors
      console.error('Error executing code:', error)
      return res.json({
        output: '',
        error: error instanceof Error ? error.message : 'Code execution failed',
        success: false
      })
    }
  } catch (error) {
    console.error('Error in code execution endpoint:', error)
    res.status(500).json({
      error: 'Internal server error',
      success: false,
      output: ''
    })
  }
})

app.post('/api/send-message', async (req, res) => {
  try {
    console.log('Received send-message request:', { sessionId: req.body.sessionId, messageLength: req.body.message?.length, codeSnapshotLength: req.body.codeSnapshot?.length })
    const { sessionId, message, codeSnapshot }: SendMessageRequest = req.body

    if (!sessionId || !message) {
      return res.status(400).json({ error: 'Missing sessionId or message' })
    }

    // Try to find interview by ID first
    let interview = await getInterviewById(sessionId)
    let submission

    if (interview) {
      // sessionId is an interview ID, get or create submission
      submission = await getOrCreateSubmissionForInterview(interview.id)
    } else {
      // Try to find interview by unique_link
      interview = await getInterviewByLink(sessionId)
      if (interview) {
        submission = await getOrCreateSubmissionForInterview(interview.id)
      } else {
        // Try to find submission by ID
        submission = await getSubmissionById(sessionId)
        if (!submission) {
          return res.status(404).json({ error: 'Session not found' })
        }
      }
    }

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' })
    }

    // Get interview if not already fetched
    if (!interview) {
      interview = await getInterviewById(submission.interview_id)
    }

    // Save user message
    await addChatMessage({
      submission_id: submission.id,
      session_id: sessionId,
      sender: 'user',
      message: message
    })

    // Update submission code if provided
    if (codeSnapshot !== undefined) {
      await updateSubmissionCode(submission.id, codeSnapshot || '', undefined)
    }

    // Get all previous messages for context
    const chatMessages = await getChatMessages(submission.id)
    const previousMessages = chatMessages.map(m => ({
      role: m.sender === 'user' ? 'user' as const : m.sender === 'assistant' ? 'assistant' as const : 'system' as const,
      content: m.message
    }))

    const systemPrompt = `You are an AI technical interviewer conducting a live coding interview.

${interview ? `Job Details:
- Position: ${interview.job_title}
${interview.job_description ? `- Description: ${interview.job_description}` : ''}
${interview.instructions ? `- Instructions: ${interview.instructions}` : ''}

` : ''}Be professional, encouraging, and ask thoughtful follow-up questions. 
Provide hints when needed but don't give away solutions.
${codeSnapshot ? `Current code:\n${codeSnapshot}` : ''}`

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...previousMessages
    ]

    console.log('Calling OpenAI for chat completion...')
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages,
      max_completion_tokens: 500
    })

    const assistantMessage = completion.choices[0]?.message?.content || 'I apologize, I could not generate a response.'

    // Save assistant response
    await addChatMessage({
      submission_id: submission.id,
      session_id: sessionId,
      sender: 'assistant',
      message: assistantMessage
    })

    res.json({ message: assistantMessage })
  } catch (error) {
    console.error('Error in send-message:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.post('/api/evaluate', requireAuth, async (req, res) => {
  try {
    const { sessionId }: EvaluateRequest = req.body

    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId' })
    }

    // Try to get submission by ID first
    let submission = await getSubmissionById(sessionId)
    let interview: Interview | null = null

    if (!submission) {
      // Try to get interview by ID, then get latest submission
      interview = await getInterviewById(sessionId)
      if (!interview) {
        interview = await getInterviewByLink(sessionId)
      }
      if (interview) {
        const submissions = await getSubmissionsByInterview(interview.id)
        if (submissions.length > 0) {
          submission = submissions[0] // Get most recent submission for evaluation
        }
      }
    } else {
      // Get interview from submission
      interview = await getInterviewById(submission.interview_id)
    }

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' })
    }

    // Check if analysis already exists
    const existingAnalysis = await getAIAnalysisBySubmission(submission.id)
    if (existingAnalysis) {
      // Return existing analysis
      await updateSubmissionStatus(submission.id, 'completed')
      const result: EvaluationResult = {
        sessionId,
        score: existingAnalysis.score,
        summary: existingAnalysis.summary,
        strengths: existingAnalysis.strengths,
        improvements: existingAnalysis.improvements
      }
      return res.json(result)
    }

    // IMMEDIATELY mark all submissions as completed to end the interview
    // This prevents candidates from typing further
    if (interview) {
      const allSubmissions = await getSubmissionsByInterview(interview.id)
      await Promise.all(
        allSubmissions.map(sub => updateSubmissionStatus(sub.id, 'completed'))
      )
    } else {
      await updateSubmissionStatus(submission.id, 'completed')
    }

    // Get chat messages synchronously to check participation
    const chatMessages = await getChatMessages(submission.id)
    
    // Check if candidate meaningfully participated
    if (!shouldEvaluate(chatMessages, submission)) {
      // Create zero-score evaluation synchronously
      const reason = !chatMessages.some(m => m.sender === 'user') 
        ? 'No responses to interview questions'
        : 'No meaningful code submitted'
      
      await createZeroScoreEvaluation(submission, reason)
      console.log('Created zero-score evaluation for submission:', submission.id)
      
      // Get the analysis we just created
      const zeroScoreAnalysis = await getAIAnalysisBySubmission(submission.id)
      if (zeroScoreAnalysis) {
        const result: EvaluationResult = {
          sessionId,
          score: zeroScoreAnalysis.score,
          summary: zeroScoreAnalysis.summary,
          strengths: zeroScoreAnalysis.strengths,
          improvements: zeroScoreAnalysis.improvements
        }
        return res.json(result)
      }
    }

    // Return immediately - evaluation will happen in background
    res.json({ 
      sessionId,
      status: 'evaluating',
      message: 'Interview ended. Evaluation in progress...'
    })

    // Start evaluation asynchronously (don't await)
    ;(async () => {
      try {
        const transcript = chatMessages
          .map(m => `${m.sender.toUpperCase()}: ${m.message}`)
          .join('\n\n')

        // Build evaluation prompt using shared helper function
        const evaluationPrompt = buildEvaluationPrompt(submission, transcript)

        console.log('Calling OpenAI for evaluation (async)...')
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: evaluationPrompt }],
          response_format: { type: 'json_object' }
        })

        const resultText = completion.choices[0]?.message?.content || '{}'
        let evaluation
        try {
          evaluation = JSON.parse(resultText)
        } catch (parseError) {
          console.error('Failed to parse evaluation JSON:', resultText)
          return
        }

        // Validate evaluation has required fields
        if (typeof evaluation.score !== 'number' || evaluation.score < 0 || evaluation.score > 100) {
          console.error('Invalid evaluation score:', evaluation)
          return
        }
        if (!evaluation.summary) {
          evaluation.summary = 'No summary available'
        }
        if (!Array.isArray(evaluation.strengths)) {
          evaluation.strengths = []
        }
        if (!Array.isArray(evaluation.improvements)) {
          evaluation.improvements = []
        }

        // Save analysis to database
        await createAIAnalysis({
          submission_id: submission.id,
          score: evaluation.score,
          summary: evaluation.summary,
          strengths: evaluation.strengths,
          improvements: evaluation.improvements
        })

        console.log('Evaluation completed for submission:', submission.id)
      } catch (error) {
        console.error('Error in async evaluation:', error)
      }
    })()
  } catch (error) {
    console.error('Error in evaluate:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Proactive AI probing endpoint
app.post('/api/probe-candidate', async (req, res) => {
  try {
    const { submissionId, code, language } = req.body

    if (!submissionId) {
      return res.status(400).json({ error: 'Missing submissionId' })
    }

    const submission = await getSubmissionById(submissionId)
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' })
    }

    const interview = await getInterviewById(submission.interview_id)
    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' })
    }

    // Get recent chat messages to avoid repeating questions
    const recentMessages = await getChatMessages(submissionId)
    const recentProbes = recentMessages
      .filter(m => m.is_probing_question)
      .slice(-3)
      .map(m => m.message)

    const probingPrompt = `You are an AI technical interviewer analyzing a candidate's code in real-time.

Job Description: ${interview.job_description || 'Not provided'}
Problem/Instructions: ${interview.instructions || 'Not provided'}
Candidate's Current Code: ${code || 'No code written yet'}
Language: ${language || 'Not specified'}

Recent probing questions asked:
${recentProbes.length > 0 ? recentProbes.join('\n') : 'None yet'}

Generate a SINGLE probing question that:
1. Is highly relevant to the job requirements and problem context
2. Tests understanding of a specific technical decision in their code
3. Is specific and actionable (not generic)
4. Encourages explanation (not just yes/no)
5. Is different from recent questions

Examples:
- If they use malloc in embedded systems: "I notice you used malloc(). For a resource-constrained embedded system with 2KB RAM, have you considered the implications of dynamic memory allocation?"
- If they use recursion: "Your solution uses recursion. For a system that needs to handle very large inputs, what are the trade-offs you're considering?"

Return ONLY valid JSON:
{
  "question": "Your specific probing question here",
  "context": "Brief explanation of why this question is relevant"
}`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: probingPrompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7
    })

    const result = JSON.parse(completion.choices[0]?.message?.content || '{}')
    
    if (!result.question) {
      return res.status(500).json({ error: 'Failed to generate probing question' })
    }

    // Save as chat message with probing flag
    await addChatMessage({
      submission_id: submissionId,
      session_id: submission.interview_id,
      sender: 'assistant',
      message: result.question,
      is_probing_question: true
    })

    res.json({
      question: result.question,
      context: result.context
    })
  } catch (error) {
    console.error('Error in probe-candidate:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.get('/api/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params

    // Try to get interview by ID first
    let interview = await getInterviewById(sessionId)

    if (!interview) {
      // Try to get interview by unique_link
      interview = await getInterviewByLink(sessionId)
    }

    if (interview) {
      // Get all submissions for this interview
      const submissions = await getSubmissionsByInterview(interview.id)
      
      // Get all chat messages from all submissions
      let allMessages: Array<{ role: 'user' | 'assistant' | 'system', content: string, timestamp: string }> = []
      for (const submission of submissions) {
        const messages = await getChatMessages(submission.id)
        allMessages.push(...messages.map(m => ({
          role: (m.sender === 'user' ? 'user' : m.sender === 'assistant' ? 'assistant' : 'system') as 'user' | 'assistant' | 'system',
          content: m.message,
          timestamp: m.timestamp
        })))
      }

      // Sort by timestamp
      allMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

      // Determine status based on submissions
      const hasCompletedSubmission = submissions.some(s => s.status === 'completed')
      const status = hasCompletedSubmission ? 'completed' : 'active'

      const session: Session = {
        sessionId: interview.id,
        messages: allMessages,
        createdAt: interview.created_at,
        status
      }

      return res.json(session)
    }

    // Try to get submission by ID
    const submission = await getSubmissionById(sessionId)
    if (submission) {
      const messages = await getChatMessages(submission.id)
      const formattedMessages = messages.map(m => ({
        role: (m.sender === 'user' ? 'user' : m.sender === 'assistant' ? 'assistant' : 'system') as 'user' | 'assistant' | 'system',
        content: m.message,
        timestamp: m.timestamp
      }))

      const session: Session = {
        sessionId: submission.id,
        messages: formattedMessages,
        createdAt: submission.submitted_at,
        status: submission.status === 'completed' ? 'completed' : 'active'
      }

      return res.json(session)
    }

    return res.status(404).json({ error: 'Session not found' })
  } catch (error) {
    console.error('Error in get session:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.get('/api/sessions', requireAuth, async (req, res) => {
  try {
    const auth = (req as any).auth
    const clerkUserId = auth.userId || auth.sub || auth.id

    if (!clerkUserId) {
      return res.status(401).json({ error: 'Unable to identify user' })
    }

    // Get company by Clerk ID
    const company = await getCompanyByClerkId(clerkUserId)
    if (!company) {
      // No company found, return empty array
      return res.json([])
    }

    // Get all interviews for company
    const interviews = await getInterviewsByCompany(company.id)

    // Format interviews with job titles and status
    const sessionsArray = await Promise.all(
      interviews.map(async (interview) => {
        // Get submissions to determine status
        const submissions = await getSubmissionsByInterview(interview.id)
        
        // Check if any submission has an AI analysis (interview was ended/evaluated)
        let hasEvaluation = false
        for (const submission of submissions) {
          try {
            const analysis = await getAIAnalysisBySubmission(submission.id)
            if (analysis) {
              hasEvaluation = true
              break
            }
          } catch {
            // Continue checking other submissions
          }
        }
        
        // If interview was evaluated (ended), mark as completed
        // OR if all submissions are completed
        const status = hasEvaluation || (submissions.length > 0 && submissions.every(s => s.status === 'completed'))
          ? 'completed' 
          : 'active'

        // Find earliest active submission for time calculation
        const activeSubmissions = submissions.filter(s => s.status !== 'completed' && s.started_at)
        let earliestStartTime: string | null = null
        if (activeSubmissions.length > 0) {
          earliestStartTime = activeSubmissions
            .map(s => s.started_at!)
            .sort()[0]
        }
        
        // Calculate remaining time if there's an active candidate
        let timeRemaining: number | null = null
        if (earliestStartTime && interview.time_limit_minutes) {
          const startTime = new Date(earliestStartTime).getTime()
          const now = Date.now()
          const elapsedSeconds = Math.floor((now - startTime) / 1000)
          const totalSeconds = interview.time_limit_minutes * 60
          timeRemaining = Math.max(0, totalSeconds - elapsedSeconds)
        }

        // Get first submission for candidate name and time taken
        const firstSubmission = submissions.length > 0 ? submissions[0] : null
        let candidateName: string | null = null
        let timeTaken: number | null = null

        if (firstSubmission) {
          candidateName = firstSubmission.candidate_name || null
          
          // Calculate time taken if submission has both started_at and submitted_at
          if (firstSubmission.started_at && firstSubmission.submitted_at) {
            const startTime = new Date(firstSubmission.started_at).getTime()
            const submitTime = new Date(firstSubmission.submitted_at).getTime()
            timeTaken = Math.round((submitTime - startTime) / 1000 / 60) // minutes
          }
        }

        return {
          id: interview.id,
          jobTitle: interview.job_title,
          candidateName,
          timeTaken,
          createdAt: interview.created_at,
          status,
          uniqueLink: interview.unique_link,
          timeLimitMinutes: interview.time_limit_minutes,
          timeRemainingSeconds: timeRemaining
        }
      })
    )

    res.json(sessionsArray)
  } catch (error) {
    console.error('Error in get sessions:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.get('/api/interviews/:interviewId/candidates', requireAuth, async (req, res) => {
  try {
    const { interviewId } = req.params

    // Verify interview exists
    const interview = await getInterviewById(interviewId)
    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' })
    }

    // Get all submissions for this interview
    const submissions = await getSubmissionsByInterview(interviewId)

    res.json({ count: submissions.length })
  } catch (error) {
    console.error('Error in get candidate count:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.get('/api/interviews/:interviewId/submissions', requireAuth, async (req, res) => {
  try {
    const auth = (req as any).auth
    const clerkUserId = auth.userId || auth.sub || auth.id
    const { interviewId } = req.params

    if (!clerkUserId) {
      return res.status(401).json({ error: 'Unable to identify user' })
    }

    // Get company by Clerk ID
    const company = await getCompanyByClerkId(clerkUserId)
    if (!company) {
      return res.status(403).json({ error: 'Company not found' })
    }

    // Verify interview exists and belongs to user's company
    const interview = await getInterviewById(interviewId)
    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' })
    }

    if (interview.company_id !== company.id) {
      return res.status(403).json({ error: 'Unauthorized - Interview does not belong to your company' })
    }

    // Get all submissions for this interview
    const submissions = await getSubmissionsByInterview(interviewId)

    res.json(submissions)
  } catch (error) {
    console.error('Error in get submissions:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get interview details with all candidates, stats, and time tracking
app.get('/api/interviews/:interviewId/details', requireAuth, async (req, res) => {
  try {
    const auth = (req as any).auth
    const clerkUserId = auth.userId || auth.sub || auth.id

    if (!clerkUserId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const company = await getCompanyByClerkId(clerkUserId)
    if (!company) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const { interviewId } = req.params
    const interview = await getInterviewById(interviewId)

    if (!interview || interview.company_id !== company.id) {
      return res.status(404).json({ error: 'Interview not found' })
    }

    const submissions = await getSubmissionsByInterview(interviewId)
    const analyses = await Promise.all(
      submissions.map(async (sub) => {
        try {
          return await getAIAnalysisBySubmission(sub.id)
        } catch {
          return null
        }
      })
    )

    const candidatesWithAnalysis = submissions.map((sub, idx) => {
      let timeTaken: number | null = null
      if (sub.started_at && sub.submitted_at) {
        const startTime = new Date(sub.started_at).getTime()
        const submitTime = new Date(sub.submitted_at).getTime()
        timeTaken = Math.round((submitTime - startTime) / 1000 / 60) // minutes
      }

      return {
        ...sub,
        analysis: analyses[idx],
        timeTaken
      }
    })

    const completedSubmissions = submissions.filter(s => s.status === 'completed')
    const analysesWithScores = analyses.filter(a => a !== null)
    const averageScore = analysesWithScores.length > 0
      ? Math.round(analysesWithScores.reduce((sum, a) => sum + (a?.score || 0), 0) / analysesWithScores.length)
      : null

    res.json({
      interview,
      candidates: candidatesWithAnalysis,
      stats: {
        total: submissions.length,
        completed: completedSubmissions.length,
        averageScore
      }
    })
  } catch (error) {
    console.error('Error fetching interview details:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.get('/api/submissions/:submissionId/report', requireAuth, async (req, res) => {
  try {
    const auth = (req as any).auth
    const clerkUserId = auth.userId || auth.sub || auth.id
    const { submissionId } = req.params

    if (!clerkUserId) {
      return res.status(401).json({ error: 'Unable to identify user' })
    }

    // Get company by Clerk ID
    const company = await getCompanyByClerkId(clerkUserId)
    if (!company) {
      return res.status(403).json({ error: 'Company not found' })
    }

    // Get submission
    const submission = await getSubmissionById(submissionId)
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' })
    }

    // Verify interview belongs to user's company
    const interview = await getInterviewById(submission.interview_id)
    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' })
    }

    if (interview.company_id !== company.id) {
      return res.status(403).json({ error: 'Unauthorized - Submission does not belong to your company' })
    }

    // Get chat messages
    const messages = await getChatMessages(submissionId)

    // Get AI analysis (may be null)
    const analysis = await getAIAnalysisBySubmission(submissionId)

    res.json({
      submission,
      messages,
      analysis,
      interview: {
        time_limit_minutes: interview.time_limit_minutes
      }
    })
  } catch (error) {
    console.error('Error in get submission report:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.patch('/api/submissions/:submissionId/status', requireAuth, async (req, res) => {
  try {
    const auth = (req as any).auth
    const clerkUserId = auth.userId || auth.sub || auth.id
    const { submissionId } = req.params
    const { status } = req.body

    if (!clerkUserId) {
      return res.status(401).json({ error: 'Unable to identify user' })
    }

    // Validate status
    const validStatuses = ['pending', 'completed', 'reviewed']
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` })
    }

    // Get company by Clerk ID
    const company = await getCompanyByClerkId(clerkUserId)
    if (!company) {
      return res.status(403).json({ error: 'Company not found' })
    }

    // Get submission
    const submission = await getSubmissionById(submissionId)
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' })
    }

    // Verify interview belongs to user's company
    const interview = await getInterviewById(submission.interview_id)
    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' })
    }

    if (interview.company_id !== company.id) {
      return res.status(403).json({ error: 'Unauthorized - Submission does not belong to your company' })
    }

    // Update status
    const updatedSubmission = await updateSubmissionStatus(submissionId, status)

    res.json(updatedSubmission)
  } catch (error) {
    console.error('Error in update submission status:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

// Start server after database connection test completes
dbTestPromise.then(() => {
  app.listen(PORT, '127.0.0.1', () => {
    console.log(`Backend server running on port ${PORT}`)
  })
}).catch(() => {
  // Error already logged and process.exit called in test
})
