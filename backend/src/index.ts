import express from 'express'
import cors from 'cors'
import { v4 as uuidv4 } from 'uuid'
import OpenAI from 'openai'
import { clerkClient } from '@clerk/clerk-sdk-node'
import type { Session, SendMessageRequest, EvaluateRequest, EvaluationResult } from './types.js'

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const sessions = new Map<string, Session>()

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

app.post('/api/generate-session', requireAuth, (req, res) => {
  const sessionId = uuidv4()
  const session: Session = {
    sessionId,
    messages: [],
    createdAt: new Date().toISOString(),
    status: 'active'
  }
  sessions.set(sessionId, session)
  
  console.log(`Created new session: ${sessionId}`)
  res.json({ sessionId })
})

app.post('/api/send-message', async (req, res) => {
  try {
    const { sessionId, message, codeSnapshot }: SendMessageRequest = req.body

    if (!sessionId || !message) {
      return res.status(400).json({ error: 'Missing sessionId or message' })
    }

    let session = sessions.get(sessionId)
    if (!session) {
      session = {
        sessionId,
        messages: [],
        createdAt: new Date().toISOString(),
        status: 'active'
      }
      sessions.set(sessionId, session)
    }

    session.messages.push({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    })

    const systemPrompt = `You are an AI technical interviewer conducting a live coding interview. 
Be professional, encouraging, and ask thoughtful follow-up questions. 
Provide hints when needed but don't give away solutions.
${codeSnapshot ? `Current code:\n${codeSnapshot}` : ''}`

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...session.messages.map(m => ({ 
        role: m.role as 'user' | 'assistant' | 'system', 
        content: m.content 
      }))
    ]

    const completion = await openai.chat.completions.create({
      model: 'gpt-5',
      messages,
      max_completion_tokens: 500
    })

    const assistantMessage = completion.choices[0]?.message?.content || 'I apologize, I could not generate a response.'

    session.messages.push({
      role: 'assistant',
      content: assistantMessage,
      timestamp: new Date().toISOString()
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

    const session = sessions.get(sessionId)
    if (!session) {
      return res.status(404).json({ error: 'Session not found' })
    }

    const transcript = session.messages
      .map(m => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n\n')

    const evaluationPrompt = `Analyze this coding interview transcript and provide a JSON evaluation with:
- score (0-100)
- summary (brief overview)
- strengths (array of strings)
- improvements (array of strings)

Transcript:
${transcript}

Respond with valid JSON only.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-5',
      messages: [{ role: 'user', content: evaluationPrompt }],
      response_format: { type: 'json_object' }
    })

    const resultText = completion.choices[0]?.message?.content || '{}'
    const evaluation = JSON.parse(resultText)

    const result: EvaluationResult = {
      sessionId,
      score: evaluation.score || 0,
      summary: evaluation.summary || 'No summary available',
      strengths: evaluation.strengths || [],
      improvements: evaluation.improvements || []
    }

    session.status = 'completed'

    res.json(result)
  } catch (error) {
    console.error('Error in evaluate:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.get('/api/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params
  const session = sessions.get(sessionId)
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' })
  }
  
  res.json(session)
})

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`)
})
