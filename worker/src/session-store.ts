const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000'

interface SessionData {
  sessionId: string
  codingPlatformUrl?: string
  createdAt: string
  status: 'active' | 'completed'
}

const sessionCache = new Map<string, { data: SessionData; expires: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function getSession(sessionId: string): Promise<SessionData | null> {
  // Check cache first
  const cached = sessionCache.get(sessionId)
  if (cached && cached.expires > Date.now()) {
    return cached.data
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/sessions/${sessionId}`)
    if (!response.ok) {
      return null
    }

    const data: SessionData = await response.json()
    
    // Cache the session
    sessionCache.set(sessionId, {
      data,
      expires: Date.now() + CACHE_TTL
    })

    return data
  } catch (error) {
    console.error(`Error fetching session ${sessionId}:`, error)
    return null
  }
}

export function clearSessionCache(sessionId: string) {
  sessionCache.delete(sessionId)
}

