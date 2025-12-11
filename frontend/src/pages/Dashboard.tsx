import { useState, useEffect } from 'react'
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
}

export default function Dashboard() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [newSessionId, setNewSessionId] = useState<string | null>(null)
  const [candidateLink, setCandidateLink] = useState('')
  const [isCreatingSession, setIsCreatingSession] = useState(false)
  const [isEndingInterview, setIsEndingInterview] = useState<string | null>(null)
  const [candidateCounts, setCandidateCounts] = useState<Map<string, number>>(new Map())
  const [loadingInterviews, setLoadingInterviews] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [jobTitle, setJobTitle] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [instructions, setInstructions] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [formErrors, setFormErrors] = useState<{ jobTitle?: string }>({})
  const { getToken } = useAuth()

  // Fetch interviews on mount
  useEffect(() => {
    fetchInterviews()
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

  const resetForm = () => {
    setJobTitle('')
    setJobDescription('')
    setInstructions('')
    setFormErrors({})
    setShowForm(false)
  }

  const createSession = async () => {
    if (isCreatingSession) return

    // Validate form
    const errors: { jobTitle?: string } = {}
    if (!jobTitle.trim()) {
      errors.jobTitle = 'Job title is required'
      setFormErrors(errors)
      return
    }

    setIsCreatingSession(true)
    setFormErrors({})
    
    try {
      const token = await getToken()
      const response = await fetch(`${BACKEND_URL}/api/generate-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          jobTitle: jobTitle.trim(),
          jobDescription: jobDescription.trim() || undefined,
          instructions: instructions.trim() || undefined
        })
      })
      if (!response.ok) {
        const errorMessage = await parseApiError(response)
        throw new Error(errorMessage)
      }

      const data = await response.json()
      setNewSessionId(data.sessionId)

      // Refresh interviews list to get the new interview with all details
      await fetchInterviews()

      // Update the candidate link display
      if (data.candidateLink) {
        setCandidateLink(data.candidateLink)
      }

      // Reset form after successful creation
      resetForm()
      toast.success('Interview created successfully!')
    } catch (error) {
      const errorMessage = handleApiError(error)
      toast.error(errorMessage)
      console.error('Failed to create session:', error)
    } finally {
      setIsCreatingSession(false)
    }
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

      const evaluation = await response.json()

      // Refresh interviews to get updated status
      await fetchInterviews()

      // Show evaluation results
      toast.success(`Interview Complete! Score: ${evaluation.score}/100`)
      alert(`Interview Complete!\n\nScore: ${evaluation.score}/100\nSummary: ${evaluation.summary}`)
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
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-2xl font-bold text-gray-900">AI Interview Tool</h1>
            <UserButton afterSignOutUrl="/sign-in" />
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-8">
            {!showForm ? (
              <button
                onClick={() => setShowForm(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
              >
                New Interview
              </button>
            ) : (
              <div className="bg-white shadow rounded-lg p-6 max-w-2xl">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Create New Interview</h2>
                
                <form onSubmit={(e) => { e.preventDefault(); createSession(); }}>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="jobTitle" className="block text-sm font-medium text-gray-700 mb-1">
                        Job Title <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="jobTitle"
                        type="text"
                        value={jobTitle}
                        onChange={(e) => {
                          setJobTitle(e.target.value)
                          if (formErrors.jobTitle) {
                            setFormErrors({})
                          }
                        }}
                        className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          formErrors.jobTitle ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="e.g., Senior Software Engineer"
                        disabled={isCreatingSession}
                      />
                      {formErrors.jobTitle && (
                        <p className="mt-1 text-sm text-red-600">{formErrors.jobTitle}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="jobDescription" className="block text-sm font-medium text-gray-700 mb-1">
                        Job Description <span className="text-gray-500 text-xs">(optional)</span>
                      </label>
                      <textarea
                        id="jobDescription"
                        value={jobDescription}
                        onChange={(e) => setJobDescription(e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Describe the role, requirements, and responsibilities..."
                        rows={4}
                        disabled={isCreatingSession}
                      />
                    </div>

                    <div>
                      <label htmlFor="instructions" className="block text-sm font-medium text-gray-700 mb-1">
                        Instructions <span className="text-gray-500 text-xs">(optional)</span>
                      </label>
                      <textarea
                        id="instructions"
                        value={instructions}
                        onChange={(e) => setInstructions(e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="These instructions will be shown to candidates..."
                        rows={3}
                        disabled={isCreatingSession}
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        These instructions will be shown to candidates
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex gap-3">
                    <button
                      type="submit"
                      disabled={isCreatingSession}
                      className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 flex items-center gap-2"
                    >
                      {isCreatingSession && <LoadingSpinner size="sm" />}
                      {isCreatingSession ? 'Creating...' : 'Create Interview'}
                    </button>
                    <button
                      type="button"
                      onClick={resetForm}
                      disabled={isCreatingSession}
                      className="bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 text-gray-700 font-semibold py-2 px-4 rounded-lg transition duration-200"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}
            
            {newSessionId && candidateLink && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Interview session created! Share this link with the candidate:
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={candidateLink}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                  <button
                    onClick={() => navigator.clipboard.writeText(candidateLink)}
                    className="bg-white border border-gray-300 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}
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
                        Created At
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Candidates
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
                          {new Date(session.createdAt).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {candidateCounts.get(session.id) ?? '-'}
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
                      <tr key={session.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {session.jobTitle}
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
