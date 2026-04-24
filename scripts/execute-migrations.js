/**
 * Execute Supabase Migrations via Management API
 * This script attempts to push all migrations to Supabase
 */

import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')
const migrationsDir = join(projectRoot, 'supabase', 'migrations')

// Load environment variables
dotenv.config({ path: join(projectRoot, '.env.local') })
dotenv.config({ path: join(projectRoot, '.env') })

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing Supabase credentials')
  console.error('Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env file')
  process.exit(1)
}

// Extract project ref from URL
const projectRef = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1]

if (!projectRef) {
  console.error('❌ Error: Could not extract project ref from Supabase URL')
  process.exit(1)
}

console.log(`📦 Project: ${projectRef}`)
console.log(`🔗 URL: ${supabaseUrl}\n`)

// Get migration files in order
function getMigrationFiles() {
  return readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort()
    .map(file => ({
      name: file,
      path: join(migrationsDir, file),
      content: readFileSync(join(migrationsDir, file), 'utf-8')
    }))
}

// Execute SQL via Supabase Management API
async function executeSQL(sql, migrationName) {
  try {
    // Use Supabase Management API
    const managementApiUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`
    
    const response = await fetch(managementApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey
      },
      body: JSON.stringify({
        query: sql
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    const result = await response.json()
    return { success: true, result }
  } catch (error) {
    // Management API might not be available, try alternative method
    console.warn(`⚠️  Management API failed for ${migrationName}:`, error.message)
    
    // Alternative: Use Supabase REST API with service role
    try {
      const restApiUrl = `${supabaseUrl}/rest/v1/rpc/exec_sql`
      
      const response = await fetch(restApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey
        },
        body: JSON.stringify({ sql })
      })

      if (response.ok) {
        return { success: true, result: await response.json() }
      }
    } catch (e) {
      // Both methods failed
    }

    return { success: false, error: error.message }
  }
}

// Main execution function
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

  const executionOrder = [
    ...featureMigrations,
    ...coreMigrations,
    ...fixMigrations,
    ...verifyMigrations
  ]

  console.log('📋 Execution Order:\n')
  executionOrder.forEach((m, i) => {
    console.log(`${i + 1}. ${m.name}`)
  })
  console.log()

  // Ask for confirmation
  console.log('⚠️  WARNING: This will execute all migrations on your Supabase database!')
  console.log('⚠️  Make sure you have backed up your database.\n')
  
  // Execute migrations
  const results = []
  let successCount = 0
  let failCount = 0

  for (let i = 0; i < executionOrder.length; i++) {
    const migration = executionOrder[i]
    console.log(`\n[${i + 1}/${executionOrder.length}] Executing: ${migration.name}`)
    
    try {
      const result = await executeSQL(migration.content, migration.name)
      
      if (result.success) {
        console.log(`✅ Success: ${migration.name}`)
        successCount++
        results.push({ migration: migration.name, status: 'success' })
      } else {
        console.log(`❌ Failed: ${migration.name}`)
        console.log(`   Error: ${result.error}`)
        failCount++
        results.push({ migration: migration.name, status: 'failed', error: result.error })
      }
    } catch (error) {
      console.log(`❌ Error: ${migration.name}`)
      console.log(`   ${error.message}`)
      failCount++
      results.push({ migration: migration.name, status: 'error', error: error.message })
    }

    // Small delay between migrations
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  // Summary
  console.log('\n' + '='.repeat(50))
  console.log('📊 Execution Summary')
  console.log('='.repeat(50))
  console.log(`✅ Successful: ${successCount}`)
  console.log(`❌ Failed: ${failCount}`)
  console.log(`📝 Total: ${executionOrder.length}\n`)

  if (failCount > 0) {
    console.log('❌ Failed Migrations:')
    results
      .filter(r => r.status !== 'success')
      .forEach(r => {
        console.log(`   - ${r.migration}`)
        if (r.error) console.log(`     Error: ${r.error}`)
      })
    console.log()
  }

  // Note about manual execution
  if (failCount > 0 || successCount === 0) {
    console.log('⚠️  Some migrations failed or could not be executed automatically.')
    console.log('📝 Please execute them manually via Supabase Dashboard:\n')
    console.log('1. Go to: https://app.supabase.com')
    console.log('2. Select your project')
    console.log('3. Go to SQL Editor')
    console.log('4. Copy and paste each migration file content')
    console.log('5. Run them one by one\n')
    
    if (failCount > 0) {
      console.log('Failed migrations to execute manually:')
      results
        .filter(r => r.status !== 'success')
        .forEach(r => console.log(`   - ${r.migration}`))
    }
  } else {
    console.log('✅ All migrations executed successfully!')
  }
}

// Run the script
pushMigrations().catch(error => {
  console.error('❌ Fatal error:', error)
  process.exit(1)
})



