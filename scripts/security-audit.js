#!/usr/bin/env node
/**
 * Comprehensive Security Audit Script for GritSync
 * Checks all critical security aspects of the application
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join, dirname, extname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logSection(title) {
  log(`\n${'='.repeat(60)}`, 'cyan')
  log(title, 'cyan')
  log('='.repeat(60), 'cyan')
}

function logCheck(name, passed, details = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL'
  const color = passed ? 'green' : 'red'
  log(`  ${status} - ${name}`, color)
  if (details) {
    log(`    ${details}`, 'yellow')
  }
}

// Security checks
const checks = {
  passed: 0,
  failed: 0,
  warnings: 0,
}

// Helper function to recursively find files
function findFiles(dir, extensions, files = []) {
  try {
    const entries = readdirSync(dir)
    for (const entry of entries) {
      const fullPath = join(dir, entry)
      try {
        const stat = statSync(fullPath)
        if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules') {
          findFiles(fullPath, extensions, files)
        } else if (stat.isFile()) {
          const ext = extname(entry).toLowerCase()
          if (extensions.includes(ext)) {
            files.push(fullPath)
          }
        }
      } catch (err) {
        // Skip files that can't be accessed
      }
    }
  } catch (err) {
    // Skip directories that can't be accessed
  }
  return files
}

// 1. Check for hardcoded secrets
function checkHardcodedSecrets() {
  logSection('1. Hardcoded Secrets Check')
  
  try {
    const srcDir = join(rootDir, 'src')
    const supabaseDir = join(rootDir, 'supabase')
    
    // Exclude test files from secret scanning (they're acceptable)
    const srcFiles = existsSync(srcDir) 
      ? findFiles(srcDir, ['.ts', '.tsx', '.js', '.jsx']).filter(f => !f.includes('test') && !f.includes('spec'))
      : []
    const supabaseFiles = existsSync(supabaseDir) ? findFiles(supabaseDir, ['.ts', '.js']) : []
    
    const allFiles = [...srcFiles, ...supabaseFiles]
    
    const secretPatterns = [
      { pattern: /sk_live_[a-zA-Z0-9]{24,}/, name: 'Stripe Live Secret Key' },
      { pattern: /sk_test_[a-zA-Z0-9]{24,}/, name: 'Stripe Test Secret Key' },
      { pattern: /SUPABASE_SERVICE_ROLE_KEY\s*=\s*['"][^'"]+['"]/, name: 'Hardcoded Service Role Key' },
      { pattern: /eyJ[a-zA-Z0-9_-]{20,}\.eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/, name: 'JWT Token (long-lived)' },
      // Only flag passwords that look like real secrets (not test passwords)
      { pattern: /password\s*[:=]\s*['"](?!test|password|123456|admin)[^'"]{12,}['"]/, name: 'Hardcoded Password (suspicious)' },
    ]
    
    let foundSecrets = false
    let testFileSecrets = 0
    
    for (const file of allFiles) {
      try {
        const content = readFileSync(file, 'utf-8')
        const relativePath = file.replace(rootDir + '\\', '').replace(rootDir + '/', '')
        const isTestFile = relativePath.includes('test') || relativePath.includes('spec')
        
        for (const { pattern, name } of secretPatterns) {
          if (pattern.test(content)) {
            if (isTestFile) {
              testFileSecrets++
              // Don't fail for test files, just note them
            } else {
              logCheck(`Found ${name} in ${relativePath}`, false)
              foundSecrets = true
              checks.failed++
            }
          }
        }
      } catch (err) {
        // Skip files that can't be read
      }
    }
    
    if (testFileSecrets > 0) {
      logCheck('Test files with hardcoded passwords', true, `${testFileSecrets} instances in test files (acceptable)`)
      checks.passed++
    }
    
    if (!foundSecrets) {
      logCheck('No hardcoded secrets found in production code', true)
      checks.passed++
    }
  } catch (err) {
    logCheck('Could not scan for secrets', false, err.message)
    checks.failed++
  }
}

// 2. Check .gitignore
function checkGitignore() {
  logSection('2. .gitignore Configuration')
  
  const gitignorePath = join(rootDir, '.gitignore')
  
  if (!existsSync(gitignorePath)) {
    logCheck('.gitignore file exists', false, 'File not found')
    checks.failed++
    return
  }
  
  const gitignore = readFileSync(gitignorePath, 'utf-8')
  const requiredPatterns = [
    { pattern: /\.env/, name: '.env files' },
    { pattern: /\.env\.local/, name: '.env.local files' },
    { pattern: /\.env\.production/, name: '.env.production files' },
    { pattern: /node_modules/, name: 'node_modules' },
    { pattern: /\.db/, name: 'Database files' },
  ]
  
  let allPresent = true
  for (const { pattern, name } of requiredPatterns) {
    if (pattern.test(gitignore)) {
      logCheck(`${name} in .gitignore`, true)
      checks.passed++
    } else {
      logCheck(`${name} in .gitignore`, false)
      allPresent = false
      checks.warnings++
    }
  }
  
  if (allPresent) {
    logCheck('All critical patterns in .gitignore', true)
  }
}

// 3. Check environment variables
function checkEnvironmentVariables() {
  logSection('3. Environment Variables Configuration')
  
  const envExamplePath = join(rootDir, 'env.production.example')
  
  if (!existsSync(envExamplePath)) {
    logCheck('env.production.example exists', false)
    checks.failed++
    return
  }
  
  const envExample = readFileSync(envExamplePath, 'utf-8')
  
  const requiredVars = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'STRIPE_SECRET_KEY',
    'VITE_STRIPE_PUBLISHABLE_KEY',
    'JWT_SECRET',
  ]
  
  let allPresent = true
  for (const varName of requiredVars) {
    if (envExample.includes(varName)) {
      logCheck(`${varName} documented`, true)
      checks.passed++
    } else {
      logCheck(`${varName} documented`, false)
      allPresent = false
      checks.warnings++
    }
  }
  
  // Check for placeholder values
  if (envExample.includes('your-') || envExample.includes('YOUR_')) {
    logCheck('Environment variables use placeholders', true)
    checks.passed++
  } else {
    logCheck('Environment variables use placeholders', false, 'Should not contain real secrets')
    checks.warnings++
  }
}

// 4. Check RLS policies
function checkRLSPolicies() {
  logSection('4. Row Level Security (RLS) Policies')
  
  const schemaPath = join(rootDir, 'supabase', 'schema.sql')
  
  if (!existsSync(schemaPath)) {
    logCheck('schema.sql exists', false)
    checks.failed++
    return
  }
  
  const schema = readFileSync(schemaPath, 'utf-8')
  
  // Check if RLS is enabled on critical tables
  const criticalTables = [
    'users',
    'applications',
    'quotations',
    'user_details',
    'user_documents',
    'application_payments',
  ]
  
  let allEnabled = true
  for (const table of criticalTables) {
    const rlsPattern = new RegExp(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`, 'i')
    if (rlsPattern.test(schema)) {
      logCheck(`RLS enabled on ${table}`, true)
      checks.passed++
    } else {
      logCheck(`RLS enabled on ${table}`, false)
      allEnabled = false
      checks.failed++
    }
  }
  
  // Check for policy definitions
  const policyCount = (schema.match(/CREATE POLICY/gi) || []).length
  if (policyCount > 0) {
    logCheck(`RLS policies defined (${policyCount} found)`, true)
    checks.passed++
  } else {
    logCheck('RLS policies defined', false)
    checks.failed++
  }
}

// 5. Check SQL injection protection
function checkSQLInjectionProtection() {
  logSection('5. SQL Injection Protection')
  
  try {
    const srcDir = join(rootDir, 'src')
    const srcFiles = existsSync(srcDir) ? findFiles(srcDir, ['.ts', '.tsx']) : []
    
    let foundRawSQL = false
    
    for (const file of srcFiles) {
      try {
        const content = readFileSync(file, 'utf-8')
        const relativePath = file.replace(rootDir + '\\', '').replace(rootDir + '/', '')
        
        // Check for dangerous SQL patterns
        const dangerousPatterns = [
          { pattern: /\.query\s*\([^)]*\+/, name: 'String concatenation in queries' },
          { pattern: /db\.run\s*\([^)]*\+/, name: 'String concatenation in db.run' },
          { pattern: /db\.all\s*\([^)]*\+/, name: 'String concatenation in db.all' },
        ]
        
        for (const { pattern, name } of dangerousPatterns) {
          if (pattern.test(content)) {
            logCheck(`${name} in ${relativePath}`, false)
            foundRawSQL = true
            checks.warnings++
          }
        }
      } catch (err) {
        // Skip files that can't be read
      }
    }
    
    // Check if using Supabase client (which uses parameterized queries)
    const supabaseApiPath = join(rootDir, 'src', 'lib', 'supabase-api.ts')
    if (existsSync(supabaseApiPath)) {
      const content = readFileSync(supabaseApiPath, 'utf-8')
      if (content.includes('.from(') && content.includes('.select(')) {
        logCheck('Using Supabase client (parameterized queries)', true)
        checks.passed++
      } else {
        logCheck('Using Supabase client', false)
        checks.warnings++
      }
    }
    
    if (!foundRawSQL) {
      logCheck('No dangerous SQL patterns found', true)
      checks.passed++
    }
  } catch (err) {
    logCheck('Could not scan for SQL injection risks', false, err.message)
    checks.failed++
  }
}

// 6. Check XSS protection
function checkXSSProtection() {
  logSection('6. XSS (Cross-Site Scripting) Protection')
  
  try {
    const srcDir = join(rootDir, 'src')
    const srcFiles = existsSync(srcDir) ? findFiles(srcDir, ['.tsx', '.ts']) : []
    
    let foundDangerousPatterns = false
    let foundUnsanitized = false
    let sanitizedCount = 0
    
    for (const file of srcFiles) {
      try {
        const content = readFileSync(file, 'utf-8')
        const relativePath = file.replace(rootDir + '\\', '').replace(rootDir + '/', '')
        
        // Check for dangerouslySetInnerHTML usage
        const dangerousHTMLMatches = content.match(/dangerouslySetInnerHTML/g)
        if (dangerousHTMLMatches) {
          foundDangerousPatterns = true
          
          // Check if sanitizeHTML is imported and used
          const hasSanitizeImport = /import.*sanitizeHTML.*from|from.*['"]@\/lib\/utils['"]/.test(content)
          const sanitizeUsage = content.match(/sanitizeHTML\s*\(/g)
          
          // Count how many are sanitized
          if (sanitizeUsage) {
            sanitizedCount += sanitizeUsage.length
          }
          
          // Check if all instances are sanitized
          const allSanitized = dangerousHTMLMatches.every(() => {
            // Look for sanitizeHTML near dangerouslySetInnerHTML
            const lines = content.split('\n')
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].includes('dangerouslySetInnerHTML')) {
                // Check surrounding lines for sanitizeHTML
                const context = lines.slice(Math.max(0, i - 5), Math.min(lines.length, i + 5)).join('\n')
                if (context.includes('sanitizeHTML')) {
                  return true
                }
              }
            }
            return false
          })
          
          if (hasSanitizeImport && sanitizeUsage && sanitizeUsage.length >= dangerousHTMLMatches.length) {
            logCheck(`dangerouslySetInnerHTML in ${relativePath}`, true, `Sanitized (${sanitizeUsage.length}/${dangerousHTMLMatches.length} instances)`)
            checks.passed++
          } else {
            logCheck(`dangerouslySetInnerHTML in ${relativePath}`, false, `Found ${dangerousHTMLMatches.length} instances - ${sanitizeUsage ? sanitizeUsage.length : 0} sanitized`)
            foundUnsanitized = true
            checks.warnings++
          }
        }
        
        // Check for innerHTML assignments
        const innerHTMLMatches = content.match(/\.innerHTML\s*=/g)
        if (innerHTMLMatches) {
          foundDangerousPatterns = true
          
          // Check if sanitizeHTML is used nearby
          const hasSanitizeImport = /import.*sanitizeHTML.*from|from.*['"]@\/lib\/utils['"]/.test(content)
          const sanitizeUsage = content.match(/sanitizeHTML\s*\(/g)
          
          if (hasSanitizeImport && sanitizeUsage) {
            logCheck(`innerHTML assignment in ${relativePath}`, true, `Sanitized (${sanitizeUsage.length} sanitization calls found)`)
            checks.passed++
          } else {
            logCheck(`innerHTML assignment in ${relativePath}`, false, `Found ${innerHTMLMatches.length} instances - review for sanitization`)
            foundUnsanitized = true
            checks.warnings++
          }
        }
      } catch (err) {
        // Skip files that can't be read
      }
    }
    
    // Check for sanitization function
    const utilsPath = join(rootDir, 'src', 'lib', 'utils.ts')
    if (existsSync(utilsPath)) {
      const content = readFileSync(utilsPath, 'utf-8')
      if (content.includes('sanitizeHTML') || content.includes('DOMPurify')) {
        logCheck('HTML sanitization function exists (sanitizeHTML)', true)
        checks.passed++
      } else if (content.includes('sanitizeInput') || content.includes('sanitize')) {
        logCheck('Input sanitization function exists', true, 'Consider adding HTML sanitization')
        checks.passed++
      } else {
        logCheck('Input sanitization function exists', false)
        checks.warnings++
      }
    }
    
    if (!foundDangerousPatterns) {
      logCheck('No dangerous XSS patterns found', true)
      checks.passed++
    } else if (!foundUnsanitized) {
      logCheck('All XSS patterns are sanitized', true, `Found ${sanitizedCount} sanitized instances`)
      checks.passed++
    }
  } catch (err) {
    logCheck('Could not scan for XSS risks', false, err.message)
    checks.failed++
  }
}

// 7. Check CORS configuration
function checkCORSConfiguration() {
  logSection('7. CORS Configuration')
  
  // Check edge functions
  const edgeFunctions = [
    'supabase/functions/create-payment-intent/index.ts',
    'supabase/functions/send-email/index.ts',
  ]
  
  let corsConfigured = false
  for (const funcPath of edgeFunctions) {
    const fullPath = join(rootDir, funcPath)
    if (existsSync(fullPath)) {
      const content = readFileSync(fullPath, 'utf-8')
      if (content.includes('Access-Control-Allow-Origin')) {
        logCheck(`CORS headers in ${funcPath}`, true)
        corsConfigured = true
        checks.passed++
      } else {
        logCheck(`CORS headers in ${funcPath}`, false)
        checks.warnings++
      }
    }
  }
  
  // Check server CORS
  const serverPath = join(rootDir, 'server', 'index.ts')
  if (existsSync(serverPath)) {
    const content = readFileSync(serverPath, 'utf-8')
    if (content.includes('cors()')) {
      logCheck('CORS middleware in server', true)
      checks.passed++
    } else {
      logCheck('CORS middleware in server', false)
      checks.warnings++
    }
  }
}

// 8. Check file upload security
function checkFileUploadSecurity() {
  logSection('8. File Upload Security')
  
  try {
    const srcDir = join(rootDir, 'src')
    const srcFiles = existsSync(srcDir) ? findFiles(srcDir, ['.ts', '.tsx']) : []
    
    let foundUploads = false
    let hasValidation = false
    
    for (const file of srcFiles) {
      try {
        const content = readFileSync(file, 'utf-8')
        
        if (content.includes('.upload(') || content.includes('File') || content.includes('file')) {
          foundUploads = true
          
          // Check for file type validation
          if (content.includes('fileExt') || content.includes('file.type') || content.includes('mime')) {
            hasValidation = true
          }
        }
      } catch (err) {
        // Skip files that can't be read
      }
    }
    
    if (foundUploads) {
      if (hasValidation) {
        logCheck('File upload validation present', true)
        checks.passed++
      } else {
        logCheck('File upload validation present', false, 'Should validate file types and sizes')
        checks.warnings++
      }
    } else {
      logCheck('File uploads found', true, 'No file uploads detected')
      checks.passed++
    }
  } catch (err) {
    logCheck('Could not scan for file upload security', false, err.message)
    checks.failed++
  }
}

// 9. Check authentication/authorization
function checkAuthSecurity() {
  logSection('9. Authentication & Authorization')
  
  // Check for admin route protection
  const appPath = join(rootDir, 'src', 'App.tsx')
  if (existsSync(appPath)) {
    const content = readFileSync(appPath, 'utf-8')
    
    if (content.includes('AdminRoute') || content.includes('role') || content.includes('admin')) {
      logCheck('Admin route protection exists', true)
      checks.passed++
    } else {
      logCheck('Admin route protection exists', false)
      checks.warnings++
    }
  }
  
  // Check for password validation
  const settingsPath = join(rootDir, 'src', 'lib', 'settings.ts')
  if (existsSync(settingsPath)) {
    const content = readFileSync(settingsPath, 'utf-8')
    if (content.includes('validatePassword') || content.includes('passwordMinLength')) {
      logCheck('Password validation exists', true)
      checks.passed++
    } else {
      logCheck('Password validation exists', false)
      checks.warnings++
    }
  }
}

// 10. Check dependencies
function checkDependencies() {
  logSection('10. Dependencies Security')
  
  const packageJsonPath = join(rootDir, 'package.json')
  
  if (!existsSync(packageJsonPath)) {
    logCheck('package.json exists', false)
    checks.failed++
    return
  }
  
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
  
  // Check for known vulnerable packages (basic check)
  const vulnerablePackages = [
    // Add known vulnerable packages here if needed
  ]
  
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  }
  
  let foundVulnerable = false
  for (const pkg of vulnerablePackages) {
    if (allDeps[pkg]) {
      logCheck(`Vulnerable package ${pkg}`, false, 'Update to latest version')
      foundVulnerable = true
      checks.warnings++
    }
  }
  
  if (!foundVulnerable) {
    logCheck('No known vulnerable packages detected', true, 'Run npm audit for detailed check')
    checks.passed++
  }
  
  // Suggest running npm audit
  logCheck('Run npm audit', true, 'Execute: npm audit for detailed vulnerability check')
  checks.passed++
}

// 11. Check for rate limiting
function checkRateLimiting() {
  logSection('11. Rate Limiting')
  
  // Check if rate limiting is mentioned in documentation
  const docsFiles = [
    'PRODUCTION_README.md',
    'PRE_DEPLOYMENT_VERIFICATION.md',
  ]
  
  let foundRateLimit = false
  for (const docFile of docsFiles) {
    const docPath = join(rootDir, docFile)
    if (existsSync(docPath)) {
      const content = readFileSync(docPath, 'utf-8')
      if (content.includes('rate limit') || content.includes('rateLimit') || content.includes('rate-limiting')) {
        foundRateLimit = true
        break
      }
    }
  }
  
  if (foundRateLimit) {
    logCheck('Rate limiting documented', true, 'Verify implementation in production')
    checks.passed++
  } else {
    logCheck('Rate limiting documented', false, 'Consider implementing rate limiting')
    checks.warnings++
  }
}

// Main execution
async function main() {
  log('\n🔒 GritSync Security Audit', 'cyan')
  log('='.repeat(60), 'cyan')
  
  checkHardcodedSecrets()
  checkGitignore()
  checkEnvironmentVariables()
  checkRLSPolicies()
  checkSQLInjectionProtection()
  checkXSSProtection()
  checkCORSConfiguration()
  checkFileUploadSecurity()
  checkAuthSecurity()
  checkDependencies()
  checkRateLimiting()
  
  // Summary
  logSection('Security Audit Summary')
  log(`✅ Passed: ${checks.passed}`, 'green')
  log(`⚠️  Warnings: ${checks.warnings}`, 'yellow')
  log(`❌ Failed: ${checks.failed}`, 'red')
  
  const total = checks.passed + checks.warnings + checks.failed
  const score = Math.round((checks.passed / total) * 100)
  
  log(`\n📊 Security Score: ${score}%`, score >= 80 ? 'green' : score >= 60 ? 'yellow' : 'red')
  
  if (checks.failed > 0) {
    log('\n⚠️  Action Required: Fix failed checks before deployment', 'red')
    process.exit(1)
  } else if (checks.warnings > 0) {
    log('\n⚠️  Review warnings and address as needed', 'yellow')
    process.exit(0)
  } else {
    log('\n✅ All security checks passed!', 'green')
    process.exit(0)
  }
}

main().catch(err => {
  log(`\n❌ Error running security audit: ${err.message}`, 'red')
  process.exit(1)
})

