import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { authenticateToken, cacheStaticAssets } from '../middleware/index.js'
import { logger } from '../utils/logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

// Serve uploaded files with caching
router.get('/:userId/:filename', authenticateToken, cacheStaticAssets(86400), (req, res) => {
  try {
    const { userId, filename } = req.params
    
    // Check permissions
    if (req.user.role !== 'admin' && req.user.id !== userId) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const filePath = path.join(__dirname, '..', 'uploads', userId, filename)
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' })
    }

    // Get file stats for Last-Modified header
    const stats = fs.statSync(filePath)
    res.set('Last-Modified', stats.mtime.toUTCString())
    res.set('ETag', `"${stats.mtime.getTime()}-${stats.size}"`)

    res.sendFile(filePath)
  } catch (error) {
    logger.error('Error serving file', error)
    res.status(500).json({ error: 'Failed to serve file' })
  }
})

export default router


