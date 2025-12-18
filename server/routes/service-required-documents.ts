import { Router, Response } from 'express';
import { db } from '../db';
import { serviceRequiredDocuments } from '../../shared/schema';
import { eq, inArray, and } from 'drizzle-orm';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

router.get('/', async (_req, res: Response) => {
  try {
    const documents = await db.select().from(serviceRequiredDocuments).where(eq(serviceRequiredDocuments.is_active, true));
    res.json(documents);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/service/:serviceType', async (req, res: Response) => {
  try {
    const { serviceType } = req.params;
    const documents = await db.select()
      .from(serviceRequiredDocuments)
      .where(and(
        eq(serviceRequiredDocuments.service_type, serviceType),
        eq(serviceRequiredDocuments.is_active, true)
      ));
    res.json(documents);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/by-types', async (req, res: Response) => {
  try {
    const { serviceTypes } = req.body;
    
    if (!serviceTypes || !Array.isArray(serviceTypes) || serviceTypes.length === 0) {
      return res.json([]);
    }
    
    const documents = await db.select()
      .from(serviceRequiredDocuments)
      .where(and(
        inArray(serviceRequiredDocuments.service_type, serviceTypes),
        eq(serviceRequiredDocuments.is_active, true)
      ));
    
    res.json(documents);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { service_type, document_type, document_name, description, required, sort_order } = req.body;
    
    if (!service_type || !document_type || !document_name) {
      return res.status(400).json({ error: 'service_type, document_type, and document_name are required' });
    }
    
    const [newDocument] = await db.insert(serviceRequiredDocuments).values({
      service_type,
      document_type,
      document_name,
      description,
      required: required ?? true,
      sort_order: sort_order ?? 0,
    }).returning();
    
    res.status(201).json(newDocument);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const [updated] = await db.update(serviceRequiredDocuments)
      .set({ ...updates, updated_at: new Date() })
      .where(eq(serviceRequiredDocuments.id, id))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ error: 'Document requirement not found' });
    }
    
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const [deleted] = await db.delete(serviceRequiredDocuments)
      .where(eq(serviceRequiredDocuments.id, id))
      .returning();
    
    if (!deleted) {
      return res.status(404).json({ error: 'Document requirement not found' });
    }
    
    res.json(deleted);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
