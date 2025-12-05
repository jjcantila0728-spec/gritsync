// Script to run the sessions table migration
import 'dotenv/config'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { getSupabaseAdmin } from '../server/db/supabase.js'
import { logger } from '../server/utils/logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function runMigration() {
  try {
    logger.info('Starting sessions table migration...')
    
    // Read the migration file
    const migrationPath = join(__dirname, '..', 'supabase', 'migrations', 'add_sessions_table.sql')
    const migrationSQL = readFileSync(migrationPath, 'utf-8')
    
    // Get Supabase admin client
    const supabase = getSupabaseAdmin()
    
    // Split SQL into individual statements (basic approach)
    // Note: In production, you'd want a more robust SQL parser
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))
    
    logger.info(`Executing ${statements.length} SQL statements...`)
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      
      // Skip empty statements and comments
      if (!statement || statement.startsWith('--')) {
        continue
      }
      
      try {
        // Use RPC for functions, direct query for DDL
        if (statement.includes('CREATE OR REPLACE FUNCTION')) {
          // For functions, we need to execute them differently
          const { error } = await supabase.rpc('exec_sql', { sql: statement })
          if (error) {
            // Try direct query instead
            const { error: queryError } = await supabase
              .from('_exec_sql')
              .select('*')
              .limit(0)
            
            // If that doesn't work, log and continue
            logger.warn(`Could not execute function statement ${i + 1}, may need manual execution`)
            continue
          }
        } else {
          // For DDL statements, we'll use a different approach
          // Supabase doesn't support DDL via client, so we'll log instructions
          logger.info(`Statement ${i + 1}: ${statement.substring(0, 50)}...`)
        }
      } catch (error) {
        logger.warn(`Error executing statement ${i + 1}:`, error.message)
      }
    }
    
    logger.info('⚠️  Note: Supabase client cannot execute DDL statements directly.')
    logger.info('Please run the migration using one of these methods:')
    logger.info('1. Supabase Dashboard: SQL Editor → Run the migration file')
    logger.info('2. Supabase CLI: supabase db push')
    logger.info('3. psql: Connect to your database and run the SQL file')
    
    // Verify the table exists
    const { data, error } = await supabase
      .from('sessions')
      .select('id')
      .limit(1)
    
    if (error) {
      if (error.code === '42P01') {
        logger.warn('Sessions table does not exist yet. Please run the migration manually.')
      } else {
        logger.error('Error checking sessions table:', error)
      }
    } else {
      logger.info('✅ Sessions table exists!')
    }
    
    logger.info('Migration script completed.')
    
  } catch (error) {
    logger.error('Migration failed:', error)
    process.exit(1)
  }
}

runMigration()
