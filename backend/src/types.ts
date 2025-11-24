export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
}

export interface Session {
  sessionId: string
  messages: Message[]
  createdAt: string
  status: 'active' | 'completed'
  codingPlatformUrl?: string
}

export interface CreateSessionRequest {
  codingPlatformUrl?: string
}

export interface SendMessageRequest {
  sessionId: string
  message: string
  codeSnapshot?: string
}

export interface EvaluateRequest {
  sessionId: string
}

export interface EvaluationResult {
  sessionId: string
  score: number
  summary: string
  strengths: string[]
  improvements: string[]
}
