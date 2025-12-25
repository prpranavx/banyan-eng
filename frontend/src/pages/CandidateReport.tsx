import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import Editor from '@monaco-editor/react'
import toast from 'react-hot-toast'
import LoadingSpinner from '../components/LoadingSpinner.tsx'
import { handleApiError, parseApiError } from '../utils/apiErrorHandler.ts'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'

interface Submission {
  id: string
  interview_id: string
  candidate_name: string
  candidate_email: string
  code: string | null
  language: string | null
  submitted_at: string
  started_at: string | null
  status: string
}

interface ChatMessage {
  id: string
  submission_id: string
  session_id: string
  sender: string
  message: string
  timestamp: string
}

interface AIAnalysis {
  id: string
  submission_id: string
  score: number
  summary: string
  strengths: string[]
  improvements: string[]
  generated_at: string
}

interface ReportData {
  submission: Submission
  messages: ChatMessage[]
  analysis: AIAnalysis | null
}

export default function CandidateReport() {
  const { interviewId, submissionId } = useParams<{ interviewId: string; submissionId: string }>()
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const { getToken } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (submissionId) {
      fetchReport()
    }
  }, [submissionId])

  const fetchReport = async () => {
    try {
      setLoading(true)
      setError(null)
      const token = await getToken()
      const response = await fetch(`${BACKEND_URL}/api/submissions/${submissionId}/report`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        const errorMessage = await parseApiError(response)
        const userMessage = handleApiError(new Error(errorMessage))
        setError(userMessage)
        toast.error(userMessage)
        return
      }

      const data = await response.json()
      setReportData(data)
    } catch (error) {
      const errorMessage = handleApiError(error)
      setError(errorMessage)
      toast.error(errorMessage)
      console.error('Failed to fetch report:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateStatus = async (newStatus: string) => {
    if (!submissionId || updatingStatus) return

    setUpdatingStatus(true)
    try {
      const token = await getToken()
      const response = await fetch(`${BACKEND_URL}/api/submissions/${submissionId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      })

      if (!response.ok) {
        const errorMessage = await parseApiError(response)
        throw new Error(errorMessage)
      }

      // Refresh report data
      await fetchReport()
      toast.success(`Status updated to ${newStatus}`)
    } catch (error) {
      const errorMessage = handleApiError(error)
      toast.error(errorMessage)
      console.error('Failed to update status:', error)
    } finally {
      setUpdatingStatus(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center flex-col gap-4">
        <LoadingSpinner size="lg" />
        <p className="text-gray-500">Loading report...</p>
      </div>
    )
  }

  if (error || !reportData) {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16 items-center">
              <h1 className="text-2xl font-bold text-gray-900">Candidate Report</h1>
              <Link
                to={`/interview/${interviewId}/candidates`}
                className="text-blue-600 hover:text-blue-900 font-medium"
              >
                ← Back to Candidates
              </Link>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <p className="text-red-800">{error || 'Report not found'}</p>
                <button
                  onClick={fetchReport}
                  className="text-red-600 hover:text-red-900 font-medium text-sm ml-4"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  const { submission, messages, analysis } = reportData

  // Calculate time taken
  const timeTaken = submission.started_at && submission.submitted_at
    ? Math.round(
        (new Date(submission.submitted_at).getTime() - 
         new Date(submission.started_at).getTime()) / 1000 / 60
      )
    : null

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-2xl font-bold text-gray-900">Candidate Report</h1>
            <Link
              to={`/interview/${interviewId}/candidates`}
              className="text-blue-600 hover:text-blue-900 font-medium"
            >
              ← Back to Candidates
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0 space-y-6">
          {/* Candidate Info */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Candidate Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Name</p>
                <p className="text-lg text-gray-900">{submission.candidate_name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Email</p>
                <p className="text-lg text-gray-900">{submission.candidate_email}</p>
              </div>
              {timeTaken !== null && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Time Taken</p>
                  <p className="text-lg text-gray-900">{timeTaken} minutes</p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-gray-500">Submitted At</p>
                <p className="text-lg text-gray-900">{new Date(submission.submitted_at).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Status</p>
                <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                  submission.status === 'accepted' ? 'bg-green-100 text-green-800' :
                  submission.status === 'rejected' ? 'bg-red-100 text-red-800' :
                  submission.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                  submission.status === 'scheduled' ? 'bg-purple-100 text-purple-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {submission.status}
                </span>
              </div>
            </div>
          </div>

          {/* Code Section */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Submitted Code</h2>
              {submission.language && (
                <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-md text-sm font-medium">
                  {submission.language}
                </span>
              )}
            </div>
            <div className="border border-gray-300 rounded-lg overflow-hidden" style={{ height: '400px' }}>
              <Editor
                height="100%"
                language={submission.language || 'plaintext'}
                value={submission.code || ''}
                theme="vs-dark"
                options={{
                  readOnly: true,
                  fontSize: 14,
                  minimap: { enabled: false },
                  wordWrap: 'on' as const
                }}
              />
            </div>
          </div>

          {/* Chat Transcript */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Chat Transcript</h2>
            {messages.length === 0 ? (
              <p className="text-gray-500">No messages in this conversation.</p>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-3xl rounded-lg p-3 ${
                        message.sender === 'user'
                          ? 'bg-indigo-500 text-white'
                          : 'bg-gray-200 text-gray-800'
                      }`}
                    >
                      <p className="text-sm font-medium mb-1">
                        {message.sender === 'user' ? 'Candidate' : 'AI Assistant'}
                      </p>
                      <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                      <p className={`text-xs mt-1 ${
                        message.sender === 'user' ? 'text-indigo-100' : 'text-gray-500'
                      }`}>
                        {new Date(message.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI Analysis */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">AI Analysis</h2>
            {analysis ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Score</p>
                  <p className="text-3xl font-bold text-gray-900">{analysis.score}/100</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Summary</p>
                  <p className="text-gray-900">{analysis.summary}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-2">Strengths</p>
                    <ul className="list-disc list-inside space-y-1">
                      {analysis.strengths.map((strength, idx) => (
                        <li key={idx} className="text-gray-700">{strength}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-2">Improvements</p>
                    <ul className="list-disc list-inside space-y-1">
                      {analysis.improvements.map((improvement, idx) => (
                        <li key={idx} className="text-gray-700">{improvement}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">No analysis available for this submission.</p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Actions</h2>
            <div className="flex gap-3">
              <button
                onClick={() => updateStatus('accepted')}
                disabled={updatingStatus}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 flex items-center gap-2"
              >
                {updatingStatus && <LoadingSpinner size="sm" />}
                {updatingStatus ? 'Updating...' : 'Accept'}
              </button>
              <button
                onClick={() => updateStatus('rejected')}
                disabled={updatingStatus}
                className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 flex items-center gap-2"
              >
                {updatingStatus && <LoadingSpinner size="sm" />}
                {updatingStatus ? 'Updating...' : 'Reject'}
              </button>
              <button
                onClick={() => updateStatus('scheduled')}
                disabled={updatingStatus}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 flex items-center gap-2"
              >
                {updatingStatus && <LoadingSpinner size="sm" />}
                {updatingStatus ? 'Updating...' : 'Schedule Interview'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

