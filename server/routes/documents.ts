import { Router, Response } from 'express';
import { db } from '../db';
import { userDocuments } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { uploadFile, deleteFile, listUserFiles, getFileDownloadUrl, downloadFile } from '../services/file-storage';

const router = Router();

router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const documents = await db.select().from(userDocuments).where(eq(userDocuments.user_id, userId));
    res.json(documents);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/user/:userId', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const documents = await db.select().from(userDocuments).where(eq(userDocuments.user_id, userId));
    res.json(documents);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const [document] = await db.select().from(userDocuments).where(eq(userDocuments.id, id));
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    if (req.user!.role !== 'admin' && document.user_id !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json(document);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/download', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const [document] = await db.select().from(userDocuments).where(eq(userDocuments.id, id));
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    if (req.user!.role !== 'admin' && document.user_id !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    if (!document.storage_path) {
      return res.status(404).json({ error: 'File not available' });
    }
    
    const result = await downloadFile(document.storage_path);
    
    if (!result.success) {
      return res.status(502).json({ error: result.error });
    }
    
    res.setHeader('Content-Type', result.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${document.filename}"`);
    res.send(result.data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/url', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const [document] = await db.select().from(userDocuments).where(eq(userDocuments.id, id));
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    if (req.user!.role !== 'admin' && document.user_id !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    if (!document.storage_path) {
      return res.status(404).json({ error: 'File not available' });
    }
    
    const result = await getFileDownloadUrl(document.storage_path);
    
    if (!result.success) {
      return res.status(502).json({ error: result.error });
    }
    
    res.json({ url: result.url });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/upload', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { filename, mimeType, fileData, documentType, applicationId } = req.body;
    
    if (!filename || !fileData || !mimeType) {
      return res.status(400).json({ error: 'Missing required fields: filename, fileData, mimeType' });
    }
    
    const buffer = Buffer.from(fileData, 'base64');
    
    const uploadResult = await uploadFile(userId, buffer, filename, mimeType);
    
    if (!uploadResult.success) {
      return res.status(502).json({ error: uploadResult.error });
    }
    
    const [newDocument] = await db.insert(userDocuments).values({
      user_id: userId,
      filename,
      file_type: mimeType,
      document_type: documentType || 'other',
      storage_path: uploadResult.fileId!,
      file_size: buffer.length,
      application_id: applicationId || null,
    }).returning();
    
    res.status(201).json(newDocument);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const [document] = await db.select().from(userDocuments).where(eq(userDocuments.id, id));
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    if (req.user!.role !== 'admin' && document.user_id !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    if (document.storage_path) {
      const deleteResult = await deleteFile(document.storage_path);
      if (!deleteResult.success) {
        console.warn('Failed to delete file from storage:', deleteResult.error);
      }
    }
    
    await db.delete(userDocuments).where(eq(userDocuments.id, id));
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/drive/files', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const result = await listUserFiles(userId);
    
    if (!result.success) {
      return res.status(502).json({ error: result.error });
    }
    
    res.json(result.files);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
