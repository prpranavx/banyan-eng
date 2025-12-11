import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import Editor from '@monaco-editor/react'
import toast from 'react-hot-toast'
import LoadingSpinner from '../components/LoadingSpinner.tsx'
import { handleApiError, parseApiError } from '../utils/apiErrorHandler.ts'

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
}

export default function CandidateInterview() {
  const { uniqueLink } = useParams<{ uniqueLink: string }>()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [code, setCode] = useState('')
  const [language, setLanguage] = useState<string>('python')
  const [loading, setLoading] = useState(false)
  const [loadingSession, setLoadingSession] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [submissionId, setSubmissionId] = useState<string | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [candidateName, setCandidateName] = useState('')
  const [candidateEmail, setCandidateEmail] = useState('')
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [output, setOutput] = useState<string>('')
  const [executionError, setExecutionError] = useState<string | null>(null)
  const [isExecuting, setIsExecuting] = useState(false)
  const [executionSuccess, setExecutionSuccess] = useState<boolean | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Fetch session details (only if we have submissionId)
  useEffect(() => {
    if (!submissionId) return

    const fetchSession = async () => {
      try {
        setLoadingSession(true)
        const response = await fetch(`${BACKEND_URL}/api/sessions/${submissionId}`)
        if (response.ok) {
          const sessionData = await response.json()
          setSession(sessionData)
        } else {
          const errorMessage = await parseApiError(response)
          toast.error(handleApiError(new Error(errorMessage)))
        }
      } catch (error) {
        toast.error(handleApiError(error))
        console.error('Failed to fetch session:', error)
      } finally {
        setLoadingSession(false)
      }
    }

    fetchSession()
  }, [submissionId])

  // Autosave code and language with debouncing
  useEffect(() => {
    // Don't save if no submission ID or editor not shown
    if (!submissionId || !showEditor) return

    // Clear existing timeout
    const timeoutId = setTimeout(async () => {
      setIsSaving(true)
      setSaveError(null)

      try {
        const response = await fetch(`${BACKEND_URL}/api/submissions/${submissionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: code || '',
            language: language
          })
        })

        if (!response.ok) {
          const errorMessage = await parseApiError(response)
          throw new Error(errorMessage)
        }

        setLastSaved(new Date())
        toast.success('Code saved', { duration: 2000 })
        
        // Clear save indicator after a brief delay
        setTimeout(() => {
          setIsSaving(false)
        }, 500)
      } catch (error) {
        const errorMessage = handleApiError(error)
        setSaveError(errorMessage)
        toast.error(errorMessage, { duration: 3000 })
        setIsSaving(false)
        console.error('Failed to autosave code:', error)
      }
    }, 2000) // 2 seconds delay

    // Cleanup function
    return () => clearTimeout(timeoutId)
  }, [code, language, submissionId, showEditor])

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    // Validation
    if (!candidateName.trim()) {
      setFormError('Candidate name is required')
      return
    }

    if (!candidateEmail.trim()) {
      setFormError('Candidate email is required')
      return
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(candidateEmail)) {
      setFormError('Please enter a valid email address')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch(`${BACKEND_URL}/api/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interviewId: uniqueLink,
          candidateName: candidateName.trim(),
          candidateEmail: candidateEmail.trim()
        })
      })

      if (!response.ok) {
        const errorMessage = await parseApiError(response)
        throw new Error(errorMessage)
      }

      const data = await response.json()
      setSubmissionId(data.submissionId)
      setShowEditor(true)
      toast.success('Interview started successfully!')
    } catch (error) {
      const errorMessage = handleApiError(error)
      setFormError(errorMessage)
      toast.error(errorMessage)
      console.error('Failed to create submission:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRunCode = async () => {
    if (!code.trim() || isExecuting) return

    setIsExecuting(true)
    setOutput('')
    setExecutionError(null)
    setExecutionSuccess(null)

    try {
      const response = await fetch(`${BACKEND_URL}/api/code/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          language
        })
      })

      if (!response.ok) {
        const errorMessage = await parseApiError(response)
        throw new Error(errorMessage)
      }

      const data = await response.json()

      if (data.success) {
        setOutput(data.output || '')
        setExecutionError(null)
        setExecutionSuccess(true)
        toast.success('Code executed successfully')
      } else {
        const errorMsg = data.error || 'Execution failed'
        setExecutionError(errorMsg)
        setOutput('')
        setExecutionSuccess(false)
        toast.error(errorMsg)
      }
    } catch (error) {
      const errorMessage = handleApiError(error)
      setExecutionError(errorMessage)
      setOutput('')
      setExecutionSuccess(false)
      toast.error(errorMessage)
      console.error('Failed to execute code:', error)
    } finally {
      setIsExecuting(false)
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || loading || !submissionId) return

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
          sessionId: submissionId,
          message: input,
          codeSnapshot: code,
          language: language
        })
      })
      if (!response.ok) {
        const errorMessage = await parseApiError(response)
        throw new Error(errorMessage)
      }

      const data = await response.json()
      
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date().toISOString()
      }
      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      const errorMessage = handleApiError(error)
      toast.error(errorMessage)
      console.error('Failed to send message:', error)
    } finally {
      setLoading(false)
    }
  }


  return (
    <div className="min-h-screen bg-gray-100 relative">
      {/* AI Chat Overlay - only show when editor is visible */}
      {showEditor && (
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
      )}

      {/* Main Content */}
      <div className="h-screen flex flex-col">
        <header className="bg-white shadow-sm py-4 px-6 z-10">
          <h1 className="text-xl font-semibold text-gray-800">Live Coding Interview</h1>
          {submissionId && (
            <p className="text-sm text-gray-500">Session: {submissionId.slice(0, 8)}...</p>
          )}
        </header>

        {/* Show form or editor based on state */}
        {!showEditor ? (
          /* Candidate Info Form */
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="w-full max-w-md mx-auto p-8 bg-white rounded-lg shadow-md">
              <h2 className="text-2xl font-semibold text-gray-800 mb-6 text-center">
                Welcome to Your Interview
              </h2>
              <p className="text-gray-600 mb-6 text-center">
                Please provide your information to begin the coding interview.
              </p>
              
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div>
                  <label htmlFor="candidateName" className="block text-sm font-medium text-gray-700 mb-1">
                    Candidate Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="candidateName"
                    type="text"
                    value={candidateName}
                    onChange={(e) => setCandidateName(e.target.value)}
                    required
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Enter your full name"
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label htmlFor="candidateEmail" className="block text-sm font-medium text-gray-700 mb-1">
                    Candidate Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="candidateEmail"
                    type="email"
                    value={candidateEmail}
                    onChange={(e) => setCandidateEmail(e.target.value)}
                    required
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="your.email@example.com"
                    disabled={isSubmitting}
                  />
                </div>

                {formError && (
                  <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-md p-3">
                    {formError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-md transition duration-200 flex items-center justify-center gap-2"
                >
                  {isSubmitting && <LoadingSpinner size="sm" />}
                  {isSubmitting ? 'Starting Interview...' : 'Start Interview'}
                </button>
              </form>
            </div>
          </div>
        ) : (
          /* Coding Environment */
          <div className="flex-1 flex flex-col bg-gray-50 p-4">
            <div className="w-full h-full flex flex-col">
              <div className="mb-4 flex items-center gap-4">
                <label className="text-sm font-medium text-gray-700">Language:</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="python">Python</option>
                  <option value="javascript">JavaScript</option>
                </select>
                {isSaving && (
                  <span className="text-sm text-gray-500 flex items-center gap-2">
                    <LoadingSpinner size="sm" />
                    Saving...
                  </span>
                )}
                {!isSaving && lastSaved && !saveError && (
                  <span className="text-sm text-green-600">Saved</span>
                )}
                {saveError && (
                  <span className="text-sm text-red-600" title={saveError}>
                    Save failed
                  </span>
                )}
              </div>
              <div className="flex-1 border border-gray-300 rounded-lg overflow-hidden mb-4">
                <Editor
                  height="100%"
                  language={language}
                  value={code}
                  onChange={(value) => setCode(value || '')}
                  theme="vs-dark"
                  options={{
                    fontSize: 14,
                    minimap: { enabled: false },
                    wordWrap: 'on' as const,
                    automaticLayout: true
                  }}
                />
              </div>
              
              {/* Run Code Button */}
              <button
                onClick={handleRunCode}
                disabled={isExecuting || !code.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-2 px-6 rounded-lg transition duration-200 mb-4 self-start flex items-center gap-2"
              >
                {isExecuting && <LoadingSpinner size="sm" />}
                {isExecuting ? 'Running...' : 'Run Code'}
              </button>

              {/* Output Panel */}
              <div className="border border-gray-300 rounded-lg bg-white">
                <div className="p-4 font-mono text-sm overflow-y-auto max-h-64 min-h-[100px] whitespace-pre-wrap">
                  {isExecuting ? (
                    <div className="text-blue-600 flex items-center gap-2">
                      <LoadingSpinner size="sm" />
                      Running...
                    </div>
                  ) : executionSuccess === true ? (
                    <div className="text-green-600">{output || '(No output)'}</div>
                  ) : executionSuccess === false ? (
                    <div className="text-red-600">{executionError || 'Execution failed'}</div>
                  ) : (
                    <div className="text-gray-400">Output will appear here after running code</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}