import { Pool } from 'pg'

let pool: Pool | null = null

export function getDb(): Pool {
  if (pool) {
    return pool
  }

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set')
  }

  const poolConfig: any = {
    connectionString: databaseUrl
  }

  // Use SSL for production (Railway, Supabase, etc.) but not localhost
  // This is safe because production DBs require SSL, local doesn't support it
  const useSSL = !databaseUrl.includes('localhost') && !databaseUrl.includes('127.0.0.1')
  
  if (useSSL) {
    poolConfig.ssl = {
      rejectUnauthorized: false
    }
  }

  pool = new Pool(poolConfig)
  return pool
}

