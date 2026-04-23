/**
 * Script to push all Supabase migrations
 * Uses Supabase Management API to execute migrations
 */

import { readFileSync, readdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')
const migrationsDir = join(projectRoot, 'supabase', 'migrations')

// Load environment variables
dotenv.config({ path: join(projectRoot, '.env.local') })
dotenv.config({ path: join(projectRoot, '.env') })

// Get Supabase credentials
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing Supabase credentials')
  console.error('Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env file')
  process.exit(1)
}

// Create Supabase admin client
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Get all migration files in order
function getMigrationFiles() {
  const files = readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort() // Sort alphabetically (should match chronological order)
  
  return files.map(file => ({
    name: file,
    path: join(migrationsDir, file),
    content: readFileSync(join(migrationsDir, file), 'utf-8')
  }))
}

// Execute SQL using Supabase RPC (if exec_sql function exists)
async function executeSQL(sql) {
  try {
    // Try using RPC if exec_sql function exists
    const { data, error } = await supabase.rpc('exec_sql', { sql })
    if (!error) {
      return { success: true, data }
    }
  } catch (e) {
    // RPC not available, will use direct query
  }

  // Fallback: Use Supabase Management API via REST
  // Note: Supabase client doesn't support DDL directly
  // We'll need to use the REST API or provide instructions
  console.warn('⚠️  Direct SQL execution not available via client')
  return { success: false, error: 'DDL not supported via client' }
}

// Main function
async function pushMigrations() {
  console.log('🚀 Starting Supabase Migration Push\n')
  
  const migrations = getMigrationFiles()
  console.log(`Found ${migrations.length} migration files\n`)

  // Group migrations
  const featureMigrations = migrations.filter(m => 
    m.name.includes('email') || 
    m.name.includes('workflow') || 
    m.name.includes('analytics') || 
    m.name.includes('campaign')
  )

  const coreMigrations = migrations.filter(m => 
    !m.name.includes('fix-') && 
    !m.name.includes('verify-') &&
    !featureMigrations.includes(m)
  )

  const fixMigrations = migrations.filter(m => m.name.includes('fix-'))
  const verifyMigrations = migrations.filter(m => m.name.includes('verify-'))

  console.log('📋 Migration Plan:\n')
  console.log(`1. Feature Migrations: ${featureMigrations.length} files`)
  console.log(`2. Core Migrations: ${coreMigrations.length} files`)
  console.log(`3. Fix Migrations: ${fixMigrations.length} files`)
  console.log(`4. Verification: ${verifyMigrations.length} files\n`)

  // Since Supabase client doesn't support DDL, we'll create a combined SQL file
  console.log('📝 Creating combined migration file...\n')
  
  const combinedSQL = [
    '-- Combined Supabase Migrations',
    '-- Generated automatically',
    `-- Date: ${new Date().toISOString()}`,
    '--',
    '-- IMPORTANT: Review this file before executing!',
    '--',
    ''
  ]

  // Add feature migrations
  combinedSQL.push('-- ============================================')
  combinedSQL.push('-- FEATURE MIGRATIONS')
  combinedSQL.push('-- ============================================\n')
  featureMigrations.forEach(m => {
    combinedSQL.push(`-- Migration: ${m.name}`)
    combinedSQL.push(m.content)
    combinedSQL.push('\n-- ============================================\n')
  })

  // Add core migrations
  combinedSQL.push('-- ============================================')
  combinedSQL.push('-- CORE MIGRATIONS')
  combinedSQL.push('-- ============================================\n')
  coreMigrations.forEach(m => {
    combinedSQL.push(`-- Migration: ${m.name}`)
    combinedSQL.push(m.content)
    combinedSQL.push('\n-- ============================================\n')
  })

  // Add fix migrations
  combinedSQL.push('-- ============================================')
  combinedSQL.push('-- FIX MIGRATIONS')
  combinedSQL.push('-- ============================================\n')
  fixMigrations.forEach(m => {
    combinedSQL.push(`-- Migration: ${m.name}`)
    combinedSQL.push(m.content)
    combinedSQL.push('\n-- ============================================\n')
  })

  // Write combined file
  const outputPath = join(projectRoot, 'supabase', 'all-migrations-combined.sql')
  writeFileSync(outputPath, combinedSQL.join('\n'))
  
  console.log(`✅ Created combined migration file: ${outputPath}\n`)
  console.log('📋 Next Steps:\n')
  console.log('1. Go to Supabase Dashboard: https://app.supabase.com')
  console.log('2. Select your project')
  console.log('3. Go to SQL Editor')
  console.log('4. Open the file: supabase/all-migrations-combined.sql')
  console.log('5. Copy and paste the entire content')
  console.log('6. Click "Run" to execute all migrations\n')
  
  console.log('⚠️  Important:')
  console.log('- Review the combined file before executing')
  console.log('- Backup your database first')
  console.log('- Execute in a test environment first if possible\n')

  // Try to use Supabase Management API
  console.log('🔄 Attempting to use Supabase Management API...\n')
  
  try {
    // Check if we can access the database
    const { data: tables, error } = await supabase
      .from('_migrations')
      .select('*')
      .limit(1)
    
    if (error && error.code === '42P01') {
      console.log('ℹ️  Migrations table does not exist (this is normal for new projects)\n')
    }

    // Since DDL operations aren't supported via the client,
    // we'll provide instructions for manual execution
    console.log('📝 Manual Execution Required:\n')
    console.log('The Supabase JavaScript client does not support DDL operations.')
    console.log('Please use one of these methods:\n')
    console.log('Method 1: Supabase Dashboard (Easiest)')
    console.log('  - Use the combined SQL file created above\n')
    console.log('Method 2: Supabase CLI')
    console.log('  - Install: npm install -g supabase')
    console.log('  - Run: supabase db push\n')
    console.log('Method 3: Direct PostgreSQL Connection')
    console.log('  - Use psql with your connection string\n')

  } catch (error) {
    console.error('Error:', error.message)
  }
}

// Run the script
pushMigrations().catch(console.error)

