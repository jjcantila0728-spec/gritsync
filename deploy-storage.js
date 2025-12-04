/**
 * Quick script to create Supabase Storage bucket
 * 
 * Usage:
 * 1. Add to .env: SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
 * 2. Run: node deploy-storage.js
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config()

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://warfdcbvnapietbkpild.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseServiceKey) {
  console.log('❌ SUPABASE_SERVICE_ROLE_KEY not found in .env')
  console.log('\nTo create storage bucket automatically:')
  console.log('1. Get your service role key from:')
  console.log('   Supabase Dashboard > Settings > API > service_role secret')
  console.log('2. Add to .env:')
  console.log('   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key')
  console.log('3. Run this script again')
  console.log('\nOr create bucket manually:')
  console.log('   Dashboard > Storage > New bucket > Name: "documents" > Private')
  process.exit(0)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function createBucket() {
  console.log('📦 Creating storage bucket "documents"...\n')
  
  try {
    // Check if exists
    const { data: buckets } = await supabase.storage.listBuckets()
    if (buckets?.some(b => b.name === 'documents')) {
      console.log('✅ Bucket "documents" already exists!')
      return
    }
    
    // Create bucket via REST API
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
        file_size_limit: 52428800,
        allowed_mime_types: ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
      })
    })
    
    if (response.ok) {
      console.log('✅ Storage bucket "documents" created successfully!')
    } else {
      const error = await response.json().catch(() => ({}))
      if (error.message?.includes('already exists')) {
        console.log('✅ Bucket "documents" already exists!')
      } else {
        throw new Error(error.message || `HTTP ${response.status}`)
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message)
    console.log('\n💡 Create manually: Dashboard > Storage > New bucket')
  }
}

createBucket()

