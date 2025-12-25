import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserButton, useAuth } from '@clerk/clerk-react'
import toast from 'react-hot-toast'
import LoadingSpinner from '../components/LoadingSpinner.tsx'
import { handleApiError, parseApiError } from '../utils/apiErrorHandler.ts'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'

interface Session {
  id: string
  jobTitle: string
  createdAt: string
  status: 'active' | 'completed'
  uniqueLink: string
  timeLimitMinutes?: number | null
  timeRemainingSeconds?: number | null
}

export default function Dashboard() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [isEndingInterview, setIsEndingInterview] = useState<string | null>(null)
  const [candidateCounts, setCandidateCounts] = useState<Map<string, number>>(new Map())
  const [loadingInterviews, setLoadingInterviews] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { getToken } = useAuth()
  const navigate = useNavigate()

  // Fetch interviews on mount
  useEffect(() => {
    fetchInterviews()
  }, [])

  // Update current time and refetch interviews every minute for countdown
  useEffect(() => {
    const interval = setInterval(() => {
      fetchInterviews() // Refetch to update times
    }, 60000) // Update every minute
    return () => clearInterval(interval)
  }, [])

  const fetchInterviews = async () => {
    try {
      setLoadingInterviews(true)
      setError(null)
      const token = await getToken()
      const response = await fetch(`${BACKEND_URL}/api/sessions`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setSessions(data)
        // Fetch candidate counts for each interview
        fetchCandidateCounts(data)
      } else {
        const errorMessage = await parseApiError(response)
        setError(handleApiError(new Error(errorMessage)))
        toast.error(handleApiError(new Error(errorMessage)))
      }
    } catch (error) {
      const errorMessage = handleApiError(error)
      setError(errorMessage)
      toast.error(errorMessage)
      console.error('Failed to fetch interviews:', error)
    } finally {
      setLoadingInterviews(false)
    }
  }

  const fetchCandidateCounts = async (interviews: Session[]) => {
    const counts = new Map<string, number>()
    const token = await getToken()

    // Fetch all counts in parallel
    const countPromises = interviews.map(async (interview) => {
      try {
        const response = await fetch(
          `${BACKEND_URL}/api/interviews/${interview.id}/candidates`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        )
        if (response.ok) {
          const data = await response.json()
          counts.set(interview.id, data.count)
        } else {
          counts.set(interview.id, 0)
        }
      } catch (error) {
        console.error(`Failed to fetch count for interview ${interview.id}:`, error)
        counts.set(interview.id, 0)
      }
    })

    await Promise.all(countPromises)
    setCandidateCounts(counts)
  }

  const endInterview = async (sessionId: string) => {
    if (isEndingInterview) return

    setIsEndingInterview(sessionId)
    try {
      const token = await getToken()
      const response = await fetch(`${BACKEND_URL}/api/evaluate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ sessionId })
      })
      if (!response.ok) {
        const errorMessage = await parseApiError(response)
        throw new Error(errorMessage)
      }

      const result = await response.json()

      // Refresh interviews immediately to show it moved to past interviews
      await fetchInterviews()

      // Show success message
      if (result.status === 'evaluating') {
        toast.success('Interview ended. Evaluation in progress...')
      } else {
        toast.success(`Interview Complete! Score: ${result.score}/100`)
      }
    } catch (error) {
      const errorMessage = handleApiError(error)
      toast.error(errorMessage)
      console.error('Failed to evaluate interview:', error)
    } finally {
      setIsEndingInterview(null)
    }
  }

  const activeSessions = sessions.filter(s => s.status === 'active')
  const pastSessions = sessions.filter(s => s.status === 'completed')

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-gray-200 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              AI Interview
            </h1>
            <UserButton afterSignOutUrl="/sign-in" />
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 pt-24">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-8">
            <button
              onClick={() => navigate('/create-interview')}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
            >
              New Interview
            </button>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center justify-between">
                <p className="text-red-800">{error}</p>
                <button
                  onClick={fetchInterviews}
                  className="text-red-600 hover:text-red-900 font-medium text-sm"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Active Interviews</h2>
            {loadingInterviews ? (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : activeSessions.length === 0 ? (
              <p className="text-gray-500">No active interviews</p>
            ) : (
              <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Job Title
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Time Limit
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created At
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Candidates
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Interview Link
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {activeSessions.map((session) => (
                      <tr key={session.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {session.jobTitle}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {session.timeRemainingSeconds !== null && session.timeRemainingSeconds !== undefined ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-50 text-orange-700 rounded-md text-xs font-medium">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {Math.floor(session.timeRemainingSeconds / 60)}:{(session.timeRemainingSeconds % 60).toString().padStart(2, '0')} remaining
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-medium">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {session.timeLimitMinutes || 60} min
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(session.createdAt).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {candidateCounts.get(session.id) ?? '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              readOnly
                              value={`${window.location.origin}/interview/${session.uniqueLink}`}
                              className="px-2 py-1 border border-gray-300 rounded text-xs w-64"
                              onClick={(e) => (e.target as HTMLInputElement).select()}
                            />
                            <button
                              onClick={() => {
                                const link = `${window.location.origin}/interview/${session.uniqueLink}`
                                navigator.clipboard.writeText(link)
                                toast.success('Link copied to clipboard!')
                              }}
                              className="bg-white border border-gray-300 px-2 py-1 rounded text-xs font-medium hover:bg-gray-50"
                            >
                              Copy
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <a
                            href={`/interview/${session.id}/candidates`}
                            className="text-blue-600 hover:text-blue-900 mr-4"
                          >
                            View
                          </a>
                          <button
                            onClick={() => endInterview(session.id)}
                            disabled={isEndingInterview === session.id}
                            className="text-red-600 hover:text-red-900 disabled:text-gray-400 flex items-center gap-2"
                          >
                            {isEndingInterview === session.id && <LoadingSpinner size="sm" />}
                            {isEndingInterview === session.id ? 'Evaluating...' : 'End Interview'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Past Interviews</h2>
            {loadingInterviews ? (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : pastSessions.length === 0 ? (
              <p className="text-gray-500">No past interviews</p>
            ) : (
              <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Job Title
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Time Limit
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created At
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Candidates
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {pastSessions.map((session) => (
                      <tr 
                        key={session.id}
                        onClick={() => window.location.href = `/interview/${session.id}/details`}
                        className="cursor-pointer hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {session.jobTitle}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {session.timeLimitMinutes ? `${session.timeLimitMinutes} min` : 'No limit'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(session.createdAt).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {candidateCounts.get(session.id) ?? '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-medium">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {session.timeLimitMinutes || 60} min
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(session.createdAt).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {candidateCounts.get(session.id) ?? '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                            Completed
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
