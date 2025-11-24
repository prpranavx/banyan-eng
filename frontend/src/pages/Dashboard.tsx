import { useState } from 'react'
import { UserButton, useAuth } from '@clerk/clerk-react'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'

interface Session {
  sessionId: string
  createdAt: string
  status: 'active' | 'completed'
  codingPlatformUrl?: string
}

export default function Dashboard() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [newSessionId, setNewSessionId] = useState<string | null>(null)
  const [candidateLink, setCandidateLink] = useState('')
  const [codingPlatformUrl, setCodingPlatformUrl] = useState('')
  const [isCreatingSession, setIsCreatingSession] = useState(false)
  const [isEndingInterview, setIsEndingInterview] = useState<string | null>(null)
  const { getToken } = useAuth()

  const createSession = async () => {
    if (isCreatingSession) return

    setIsCreatingSession(true)
    try {
      const token = await getToken()
      const response = await fetch(`${BACKEND_URL}/api/generate-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ codingPlatformUrl: codingPlatformUrl.trim() || undefined })
      })
      const data = await response.json()
      setNewSessionId(data.sessionId)

      const newSession: Session = {
        sessionId: data.sessionId,
        createdAt: new Date().toISOString(),
        status: 'active',
        codingPlatformUrl: data.codingPlatformUrl
      }
      setSessions([newSession, ...sessions])
      setCodingPlatformUrl('') // Reset the input

      // Update the candidate link display
      if (data.candidateLink) {
        setCandidateLink(data.candidateLink)
      }
    } catch (error) {
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
      const evaluation = await response.json()

      // Update session status
      setSessions(sessions.map(s =>
        s.sessionId === sessionId
          ? { ...s, status: 'completed' }
          : s
      ))

      // Show evaluation results
      alert(`Interview Complete!\n\nScore: ${evaluation.score}/100\nSummary: ${evaluation.summary}`)
    } catch (error) {
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
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Coding Platform URL (optional)
              </label>
              <input
                type="url"
                value={codingPlatformUrl}
                onChange={(e) => setCodingPlatformUrl(e.target.value)}
                placeholder="https://coderpad.io/... or https://hackerrank.com/..."
                className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isCreatingSession}
              />
              <p className="text-sm text-gray-500 mt-1">
                Enter a CoderPad, HackerRank, or other coding platform link to monitor this session
              </p>
            </div>

            <button
              onClick={createSession}
              disabled={isCreatingSession}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
            >
              {isCreatingSession ? 'Creating...' : 'New Interview'}
            </button>
            
            {newSessionId && (
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

          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Active Interviews</h2>
            {activeSessions.length === 0 ? (
              <p className="text-gray-500">No active interviews</p>
            ) : (
              <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Session ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created At
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {activeSessions.map((session) => (
                      <tr key={session.sessionId}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                          {session.sessionId.slice(0, 8)}...
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(session.createdAt).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <a
                            href={`/candidate/${session.sessionId}`}
                            className="text-blue-600 hover:text-blue-900 mr-4"
                          >
                            View
                          </a>
                          <button
                            onClick={() => endInterview(session.sessionId)}
                            disabled={isEndingInterview === session.sessionId}
                            className="text-red-600 hover:text-red-900 disabled:text-gray-400"
                          >
                            {isEndingInterview === session.sessionId ? 'Evaluating...' : 'End Interview'}
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
            {pastSessions.length === 0 ? (
              <p className="text-gray-500">No past interviews</p>
            ) : (
              <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Session ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created At
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {pastSessions.map((session) => (
                      <tr key={session.sessionId}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                          {session.sessionId.slice(0, 8)}...
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(session.createdAt).toLocaleString()}
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
