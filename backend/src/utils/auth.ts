import { AuthenticatedRequest } from '../types.js'

export function getClerkUserId(req: AuthenticatedRequest): string {
  const userId = req.auth.userId || req.auth.sub || req.auth.id
  if (!userId) {
    throw new Error('Unable to identify user from auth token')
  }
  return userId
}

