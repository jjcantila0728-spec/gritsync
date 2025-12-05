/**
 * Verification Script for Serverless Migration
 * Checks that all Express dependencies have been removed from frontend
 */

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const checks = {
  passed: [],
  failed: [],
  warnings: []
}

function checkFile(filePath, description, checks) {
  if (!existsSync(filePath)) {
    checks.failed.push(`❌ ${description}: File not found: ${filePath}`)
    return
  }

  const content = readFileSync(filePath, 'utf-8')
  
  // Check for Express API calls
  if (content.includes('VITE_API_URL') && content.includes('localhost:3001')) {
    checks.warnings.push(`⚠️  ${description}: Still references VITE_API_URL with localhost:3001`)
  }
  
  // Check for Express API endpoints
  const expressEndpoints = [
    '/api/auth',
    '/api/applications',
    '/api/quotations',
    '/api/services',
    '/api/clients',
    '/api/user',
    '/api/dashboard',
    '/api/files',
    '/api/notifications',
    '/api/track',
    '/api/users',
    '/api/sessions',
    '/api/webhooks'
  ]
  
  const foundEndpoints = expressEndpoints.filter(endpoint => 
    content.includes(endpoint) && !content.includes('//') && !content.includes('*')
  )
  
  if (foundEndpoints.length > 0) {
    checks.warnings.push(`⚠️  ${description}: May still reference Express endpoints: ${foundEndpoints.join(', ')}`)
  }
  
  // Check for Supabase usage
  if (content.includes('supabase.') || content.includes('supabase.functions.invoke')) {
    checks.passed.push(`✅ ${description}: Uses Supabase`)
  }
}

console.log('🔍 Verifying Serverless Migration...\n')

// Check key frontend files
const filesToCheck = [
  { path: 'src/lib/supabase-api.ts', desc: 'Supabase API' },
  { path: 'src/pages/AdminClients.tsx', desc: 'Admin Clients' },
  { path: 'src/lib/email-service.ts', desc: 'Email Service' },
]

filesToCheck.forEach(({ path, desc }) => {
  checkFile(join(process.cwd(), path), desc, checks)
})

// Check Edge Function exists
const edgeFunctionPath = join(process.cwd(), 'supabase/functions/admin-login-as/index.ts')
if (existsSync(edgeFunctionPath)) {
  checks.passed.push('✅ Admin login-as Edge Function exists')
} else {
  checks.failed.push('❌ Admin login-as Edge Function not found')
}

// Check .env.example
const envExamplePath = join(process.cwd(), '.env.example')
if (existsSync(envExamplePath)) {
  const envContent = readFileSync(envExamplePath, 'utf-8')
  if (envContent.includes('VITE_API_URL')) {
    checks.warnings.push('⚠️  .env.example still contains VITE_API_URL (consider removing)')
  }
}

// Print results
console.log('Results:\n')

if (checks.passed.length > 0) {
  console.log('✅ Passed Checks:')
  checks.passed.forEach(check => console.log(`  ${check}`))
  console.log('')
}

if (checks.warnings.length > 0) {
  console.log('⚠️  Warnings:')
  checks.warnings.forEach(warning => console.log(`  ${warning}`))
  console.log('')
}

if (checks.failed.length > 0) {
  console.log('❌ Failed Checks:')
  checks.failed.forEach(failure => console.log(`  ${failure}`))
  console.log('')
  process.exit(1)
}

if (checks.failed.length === 0 && checks.warnings.length === 0) {
  console.log('🎉 All checks passed! Your app is ready for serverless deployment.\n')
} else if (checks.failed.length === 0) {
  console.log('✅ Critical checks passed. Review warnings above.\n')
}
