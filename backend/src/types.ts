import { Request } from 'express'

export interface ClerkAuth {
  userId?: string
  sub?: string
  id?: string
  emailAddresses?: Array<{ emailAddress: string }>
}

export interface AuthenticatedRequest extends Request {
  auth: ClerkAuth
}
