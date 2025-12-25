import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import toast from 'react-hot-toast'
import LoadingSpinner from '../components/LoadingSpinner.tsx'
import { handleApiError, parseApiError } from '../utils/apiErrorHandler.ts'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'

interface Interview {
  id: string
  job_title: string
  time_limit_minutes: number | null
  created_at: string
}

interface Candidate {
  id: string
  candidate_name: string
  candidate_email: string
  status: string
  submitted_at: string
  started_at: string | null
  timeTaken: number | null
  analysis: {
    score: number
    summary: string
  } | null
}

interface InterviewDetails {
  interview: Interview
  candidates: Candidate[]
  stats: {
    total: number
    completed: number
    averageScore: number | null
  }
}

export default function InterviewDetails() {
  const { interviewId } = useParams<{ interviewId: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<InterviewDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(Date.now())
  const { getToken } = useAuth()

  useEffect(() => {
    if (interviewId) {
      fetchDetails()
    }
  }, [interviewId])

  // Update current time every minute for countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now())
    }, 60000) // Update every minute
    return () => clearInterval(interval)
  }, [])

  // Helper function to calculate remaining time
  const calculateTimeRemaining = (startedAt: string | null, timeLimitMinutes: number | null): number | null => {
    if (!startedAt || !timeLimitMinutes) return null
    const startTime = new Date(startedAt).getTime()
    const elapsedSeconds = Math.floor((currentTime - startTime) / 1000)
    const totalSeconds = timeLimitMinutes * 60
    const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds)
    return remainingSeconds
  }

  const fetchDetails = async () => {
    try {
      setLoading(true)
      const token = await getToken()
      const response = await fetch(`${BACKEND_URL}/api/interviews/${interviewId}/details`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        const errorMessage = await parseApiError(response)
        throw new Error(errorMessage)
      }

      const details = await response.json()
      setData(details)
    } catch (error) {
      toast.error(handleApiError(error))
      console.error('Failed to fetch interview details:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Interview not found</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-gray-200 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Interview Details
            </h1>
            <button
              onClick={() => navigate('/dashboard')}
              className="text-gray-600 hover:text-gray-900"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 pt-24">
        <div className="px-4 py-6 sm:px-0">
          {/* Interview Info */}
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold text-gray-900">{data.interview.job_title}</h2>
              <div className="flex items-center gap-2 bg-blue-50 border-2 border-blue-200 px-4 py-2 rounded-lg">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium text-blue-700">Time Limit:</span>
                <span className="text-lg font-bold text-blue-900">{data.interview.time_limit_minutes || 60} minutes</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Created:</span>
                <span className="ml-2 font-medium">{new Date(data.interview.created_at).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-gray-500">Total Candidates:</span>
                <span className="ml-2 font-medium">{data.stats.total}</span>
              </div>
              <div>
                <span className="text-gray-500">Completed:</span>
                <span className="ml-2 font-medium">{data.stats.completed}</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white shadow rounded-lg p-4">
              <div className="text-sm text-gray-500">Completed</div>
              <div className="text-2xl font-bold text-gray-900">{data.stats.completed}</div>
            </div>
            <div className="bg-white shadow rounded-lg p-4">
              <div className="text-sm text-gray-500">Average Score</div>
              <div className="text-2xl font-bold text-gray-900">
                {data.stats.averageScore !== null ? `${data.stats.averageScore}/100` : 'N/A'}
              </div>
            </div>
            <div className="bg-white shadow rounded-lg p-4">
              <div className="text-sm text-gray-500">Completion Rate</div>
              <div className="text-2xl font-bold text-gray-900">
                {data.stats.total > 0 ? Math.round((data.stats.completed / data.stats.total) * 100) : 0}%
              </div>
            </div>
          </div>

          {/* Candidates Table */}
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Candidates</h3>
            </div>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time Taken</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.candidates.map((candidate) => (
                  <tr key={candidate.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {candidate.candidate_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {candidate.candidate_email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        candidate.status === 'completed' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {candidate.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {candidate.status === 'completed' ? (
                        candidate.timeTaken !== null ? `${candidate.timeTaken} min` : '-'
                      ) : (
                        (() => {
                          const remaining = calculateTimeRemaining(candidate.started_at, data.interview.time_limit_minutes)
                          if (remaining === null) return '-'
                          const minutes = Math.floor(remaining / 60)
                          const seconds = remaining % 60
                          return `${minutes}:${seconds.toString().padStart(2, '0')} remaining`
                        })()
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {candidate.analysis ? (
                        `${candidate.analysis.score}/100`
                      ) : candidate.status === 'completed' ? (
                        <span className="text-gray-500 italic">Evaluating...</span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Link
                        to={`/interview/${interviewId}/submission/${candidate.id}`}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        View Report
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}


