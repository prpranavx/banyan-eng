import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import Editor from '@monaco-editor/react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
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

interface Interview {
  id: string
  job_title: string
  job_description: string | null
  instructions: string | null
  unique_link: string
  time_limit_minutes: number | null
  starter_code: string | null
}

export default function CandidateInterview() {
  const { uniqueLink } = useParams<{ uniqueLink: string }>()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [code, setCode] = useState('')
  const [language, setLanguage] = useState<string>('python')
  const [loading, setLoading] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [submissionId, setSubmissionId] = useState<string | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [candidateName, setCandidateName] = useState('')
  const [candidateEmail, setCandidateEmail] = useState('')
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmittingInterview, setIsSubmittingInterview] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const lastActivityTimeRef = useRef<number>(0)
  const editorRef = useRef<any>(null)
  const wasVisibleRef = useRef<boolean>(true)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [output, setOutput] = useState<string>('')
  const [executionError, setExecutionError] = useState<string | null>(null)
  const [isExecuting, setIsExecuting] = useState(false)
  const [executionSuccess, setExecutionSuccess] = useState<boolean | null>(null)
  const [interview, setInterview] = useState<Interview | null>(null)
  const [questionPanelWidth, setQuestionPanelWidth] = useState(400)
  const [isResizing, setIsResizing] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null) // in seconds
  const [interviewTimeLimit, setInterviewTimeLimit] = useState<number | null>(null)
  const [hasWarned5Min, setHasWarned5Min] = useState(false)
  const [hasWarned1Min, setHasWarned1Min] = useState(false)
  const [assistantPosition, setAssistantPosition] = useState({ x: typeof window !== 'undefined' ? window.innerWidth - 340 : 0, y: typeof window !== 'undefined' ? window.innerHeight - 420 : 0 })
  const [assistantSize, setAssistantSize] = useState({ width: 320, height: 384 })
  const [isDragging, setIsDragging] = useState(false)
  const [isResizingAssistant, setIsResizingAssistant] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const resizeRef = useRef<HTMLDivElement>(null)
  const assistantRef = useRef<HTMLDivElement>(null)
  const resizeHandleRef = useRef<HTMLDivElement>(null)
  const startTimeRef = useRef<number | null>(null)
  const initializedRef = useRef(false)

  // Fetch interview data
  useEffect(() => {
    if (!uniqueLink) return

    const fetchInterview = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/interviews/link/${uniqueLink}`)
        if (response.ok) {
          const data = await response.json()
          console.log('[Interview] Fetched data:', data)
          console.log('[Interview] time_limit_minutes:', data.time_limit_minutes)
          setInterview(data)
        } else {
          console.error('Failed to fetch interview data')
        }
      } catch (error) {
        console.error('Error fetching interview:', error)
      }
    }

    fetchInterview()
  }, [uniqueLink])

  // Set time limit when interview is fetched
  useEffect(() => {
    if (interview?.time_limit_minutes) {
      setInterviewTimeLimit(interview.time_limit_minutes)
    }
  }, [interview])

  // Handle panel resizing
  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = e.clientX
      if (newWidth >= 300 && newWidth <= window.innerWidth - 300) {
        setQuestionPanelWidth(newWidth)
      }
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

  // Handle AI assistant dragging
  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - dragStart.x
      const newY = e.clientY - dragStart.y
      
      // Constrain to viewport
      const maxX = window.innerWidth - assistantSize.width
      const maxY = window.innerHeight - assistantSize.height
      
      setAssistantPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragStart, assistantSize])

  // Handle AI assistant resizing
  useEffect(() => {
    if (!isResizingAssistant) return

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(280, Math.min(e.clientX - assistantPosition.x, window.innerWidth * 0.8))
      const newHeight = Math.max(200, Math.min(e.clientY - assistantPosition.y, window.innerHeight * 0.8))
      
      // Ensure assistant doesn't go off-screen
      const maxX = window.innerWidth - newWidth
      const maxY = window.innerHeight - newHeight
      
      if (assistantPosition.x > maxX) {
        setAssistantPosition(prev => ({ ...prev, x: maxX }))
      }
      if (assistantPosition.y > maxY) {
        setAssistantPosition(prev => ({ ...prev, y: maxY }))
      }
      
      setAssistantSize({ width: newWidth, height: newHeight })
    }

    const handleMouseUp = () => {
      setIsResizingAssistant(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizingAssistant, assistantPosition])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Reset initialization ref when submissionId changes
  useEffect(() => {
    initializedRef.current = false
  }, [submissionId])

  // Load existing submission code when resuming, or initialize with starter code
  useEffect(() => {
    if (!submissionId || !showEditor || !interview || initializedRef.current) return

    const loadSubmission = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/submissions/${submissionId}`)
        if (response.ok) {
          const submission = await response.json()
          
          // Priority order:
          // 1. Existing submission code (highest priority)
          // 2. Starter code from interview (if no existing code)
          // 3. Empty string (fallback)
          
          if (submission.code) {
            // Existing code takes precedence
            setCode(submission.code)
            if (submission.language) {
              setLanguage(submission.language)
            }
          } else if (interview.starter_code) {
            // Only use starter code if:
            // - Interview has starter code
            // - No existing code in submission
            // Note: We don't check current code state here to avoid dependency issues
            // The initializedRef ensures this only runs once
            setCode(interview.starter_code)
          }
          
          initializedRef.current = true
        }
      } catch (error) {
        console.error('Failed to load submission:', error)
      }
    }

    loadSubmission()
  }, [submissionId, showEditor, interview])

  // Fetch session details (only if we have submissionId)
  useEffect(() => {
    if (!submissionId) return

    const fetchSession = async () => {
      try {
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
      }
    }

    fetchSession()
    
    // Poll session status to check if interview ended
    const interval = setInterval(fetchSession, 5000) // Check every 5 seconds
    return () => clearInterval(interval)
  }, [submissionId])

  // Autosave code and language with debouncing
  useEffect(() => {
    if (!submissionId || !showEditor) return

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
    }, 2000)

    return () => clearTimeout(timeoutId)
  }, [code, language, submissionId, showEditor])

  // Calculate time remaining - real-time countdown
  useEffect(() => {
    if (!submissionId || !interviewTimeLimit || !showEditor) return

    let interval: ReturnType<typeof setInterval> | null = null

    // Initialize timer: fetch start time, then start calculation
    const initializeTimer = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/submissions/${submissionId}`)
        if (!response.ok) {
          console.error('[Time] Failed to fetch submission:', response.status)
          return
        }

        const sub = await response.json()
        console.log('[Time] Submission data:', sub)
        console.log('[Time] started_at:', sub.started_at)

        if (!sub.started_at) {
          console.warn('[Time] No started_at in submission - interview may not have started')
          return
        }

        // Set start time
        startTimeRef.current = new Date(sub.started_at).getTime()

        // Calculate function
        const calculateTimeRemaining = () => {
          if (startTimeRef.current === null) return

          const now = Date.now()
          const elapsedSeconds = Math.floor((now - startTimeRef.current) / 1000)
          const totalSeconds = interviewTimeLimit * 60
          const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds)

          setTimeRemaining(remainingSeconds)

          // Auto-submit when time runs out
          if (remainingSeconds === 0 && session?.status !== 'completed' && submissionId) {
            toast.error('Time is up! Submitting your interview automatically...')
            handleSubmitInterview().catch(err => {
              console.error('Auto-submit failed:', err)
            })
          }

          // Warning toasts
          if (remainingSeconds <= 300 && remainingSeconds > 299 && !hasWarned5Min) {
            toast.error('⚠️ 5 minutes remaining!', { duration: 5000 })
            setHasWarned5Min(true)
          }
          if (remainingSeconds <= 60 && remainingSeconds > 59 && !hasWarned1Min) {
            toast.error('⚠️ 1 minute remaining!', { duration: 5000 })
            setHasWarned1Min(true)
          }
        }

        // Calculate immediately, then every second
        calculateTimeRemaining()
        interval = setInterval(calculateTimeRemaining, 1000)
      } catch (error) {
        console.error('[Time] Error fetching start time:', error)
      }
    }

    initializeTimer()

    return () => {
      if (interval) clearInterval(interval)
      startTimeRef.current = null
    }
  }, [submissionId, interviewTimeLimit, showEditor, session, hasWarned5Min, hasWarned1Min])

  // Proactive AI probing - trigger on code changes with debounce
  useEffect(() => {
    if (!submissionId || !showEditor || !code.trim()) return

    // Debounce: wait 30 seconds after last code change before probing
    const PROBE_DEBOUNCE = 30 * 1000 // 30 seconds
    let probeTimeoutId: ReturnType<typeof setTimeout> | null = null

    const probeCandidate = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/probe-candidate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            submissionId,
            code,
            language
          })
        })

        if (response.ok) {
          const data = await response.json()
          const probeMessage: Message = {
            role: 'assistant',
            content: data.question,
            timestamp: new Date().toISOString()
          }
          setMessages(prev => [...prev, probeMessage])
          toast.success('AI has a question for you!', { duration: 3000 })
        }
      } catch (error) {
        console.error('Failed to probe candidate:', error)
      }
    }

    // Clear previous timeout
    if (probeTimeoutId) {
      clearTimeout(probeTimeoutId)
    }

    // Set new timeout - probe after 30 seconds of inactivity
    probeTimeoutId = setTimeout(() => {
      probeCandidate()
    }, PROBE_DEBOUNCE)

    return () => {
      if (probeTimeoutId) clearTimeout(probeTimeoutId)
    }
  }, [submissionId, showEditor, code, language]) // Trigger on code changes

  // Track activity (paste, tab switch, etc.)
  const trackActivity = async (eventType: 'paste' | 'tab_switch' | 'visibility_change') => {
    if (!submissionId) return

    const now = Date.now()
    // Debounce: max 1 event per second
    if (now - lastActivityTimeRef.current < 1000) {
      return
    }
    lastActivityTimeRef.current = now

    try {
      await fetch(`${BACKEND_URL}/api/submissions/${submissionId}/track-activity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventType })
      })
    } catch (error) {
      // Silently fail - don't break interview flow
      console.error('Failed to track activity:', error)
    }
  }

  // Paste detection in Monaco editor
  useEffect(() => {
    if (!showEditor || !submissionId || !editorRef.current) return

    const editor = editorRef.current
    const disposable = editor.onDidPaste(() => {
      trackActivity('paste')
    })

    return () => {
      disposable.dispose()
    }
  }, [showEditor, submissionId])

  // Page Visibility API - track tab switching
  useEffect(() => {
    if (!showEditor || !submissionId) return

    const handleVisibilityChange = () => {
      const isVisible = !document.hidden
      
      // Only track when tab becomes visible (user switched back)
      if (isVisible && !wasVisibleRef.current) {
        trackActivity('tab_switch')
      }
      
      wasVisibleRef.current = isVisible
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    wasVisibleRef.current = !document.hidden

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [showEditor, submissionId])

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    if (!candidateName.trim()) {
      setFormError('Candidate name is required')
      return
    }

    if (!candidateEmail.trim()) {
      setFormError('Candidate email is required')
      return
    }

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
      if (data.resumed) {
        toast.success('Welcome back! Resuming your previous session...')
      } else {
        toast.success('Interview started successfully!')
      }
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
    // Check if interview is ended
    if (session?.status === 'completed') {
      toast.error('This interview has ended. You can no longer run code.')
      return
    }
    
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

  const handleSubmitInterview = async () => {
    if (!submissionId) return
    
    if (session?.status === 'completed') {
      toast.error('This interview has already been submitted.')
      return
    }

    const confirmed = window.confirm(
      'Are you sure you want to submit your interview? You will not be able to make further changes.'
    )
    
    if (!confirmed) return

    setIsSubmittingInterview(true)
    
    try {
      // First, save the final code
      const saveResponse = await fetch(`${BACKEND_URL}/api/submissions/${submissionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code || '',
          language: language
        })
      })

      if (!saveResponse.ok) {
        const errorMessage = await parseApiError(saveResponse)
        throw new Error(errorMessage)
      }

      // Then, submit the interview
      const submitResponse = await fetch(`${BACKEND_URL}/api/submissions/${submissionId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!submitResponse.ok) {
        const errorMessage = await parseApiError(submitResponse)
        throw new Error(errorMessage)
      }

      toast.success('Interview submitted successfully! Thank you for your time.')
      
      // Refresh session to get updated status
      const sessionResponse = await fetch(`${BACKEND_URL}/api/sessions/${submissionId}`)
      if (sessionResponse.ok) {
        const sessionData = await sessionResponse.json()
        setSession(sessionData)
      }
      
      // Disable editor (readOnly will be set based on session.status)
    } catch (error) {
      const errorMessage = handleApiError(error)
      toast.error(`Failed to submit interview: ${errorMessage}`)
      console.error('Failed to submit interview:', error)
    } finally {
      setIsSubmittingInterview(false)
    }
  }

  const sendMessage = async () => {
    // Check if interview is ended
    if (session?.status === 'completed') {
      toast.error('This interview has ended. You can no longer send messages.')
      return
    }
    
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

  // Map language to Monaco editor language
  const getMonacoLanguage = (lang: string) => {
    const langMap: Record<string, string> = {
      python: 'python',
      javascript: 'javascript',
      c: 'c',
      cpp: 'cpp',
      java: 'java'
    }
    return langMap[lang] || 'python'
  }

  // Handle drag start for AI assistant
  const handleDragStart = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.resize-handle')) return
    setIsDragging(true)
    setDragStart({
      x: e.clientX - assistantPosition.x,
      y: e.clientY - assistantPosition.y
    })
  }

  // Handle resize start for AI assistant
  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsResizingAssistant(true)
  }

  return (
    <div className="min-h-screen bg-gray-50 relative">
      {/* Show banner if interview ended */}
      {session?.status === 'completed' && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-white text-center py-2 z-50">
          This interview has ended. You can no longer make changes.
        </div>
      )}
      {/* AI Chat Overlay - only show when editor is visible */}
      {showEditor && (
        <div
          ref={assistantRef}
          className="fixed z-50 bg-white border-2 border-indigo-500 rounded-lg shadow-lg flex flex-col overflow-hidden"
          style={{
            left: `${assistantPosition.x}px`,
            top: `${assistantPosition.y}px`,
            width: `${assistantSize.width}px`,
            height: `${assistantSize.height}px`
          }}
        >
          <div
            className="bg-indigo-500 text-white p-3 font-semibold cursor-move select-none"
            onMouseDown={handleDragStart}
          >
            codepair Assistant
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
              disabled={loading || session?.status === 'completed'}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim() || session?.status === 'completed'}
              className="bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-400 text-white px-3 py-1 rounded text-sm"
            >
              Send
            </button>
          </div>
          {/* Resize Handle */}
          <div
            ref={resizeHandleRef}
            className="resize-handle absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize bg-indigo-500 opacity-50 hover:opacity-100 transition-opacity"
            style={{
              clipPath: 'polygon(100% 0, 0 100%, 100% 100%)'
            }}
            onMouseDown={handleResizeStart}
          />
        </div>
      )}

      {/* Main Content */}
      <div className="h-screen flex flex-col">
        <header className="bg-indigo-600 shadow-sm py-3 px-6 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-white">
                {interview?.job_title || 'Live Coding Interview'}
              </h1>
              {submissionId && (
                <p className="text-xs text-indigo-200">Session: {submissionId.slice(0, 8)}...</p>
              )}
            </div>
            {showEditor && (
              <div className="flex items-center gap-4">
                {interviewTimeLimit && (
                  <div className="flex items-center gap-2 bg-indigo-500/30 px-4 py-2 rounded-lg border-2 border-indigo-400">
                    <span className="text-sm font-medium text-indigo-100">Time Remaining:</span>
                    <span className={`text-lg font-bold font-mono ${
                      timeRemaining !== null && timeRemaining < 300 ? 'text-red-300' : 
                      timeRemaining !== null && timeRemaining < 600 ? 'text-orange-300' : 'text-white'
                    }`}>
                      {timeRemaining !== null 
                        ? `${Math.floor(timeRemaining / 60)}:${(timeRemaining % 60).toString().padStart(2, '0')}`
                        : `${interviewTimeLimit}:00`
                      }
                    </span>
                  </div>
                )}
                <label className="text-sm font-medium text-indigo-100">Language:</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="border border-indigo-400 bg-white rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                >
                  <option value="python">Python</option>
                  <option value="javascript">JavaScript</option>
                  <option value="c">C</option>
                  <option value="cpp">C++</option>
                  <option value="java">Java</option>
                </select>
                {isSaving && (
                  <span className="text-sm text-indigo-200 flex items-center gap-2">
                    <LoadingSpinner size="sm" />
                    Saving...
                  </span>
                )}
                {!isSaving && lastSaved && !saveError && (
                  <span className="text-sm text-green-300">Saved</span>
                )}
                {saveError && (
                  <span className="text-sm text-red-600" title={saveError}>
                    Save failed
                  </span>
                )}
              </div>
            )}
          </div>
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
          /* Coding Environment - CoderPad/HackerRank Style */
          <div className="flex-1 flex overflow-hidden bg-gray-50">
            {/* Question Panel - Resizable */}
            <div
              className="bg-gray-900 border-r border-gray-700 overflow-y-auto"
              style={{ width: `${questionPanelWidth}px`, minWidth: '300px', maxWidth: '60%' }}
            >
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-100 mb-4">Problem</h2>
                
                {interview?.instructions ? (
                  <div className="prose max-w-none prose-invert prose-headings:text-gray-100 prose-p:text-gray-300 prose-code:bg-gray-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-indigo-400 prose-pre:bg-gray-950 prose-pre:text-gray-100 prose-pre:p-4 prose-pre:rounded-lg prose-pre:my-4 prose-pre:border prose-pre:border-gray-700 prose-pre:overflow-x-auto">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {interview.instructions}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="text-gray-400 italic">
                    No specific instructions provided. Please write code to solve the problem.
                  </div>
                )}
              </div>
            </div>

            {/* Resize Handle */}
            <div
              ref={resizeRef}
              onMouseDown={() => setIsResizing(true)}
              className="w-1 bg-gray-700 hover:bg-gray-600 cursor-col-resize transition-colors"
              style={{ cursor: 'col-resize' }}
            />

            {/* Code Editor and Output Panel */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Code Editor */}
              <div className="flex-1 border-b border-gray-300 overflow-hidden">
                <div className="h-full">
                  <Editor
                    height="100%"
                    language={getMonacoLanguage(language)}
                    value={code}
                    onChange={(value) => {
                      // Disable editing if interview ended
                      if (session?.status === 'completed') {
                        toast.error('This interview has ended.')
                        return
                      }
                      setCode(value || '')
                    }}
                    onMount={(editor) => {
                      editorRef.current = editor
                    }}
                    theme="vs-dark"
                    options={{
                      fontSize: 14,
                      minimap: { enabled: false },
                      wordWrap: 'on' as const,
                      automaticLayout: true,
                      scrollBeyondLastLine: false,
                      padding: { top: 16, bottom: 16 },
                      readOnly: session?.status === 'completed' // Disable editing
                    }}
                  />
                </div>
              </div>

              {/* Output Panel */}
              <div className="h-64 bg-gray-900 border-t border-gray-700 flex flex-col">
                <div className="bg-gray-800 px-4 py-2 border-b border-gray-700 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-300">Output</span>
                  <div className="flex gap-2">
                    <button
                      onClick={handleRunCode}
                      disabled={isExecuting || !code.trim() || session?.status === 'completed'}
                      className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-1.5 rounded transition duration-200 flex items-center gap-2"
                    >
                      {isExecuting ? (
                        <>
                          <LoadingSpinner size="sm" />
                          Running...
                        </>
                      ) : (
                        '▶ Run Code'
                      )}
                    </button>
                    {submissionId && session?.status !== 'completed' && (
                      <button
                        onClick={handleSubmitInterview}
                        disabled={isSubmittingInterview}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-1.5 rounded transition duration-200 flex items-center gap-2"
                      >
                        {isSubmittingInterview ? (
                          <>
                            <LoadingSpinner size="sm" />
                            Submitting...
                          </>
                        ) : (
                          '✓ Submit Interview'
                        )}
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  {isExecuting ? (
                    <div className="text-blue-400 flex items-center gap-2 font-mono text-sm">
                      <LoadingSpinner size="sm" />
                      Running code...
                    </div>
                  ) : executionSuccess === true ? (
                    <pre className="text-green-400 font-mono text-sm whitespace-pre-wrap">
                      {output || '(No output)'}
                    </pre>
                  ) : executionSuccess === false ? (
                    <pre className="text-red-400 font-mono text-sm whitespace-pre-wrap">
                      {executionError || 'Execution failed'}
                    </pre>
                  ) : (
                    <div className="text-gray-500 font-mono text-sm">
                      Click "Run Code" to execute your code. Output will appear here.
                    </div>
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
