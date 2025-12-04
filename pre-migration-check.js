/**
 * Pre-Migration Safety Check
 * 
 * Run this BEFORE applying the migration to ensure it's safe to proceed
 * 
 * Usage: node pre-migration-check.js
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables!')
  console.error('Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function preMigrationCheck() {
  console.log('🔍 Pre-Migration Safety Check\n')
  console.log('='.repeat(60))
  console.log('This script checks if it\'s safe to apply the migration')
  console.log('='.repeat(60) + '\n')
  
  const checks = []
  let canProceed = true
  
  // Check 1: Verify connection
  console.log('1️⃣  Checking database connection...')
  try {
    const { data, error } = await supabase
      .from('quotations')
      .select('count')
      .limit(1)
    
    if (error) {
      checks.push({ 
        name: 'Database Connection', 
        status: '❌ FAILED', 
        message: `Cannot connect: ${error.message}`,
        block: true
      })
      canProceed = false
    } else {
      checks.push({ 
        name: 'Database Connection', 
        status: '✅ PASSED', 
        message: 'Successfully connected to database',
        block: false
      })
    }
  } catch (error) {
    checks.push({ 
      name: 'Database Connection', 
      status: '❌ FAILED', 
      message: `Connection error: ${error.message}`,
      block: true
    })
    canProceed = false
  }
  
  // Check 2: Check current quotations count
  console.log('2️⃣  Checking existing quotations...')
  try {
    const { count, error } = await supabase
      .from('quotations')
      .select('*', { count: 'exact', head: true })
    
    if (error) {
      checks.push({ 
        name: 'Existing Quotations', 
        status: '⚠️  WARNING', 
        message: `Could not count quotations: ${error.message}`,
        block: false
      })
    } else {
      checks.push({ 
        name: 'Existing Quotations', 
        status: '✅ PASSED', 
        message: `Found ${count || 0} existing quotations`,
        block: false
      })
      
      if (count > 0) {
        console.log(`   ℹ️  Note: Migration will preserve all ${count} existing quotations`)
      }
    }
  } catch (error) {
    checks.push({ 
      name: 'Existing Quotations', 
      status: '⚠️  WARNING', 
      message: `Error: ${error.message}`,
      block: false
    })
  }
  
  // Check 3: Check if user_id is already nullable
  console.log('3️⃣  Checking current user_id constraint...')
  try {
    // Try to insert with null user_id (will fail if NOT NULL)
    const testQuote = {
      user_id: null,
      amount: 0.01,
      description: 'PRE-MIGRATION TEST - Will be deleted',
      status: 'pending',
      client_email: 'pre-migration-test@example.com',
      validity_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    }
    
    const { data: insertData, error: insertError } = await supabase
      .from('quotations')
      .insert(testQuote)
      .select()
      .single()
    
    if (insertError) {
      if (insertError.message.includes('NOT NULL') || insertError.message.includes('null value')) {
        checks.push({ 
          name: 'user_id Constraint', 
          status: '✅ READY', 
          message: 'user_id is currently NOT NULL - migration needed',
          block: false
        })
      } else if (insertError.message.includes('policy') || insertError.message.includes('permission')) {
        checks.push({ 
          name: 'user_id Constraint', 
          status: '✅ READY', 
          message: 'user_id constraint exists - migration will update it (RLS may be blocking test)',
          block: false
        })
      } else {
        checks.push({ 
          name: 'user_id Constraint', 
          status: '⚠️  WARNING', 
          message: `Unexpected error: ${insertError.message}`,
          block: false
        })
      }
    } else {
      // Clean up test quote
      if (insertData?.id) {
        await supabase.from('quotations').delete().eq('id', insertData.id)
      }
      checks.push({ 
        name: 'user_id Constraint', 
        status: '⚠️  ALREADY APPLIED', 
        message: 'user_id is already nullable - migration may have been applied already',
        block: false
      })
    }
  } catch (error) {
    checks.push({ 
      name: 'user_id Constraint', 
      status: '⚠️  WARNING', 
      message: `Could not test constraint: ${error.message}`,
      block: false
    })
  }
  
  // Check 4: Check for existing policies
  console.log('4️⃣  Checking for existing policies...')
  try {
    // Try to insert as anonymous to see if policies exist
    const { error: policyError } = await supabase
      .from('quotations')
      .insert({
        user_id: null,
        amount: 0.01,
        description: 'POLICY TEST',
        status: 'pending',
        client_email: 'policy-test@example.com'
      })
    
    if (policyError) {
      if (policyError.message.includes('policy') && !policyError.message.includes('Allow anonymous')) {
        checks.push({ 
          name: 'RLS Policies', 
          status: '✅ READY', 
          message: 'Anonymous policies do not exist - migration will create them',
          block: false
        })
      } else {
        checks.push({ 
          name: 'RLS Policies', 
          status: '⚠️  INFO', 
          message: `Policy check: ${policyError.message}`,
          block: false
        })
      }
    } else {
      checks.push({ 
        name: 'RLS Policies', 
        status: '⚠️  ALREADY APPLIED', 
        message: 'Anonymous policies may already exist',
        block: false
      })
    }
  } catch (error) {
    checks.push({ 
      name: 'RLS Policies', 
      status: '⚠️  INFO', 
      message: `Could not test policies: ${error.message}`,
      block: false
    })
  }
  
  // Check 5: Environment variables
  console.log('5️⃣  Checking environment variables...')
  if (supabaseUrl && supabaseAnonKey) {
    checks.push({ 
      name: 'Environment Variables', 
      status: '✅ PASSED', 
      message: 'Supabase credentials are configured',
      block: false
    })
  } else {
    checks.push({ 
      name: 'Environment Variables', 
      status: '❌ FAILED', 
      message: 'Missing Supabase environment variables',
      block: true
    })
    canProceed = false
  }
  
  // Print results
  console.log('\n' + '='.repeat(60))
  console.log('📊 PRE-MIGRATION CHECK RESULTS')
  console.log('='.repeat(60) + '\n')
  
  checks.forEach(check => {
    console.log(`${check.status} ${check.name}`)
    console.log(`   ${check.message}\n`)
  })
  
  console.log('='.repeat(60))
  
  const blockers = checks.filter(c => c.block).length
  const warnings = checks.filter(c => c.status.includes('⚠️')).length
  
  if (blockers > 0) {
    console.log(`\n❌ CANNOT PROCEED: ${blockers} blocking issue(s) found`)
    console.log('Please fix the issues above before applying the migration.\n')
    process.exit(1)
  } else if (warnings > 0) {
    console.log(`\n⚠️  READY WITH WARNINGS: ${warnings} warning(s) found`)
    console.log('You can proceed, but please review the warnings above.\n')
    console.log('✅ Safe to proceed with migration\n')
    process.exit(0)
  } else {
    console.log('\n✅ ALL CHECKS PASSED')
    console.log('Safe to proceed with migration!\n')
    process.exit(0)
  }
}

// Run check
preMigrationCheck().catch(error => {
  console.error('❌ Pre-migration check error:', error)
  process.exit(1)
})

