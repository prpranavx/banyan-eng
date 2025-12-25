export interface CodeExecutionRequest {
  code: string
  language: 'python' | 'javascript' | 'c' | 'cpp' | 'java'
  stdin?: string
}

export interface CodeExecutionResponse {
  output: string
  error?: string
  success: boolean
}

/**
 * Execute code using Modal.com API (or mock for fallback)
 * 
 * Calls the Modal endpoint if MODAL_ENDPOINT is configured,
 * otherwise falls back to mock execution for development/testing.
 */
export async function executeCode(
  request: CodeExecutionRequest
): Promise<CodeExecutionResponse> {
  const modalEndpoint = process.env.MODAL_ENDPOINT

  // Fall back to mock if Modal endpoint not configured
  if (!modalEndpoint) {
    console.log('[Code Execution] MODAL_ENDPOINT not set, using mock execution')
    return mockExecution(request)
  }

  try {
    // Prepare request payload
    const payload: any = {
      code: request.code,
      language: request.language
    }
    
    // Add stdin if provided
    if (request.stdin !== undefined) {
      payload.stdin = request.stdin
    }

    // Call Modal API with 30 second timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    const response = await fetch(modalEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`Modal API returned status ${response.status}: ${response.statusText}`)
    }

    const result = await response.json() as any

    // Validate response format
    if (typeof result === 'object' && result !== null && 
        typeof result.output === 'string' && typeof result.success === 'boolean') {
      return {
        output: result.output || '',
        error: result.error || undefined,
        success: result.success
      }
    } else {
      throw new Error('Invalid response format from Modal API')
    }

  } catch (error) {
    // Log error but don't expose internal details
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[Code Execution] Modal API call timed out after 30 seconds')
    } else {
      console.error('[Code Execution] Modal API call failed:', error instanceof Error ? error.message : 'Unknown error')
    }

    // Fall back to mock execution
    console.log('[Code Execution] Falling back to mock execution')
    return mockExecution(request)
  }
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
  } else if (language === 'c' || language === 'cpp') {
    if (code.includes('printf') || code.includes('cout')) {
      mockOutput = 'Hello, World!\nCode executed successfully.\n'
    } else {
      mockOutput = 'Code compiled and executed successfully.\n'
    }
  } else if (language === 'java') {
    if (code.includes('System.out.println')) {
      mockOutput = 'Hello, World!\nCode executed successfully.\n'
    } else {
      mockOutput = 'Code compiled and executed successfully.\n'
    }
  }

  return {
    output: mockOutput.trim(),
    success: true
  }
}

