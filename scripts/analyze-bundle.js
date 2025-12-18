#!/usr/bin/env node

/**
 * Bundle size analyzer
 * Analyzes the production build to identify large dependencies and optimization opportunities
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const DIST_DIR = join(process.cwd(), 'dist')
const ASSETS_DIR = join(DIST_DIR, 'assets')

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

function getFileSize(filePath) {
  try {
    const stats = statSync(filePath)
    return stats.size
  } catch {
    return 0
  }
}

function analyzeBundle() {
  console.log('📦 Analyzing bundle sizes...\n')

  if (!readdirSync(DIST_DIR).length) {
    console.error('❌ No build found. Run "npm run build" first.')
    process.exit(1)
  }

  const files = []
  
  // Analyze JavaScript files
  try {
    const jsFiles = readdirSync(ASSETS_DIR).filter(f => f.endsWith('.js'))
    jsFiles.forEach(file => {
      const filePath = join(ASSETS_DIR, file)
      const size = getFileSize(filePath)
      files.push({ name: file, size, type: 'js' })
    })
  } catch (error) {
    console.warn('⚠️  Could not analyze JS files:', error.message)
  }

  // Analyze CSS files
  try {
    const cssFiles = readdirSync(ASSETS_DIR).filter(f => f.endsWith('.css'))
    cssFiles.forEach(file => {
      const filePath = join(ASSETS_DIR, file)
      const size = getFileSize(filePath)
      files.push({ name: file, size, type: 'css' })
    })
  } catch (error) {
    console.warn('⚠️  Could not analyze CSS files:', error.message)
  }

  // Sort by size
  files.sort((a, b) => b.size - a.size)

  // Display results
  console.log('📊 Bundle Analysis:\n')
  console.log('Top 10 Largest Files:')
  console.log('─'.repeat(60))
  
  files.slice(0, 10).forEach((file, index) => {
    const icon = file.type === 'js' ? '📄' : '🎨'
    console.log(`${index + 1}. ${icon} ${file.name.padEnd(40)} ${formatBytes(file.size).padStart(10)}`)
  })

  // Calculate totals
  const totalSize = files.reduce((sum, f) => sum + f.size, 0)
  const jsSize = files.filter(f => f.type === 'js').reduce((sum, f) => sum + f.size, 0)
  const cssSize = files.filter(f => f.type === 'css').reduce((sum, f) => sum + f.size, 0)

  console.log('\n📈 Summary:')
  console.log('─'.repeat(60))
  console.log(`Total JavaScript: ${formatBytes(jsSize)}`)
  console.log(`Total CSS:        ${formatBytes(cssSize)}`)
  console.log(`Total Bundle:     ${formatBytes(totalSize)}`)
  console.log(`File Count:       ${files.length}`)

  // Recommendations
  console.log('\n💡 Recommendations:')
  console.log('─'.repeat(60))
  
  const largeFiles = files.filter(f => f.size > 500 * 1024) // > 500KB
  if (largeFiles.length > 0) {
    console.log('⚠️  Large files detected (>500KB):')
    largeFiles.forEach(f => {
      console.log(`   - ${f.name} (${formatBytes(f.size)})`)
      console.log(`     Consider code splitting or lazy loading`)
    })
  } else {
    console.log('✅ All files are reasonably sized')
  }

  // Check for vendor chunks
  const vendorChunks = files.filter(f => f.name.includes('vendor'))
  if (vendorChunks.length > 0) {
    console.log(`\n✅ Vendor chunks detected: ${vendorChunks.length}`)
    console.log('   Code splitting is working correctly')
  }

  console.log('\n✨ Analysis complete!')
}

analyzeBundle()







