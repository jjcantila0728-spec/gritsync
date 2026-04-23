/**
 * Automated Migration Pusher
 * Uses Supabase CLI via npx to push migrations
 */

import { execSync } from 'child_process'
import { readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')
const migrationsDir = join(projectRoot, 'supabase', 'migrations')

console.log('🚀 Automated Supabase Migration Pusher\n')

// Check if Supabase CLI is available
try {
  const version = execSync('npx --yes supabase --version', { encoding: 'utf-8' }).trim()
  console.log(`✅ Supabase CLI available: ${version}\n`)
} catch (error) {
  console.error('❌ Supabase CLI not available')
  console.error('Please install: npm install -g supabase')
  process.exit(1)
}

// Get project ref from environment or use default
const projectRef = process.env.SUPABASE_PROJECT_REF || 'warfdcbvnapietbkpild'

console.log(`📦 Project: ${projectRef}\n`)

// Step 1: Link project (if not already linked)
console.log('🔗 Step 1: Linking project...')
try {
  execSync(`npx --yes supabase link --project-ref ${projectRef}`, {
    cwd: projectRoot,
    stdio: 'inherit'
  })
  console.log('✅ Project linked\n')
} catch (error) {
  console.log('⚠️  Project may already be linked, continuing...\n')
}

// Step 2: Push migrations
console.log('📤 Step 2: Pushing migrations...')
try {
  execSync('npx --yes supabase db push', {
    cwd: projectRoot,
    stdio: 'inherit'
  })
  console.log('\n✅ All migrations pushed successfully!')
} catch (error) {
  console.error('\n❌ Migration push failed')
  console.error('Error:', error.message)
  console.log('\n📝 Alternative: Use Supabase Dashboard')
  console.log('1. Go to: https://app.supabase.com/project/' + projectRef + '/sql/new')
  console.log('2. Open: supabase/all-migrations-combined.sql')
  console.log('3. Copy and paste the entire content')
  console.log('4. Click "Run"')
  process.exit(1)
}



