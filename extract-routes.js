// Script to help extract routes from server/index.js
// This is a helper script - routes will be manually extracted and organized

import fs from 'fs'

const content = fs.readFileSync('server/index.js', 'utf8')
const lines = content.split('\n')

// Find all route definitions
const routes = []
let currentRoute = null
let inRoute = false
let braceCount = 0

for (let i = 0; i < lines.length; i++) {
  const line = lines[i]
  
  // Match route definitions: app.get/post/put/patch/delete('/api/...')
  const routeMatch = line.match(/app\.(get|post|put|patch|delete)\(['"`]([^'"`]+)['"`]/)
  
  if (routeMatch) {
    if (currentRoute) {
      routes.push(currentRoute)
    }
    currentRoute = {
      method: routeMatch[1],
      path: routeMatch[2],
      startLine: i + 1,
      endLine: null,
      code: [line]
    }
    inRoute = true
    braceCount = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length
  } else if (inRoute && currentRoute) {
    currentRoute.code.push(line)
    braceCount += (line.match(/{/g) || []).length - (line.match(/}/g) || []).length
    
    // Check if route handler is complete (braceCount back to 0 or negative)
    if (braceCount <= 0 && line.includes('})')) {
      currentRoute.endLine = i + 1
      routes.push(currentRoute)
      currentRoute = null
      inRoute = false
      braceCount = 0
    }
  }
}

if (currentRoute) {
  routes.push(currentRoute)
}

// Group routes by prefix
const grouped = {}
routes.forEach(route => {
  const prefix = route.path.split('/')[2] || 'root'
  if (!grouped[prefix]) {
    grouped[prefix] = []
  }
  grouped[prefix].push(route)
})

console.log('Route Groups:')
Object.keys(grouped).forEach(key => {
  console.log(`\n${key}: ${grouped[key].length} routes`)
  grouped[key].forEach(r => {
    console.log(`  ${r.method.toUpperCase()} ${r.path} (lines ${r.startLine}-${r.endLine})`)
  })
})

// Write summary
fs.writeFileSync('route-extraction-summary.json', JSON.stringify({
  totalRoutes: routes.length,
  groups: Object.keys(grouped).map(key => ({
    prefix: key,
    count: grouped[key].length,
    routes: grouped[key].map(r => ({
      method: r.method,
      path: r.path,
      lines: `${r.startLine}-${r.endLine}`
    }))
  }))
}, null, 2))

console.log('\n✅ Route extraction summary written to route-extraction-summary.json')


