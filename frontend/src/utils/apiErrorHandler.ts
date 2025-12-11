/**
 * Checks if an error is a network error (fetch failure, no internet, etc.)
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) {
    return (
      error.message.includes('fetch') ||
      error.message.includes('network') ||
      error.message.includes('Failed to fetch')
    )
  }
  return false
}

/**
 * Extracts a user-friendly error message from various error types
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message)
  }
  return 'An unexpected error occurred'
}

/**
 * Handles API errors and returns user-friendly error messages
 */
export function handleApiError(error: unknown): string {
  if (isNetworkError(error)) {
    return 'Network error. Please check your internet connection and try again.'
  }

  const message = getErrorMessage(error)

  // Handle common HTTP error messages
  if (message.includes('401') || message.includes('Unauthorized')) {
    return 'You are not authorized to perform this action. Please sign in again.'
  }
  if (message.includes('403') || message.includes('Forbidden')) {
    return 'You do not have permission to access this resource.'
  }
  if (message.includes('404') || message.includes('Not Found')) {
    return 'The requested resource was not found.'
  }
  if (message.includes('500') || message.includes('Internal Server Error')) {
    return 'Server error. Please try again later.'
  }
  if (message.includes('timeout')) {
    return 'Request timed out. Please try again.'
  }

  // Return the original message if it's already user-friendly
  return message || 'An unexpected error occurred. Please try again.'
}

/**
 * Parses error response from API and extracts error message
 */
export async function parseApiError(response: Response): Promise<string> {
  try {
    const data = await response.json()
    if (data.error) {
      return data.error
    }
    if (data.message) {
      return data.message
    }
  } catch {
    // If JSON parsing fails, use status text
  }

  // Fallback to status text
  if (response.statusText) {
    return response.statusText
  }

  // Fallback to status code
  return `Error ${response.status}`
}

