import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { getDb } from '../db.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function runMigration() {
  try {
    console.log('🔄 Starting database migrations...')

    // Get database connection
    const db = getDb()
    console.log('✅ Database connection established')

    // Run migration 001
    const migration001Path = join(__dirname, '001_initial_schema.sql')
    console.log(`📄 Reading migration file: ${migration001Path}`)
    const sql001 = readFileSync(migration001Path, 'utf-8')
    console.log('⚙️  Executing migration 001...')
    await db.query(sql001)
    console.log('✅ Migration 001 completed')

    // Run migration 002
    const migration002Path = join(__dirname, '002_add_time_tracking_and_probing.sql')
    console.log(`📄 Reading migration file: ${migration002Path}`)
    const sql002 = readFileSync(migration002Path, 'utf-8')
    console.log('⚙️  Executing migration 002...')
    await db.query(sql002)
    console.log('✅ Migration 002 completed')

    console.log('✅ All migrations completed successfully!')
    process.exit(0)
  } catch (error) {
    console.error('❌ Migration failed:', error)
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      if (error.stack) {
        console.error('Stack trace:', error.stack)
      }
    }
    process.exit(1)
  }
}

runMigration()

