import jwt from 'jsonwebtoken'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// JWT Secret - require in production, use default only in development
let JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is required in production')
  }
  JWT_SECRET = 'your-secret-key-change-in-production'
  console.warn('⚠️  Using default JWT_SECRET. Set JWT_SECRET environment variable in production!')
}

// Auth middleware - supports both JWT and Supabase tokens
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: 'Access token required' })
  }

  // Try JWT verification first (for legacy auth)
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (!err && user) {
      req.user = user
      return next()
    }

    // If JWT fails, try Supabase token verification
    // For Supabase tokens, we'll verify by calling Supabase API
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (supabaseUrl && (supabaseAnonKey || supabaseServiceKey)) {
      // Use anon key if available, otherwise use service role key
      const supabaseKey = supabaseAnonKey || supabaseServiceKey
      const supabaseClient = createClient(supabaseUrl, supabaseKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      })

      // Verify token with Supabase - getUser() reads from Authorization header
      supabaseClient.auth.getUser()
        .then(({ data: { user: supabaseUser }, error: supabaseError }) => {
          if (supabaseError || !supabaseUser) {
            return res.status(403).json({ error: 'Invalid or expired token' })
          }

          // Get user role from metadata
          const role = supabaseUser.user_metadata?.role || supabaseUser.app_metadata?.role || 'client'
          req.user = {
            id: supabaseUser.id,
            email: supabaseUser.email,
            role: role
          }
          next()
        })
        .catch(() => {
          return res.status(403).json({ error: 'Invalid or expired token' })
        })
    } else {
      // No Supabase config, fall back to JWT error
      return res.status(403).json({ error: 'Invalid or expired token' })
    }
  })
}

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userId = req.user?.id || 'temp'
    const uploadPath = path.join(__dirname, '..', 'uploads', userId)
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true })
    }
    cb(null, uploadPath)
  },
  filename: (req, file, cb) => {
    // Use the original filename (which is already renamed by frontend)
    // Format: {document_type}_{firstname}_{lastname}.ext
    // If filename doesn't match expected format, add a unique suffix to avoid conflicts
    const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')
    cb(null, sanitizedFilename)
  }
})

export const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit to match frontend validation
})

// Re-export cache middleware
export * from './cache.js'
export * from './responseCache.js'

