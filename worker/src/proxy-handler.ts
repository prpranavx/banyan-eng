// This file is deprecated - functionality moved to browser-session.ts
// Keeping for backwards compatibility during migration
export async function proxyPage(sessionId: string): Promise<string> {
  throw new Error('proxyPage is deprecated - use browser-session.ts instead')
}

