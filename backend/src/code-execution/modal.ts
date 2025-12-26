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
 * Execute code using Modal.com API
 * 
 * Requires MODAL_ENDPOINT environment variable to be configured.
 */
export async function executeCode(
  request: CodeExecutionRequest
): Promise<CodeExecutionResponse> {
  const modalEndpoint = process.env.MODAL_ENDPOINT

  if (!modalEndpoint) {
    throw new Error('MODAL_ENDPOINT environment variable is required for code execution')
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
      throw new Error('Code execution timed out after 30 seconds')
    } else {
      console.error('[Code Execution] Modal API call failed:', error instanceof Error ? error.message : 'Unknown error')
      throw error
    }
  }
}

