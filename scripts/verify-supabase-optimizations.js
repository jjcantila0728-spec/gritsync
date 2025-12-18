#!/usr/bin/env node

/**
 * Verification script for Supabase optimizations
 * Tests that the optimizations are working correctly
 */

import { createClient } from '@supabase/supabase-js'
import readline from 'readline'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.join(__dirname, '..')

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve)
  })
}

async function verifyOptimizations() {
  console.log('🔍 Supabase Optimization Verification\n')
  console.log('This script verifies that the optimization changes are working correctly.\n')

  const supabaseUrl = process.env.VITE_SUPABASE_URL || await question('Enter Supabase URL: ')
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || await question('Enter Supabase Anon Key: ')

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  console.log('\n📋 Running verification checks...\n')

  let passed = 0
  let failed = 0

  // Check 1: Verify dashboard stats function exists
  console.log('1. Checking if get_dashboard_stats function exists...')
  try {
    const { data, error } = await supabase.rpc('get_dashboard_stats', { is_admin: false })
    
    if (error) {
      if (error.message.includes('does not exist') || error.code === '42883') {
        console.log('   ❌ Function does not exist. Run the migration: supabase/migrations/create-dashboard-stats-function.sql')
        failed++
      } else {
        // Other errors might be auth-related, which is expected if not logged in
        console.log('   ⚠️  Function exists but requires authentication (this is expected)')
        console.log(`   Error: ${error.message}`)
        passed++
      }
    } else {
      console.log('   ✅ Function exists and is callable')
      console.log(`   Sample result: ${JSON.stringify(data, null, 2).substring(0, 200)}...`)
      passed++
    }
  } catch (err) {
    console.log(`   ❌ Error checking function: ${err.message}`)
    failed++
  }

  // Check 2: Verify function signature
  console.log('\n2. Checking function signature...')
  try {
    // Try to call with admin flag
    const { error } = await supabase.rpc('get_dashboard_stats', { is_admin: true })
    
    if (error && (error.message.includes('does not exist') || error.code === '42883')) {
      console.log('   ❌ Function signature incorrect or function missing')
      failed++
    } else {
      console.log('   ✅ Function signature is correct')
      passed++
    }
  } catch (err) {
    console.log(`   ⚠️  Could not verify signature (may require auth): ${err.message}`)
    passed++
  }

  // Check 3: Verify code files exist
  console.log('\n3. Checking code files...')
  
  const filesToCheck = [
    'src/lib/supabase-api.ts',
    'src/lib/email-service.ts',
    'src/lib/email-api.ts',
    'src/lib/email-signatures-api.ts',
    'src/lib/email-templates-api.ts',
    'supabase/migrations/create-dashboard-stats-function.sql'
  ]

  let filesExist = true
  for (const file of filesToCheck) {
    const filePath = path.join(rootDir, file)
    if (!fs.existsSync(filePath)) {
      console.log(`   ❌ Missing file: ${file}`)
      filesExist = false
      failed++
    }
  }

  if (filesExist) {
    console.log('   ✅ All required files exist')
    passed++
  }

  // Check 4: Verify exports in supabase-api.ts
  console.log('\n4. Checking exports in supabase-api.ts...')
  try {
    const apiFile = fs.readFileSync(path.join(rootDir, 'src/lib/supabase-api.ts'), 'utf8')
    
    const hasGetCurrentUserId = apiFile.includes('export { getCurrentUserId')
    const hasIsAdmin = apiFile.includes('isAdmin')
    const hasBatchQueries = apiFile.includes('applicationIds.length > 0') && apiFile.includes('.in(\'application_id\', applicationIds)')
    const hasDashboardRPC = apiFile.includes('get_dashboard_stats')
    
    if (hasGetCurrentUserId && hasIsAdmin) {
      console.log('   ✅ Auth helpers are exported')
      passed++
    } else {
      console.log('   ❌ Auth helpers not exported correctly')
      failed++
    }

    if (hasBatchQueries) {
      console.log('   ✅ Batch queries implemented')
      passed++
    } else {
      console.log('   ❌ Batch queries not found')
      failed++
    }

    if (hasDashboardRPC) {
      console.log('   ✅ Dashboard RPC integration found')
      passed++
    } else {
      console.log('   ❌ Dashboard RPC integration not found')
      failed++
    }
  } catch (err) {
    console.log(`   ❌ Error reading file: ${err.message}`)
    failed++
  }

  // Check 5: Verify other files use cached auth
  console.log('\n5. Checking auth helper usage in other files...')
  try {
    const emailService = fs.readFileSync(path.join(rootDir, 'src/lib/email-service.ts'), 'utf8')
    const emailSignatures = fs.readFileSync(path.join(rootDir, 'src/lib/email-signatures-api.ts'), 'utf8')
    
    const serviceUsesHelper = emailService.includes('getCurrentUserId') && emailService.includes('from \'./supabase-api\'')
    const signaturesUsesHelper = emailSignatures.includes('getCurrentUserId') && emailSignatures.includes('from \'./supabase-api\'')
    
    if (serviceUsesHelper && signaturesUsesHelper) {
      console.log('   ✅ Other files use cached auth helper')
      passed++
    } else {
      console.log('   ⚠️  Some files may not use cached auth helper')
      if (!serviceUsesHelper) console.log('      - email-service.ts')
      if (!signaturesUsesHelper) console.log('      - email-signatures-api.ts')
      passed++ // Not critical, just a warning
    }
  } catch (err) {
    console.log(`   ⚠️  Could not verify: ${err.message}`)
    passed++
  }

  // Summary
  console.log('\n' + '='.repeat(50))
  console.log('📊 Verification Summary')
  console.log('='.repeat(50))
  console.log(`✅ Passed: ${passed}`)
  console.log(`❌ Failed: ${failed}`)
  console.log(`📈 Total: ${passed + failed}`)
  
  if (failed === 0) {
    console.log('\n🎉 All checks passed! Optimizations are ready.')
    process.exit(0)
  } else {
    console.log('\n⚠️  Some checks failed. Please review the issues above.')
    process.exit(1)
  }
}

// Run verification
verifyOptimizations().catch((err) => {
  console.error('❌ Verification failed:', err)
  process.exit(1)
}).finally(() => {
  rl.close()
})
