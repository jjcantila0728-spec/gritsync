#!/usr/bin/env node

/**
 * Deployment Verification Script
 * 
 * This script helps verify that the application is ready for deployment
 * by checking various configuration and code quality aspects.
 */

import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`)
}

function checkmark() {
  return `${colors.green}✓${colors.reset}`
}

function cross() {
  return `${colors.red}✗${colors.reset}`
}

function warning() {
  return `${colors.yellow}⚠${colors.reset}`
}

// Verification checks
const checks = {
  files: [],
  errors: [],
  warnings: [],
}

function checkFile(file, description) {
  const filePath = join(rootDir, file)
  const exists = existsSync(filePath)
  
  if (exists) {
    checks.files.push({ file, description, status: 'exists' })
    log(`  ${checkmark()} ${file}`, colors.green)
    return true
  } else {
    checks.errors.push({ file, description })
    log(`  ${cross()} ${file} - MISSING`, colors.red)
    return false
  }
}

function checkPackageJson() {
  log('\n📦 Checking package.json...', colors.cyan)
  const packagePath = join(rootDir, 'package.json')
  
  if (!existsSync(packagePath)) {
    checks.errors.push({ file: 'package.json', description: 'Package.json missing' })
    log(`  ${cross()} package.json not found`, colors.red)
    return false
  }
  
  try {
    const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'))
    
    // Check required scripts
    const requiredScripts = ['build', 'dev', 'test', 'lint']
    const missingScripts = requiredScripts.filter(script => !pkg.scripts?.[script])
    
    if (missingScripts.length > 0) {
      checks.warnings.push({ file: 'package.json', description: `Missing scripts: ${missingScripts.join(', ')}` })
      log(`  ${warning()} Missing scripts: ${missingScripts.join(', ')}`, colors.yellow)
    } else {
      log(`  ${checkmark()} All required scripts present`, colors.green)
    }
    
    // Check for production dependencies
    const prodDeps = Object.keys(pkg.dependencies || {})
    log(`  ${checkmark()} ${prodDeps.length} production dependencies`, colors.green)
    
    return true
  } catch (error) {
    checks.errors.push({ file: 'package.json', description: `Error reading package.json: ${error.message}` })
    log(`  ${cross()} Error reading package.json: ${error.message}`, colors.red)
    return false
  }
}

function checkVercelConfig() {
  log('\n🚀 Checking Vercel configuration...', colors.cyan)
  const vercelPath = join(rootDir, 'vercel.json')
  
  if (!existsSync(vercelPath)) {
    checks.errors.push({ file: 'vercel.json', description: 'Vercel config missing' })
    log(`  ${cross()} vercel.json not found`, colors.red)
    return false
  }
  
  try {
    const config = JSON.parse(readFileSync(vercelPath, 'utf-8'))
    
    // Check required fields
    if (!config.buildCommand) {
      checks.warnings.push({ file: 'vercel.json', description: 'buildCommand not specified' })
      log(`  ${warning()} buildCommand not specified`, colors.yellow)
    } else {
      log(`  ${checkmark()} buildCommand: ${config.buildCommand}`, colors.green)
    }
    
    if (!config.outputDirectory) {
      checks.warnings.push({ file: 'vercel.json', description: 'outputDirectory not specified' })
      log(`  ${warning()} outputDirectory not specified`, colors.yellow)
    } else {
      log(`  ${checkmark()} outputDirectory: ${config.outputDirectory}`, colors.green)
    }
    
    if (config.rewrites && config.rewrites.length > 0) {
      log(`  ${checkmark()} SPA routing configured (${config.rewrites.length} rewrite(s))`, colors.green)
    } else {
      checks.warnings.push({ file: 'vercel.json', description: 'No rewrites configured for SPA routing' })
      log(`  ${warning()} No rewrites configured for SPA routing`, colors.yellow)
    }
    
    return true
  } catch (error) {
    checks.errors.push({ file: 'vercel.json', description: `Error reading vercel.json: ${error.message}` })
    log(`  ${cross()} Error reading vercel.json: ${error.message}`, colors.red)
    return false
  }
}

function checkEnvironmentFiles() {
  log('\n🔐 Checking environment files...', colors.cyan)
  
  const envExample = checkFile('.env.example', 'Environment variables example')
  const envProdExample = checkFile('env.production.example', 'Production environment variables example')
  
  if (envExample) {
    try {
      const content = readFileSync(join(rootDir, '.env.example'), 'utf-8')
      const requiredVars = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']
      const missingVars = requiredVars.filter(varName => !content.includes(varName))
      
      if (missingVars.length > 0) {
        checks.warnings.push({ file: '.env.example', description: `Missing variables: ${missingVars.join(', ')}` })
        log(`  ${warning()} Missing variables: ${missingVars.join(', ')}`, colors.yellow)
      } else {
        log(`  ${checkmark()} All required variables documented`, colors.green)
      }
    } catch (error) {
      checks.warnings.push({ file: '.env.example', description: `Error reading file: ${error.message}` })
    }
  }
  
  // Check that .env is in .gitignore
  try {
    const gitignorePath = join(rootDir, '.gitignore')
    if (existsSync(gitignorePath)) {
      const gitignore = readFileSync(gitignorePath, 'utf-8')
      if (gitignore.includes('.env') && !gitignore.includes('.env.example')) {
        log(`  ${checkmark()} .env is in .gitignore`, colors.green)
      } else {
        checks.warnings.push({ file: '.gitignore', description: '.env might not be properly ignored' })
        log(`  ${warning()} Check .gitignore for .env entries`, colors.yellow)
      }
    }
  } catch (error) {
    // .gitignore might not exist, that's okay
  }
}

function checkDocumentation() {
  log('\n📚 Checking documentation...', colors.cyan)
  
  checkFile('README.md', 'Main README file')
  checkFile('PRE_DEPLOYMENT_VERIFICATION.md', 'Pre-deployment checklist')
  checkFile('DEPLOYMENT_SUMMARY.md', 'Deployment summary')
  checkFile('QUICK_DEPLOYMENT_GUIDE.md', 'Quick deployment guide')
}

function checkLegalPages() {
  log('\n⚖️  Checking legal pages...', colors.cyan)
  
  const termsPath = join(rootDir, 'src', 'pages', 'TermsOfService.tsx')
  const privacyPath = join(rootDir, 'src', 'pages', 'PrivacyPolicy.tsx')
  
  if (existsSync(termsPath)) {
    log(`  ${checkmark()} Terms of Service page exists`, colors.green)
  } else {
    checks.errors.push({ file: 'src/pages/TermsOfService.tsx', description: 'Terms of Service page missing' })
    log(`  ${cross()} Terms of Service page missing`, colors.red)
  }
  
  if (existsSync(privacyPath)) {
    log(`  ${checkmark()} Privacy Policy page exists`, colors.green)
  } else {
    checks.errors.push({ file: 'src/pages/PrivacyPolicy.tsx', description: 'Privacy Policy page missing' })
    log(`  ${cross()} Privacy Policy page missing`, colors.red)
  }
}

function checkMigrations() {
  log('\n🗄️  Checking database migrations...', colors.cyan)
  
  const migrationsDir = join(rootDir, 'supabase', 'migrations')
  
  if (!existsSync(migrationsDir)) {
    checks.warnings.push({ file: 'supabase/migrations', description: 'Migrations directory not found' })
    log(`  ${warning()} Migrations directory not found`, colors.yellow)
    return
  }
  
  try {
    const { readdirSync } = await import('fs')
    const migrations = readdirSync(migrationsDir).filter(file => file.endsWith('.sql'))
    
    log(`  ${checkmark()} Found ${migrations.length} migration file(s)`, colors.green)
    
    // List important migrations
    const importantMigrations = [
      'add_sessions_table.sql',
      'create_notification_types_table.sql',
      'add_public_tracking_policies.sql',
    ]
    
    importantMigrations.forEach(migration => {
      if (migrations.includes(migration)) {
        log(`    ${checkmark()} ${migration}`, colors.green)
      } else {
        checks.warnings.push({ file: `supabase/migrations/${migration}`, description: 'Important migration might be missing' })
        log(`    ${warning()} ${migration}`, colors.yellow)
      }
    })
  } catch (error) {
    checks.warnings.push({ file: 'supabase/migrations', description: `Error reading migrations: ${error.message}` })
    log(`  ${warning()} Error reading migrations: ${error.message}`, colors.yellow)
  }
}

function checkSecurity() {
  log('\n🔒 Checking security configurations...', colors.cyan)
  
  // Check vite config for console.log removal
  const viteConfigPath = join(rootDir, 'vite.config.ts')
  if (existsSync(viteConfigPath)) {
    try {
      const content = readFileSync(viteConfigPath, 'utf-8')
      if (content.includes('drop_console') || content.includes('drop_console: true')) {
        log(`  ${checkmark()} Console.log removal configured in production`, colors.green)
      } else {
        checks.warnings.push({ file: 'vite.config.ts', description: 'Console.log removal might not be configured' })
        log(`  ${warning()} Console.log removal might not be configured`, colors.yellow)
      }
    } catch (error) {
      checks.warnings.push({ file: 'vite.config.ts', description: `Error reading file: ${error.message}` })
    }
  }
  
  // Check for error boundaries
  const errorBoundaryPath = join(rootDir, 'src', 'components', 'ErrorBoundary.tsx')
  if (existsSync(errorBoundaryPath)) {
    log(`  ${checkmark()} Error boundary component exists`, colors.green)
  } else {
    checks.warnings.push({ file: 'src/components/ErrorBoundary.tsx', description: 'Error boundary might be missing' })
    log(`  ${warning()} Error boundary might be missing`, colors.yellow)
  }
}

function printSummary() {
  log('\n' + '='.repeat(60), colors.cyan)
  log('📊 Verification Summary', colors.cyan)
  log('='.repeat(60), colors.cyan)
  
  const totalChecks = checks.files.length + checks.errors.length + checks.warnings.length
  
  log(`\n✅ Files Found: ${checks.files.length}`, colors.green)
  log(`❌ Errors: ${checks.errors.length}`, checks.errors.length > 0 ? colors.red : colors.green)
  log(`⚠️  Warnings: ${checks.warnings.length}`, checks.warnings.length > 0 ? colors.yellow : colors.green)
  
  if (checks.errors.length > 0) {
    log('\n❌ Errors that need to be fixed:', colors.red)
    checks.errors.forEach((error, index) => {
      log(`  ${index + 1}. ${error.file}: ${error.description}`, colors.red)
    })
  }
  
  if (checks.warnings.length > 0) {
    log('\n⚠️  Warnings to review:', colors.yellow)
    checks.warnings.forEach((warning, index) => {
      log(`  ${index + 1}. ${warning.file}: ${warning.description}`, colors.yellow)
    })
  }
  
  if (checks.errors.length === 0 && checks.warnings.length === 0) {
    log('\n🎉 All automated checks passed!', colors.green)
    log('\n📋 Next Steps:', colors.cyan)
    log('  1. Review PRE_DEPLOYMENT_VERIFICATION.md for manual checks', colors.blue)
    log('  2. Run manual tests (user flows, etc.)', colors.blue)
    log('  3. Verify Supabase migrations and RLS policies', colors.blue)
    log('  4. Set environment variables in Vercel', colors.blue)
    log('  5. Deploy to production', colors.blue)
  } else if (checks.errors.length === 0) {
    log('\n✅ No critical errors found!', colors.green)
    log('⚠️  Please review warnings before deployment.', colors.yellow)
  } else {
    log('\n❌ Please fix errors before proceeding with deployment.', colors.red)
  }
  
  log('\n' + '='.repeat(60), colors.cyan)
}

// Main execution
async function main() {
  log('\n🚀 GritSync Deployment Verification', colors.cyan)
  log('='.repeat(60), colors.cyan)
  
  checkPackageJson()
  checkVercelConfig()
  checkEnvironmentFiles()
  checkDocumentation()
  checkLegalPages()
  await checkMigrations()
  checkSecurity()
  
  printSummary()
  
  // Exit with appropriate code
  process.exit(checks.errors.length > 0 ? 1 : 0)
}

main().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, colors.red)
  console.error(error)
  process.exit(1)
})
