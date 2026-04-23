/**
 * Script to help push Supabase migrations
 * This script provides instructions and can verify migration status
 */

import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')
const migrationsDir = join(projectRoot, 'supabase', 'migrations')

console.log('📦 Supabase Migration Pusher\n')
console.log('This script helps you push all Supabase migrations.\n')

// Get all migration files
const migrationFiles = readdirSync(migrationsDir)
  .filter(file => file.endsWith('.sql'))
  .sort()

console.log(`Found ${migrationFiles.length} migration files:\n`)

// Group migrations by type
const coreMigrations = []
const featureMigrations = []
const fixMigrations = []
const otherMigrations = []

migrationFiles.forEach(file => {
  if (file.includes('add-') && !file.includes('fix-')) {
    if (file.includes('email') || file.includes('workflow') || file.includes('analytics') || file.includes('campaign')) {
      featureMigrations.push(file)
    } else {
      coreMigrations.push(file)
    }
  } else if (file.includes('fix-')) {
    fixMigrations.push(file)
  } else {
    otherMigrations.push(file)
  }
})

console.log('📋 Migration Files by Category:\n')

if (coreMigrations.length > 0) {
  console.log('Core Migrations:')
  coreMigrations.forEach(file => console.log(`  - ${file}`))
  console.log()
}

if (featureMigrations.length > 0) {
  console.log('Feature Migrations:')
  featureMigrations.forEach(file => console.log(`  - ${file}`))
  console.log()
}

if (fixMigrations.length > 0) {
  console.log('Fix Migrations:')
  fixMigrations.forEach(file => console.log(`  - ${file}`))
  console.log()
}

if (otherMigrations.length > 0) {
  console.log('Other Migrations:')
  otherMigrations.forEach(file => console.log(`  - ${file}`))
  console.log()
}

console.log('\n🚀 How to Push Migrations:\n')
console.log('Option 1: Using Supabase Dashboard (Recommended)\n')
console.log('1. Go to: https://app.supabase.com')
console.log('2. Select your project')
console.log('3. Go to SQL Editor')
console.log('4. Copy and paste each migration file content')
console.log('5. Run them in order (check file names for chronological order)\n')

console.log('Option 2: Install Supabase CLI\n')
console.log('Windows (PowerShell):')
console.log('  winget install Supabase.CLI')
console.log('  # Or using npm:')
console.log('  npm install -g supabase\n')

console.log('Then run:')
console.log('  supabase login')
console.log('  supabase link --project-ref your-project-ref')
console.log('  supabase db push\n')

console.log('Option 3: Using psql (PostgreSQL client)\n')
console.log('1. Get your database connection string from Supabase Dashboard')
console.log('2. Run: psql "your-connection-string"')
console.log('3. Execute each migration file:\n')
console.log('   \\i supabase/migrations/filename.sql\n')

console.log('\n⚠️  Important Notes:\n')
console.log('- Always backup your database before applying migrations')
console.log('- Test migrations in a development environment first')
console.log('- Apply migrations in order (check file timestamps)')
console.log('- Some migrations depend on others - check dependencies')
console.log('- Verify each migration completes successfully\n')

console.log('✅ After pushing migrations, verify:')
console.log('1. All tables exist')
console.log('2. All functions are created')
console.log('3. RLS policies are enabled')
console.log('4. Indexes are created')
console.log('5. No errors in Supabase logs\n')



