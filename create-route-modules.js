// Script to create route modules by extracting code from server/index.js
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const originalFile = fs.readFileSync('server/index.js', 'utf8')
const lines = originalFile.split('\n')

// Route groups with their line ranges and dependencies
const routeGroups = {
  'quotations': {
    routes: [
      { start: 2554, end: 2585 },
      { start: 2588, end: 2659 },
      { start: 2661, end: 2680 },
      { start: 2683, end: 2705 },
      { start: 2708, end: 2735 },
      { start: 2738, end: 2800 },
      { start: 2803, end: 2822 },
      { start: 3126, end: 3169 },
      { start: 3172, end: 3194 }
    ],
    imports: ['express', 'db', 'authenticateToken', 'generateQuoteId', 'bcrypt', 'generateGritId', 'getStripe'],
    path: '/api/quotations'
  },
  'services': {
    routes: [
      { start: 2826, end: 2922 },
      { start: 2925, end: 2960 },
      { start: 2963, end: 3037 },
      { start: 3040, end: 3103 },
      { start: 3106, end: 3123 }
    ],
    imports: ['express', 'db', 'authenticateToken'],
    path: '/api/services'
  },
  'clients': {
    routes: [
      { start: 3197, end: 3216 },
      { start: 3219, end: 3237 },
      { start: 3240, end: 3266 }
    ],
    imports: ['express', 'db', 'authenticateToken'],
    path: '/api/clients'
  },
  'notifications': {
    routes: [
      { start: 4396, end: 4414 },
      { start: 4416, end: 4424 },
      { start: 4426, end: 4442 },
      { start: 4444, end: 4452 }
    ],
    imports: ['express', 'db', 'authenticateToken'],
    path: '/api/notifications'
  }
}

// Create route modules directory if it doesn't exist
const routesDir = path.join(__dirname, 'server', 'routes')
if (!fs.existsSync(routesDir)) {
  fs.mkdirSync(routesDir, { recursive: true })
}

// Function to extract code between line numbers
function extractCode(startLine, endLine) {
  // Line numbers are 1-indexed, array is 0-indexed
  return lines.slice(startLine - 1, endLine).join('\n')
}

// Function to convert app.route() to router.route()
function convertToRouter(code, routePath) {
  // Remove the base path from route definitions
  const basePath = routePath.replace('/api/', '')
  
  // Replace app.get/post/put/patch/delete with router.get/post/put/patch/delete
  code = code.replace(/app\.(get|post|put|patch|delete)\(['"`]\/api\//g, (match, method) => {
    return `router.${method}(`
  })
  
  // Remove /api/ prefix from paths
  code = code.replace(/router\.(get|post|put|patch|delete)\(['"`]\/api\//g, (match, method) => {
    return `router.${method}('`
  })
  
  // Handle regex routes
  code = code.replace(/app\.get\(/g, 'router.get(')
  
  return code
}

// Create route modules
Object.keys(routeGroups).forEach(groupName => {
  const group = routeGroups[groupName]
  let moduleCode = `import express from 'express'
import db from '../db/index.js'
import { authenticateToken } from '../middleware/index.js'
`
  
  // Add additional imports based on group
  if (groupName === 'quotations') {
    moduleCode += `import { generateQuoteId, generateGritId } from '../utils/index.js'
import { getStripe } from '../services/stripe.js'
import bcrypt from 'bcryptjs'
`
  }
  
  moduleCode += `
const router = express.Router()
`
  
  // Extract and convert routes
  group.routes.forEach((route, index) => {
    const code = extractCode(route.start, route.end)
    const converted = convertToRouter(code, group.path)
    
    // Remove the route definition line and extract just the handler
    const handlerMatch = converted.match(/router\.(get|post|put|patch|delete)\([^,]+,\s*(.+)/s)
    if (handlerMatch) {
      const method = handlerMatch[1]
      const handler = handlerMatch[2]
      
      // Extract the path
      const pathMatch = converted.match(/router\.(get|post|put|patch|delete)\(['"`]([^'"`]+)['"`]/)
      const routePath = pathMatch ? pathMatch[2].replace('/api/' + groupName.replace('s', ''), '') : ''
      
      moduleCode += `
// Route ${index + 1}
router.${method}('${routePath}', ${handler.trim()}
`
    } else {
      // Fallback: use the converted code as-is
      moduleCode += converted + '\n'
    }
  })
  
  moduleCode += `
export default router
`
  
  // Write the module file
  const filePath = path.join(routesDir, `${groupName}.js`)
  fs.writeFileSync(filePath, moduleCode)
  console.log(`Created ${filePath}`)
})

console.log('\n✅ Route modules created!')


