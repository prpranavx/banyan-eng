import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import toast from 'react-hot-toast'
import LoadingSpinner from '../components/LoadingSpinner.tsx'
import { handleApiError, parseApiError } from '../utils/apiErrorHandler.ts'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'

interface Template {
  id: string
  name: string
  instructions: string
}

const TEMPLATES: Template[] = [
  {
    id: 'custom',
    name: 'Custom',
    instructions: ''
  },
  {
    id: 'two-sum',
    name: 'Two Sum',
    instructions: `# Two Sum

Given an array of integers \`nums\` and an integer \`target\`, return indices of the two numbers such that they add up to \`target\`.

You may assume that each input would have exactly one solution, and you may not use the same element twice.

You can return the answer in any order.

## Example 1:

\`\`\`
Input: nums = [2,7,11,15], target = 9
Output: [0,1]
Explanation: Because nums[0] + nums[1] == 9, we return [0, 1].
\`\`\`

## Example 2:

\`\`\`
Input: nums = [3,2,4], target = 6
Output: [1,2]
\`\`\`

## Constraints:

- 2 <= nums.length <= 10^4
- -10^9 <= nums[i] <= 10^9
- -10^9 <= target <= 10^9
- Only one valid answer exists.`
  },
  {
    id: 'reverse-linked-list',
    name: 'Reverse Linked List',
    instructions: `# Reverse Linked List

Given the head of a singly linked list, reverse the list, and return the reversed list.

## Example 1:

\`\`\`
Input: head = [1,2,3,4,5]
Output: [5,4,3,2,1]
\`\`\`

## Example 2:

\`\`\`
Input: head = [1,2]
Output: [2,1]
\`\`\`

## Example 3:

\`\`\`
Input: head = []
Output: []
\`\`\`

## Constraints:

- The number of nodes in the list is the range [0, 5000].
- -5000 <= Node.val <= 5000`
  },
  {
    id: 'binary-search',
    name: 'Binary Search',
    instructions: `# Binary Search

Given an array of integers \`nums\` which is sorted in ascending order, and an integer \`target\`, write a function to search \`target\` in \`nums\`. If \`target\` exists, then return its index. Otherwise, return \`-1\`.

You must write an algorithm with \`O(log n)\` runtime complexity.

## Example 1:

\`\`\`
Input: nums = [-1,0,3,5,9,12], target = 9
Output: 4
Explanation: 9 exists in nums and its index is 4
\`\`\`

## Example 2:

\`\`\`
Input: nums = [-1,0,3,5,9,12], target = 2
Output: -1
Explanation: 2 does not exist in nums so return -1
\`\`\`

## Constraints:

- 1 <= nums.length <= 10^4
- -10^4 < nums[i], target < 10^4
- All the integers in nums are unique.
- nums is sorted in ascending order.`
  },
  {
    id: 'merge-sorted-arrays',
    name: 'Merge Two Sorted Arrays',
    instructions: `# Merge Two Sorted Arrays

You are given two integer arrays \`nums1\` and \`nums2\`, sorted in non-decreasing order, and two integers \`m\` and \`n\`, representing the number of elements in \`nums1\` and \`nums2\` respectively.

Merge \`nums2\` into \`nums1\` in-place, such that the resulting array is also sorted in non-decreasing order.

Note: \`nums1\` has a length of \`m + n\`, where the first \`m\` elements denote the elements that should be merged, and the last \`n\` elements are set to 0 and should be ignored. \`nums2\` has a length of \`n\`.

## Example 1:

\`\`\`
Input: nums1 = [1,2,3,0,0,0], m = 3, nums2 = [2,5,6], n = 3
Output: [1,2,2,3,5,6]
Explanation: The arrays we are merging are [1,2,3] and [2,5,6].
The result of the merge is [1,2,2,3,5,6] with the underlined elements coming from nums1.
\`\`\`

## Example 2:

\`\`\`
Input: nums1 = [1], m = 1, nums2 = [], n = 0
Output: [1]
Explanation: The arrays we are merging are [1] and [].
The result of the merge is [1].
\`\`\`

## Constraints:

- nums1.length == m + n
- nums2.length == n
- 0 <= m, n <= 200
- 1 <= m + n <= 200
- -10^9 <= nums1[i], nums2[j] <= 10^9`
  }
]

