import { Router, Request, Response } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth'

const router = Router()

const UPLOADS_DIR = path.join(process.cwd(), 'uploads')
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true })
}

const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
})

router.post('/upload', authenticateToken, upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' })
    }

    const filePath = req.body.path
    if (!filePath) {
      return res.status(400).json({ error: 'No path provided' })
    }

    const sanitized = filePath.replace(/\.\./g, '').replace(/^\//, '')
    const fullPath = path.join(UPLOADS_DIR, sanitized)
    const dir = path.dirname(fullPath)

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    fs.writeFileSync(fullPath, req.file.buffer)

    res.json({ path: sanitized })
  } catch (error: any) {
    console.error('Storage upload error:', error)
    res.status(500).json({ error: error.message || 'Upload failed' })
  }
})

router.get('/download', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const filePath = req.query.path as string
    if (!filePath) {
      return res.status(400).json({ error: 'No path provided' })
    }

    const sanitized = filePath.replace(/\.\./g, '').replace(/^\//, '')
    const fullPath = path.join(UPLOADS_DIR, sanitized)

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found' })
    }

    const ext = path.extname(fullPath).toLowerCase()
    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    }
    const contentType = mimeTypes[ext] || 'application/octet-stream'

    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(fullPath)}"`)
    res.send(fs.readFileSync(fullPath))
  } catch (error: any) {
    console.error('Storage download error:', error)
    res.status(500).json({ error: error.message || 'Download failed' })
  }
})

router.get('/signed-url', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const filePath = req.query.path as string
    if (!filePath) {
      return res.status(400).json({ error: 'No path provided' })
    }

    const sanitized = filePath.replace(/\.\./g, '').replace(/^\//, '')
    const fullPath = path.join(UPLOADS_DIR, sanitized)

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found' })
    }

    const token = req.headers.authorization?.split(' ')[1] || ''
    const url = `/api/storage/file/${encodeURIComponent(sanitized)}?t=${token}`
    res.json({ url })
  } catch (error: any) {
    console.error('Storage signed-url error:', error)
    res.status(500).json({ error: error.message || 'Failed to create URL' })
  }
})

router.get('/file/*filePath', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const filePath = (req.params as any).filePath
    const sanitized = filePath.replace(/\.\./g, '').replace(/^\//, '')
    const fullPath = path.join(UPLOADS_DIR, sanitized)

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found' })
    }

    const ext = path.extname(fullPath).toLowerCase()
    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    }
    const contentType = mimeTypes[ext] || 'application/octet-stream'
    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(fullPath)}"`)
    res.send(fs.readFileSync(fullPath))
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to serve file' })
  }
})

router.get('/public/*filePath', async (req: Request, res: Response) => {
  try {
    const filePath = (req.params as any).filePath
    const sanitized = filePath.replace(/\.\./g, '').replace(/^\//, '')
    const fullPath = path.join(UPLOADS_DIR, sanitized)

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found' })
    }

    const ext = path.extname(fullPath).toLowerCase()
    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    }
    const contentType = mimeTypes[ext] || 'application/octet-stream'
    res.setHeader('Content-Type', contentType)
    res.send(fs.readFileSync(fullPath))
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to serve file' })
  }
})

router.delete('/delete', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { paths } = req.body
    if (!Array.isArray(paths)) {
      return res.status(400).json({ error: 'paths must be an array' })
    }

    for (const filePath of paths) {
      const sanitized = filePath.replace(/\.\./g, '').replace(/^\//, '')
      const fullPath = path.join(UPLOADS_DIR, sanitized)
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath)
      }
    }

    res.json({ success: true })
  } catch (error: any) {
    console.error('Storage delete error:', error)
    res.status(500).json({ error: error.message || 'Delete failed' })
  }
})

export default router
