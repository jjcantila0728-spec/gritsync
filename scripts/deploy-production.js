#!/usr/bin/env node
/**
 * Production Deployment Script
 * Validates environment, builds application, and prepares for deployment
 */

import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { execSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function error(message) {
  log(`❌ ${message}`, 'red')
}

function success(message) {
  log(`✅ ${message}`, 'green')
}

function warning(message) {
  log(`⚠️  ${message}`, 'yellow')
}

function info(message) {
  log(`ℹ️  ${message}`, 'cyan')
}

// Check if file exists
function fileExists(path) {
  return existsSync(join(rootDir, path))
}

// Validate environment variables
function validateEnvironment() {
  log('\n🔍 Validating Environment Variables...\n', 'blue')
  
  const required = [
    'JWT_SECRET',
    'VITE_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'STRIPE_SECRET_KEY',
    'FRONTEND_URL'
  ]
  
  const optional = [
    'VITE_STRIPE_PUBLISHABLE_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'VITE_API_URL',
    'PORT'
  ]
  
  const missing = []
  const warnings = []
  
  // Check required variables
  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key)
    }
  }
  
  // Check for test keys in production
  if (process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) {
    warnings.push('Using Stripe TEST key in production!')
  }
  
  if (process.env.VITE_STRIPE_PUBLISHABLE_KEY?.startsWith('pk_test_')) {
    warnings.push('Using Stripe TEST publishable key in production!')
  }
  
  // Check JWT_SECRET is not default
  if (process.env.JWT_SECRET === 'your-secret-key-change-in-production') {
    warnings.push('JWT_SECRET is still using default value!')
  }
  
  if (missing.length > 0) {
    error('Missing required environment variables:')
    missing.forEach(key => error(`  - ${key}`))
    return false
  }
  
  if (warnings.length > 0) {
    warning('Warnings:')
    warnings.forEach(w => warning(`  - ${w}`))
  }
  
  success('Environment variables validated')
  return true
}

// Run type check
function typeCheck() {
  log('\n🔍 Running TypeScript type check...\n', 'blue')
  
  try {
    execSync('npm run type-check', { 
      stdio: 'inherit',
      cwd: rootDir 
    })
    success('Type check passed')
    return true
  } catch (error) {
    error('Type check failed')
    return false
  }
}

// Build application
function build() {
  log('\n🏗️  Building application...\n', 'blue')
  
  try {
    execSync('npm run build:prod', { 
      stdio: 'inherit',
      cwd: rootDir,
      env: { ...process.env, NODE_ENV: 'production' }
    })
    success('Build completed successfully')
    return true
  } catch (error) {
    error('Build failed')
    return false
  }
}

// Check build output
function checkBuildOutput() {
  log('\n🔍 Checking build output...\n', 'blue')
  
  const distPath = join(rootDir, 'dist')
  if (!existsSync(distPath)) {
    error('Build output directory not found')
    return false
  }
  
  // Check for index.html
  if (!fileExists('dist/index.html')) {
    error('dist/index.html not found')
    return false
  }
  
  success('Build output verified')
  return true
}

// Main deployment function
async function deploy() {
  log('\n🚀 Starting Production Deployment\n', 'blue')
  log('='.repeat(60) + '\n')
  
  // Step 1: Validate environment
  if (!validateEnvironment()) {
    process.exit(1)
  }
  
  // Step 2: Type check
  if (!typeCheck()) {
    error('Please fix TypeScript errors before deploying')
    process.exit(1)
  }
  
  // Step 3: Build
  if (!build()) {
    error('Build failed. Please fix build errors before deploying')
    process.exit(1)
  }
  
  // Step 4: Check build output
  if (!checkBuildOutput()) {
    error('Build output verification failed')
    process.exit(1)
  }
  
  log('\n' + '='.repeat(60), 'blue')
  success('\n✅ Deployment preparation complete!')
  log('\nNext steps:', 'cyan')
  log('1. Review the build output in the dist/ directory')
  log('2. Test the production build locally: npm run start')
  log('3. Deploy to your hosting platform')
  log('4. Monitor logs and health endpoints after deployment')
  log('\n')
}

// Run deployment
deploy().catch(error => {
  error('Deployment script failed:')
  console.error(error)
  process.exit(1)
})
