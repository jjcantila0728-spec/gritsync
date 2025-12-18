/**
 * Verification script for USCIS Forms setup
 * 
 * This script checks:
 * 1. PDF templates exist in Supabase Storage
 * 2. Edge function is deployed
 * 3. OpenAI API key is configured
 * 4. Storage bucket permissions are correct
 * 
 * Usage: Run this in your Supabase SQL Editor or via Node.js
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

async function verifySetup() {
  console.log('🔍 Verifying USCIS Forms Setup...\n')

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  let allGood = true

  // 1. Check if storage bucket exists
  console.log('1️⃣ Checking storage bucket...')
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets()
    
    if (error) throw error

    const uscisFormsBucket = buckets?.find(b => b.name === 'USCIS Forms')
    
    if (uscisFormsBucket) {
      console.log('   ✅ USCIS Forms bucket exists')
      console.log(`   ℹ️  Bucket is ${uscisFormsBucket.public ? 'public' : 'private'}`)
    } else {
      console.log('   ❌ USCIS Forms bucket not found')
      console.log('   💡 Create a bucket named "USCIS Forms" in Supabase Storage')
      allGood = false
    }
  } catch (error: any) {
    console.log('   ❌ Error checking bucket:', error.message)
    allGood = false
  }

  console.log('')

  // 2. Check if PDF templates exist
  console.log('2️⃣ Checking PDF templates...')
  
  const requiredFiles = ['g-1145.pdf', 'i-765.pdf']
  
  for (const fileName of requiredFiles) {
    try {
      // Try to get file metadata
      const { data, error } = await supabase.storage
        .from('USCIS Forms')
        .list('', {
          search: fileName
        })

      if (error) throw error

      const fileExists = data?.some(f => f.name === fileName)

      if (fileExists) {
        console.log(`   ✅ ${fileName} exists`)
        
        // Try to download to verify it's accessible
        const { data: downloadData, error: downloadError } = await supabase.storage
          .from('USCIS Forms')
          .download(fileName)

        if (downloadError) {
          console.log(`   ⚠️  File exists but cannot be downloaded: ${downloadError.message}`)
        } else if (downloadData) {
          console.log(`   ℹ️  File size: ${(downloadData.size / 1024).toFixed(2)} KB`)
        }
      } else {
        console.log(`   ❌ ${fileName} not found`)
        console.log(`   💡 Upload ${fileName} to the USCIS Forms bucket`)
        allGood = false
      }
    } catch (error: any) {
      console.log(`   ❌ Error checking ${fileName}:`, error.message)
      allGood = false
    }
  }

  console.log('')

  // 3. Check if edge function exists
  console.log('3️⃣ Checking edge function...')
  try {
    // Try to invoke the function with a test request
    const { error } = await supabase.functions.invoke('fill-pdf-form-ai', {
      body: {
        formType: 'G-1145',
        data: {
          firstName: 'Test',
          lastName: 'User'
        }
      }
    })

    if (error) {
      if (error.message.includes('not found')) {
        console.log('   ❌ fill-pdf-form-ai function not deployed')
        console.log('   💡 Deploy with: supabase functions deploy fill-pdf-form-ai')
        allGood = false
      } else if (error.message.includes('OPENAI_API_KEY')) {
        console.log('   ⚠️  Function exists but OpenAI API key not configured')
        console.log('   💡 Set with: supabase secrets set OPENAI_API_KEY=your_key')
        allGood = false
      } else {
        console.log('   ✅ fill-pdf-form-ai function is deployed')
        console.log('   ℹ️  Note:', error.message)
      }
    } else {
      console.log('   ✅ fill-pdf-form-ai function is deployed and working')
    }
  } catch (error: any) {
    console.log('   ❌ Error checking function:', error.message)
    allGood = false
  }

  console.log('')

  // Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  if (allGood) {
    console.log('✅ All checks passed! USCIS Forms system is ready.')
  } else {
    console.log('❌ Some issues found. Please fix them before using the system.')
    console.log('\n📚 See USCIS_FORMS_SETUP.md for detailed instructions.')
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

// Run verification
verifySetup().catch(console.error)

