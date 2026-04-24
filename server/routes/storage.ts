import { Router, Request, Response } from 'express'
import multer from 'multer'
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth'
import pool from '../db'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } })

const MIME_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  txt: 'text/plain',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return MIME_TYPES[ext] || 'application/octet-stream'
}

function sanitizeKey(filePath: string): string {
  return filePath.replace(/\.\./g, '').replace(/^\//, '')
}

router.post('/upload', authenticateToken, upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' })
    const filePath = req.body.path
    if (!filePath) return res.status(400).json({ error: 'No path provided' })

    const key = sanitizeKey(filePath)
    const contentType = getMimeType(filePath)

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

router.get('/download', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const filePath = req.query.path as string
    if (!filePath) return res.status(400).json({ error: 'No path provided' })

    const key = sanitizeKey(filePath)
    const result = await pool.query(
      'SELECT data, content_type, storage_key FROM file_storage WHERE storage_key = $1',
      [key]
    )

    if (result.rows.length === 0) return res.status(404).json({ error: 'File not found' })

    const row = result.rows[0]
    const filename = key.split('/').pop() || 'file'
    res.setHeader('Content-Type', row.content_type)
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`)
    res.send(row.data)
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

    if (result.rows.length === 0) return res.status(404).json({ error: 'File not found' })

    const token = req.headers.authorization?.split(' ')[1] || ''
    const url = `/api/storage/file/${encodeURIComponent(key)}?t=${token}`
    res.json({ url })
  } catch (error: any) {
    console.error('Signed URL error:', error)
    res.status(500).json({ error: error.message || 'Failed to create URL' })
  }
})

router.get('/file/*filePath', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const filePath = (req.params as any).filePath
    const key = sanitizeKey(filePath)

    const result = await pool.query(
      'SELECT data, content_type, storage_key FROM file_storage WHERE storage_key = $1',
      [key]
    )

    if (result.rows.length === 0) return res.status(404).json({ error: 'File not found' })

    const row = result.rows[0]
    const filename = key.split('/').pop() || 'file'
    res.setHeader('Content-Type', row.content_type)
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`)
    res.send(row.data)
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to serve file' })
  }
})

router.get('/public/*filePath', async (req: Request, res: Response) => {
  try {
    const filePath = (req.params as any).filePath
    const key = sanitizeKey(filePath)

    const result = await pool.query(
      'SELECT data, content_type FROM file_storage WHERE storage_key = $1',
      [key]
    )

    if (result.rows.length === 0) return res.status(404).json({ error: 'File not found' })

    const row = result.rows[0]
    res.setHeader('Content-Type', row.content_type)
    res.send(row.data)
  } catch (error: any) {
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
