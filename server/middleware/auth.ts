import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { getJwtSecret } from '../utils/jwt-secret'

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
    const decoded = jwt.verify(token, getJwtSecret()) as any
    // Reject single-use SSO tokens here — they are only accepted by
    // /api/auth/sso/exchange. Smuggling one as a Bearer would otherwise leak
    // an authenticated session with no role/email claims attached.
    if (decoded?.aud === SSO_AUD) {
      return res.status(401).json({ error: 'Invalid token type' })
    }
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
      const decoded = jwt.verify(token, getJwtSecret()) as any
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
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' })
}

export function signRefreshToken(payload: object): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '30d' })
}

// ---------------------------------------------------------------------------
// Single-use SSO tokens — for hopping a user from one subdomain to another
// (e.g. app.gritsync.com → review.gritsync.com) without re-entering credentials.
// The token is short-lived, has its own `aud` claim, and is NOT accepted by
// authenticateToken (which only honors tokens without `aud` or with the app
// audience — see below). The receiving subdomain exchanges it via
// /api/auth/sso/exchange for a normal access/refresh pair.
// ---------------------------------------------------------------------------
export const SSO_AUD = 'sso-hop'

export function signSsoToken(userId: string, targetSubdomain: string): string {
  return jwt.sign(
    { sub: userId, target: targetSubdomain },
    getJwtSecret(),
    { expiresIn: '60s', audience: SSO_AUD }
  )
}

export function verifySsoToken(token: string): { sub: string; target: string } {
  const decoded = jwt.verify(token, getJwtSecret(), { audience: SSO_AUD }) as any
  if (!decoded?.sub || !decoded?.target) {
    throw new Error('Malformed SSO token')
  }
  return { sub: decoded.sub, target: decoded.target }
}