export default function CreateInterview() {
  const [jobTitle, setJobTitle] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [instructions, setInstructions] = useState('')
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(60)
  const [selectedTemplate, setSelectedTemplate] = useState('custom')
  const [formErrors, setFormErrors] = useState<{ jobTitle?: string }>({})
  const [isCreatingSession, setIsCreatingSession] = useState(false)
  const { getToken } = useAuth()
  const navigate = useNavigate()

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId)
    const template = TEMPLATES.find(t => t.id === templateId)
    if (template) {
      setInstructions(template.instructions)
    }
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
          instructions: instructions.trim() || undefined,
          timeLimitMinutes: timeLimitMinutes || 60
        })
      })
      if (!response.ok) {
        const errorMessage = await parseApiError(response)
        throw new Error(errorMessage)
      }

      const data = await response.json()
      
      // Show success toast with candidate link
      if (data.candidateLink) {
        toast.success(
          (t) => (
            <div className="flex flex-col gap-2">
              <div>Interview created successfully!</div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={data.candidateLink}
                  className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs bg-white text-gray-900"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(data.candidateLink)
                    toast.success('Link copied!', { id: t.id })
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs"
                >
                  Copy
                </button>
              </div>
            </div>
          ),
          { duration: 10000 }
        )
      } else {
        toast.success('Interview created successfully!')
      }

      // Redirect to dashboard
      navigate('/dashboard')
    } catch (error) {
      const errorMessage = handleApiError(error)
      toast.error(errorMessage)
      console.error('Failed to create session:', error)
    } finally {
      setIsCreatingSession(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-gray-200 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Create Interview
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
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Interview Details</h2>
            
            <form onSubmit={(e) => { e.preventDefault(); createSession(); }}>
              <div className="space-y-6">
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
                  <label htmlFor="template" className="block text-sm font-medium text-gray-700 mb-1">
                    Problem Template <span className="text-gray-500 text-xs">(optional)</span>
                  </label>
                  <select
                    id="template"
                    value={selectedTemplate}
                    onChange={(e) => handleTemplateChange(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isCreatingSession}
                  >
                    {TEMPLATES.map(template => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Select a template to pre-fill the instructions, or choose Custom to write your own
                  </p>
                </div>

                <div>
                  <label htmlFor="instructions" className="block text-sm font-medium text-gray-700 mb-1">
                    Instructions <span className="text-gray-500 text-xs">(optional)</span>
                  </label>
                  <p className="mb-2 text-xs text-gray-500">
                    These instructions will be shown to candidates. Supports Markdown formatting.
                  </p>
                  <div className="border border-gray-300 rounded-md overflow-hidden" style={{ height: '400px' }}>
                    <div className="flex h-full">
                      {/* Editor Panel */}
                      <div className="flex-1 flex flex-col border-r border-gray-300">
                        <div className="bg-gray-50 px-3 py-2 border-b border-gray-300">
                          <span className="text-xs font-medium text-gray-700">Editor</span>
                        </div>
                        <textarea
                          id="instructions"
                          value={instructions}
                          onChange={(e) => setInstructions(e.target.value)}
                          className="flex-1 w-full px-3 py-2 focus:outline-none resize-none font-mono text-sm"
                          placeholder="Write your interview instructions here...&#10;&#10;You can use Markdown:&#10;- Headers&#10;- Code blocks&#10;- Lists&#10;- etc."
                          disabled={isCreatingSession}
                        />
                      </div>
                      {/* Preview Panel */}
                      <div className="flex-1 flex flex-col bg-white">
                        <div className="bg-gray-50 px-3 py-2 border-b border-gray-300">
                          <span className="text-xs font-medium text-gray-700">Preview</span>
                        </div>
                        <div className="flex-1 overflow-y-auto px-4 py-3">
                          {instructions.trim() ? (
                            <div className="prose max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-code:text-indigo-600 prose-pre:bg-gray-100 prose-pre:border prose-pre:border-gray-300 prose-pre:rounded prose-pre:p-4">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {instructions}
                              </ReactMarkdown>
                            </div>
                          ) : (
                            <div className="text-gray-400 text-sm italic">
                              Preview will appear here as you type...
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="timeLimitMinutes" className="block text-sm font-medium text-gray-700 mb-1">
                    Time Limit (minutes) <span className="text-gray-500 text-xs">(optional)</span>
                  </label>
                  <input
                    id="timeLimitMinutes"
                    type="number"
                    max="180"
                    value={timeLimitMinutes}
                    onChange={(e) => setTimeLimitMinutes(parseInt(e.target.value) || 60)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="60"
                    disabled={isCreatingSession}
                  />
                  <p className="mt-1 text-xs text-gray-500">Default: 60 minutes</p>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  type="submit"
                  disabled={isCreatingSession}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 flex items-center gap-2"
                >
                  {isCreatingSession && <LoadingSpinner size="sm" />}
                  {isCreatingSession ? 'Creating...' : 'Create Interview'}
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  disabled={isCreatingSession}
                  className="bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 text-gray-700 font-semibold py-2 px-4 rounded-lg transition duration-200"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}

