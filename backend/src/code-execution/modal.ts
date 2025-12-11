export interface CodeExecutionRequest {
  code: string
  language: 'python' | 'javascript'
}

export interface CodeExecutionResponse {
  output: string
  error?: string
  success: boolean
}

/**
 * Execute code using Modal.com API (or mock for MVP stub)
 * 
 * For MVP: Returns mock output
 * Future: Will integrate with real Modal.com API
 */
export async function executeCode(
  request: CodeExecutionRequest
): Promise<CodeExecutionResponse> {
  const apiKey = process.env.MODAL_API_KEY

  // For MVP stub: use mock execution if API key not set or in development
  if (!apiKey) {
    return mockExecution(request)
  }

  // TODO: Real Modal.com API integration
  // For now, still use mock even if API key is present
  // This will be replaced with actual API calls in next step
  console.log('[Code Execution] MODAL_API_KEY is set, but using mock execution (real API integration pending)')
  return mockExecution(request)
}

/**
 * Mock code execution for MVP development
 * Simulates code execution with realistic delays and outputs
 */
async function mockExecution(
  request: CodeExecutionRequest
): Promise<CodeExecutionResponse> {
  // Simulate execution delay (100-500ms)
  const delay = Math.random() * 400 + 100
  await new Promise(resolve => setTimeout(resolve, delay))

  const { code, language } = request

  // Handle empty code
  if (!code || code.trim().length === 0) {
    return {
      output: '',
      success: true
    }
  }

  // Generate mock output based on language
  let mockOutput = ''

  if (language === 'javascript') {
    // Try to detect if code would produce output
    if (code.includes('console.log') || code.includes('console.error')) {
      mockOutput = 'Hello, World!\nCode executed successfully.\n'
    } else if (code.includes('return')) {
      mockOutput = 'Function executed.\n'
    } else {
      mockOutput = 'Code executed successfully.\n'
    }
  } else if (language === 'python') {
    // Try to detect if code would produce output
    if (code.includes('print(')) {
      mockOutput = 'Hello, World!\nCode executed successfully.\n'
    } else if (code.includes('return')) {
      mockOutput = 'Function executed.\n'
    } else {
      mockOutput = 'Code executed successfully.\n'
    }
  }

  return {
    output: mockOutput.trim(),
    success: true
  }
}

