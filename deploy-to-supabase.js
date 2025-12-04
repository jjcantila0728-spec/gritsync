/**
 * Deploy to Supabase using Supabase JS Client
 * This script uses the Supabase Management API to deploy schema and create storage
 * 
 * Requirements:
 * 1. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
 * 2. Run: node deploy-to-supabase.js
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
  console.error('\nPlease add to your .env file:')
  console.error('  SUPABASE_URL=https://warfdcbvnapietbkpild.supabase.co')
  console.error('  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key')
  console.error('\nGet service role key from: Supabase Dashboard > Settings > API > service_role secret')
  process.exit(1)
}

// Create Supabase client with service role (full admin access)
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function deploySchema() {
  console.log('📊 Deploying database schema...')
  console.log('   This will create all tables, policies, triggers, and functions.\n')
  
  try {
    const schemaPath = join(__dirname, 'supabase', 'schema.sql')
    const schema = readFileSync(schemaPath, 'utf-8')
    
    // Use Supabase REST API to execute SQL
    // Note: We'll need to use the Management API or provide instructions for manual deployment
    console.log('⚠️  Schema deployment requires Supabase Dashboard access.')
    console.log('   Please deploy manually using the instructions below.\n')
    
    return false // Indicate manual deployment needed
  } catch (error) {
    console.error('❌ Error reading schema file:', error.message)
    throw error
  }
}

async function createStorageBucket() {
  console.log('📦 Creating storage bucket...')
  
  try {
    // Check if bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()
    
    if (listError) {
      console.error('❌ Error listing buckets:', listError.message)
      return false
    }
    
    const documentsBucket = buckets?.find(b => b.name === 'documents')
    
    if (documentsBucket) {
      console.log('✅ Storage bucket "documents" already exists')
      return true
    }
    
    // Create bucket using REST API
    const response = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey
      },
      body: JSON.stringify({
        name: 'documents',
        public: false,
        file_size_limit: 52428800, // 50MB
        allowed_mime_types: ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
      })
    })
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }))
      if (error.message?.includes('already exists')) {
        console.log('✅ Storage bucket "documents" already exists')
        return true
      }
      throw new Error(error.message || `HTTP ${response.status}`)
    }
    
    console.log('✅ Storage bucket "documents" created successfully')
    return true
  } catch (error) {
    console.error('❌ Error creating storage bucket:', error.message)
    console.log('\n💡 You can create it manually:')
    console.log('   1. Go to Supabase Dashboard > Storage')
    console.log('   2. Click "New bucket"')
    console.log('   3. Name: "documents", Private: true')
    return false
  }
}

async function verifySetup() {
  console.log('\n🔍 Verifying setup...')
  
  try {
    // Check if we can query users table
    const { error: usersError } = await supabase
      .from('users')
      .select('count')
      .limit(1)
    
    if (usersError && !usersError.message.includes('permission denied')) {
      console.log('⚠️  Users table may not exist yet')
      return false
    }
    
    // Check storage
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()
    if (bucketsError) {
      console.log('⚠️  Could not verify storage:', bucketsError.message)
      return false
    }
    
    const hasDocumentsBucket = buckets?.some(b => b.name === 'documents')
    if (!hasDocumentsBucket) {
      console.log('⚠️  Documents bucket not found')
      return false
    }
    
    console.log('✅ Basic setup verified')
    return true
  } catch (error) {
    console.log('⚠️  Verification incomplete:', error.message)
    return false
  }
}

async function main() {
  console.log('🚀 Supabase Deployment Script\n')
  console.log(`📍 Project: ${supabaseUrl}\n`)
  console.log('=' .repeat(60) + '\n')
  
  // Create storage bucket (this can be done via API)
  const storageSuccess = await createStorageBucket()
  console.log('')
  
  // Schema deployment instructions
  console.log('📋 SCHEMA DEPLOYMENT REQUIRED:')
  console.log('   The database schema must be deployed manually via Supabase Dashboard.\n')
  console.log('   Steps:')
  console.log('   1. Go to: https://supabase.com/dashboard/project/warfdcbvnapietbkpild/sql/new')
  console.log('   2. Open the file: supabase/schema.sql')
  console.log('   3. Copy the entire contents')
  console.log('   4. Paste into the SQL Editor')
  console.log('   5. Click "Run" (or press Ctrl+Enter)')
  console.log('   6. Wait for "Success" message\n')
  
  // Verify what we can
  const verified = await verifySetup()
  console.log('')
  
  console.log('=' .repeat(60))
  console.log('\n📝 DEPLOYMENT SUMMARY:\n')
  
  if (storageSuccess) {
    console.log('✅ Storage bucket created')
  } else {
    console.log('⚠️  Storage bucket - manual creation needed')
  }
  
  console.log('⚠️  Database schema - manual deployment needed (see above)')
  console.log('')
  
  console.log('📋 NEXT STEPS:\n')
  console.log('1. Deploy Schema:')
  console.log('   → Follow the instructions above to deploy schema.sql')
  console.log('')
  console.log('2. Create Admin User:')
  console.log('   → Sign up through your app')
  console.log('   → Go to Supabase Dashboard > Authentication > Users')
  console.log('   → Copy your User UID')
  console.log('   → Run in SQL Editor:')
  console.log('     UPDATE users SET role = \'admin\' WHERE id = \'your-uid\';')
  console.log('')
  console.log('3. Test Setup:')
  console.log('   → Visit: http://localhost:5173/test-supabase')
  console.log('   → Verify all tests pass')
  console.log('')
  console.log('4. Deploy Edge Functions (optional, for Stripe):')
  console.log('   → Install Supabase CLI: https://github.com/supabase/cli#install')
  console.log('   → Run: supabase functions deploy create-payment-intent')
  console.log('   → Run: supabase functions deploy stripe-webhook')
  console.log('')
  console.log('📄 For detailed instructions, see: deploy-supabase-manual.md')
  console.log('')
}

main().catch(error => {
  console.error('\n❌ Deployment script failed:', error.message)
  console.log('\n💡 Use manual deployment instead:')
  console.log('   See: deploy-supabase-manual.md')
  process.exit(1)
})

