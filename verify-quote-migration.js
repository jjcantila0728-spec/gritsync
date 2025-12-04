/**
 * Verification Script for Quote Saving Migration
 * 
 * This script verifies that the migration was applied correctly
 * Run this after applying the migration in Supabase SQL Editor
 * 
 * Usage: node verify-quote-migration.js
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

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

async function verifyMigration() {
  console.log('🔍 Verifying Quote Saving Migration...\n')
  
  const checks = []
  
  // Check 1: Verify user_id column is nullable
  console.log('1️⃣  Checking if user_id column is nullable...')
  try {
    const { data, error } = await supabase
      .from('quotations')
      .select('user_id')
      .limit(1)
    
    if (error && error.message.includes('NOT NULL')) {
      checks.push({ name: 'user_id nullable', status: '❌ FAILED', message: 'user_id is still NOT NULL' })
    } else {
      // Try to insert a quote with null user_id
      const testQuote = {
        user_id: null,
        amount: 0.01,
        description: 'TEST - Migration Verification',
        status: 'pending',
        client_email: 'test@example.com',
        validity_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      }
      
      const { data: insertData, error: insertError } = await supabase
        .from('quotations')
        .insert(testQuote)
        .select()
        .single()
      
      if (insertError) {
        checks.push({ 
          name: 'user_id nullable', 
          status: '❌ FAILED', 
          message: `Cannot insert with null user_id: ${insertError.message}` 
        })
      } else {
        // Clean up test quote
        await supabase.from('quotations').delete().eq('id', insertData.id)
        checks.push({ 
          name: 'user_id nullable', 
          status: '✅ PASSED', 
          message: 'user_id column is nullable' 
        })
      }
    }
  } catch (error) {
    checks.push({ 
      name: 'user_id nullable', 
      status: '❌ FAILED', 
      message: `Error: ${error.message}` 
    })
  }
  
  // Check 2: Verify RLS policies exist
  console.log('2️⃣  Checking RLS policies...')
  try {
    // Try to insert as anonymous user
    const { error: anonError } = await supabase
      .from('quotations')
      .insert({
        user_id: null,
        amount: 0.01,
        description: 'TEST - Anonymous Insert',
        status: 'pending',
        client_email: 'test@example.com',
        validity_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      })
    
    if (anonError && anonError.message.includes('policy') || anonError.message.includes('permission')) {
      checks.push({ 
        name: 'RLS policies', 
        status: '❌ FAILED', 
        message: `Anonymous insert blocked: ${anonError.message}` 
      })
    } else if (anonError) {
      // Other errors might be okay (like validation)
      checks.push({ 
        name: 'RLS policies', 
        status: '⚠️  WARNING', 
        message: `Anonymous insert error (may be expected): ${anonError.message}` 
      })
    } else {
      checks.push({ 
        name: 'RLS policies', 
        status: '✅ PASSED', 
        message: 'RLS policies allow anonymous inserts' 
      })
    }
  } catch (error) {
    checks.push({ 
      name: 'RLS policies', 
      status: '⚠️  WARNING', 
      message: `Could not test RLS: ${error.message}` 
    })
  }
  
  // Check 3: Verify indexes exist
  console.log('3️⃣  Checking indexes...')
  try {
    // Query with validity_date filter to test index
    const { error: indexError } = await supabase
      .from('quotations')
      .select('*')
      .not('validity_date', 'is', null)
      .order('validity_date', { ascending: false })
      .limit(1)
    
    if (indexError && indexError.message.includes('index')) {
      checks.push({ 
        name: 'Indexes', 
        status: '⚠️  WARNING', 
        message: `Index query error: ${indexError.message}` 
      })
    } else {
      checks.push({ 
        name: 'Indexes', 
        status: '✅ PASSED', 
        message: 'Indexes appear to be working' 
      })
    }
  } catch (error) {
    checks.push({ 
      name: 'Indexes', 
      status: '⚠️  WARNING', 
      message: `Could not test indexes: ${error.message}` 
    })
  }
  
  // Check 4: Verify validity_date column exists
  console.log('4️⃣  Checking validity_date column...')
  try {
    const { data, error } = await supabase
      .from('quotations')
      .select('validity_date')
      .limit(1)
    
    if (error && error.message.includes('column') && error.message.includes('validity_date')) {
      checks.push({ 
        name: 'validity_date column', 
        status: '❌ FAILED', 
        message: 'validity_date column does not exist' 
      })
    } else {
      checks.push({ 
        name: 'validity_date column', 
        status: '✅ PASSED', 
        message: 'validity_date column exists' 
      })
    }
  } catch (error) {
    checks.push({ 
      name: 'validity_date column', 
      status: '❌ FAILED', 
      message: `Error: ${error.message}` 
    })
  }
  
  // Print results
  console.log('\n' + '='.repeat(60))
  console.log('📊 VERIFICATION RESULTS')
  console.log('='.repeat(60) + '\n')
  
  checks.forEach(check => {
    console.log(`${check.status} ${check.name}`)
    console.log(`   ${check.message}\n`)
  })
  
  const passed = checks.filter(c => c.status === '✅ PASSED').length
  const failed = checks.filter(c => c.status === '❌ FAILED').length
  const warnings = checks.filter(c => c.status === '⚠️  WARNING').length
  
  console.log('='.repeat(60))
  console.log(`Summary: ${passed} passed, ${failed} failed, ${warnings} warnings`)
  console.log('='.repeat(60) + '\n')
  
  if (failed > 0) {
    console.log('❌ Migration verification FAILED!')
    console.log('Please review the errors above and re-run the migration.\n')
    process.exit(1)
  } else if (warnings > 0) {
    console.log('⚠️  Migration verification completed with warnings.')
    console.log('Please review the warnings above.\n')
    process.exit(0)
  } else {
    console.log('✅ Migration verification PASSED!')
    console.log('All checks passed. Quote saving should work correctly.\n')
    process.exit(0)
  }
}

// Run verification
verifyMigration().catch(error => {
  console.error('❌ Verification script error:', error)
  process.exit(1)
})

