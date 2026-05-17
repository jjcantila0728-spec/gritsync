import { Router, Request, Response, NextFunction } from 'express'
import multer from 'multer'
import jwt from 'jsonwebtoken'
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth'
import pool from '../db'
import { supabaseAdmin } from '../lib/supabase'

/**
 * Name of the Supabase Storage bucket that holds user documents (2x2,
 * diploma, passport, etc.). The web app at src/lib/storage-urls.ts +
 * src/lib/api-service.ts both target this bucket, so keeping these in
 * sync makes web + mobile uploads visible to each other.
 */
const DOCUMENTS_BUCKET = 'documents'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } })

const JWT_SECRET = process.env.JWT_SECRET || 'gritsync-jwt-secret-key-2024'

const MIME_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  heic: 'image/heic',
  txt: 'text/plain',
  csv: 'text/csv',
  rtf: 'application/rtf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  zip: 'application/zip',
  rar: 'application/vnd.rar',
  '7z': 'application/x-7z-compressed',
  json: 'application/json',
  xml: 'application/xml',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  ogg: 'audio/ogg',
}

function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return MIME_TYPES[ext] || 'application/octet-stream'
}

function sanitizeKey(filePath: string): string {
  return filePath.replace(/\.\./g, '').replace(/^\//, '')
}

// Auth middleware that accepts token from Authorization header OR ?t= query param
// Used for file routes that are loaded via <img> or <a> tags (no headers possible)
function authenticateTokenOrQuery(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization']
  const token = (authHeader && authHeader.split(' ')[1]) || (req.query.t as string)

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

async function serveFile(key: string, res: Response) {
  // 1. Legacy path: file lives in our Postgres `file_storage` table.
  const result = await pool.query(
    'SELECT data, content_type, storage_key FROM file_storage WHERE storage_key = $1',
    [key]
  )
  if (result.rows.length > 0) {
    const row = result.rows[0]
    const filename = key.split('/').pop() || 'file'
    res.setHeader('Content-Type', row.content_type)
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`)
    res.setHeader('Cache-Control', 'private, max-age=3600')
    return res.send(row.data)
  }

  // 2. Fallback: file may have been uploaded via the new
  //    /api/storage/upload-document path which writes to Supabase Storage.
  //    Mint a short-lived signed URL and 302 the caller — RN <Image>, the
  //    in-app browser, and any <a href> all follow redirects, so callers
  //    don't need to know whether bytes are in Postgres or Supabase.
  try {
    const { data, error } = await supabaseAdmin.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUrl(key, 3600)
    if (!error && data?.signedUrl) {
      return res.redirect(302, data.signedUrl)
    }
  } catch {
    // fall through to 404
  }
  return res.status(404).json({ error: 'File not found' })
}

router.post('/upload', authenticateToken, upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' })
    const filePath = req.body.path
    if (!filePath) return res.status(400).json({ error: 'No path provided' })

    const key = sanitizeKey(filePath)
    // Prefer the browser-reported MIME type (covers "all kinds" of files);
    // fall back to extension-based detection.
    const browserType = (req.file.mimetype || '').trim()
    const contentType = browserType && browserType !== 'application/octet-stream' ? browserType : getMimeType(filePath)

    await pool.query(
      `INSERT INTO file_storage (storage_key, data, content_type, file_size)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (storage_key) DO UPDATE
       SET data = EXCLUDED.data,
           content_type = EXCLUDED.content_type,
           file_size = EXCLUDED.file_size,
           updated_at = NOW()`,
      [key, req.file.buffer, contentType, req.file.size]
    )

    res.json({ path: key })
  } catch (error: any) {
    console.error('Upload error:', error)
    res.status(500).json({ error: error.message || 'Upload failed' })
  }
})

/**
 * Document-specific upload that lands in the SAME Supabase Storage bucket
 * the web app reads from, so files uploaded via mobile show up on
 * /client/documents and vice versa.
 *
 * Why a separate route from /upload? The legacy /upload writes to the
 * Postgres `file_storage` table (which the web app's documents page
 * never reads — it talks directly to Supabase). Routing user_documents
 * through Supabase Storage keeps a single source of truth without
 * breaking other callers of /upload (NCLEXCheckout payment screenshots,
 * etc).
 *
 * Path convention enforced server-side: `<userId>/<filename>`. The
 * client picks the filename (typically `${docType}.${ext}`), and we
 * scope every upload to the authenticated user's directory regardless
 * of what they pass — so a malicious client can't write into someone
 * else's folder.
 */
router.post('/upload-document', authenticateToken, upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' })
    const userId = req.user!.id

    // The caller passes either a relative filename (`passport.pdf`) or a
    // full path that may or may not be prefixed with their own userId.
    // Normalize so the final key is always `<userId>/<filename>`.
    const rawPath = String(req.body.path ?? req.file.originalname ?? 'file').trim()
    const filename = sanitizeKey(rawPath).split('/').filter(Boolean).pop() ?? `file_${Date.now()}`
    const key = `${userId}/${filename}`

    const contentType = (req.file.mimetype || '').trim() || getMimeType(filename)

    const { error } = await supabaseAdmin.storage
      .from(DOCUMENTS_BUCKET)
      .upload(key, req.file.buffer, {
        contentType,
        upsert: true,
        cacheControl: '3600',
      })

    if (error) {
      console.error('Supabase upload error:', error)
      return res.status(500).json({ error: error.message || 'Upload to Supabase failed' })
    }

    res.json({ path: key, bucket: DOCUMENTS_BUCKET })
  } catch (error: any) {
    console.error('upload-document error:', error)
    res.status(500).json({ error: error.message || 'Upload failed' })
  }
})

/**
 * Generate a short-lived Supabase signed URL for a document. Mobile uses
 * this to open uploaded files in the in-app browser — matches what
 * src/lib/storage-urls.ts → getSignedFileUrl() returns on web.
 */
router.get('/document-url', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id
    const raw = (req.query.path as string) || ''
    if (!raw) return res.status(400).json({ error: 'path required' })

    const key = sanitizeKey(decodeURIComponent(raw))
    // Block path traversal — caller can only request files in their own folder.
    // Admin role is allowed to peek at anyone's path (for support flows).
    if (req.user!.role !== 'admin' && !key.startsWith(`${userId}/`)) {
      return res.status(403).json({ error: 'Not allowed' })
    }
    const expiresIn = Math.min(Number(req.query.expiresIn) || 3600, 24 * 3600)

    const { data, error } = await supabaseAdmin.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUrl(key, expiresIn)

    if (error || !data?.signedUrl) {
      return res.status(404).json({ error: error?.message || 'File not found' })
    }
    res.json({ url: data.signedUrl, expiresIn })
  } catch (error: any) {
    console.error('document-url error:', error)
    res.status(500).json({ error: error.message || 'Failed to sign URL' })
  }
})

/**
 * Delete a user document from Supabase Storage. Same path-scope check as
 * /document-url so users can only delete their own files.
 */
router.delete('/document', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id
    const raw = (req.body?.path as string) || ''
    if (!raw) return res.status(400).json({ error: 'path required' })

    const key = sanitizeKey(raw)
    if (req.user!.role !== 'admin' && !key.startsWith(`${userId}/`)) {
      return res.status(403).json({ error: 'Not allowed' })
    }

    const { error } = await supabaseAdmin.storage
      .from(DOCUMENTS_BUCKET)
      .remove([key])
    if (error) {
      console.error('document delete error:', error)
      return res.status(500).json({ error: error.message })
    }
    res.json({ deleted: key })
  } catch (error: any) {
    console.error('delete document error:', error)
    res.status(500).json({ error: error.message || 'Delete failed' })
  }
})

router.get('/download', authenticateTokenOrQuery, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const filePath = req.query.path as string
    if (!filePath) return res.status(400).json({ error: 'No path provided' })
    const key = sanitizeKey(filePath)
    await serveFile(key, res)
  } catch (error: any) {
    console.error('Download error:', error)
    res.status(500).json({ error: error.message || 'Download failed' })
  }
})

router.get('/signed-url', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const filePath = req.query.path as string
    if (!filePath) return res.status(400).json({ error: 'No path provided' })

    const key = sanitizeKey(filePath)
    const result = await pool.query(
      'SELECT storage_key FROM file_storage WHERE storage_key = $1',
      [key]
    )

    if (result.rows.length > 0) {
      const token = req.headers.authorization?.split(' ')[1] || ''
      const url = `/api/storage/file?path=${encodeURIComponent(key)}&t=${token}`
      return res.json({ url })
    }

    // Fallback: file lives in Supabase Storage (uploaded via the web app or
    // via /api/storage/upload-document). Hand back the direct Supabase URL
    // so the caller doesn't go through our /file proxy for a redirect.
    try {
      const { data, error } = await supabaseAdmin.storage
        .from(DOCUMENTS_BUCKET)
        .createSignedUrl(key, 3600)
      if (!error && data?.signedUrl) {
        return res.json({ url: data.signedUrl })
      }
    } catch {
      // fall through to 404
    }
    return res.status(404).json({ error: 'File not found' })
  } catch (error: any) {
    console.error('Signed URL error:', error)
    res.status(500).json({ error: error.message || 'Failed to create URL' })
  }
})

// File serving route — accepts token from ?t= query param so <img> tags work
// Uses ?path= query param to avoid wildcard routing issues with slashes in paths
router.get('/file', authenticateTokenOrQuery, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rawPath = req.query.path as string
    if (!rawPath) return res.status(400).json({ error: 'No path provided' })
    const filePath = decodeURIComponent(rawPath)
    const key = sanitizeKey(filePath)
    await serveFile(key, res)
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to serve file' })
  }
})

router.get('/public/*filePath', async (req: Request, res: Response) => {
  try {
    const raw = (req.params as any).filePath
    // Express 5 returns wildcard captures as an array of segments; join them
    // back into a slash-delimited path before sanitizing.
    const filePath = Array.isArray(raw) ? raw.join('/') : String(raw || '')
    const key = sanitizeKey(decodeURIComponent(filePath))

    const result = await pool.query(
      'SELECT data, content_type FROM file_storage WHERE storage_key = $1',
      [key]
    )

    if (result.rows.length === 0) return res.status(404).json({ error: 'File not found' })

    const row = result.rows[0]
    res.setHeader('Content-Type', row.content_type)
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.send(row.data)
  } catch (error: any) {
    console.error('Public file serve error:', error)
    res.status(500).json({ error: 'Failed to serve file' })
  }
})

router.delete('/delete', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { paths } = req.body
    if (!Array.isArray(paths)) return res.status(400).json({ error: 'paths must be an array' })

    for (const filePath of paths) {
      const key = sanitizeKey(filePath)
      await pool.query('DELETE FROM file_storage WHERE storage_key = $1', [key])
    }

    res.json({ success: true })
  } catch (error: any) {
    console.error('Delete error:', error)
    res.status(500).json({ error: error.message || 'Delete failed' })
  }
})

export default router
