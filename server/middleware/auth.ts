import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'gritsync-jwt-secret-key-2024'

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    email: string
    role: string
    grit_id?: string
    first_name?: string
    last_name?: string
    middle_name?: string
  }
}

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: 'No token provided' })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any
    req.user = decoded
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any
      req.user = decoded
    } catch {
      // ignore invalid tokens for optional auth
    }
  }
  next()
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' })
  }
  next()
}

export function signToken(payload: object): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export function signRefreshToken(payload: object): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' })
}
