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

    // Run migration 003
    const migration003Path = join(__dirname, '003_add_starter_code.sql')
    console.log(`📄 Reading migration file: ${migration003Path}`)
    const sql003 = readFileSync(migration003Path, 'utf-8')
    console.log('⚙️  Executing migration 003...')
    await db.query(sql003)
    console.log('✅ Migration 003 completed')

    // Run migration 004
    const migration004Path = join(__dirname, '004_add_subscriptions_and_credits.sql')
    console.log(`📄 Reading migration file: ${migration004Path}`)
    const sql004 = readFileSync(migration004Path, 'utf-8')
    console.log('⚙️  Executing migration 004...')
    await db.query(sql004)
    console.log('✅ Migration 004 completed')

    // Run migration 005
    const migration005Path = join(__dirname, '005_add_anti_cheating_tracking.sql')
    console.log(`📄 Reading migration file: ${migration005Path}`)
    const sql005 = readFileSync(migration005Path, 'utf-8')
    console.log('⚙️  Executing migration 005...')
    await db.query(sql005)
    console.log('✅ Migration 005 completed')

    // Run migration 006
    const migration006Path = join(__dirname, '006_fix_free_credits_to_2.sql')
    console.log(`📄 Reading migration file: ${migration006Path}`)
    const sql006 = readFileSync(migration006Path, 'utf-8')
    console.log('⚙️  Executing migration 006...')
    await db.query(sql006)
    console.log('✅ Migration 006 completed')

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

