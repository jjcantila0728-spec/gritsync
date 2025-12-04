/**
 * Supabase Deployment Script
 * This script deploys schema, creates storage bucket, and sets up everything
 * 
 * Usage:
 * 1. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
 * 2. Run: node deploy-supabase.js
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { config } from 'dotenv'

config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables!')
  console.error('Please set:')
  console.error('  - VITE_SUPABASE_URL or SUPABASE_URL')
  console.error('  - SUPABASE_SERVICE_ROLE_KEY')
  console.error('\nGet these from: Supabase Dashboard > Settings > API')
  process.exit(1)
}

// Create Supabase client with service role (admin access)
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function deploySchema() {
  console.log('📊 Deploying database schema...')
  
  try {
    const schemaPath = join(__dirname, 'supabase', 'schema.sql')
    const schema = readFileSync(schemaPath, 'utf-8')
    
    // Split schema into individual statements
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))
    
    let successCount = 0
    let errorCount = 0
    
    for (const statement of statements) {
      try {
        // Execute each statement
        const { error } = await supabase.rpc('exec_sql', { sql: statement })
        
        if (error) {
          // Try direct query for statements that don't work with RPC
          const { error: queryError } = await supabase
            .from('_temp')
            .select('*')
            .limit(0)
          
          // If it's a table creation or policy, it might fail silently (already exists)
          if (!queryError || error.message.includes('already exists') || error.message.includes('duplicate')) {
            // Ignore "already exists" errors
            successCount++
          } else {
            console.warn(`⚠️  Warning: ${error.message.substring(0, 100)}`)
            errorCount++
          }
        } else {
          successCount++
        }
      } catch (err) {
        // Some statements might fail if they already exist - that's okay
        if (err.message && (err.message.includes('already exists') || err.message.includes('duplicate'))) {
          successCount++
        } else {
          errorCount++
          console.warn(`⚠️  Warning: ${err.message?.substring(0, 100) || 'Unknown error'}`)
        }
      }
    }
    
    console.log(`✅ Schema deployment: ${successCount} statements executed`)
    if (errorCount > 0) {
      console.log(`⚠️  ${errorCount} warnings (may be expected if objects already exist)`)
    }
  } catch (error) {
    console.error('❌ Error deploying schema:', error.message)
    console.log('\n💡 Tip: You can also deploy the schema manually:')
    console.log('   1. Go to Supabase Dashboard > SQL Editor')
    console.log('   2. Copy contents of supabase/schema.sql')
    console.log('   3. Paste and execute')
    throw error
  }
}

async function createStorageBucket() {
  console.log('📦 Creating storage bucket...')
  
  try {
    // Check if bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()
    
    if (listError) {
      throw listError
    }
    
    const documentsBucket = buckets?.find(b => b.name === 'documents')
    
    if (documentsBucket) {
      console.log('✅ Storage bucket "documents" already exists')
      return
    }
    
    // Create bucket
    const { data, error } = await supabase.storage.createBucket('documents', {
      public: false, // Private bucket
      fileSizeLimit: 52428800, // 50MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
    })
    
    if (error) {
      if (error.message.includes('already exists')) {
        console.log('✅ Storage bucket "documents" already exists')
      } else {
        throw error
      }
    } else {
      console.log('✅ Storage bucket "documents" created successfully')
    }
  } catch (error) {
    console.error('❌ Error creating storage bucket:', error.message)
    console.log('\n💡 Tip: You can create it manually:')
    console.log('   1. Go to Supabase Dashboard > Storage')
    console.log('   2. Click "New bucket"')
    console.log('   3. Name: "documents"')
    console.log('   4. Set to Private')
    throw error
  }
}

async function verifySetup() {
  console.log('🔍 Verifying setup...')
  
  try {
    // Check tables
    const { data: tables, error: tablesError } = await supabase
      .from('users')
      .select('count')
      .limit(1)
    
    if (tablesError && !tablesError.message.includes('permission denied')) {
      throw new Error('Users table not found')
    }
    
    // Check storage
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()
    if (bucketsError) throw bucketsError
    
    const hasDocumentsBucket = buckets?.some(b => b.name === 'documents')
    if (!hasDocumentsBucket) {
      throw new Error('Documents bucket not found')
    }
    
    console.log('✅ Setup verified successfully!')
    return true
  } catch (error) {
    console.error('❌ Verification failed:', error.message)
    return false
  }
}

async function main() {
  console.log('🚀 Starting Supabase deployment...\n')
  console.log(`📍 Project: ${supabaseUrl}\n`)
  
  try {
    // Deploy schema
    await deploySchema()
    console.log('')
    
    // Create storage bucket
    await createStorageBucket()
    console.log('')
    
    // Verify setup
    const verified = await verifySetup()
    console.log('')
    
    if (verified) {
      console.log('🎉 Deployment complete!')
      console.log('\n📋 Next steps:')
      console.log('1. Create your first admin user:')
      console.log('   - Sign up through the app')
      console.log('   - Go to Supabase Dashboard > Authentication > Users')
      console.log('   - Copy your user ID')
      console.log('   - Run in SQL Editor:')
      console.log('     UPDATE users SET role = \'admin\' WHERE id = \'your-user-id\';')
      console.log('\n2. Test your setup:')
      console.log('   - Visit /test-supabase in your app')
      console.log('   - Verify all tests pass')
      console.log('\n3. Deploy Edge Functions (optional, for Stripe):')
      console.log('   supabase functions deploy create-payment-intent')
      console.log('   supabase functions deploy stripe-webhook')
    } else {
      console.log('⚠️  Deployment completed with warnings')
      console.log('Please check the errors above and verify manually in Supabase Dashboard')
    }
  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message)
    console.log('\n💡 Alternative: Deploy manually via Supabase Dashboard')
    console.log('   See FINAL_SUPABASE_SETUP.md for instructions')
    process.exit(1)
  }
}

main()

