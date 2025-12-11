import express from 'express'
import cors from 'cors'
import { v4 as uuidv4 } from 'uuid'
import OpenAI from 'openai'
import { clerkClient } from '@clerk/clerk-sdk-node'
import type { Session, SendMessageRequest, EvaluateRequest, EvaluationResult } from './types.js'
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
const PORT = process.env.PORT || 3000

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
      unique_link: uniqueLink
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

    // Create submission
    const submission = await createSubmission({
      interview_id: interview.id,
      candidate_name: candidateName,
      candidate_email: candidateEmail
    })

    res.json({ submissionId: submission.id })
  } catch (error) {
    console.error('Error in create submission:', error)
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
    if (language !== 'python' && language !== 'javascript') {
      return res.status(400).json({
        error: 'Invalid language. Must be "python" or "javascript"',
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
Be professional, encouraging, and ask thoughtful follow-up questions. 
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

    if (!submission) {
      // Try to get interview by ID, then get latest submission
      let interview = await getInterviewById(sessionId)
      if (!interview) {
        interview = await getInterviewByLink(sessionId)
      }
      if (interview) {
        const submissions = await getSubmissionsByInterview(interview.id)
        if (submissions.length > 0) {
          submission = submissions[0] // Get most recent submission
        }
      }
    }

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' })
    }

    // Get all chat messages for this submission
    const chatMessages = await getChatMessages(submission.id)
    const transcript = chatMessages
      .map(m => `${m.sender.toUpperCase()}: ${m.message}`)
      .join('\n\n')

    const evaluationPrompt = `Analyze this coding interview transcript and provide a JSON evaluation with:
- score (0-100)
- summary (brief overview)
- strengths (array of strings)
- improvements (array of strings)

Transcript:
${transcript}

Respond with valid JSON only.`

    console.log('Calling OpenAI for evaluation...')
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: evaluationPrompt }],
      response_format: { type: 'json_object' }
    })

    const resultText = completion.choices[0]?.message?.content || '{}'
    const evaluation = JSON.parse(resultText)

    // Save analysis to database
    try {
      await createAIAnalysis({
        submission_id: submission.id,
        score: evaluation.score || 0,
        summary: evaluation.summary || 'No summary available',
        strengths: evaluation.strengths || [],
        improvements: evaluation.improvements || []
      })
    } catch (analysisError) {
      // If analysis already exists, log but continue
      console.warn('Analysis already exists for this submission:', analysisError)
    }

    // Update submission status to completed
    await updateSubmissionStatus(submission.id, 'completed')

    const result: EvaluationResult = {
      sessionId,
      score: evaluation.score || 0,
      summary: evaluation.summary || 'No summary available',
      strengths: evaluation.strengths || [],
      improvements: evaluation.improvements || []
    }

    res.json(result)
  } catch (error) {
    console.error('Error in evaluate:', error)
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
        const hasCompletedSubmission = submissions.some(s => s.status === 'completed')
        // If all submissions are completed or no submissions exist, mark as completed
        // Otherwise active
        const status = (submissions.length > 0 && submissions.every(s => s.status === 'completed')) 
          ? 'completed' 
          : 'active'

        return {
          id: interview.id,
          jobTitle: interview.job_title,
          createdAt: interview.created_at,
          status,
          uniqueLink: interview.unique_link
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
      analysis
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
    const validStatuses = ['pending', 'completed', 'reviewed', 'accepted', 'rejected', 'scheduled']
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
  app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`)
  })
}).catch(() => {
  // Error already logged and process.exit called in test
})
