import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

interface Session {
  sessionId: string
  createdAt: string
  status: 'active' | 'completed'
  codingPlatformUrl?: string
}

export default function CandidateInterview() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Fetch session details
  useEffect(() => {
    if (!sessionId) return

    const fetchSession = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/sessions/${sessionId}`)
        if (response.ok) {
          const sessionData = await response.json()
          setSession(sessionData)
        }
      } catch (error) {
        console.error('Failed to fetch session:', error)
      }
    }

    fetchSession()
  }, [sessionId])

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date().toISOString()
    }
    setMessages([...messages, userMessage])
    setInput('')
    setLoading(true)

    try {
      const response = await fetch(`${BACKEND_URL}/api/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          message: input,
          codeSnapshot: code // Add this
        })
      })
      const data = await response.json()
      
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date().toISOString()
      }
      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Failed to send message:', error)
    } finally {
      setLoading(false)
    }
  }


  return (
    <div className="min-h-screen bg-gray-100 relative">
      {/* AI Chat Overlay - positioned fixed in bottom right */}
      <div className="fixed bottom-4 right-4 z-50 w-80 h-96 bg-white border-2 border-indigo-500 rounded-lg shadow-lg flex flex-col">
        <div className="bg-indigo-500 text-white p-3 font-semibold rounded-t-lg">
          AI Interview Assistant
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {messages.length === 0 && (
            <div className="text-gray-500 text-center text-sm">
              Type a message to start the interview!
            </div>
          )}
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`text-sm ${
                msg.role === 'user'
                  ? 'text-right'
                  : 'text-left'
              }`}
            >
              <div
                className={`inline-block max-w-64 p-2 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-indigo-500 text-white'
                    : 'bg-gray-200 text-gray-800'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="text-gray-500 text-sm">AI is thinking...</div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="p-3 border-t flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Ask about your code..."
            className="flex-1 border border-gray-300 rounded px-3 py-1 text-sm"
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-400 text-white px-3 py-1 rounded text-sm"
          >
            Send
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="h-screen flex flex-col">
        <header className="bg-white shadow-sm py-4 px-6 z-10">
          <h1 className="text-xl font-semibold text-gray-800">Live Coding Interview</h1>
          <p className="text-sm text-gray-500">Session: {sessionId?.slice(0, 8)}...</p>
        </header>

        {/* Coding Platform Redirect or Fallback */}
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          {session?.codingPlatformUrl ? (
            <div className="text-center max-w-md">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">Your Coding Interview</h2>
              <p className="text-gray-600 mb-6">
                Click below to open your coding environment with the AI assistant overlaid.
              </p>
              <button
                onClick={() => window.location.href = session.codingPlatformUrl!}
                className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-8 py-4 rounded-lg text-lg transition duration-200"
              >
                Start Coding Interview →
              </button>
              <p className="text-sm text-gray-500 mt-4">
                The AI chat assistant will appear on the coding platform.
              </p>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">Welcome to your interview!</h2>
                <p className="text-gray-600 mb-6">Your coding environment will appear here.</p>
                <div className="max-w-2xl mx-auto">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Practice Code Area
                  </label>
                  <textarea
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="You can write code here while waiting..."
                    rows={12}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}