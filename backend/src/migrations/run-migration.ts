import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { getDb } from '../db.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function runMigration() {
  try {
    console.log('🔄 Starting database migration...')

    // Read SQL file
    const sqlFilePath = join(__dirname, '001_initial_schema.sql')
    console.log(`📄 Reading migration file: ${sqlFilePath}`)
    
    const sql = readFileSync(sqlFilePath, 'utf-8')

    // Get database connection
    const db = getDb()
    console.log('✅ Database connection established')

    // Execute SQL
    console.log('⚙️  Executing migration SQL...')
    await db.query(sql)

    console.log('✅ Migration completed successfully!')
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

