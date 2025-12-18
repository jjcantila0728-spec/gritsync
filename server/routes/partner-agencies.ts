import { Router, Response } from 'express';
import { db } from '../db';
import { partnerAgencies } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

router.get('/', async (_req, res: Response) => {
  try {
    const agencies = await db
      .select()
      .from(partnerAgencies)
      .where(eq(partnerAgencies.is_active, true));
    res.json(agencies);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/all', authenticateToken, requireAdmin, async (_req, res: Response) => {
  try {
    const agencies = await db.select().from(partnerAgencies);
    res.json(agencies);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res: Response) => {
  try {
    const { id } = req.params;
    const [agency] = await db.select().from(partnerAgencies).where(eq(partnerAgencies.id, id));
    if (!agency) {
      return res.status(404).json({ error: 'Partner agency not found' });
    }
    res.json(agency);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = req.body;
    const [newAgency] = await db.insert(partnerAgencies).values({
      ...data,
      is_active: data.is_active ?? true,
    }).returning();
    res.status(201).json(newAgency);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body;
    
    const updateData: any = { updated_at: new Date() };
    const allowedFields = ['name', 'email', 'phone', 'website', 'address', 'city', 'state', 'country', 'zipcode', 'contact_person_name', 'contact_person_email', 'contact_person_phone', 'is_active', 'notes'];
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }
    
    const [updated] = await db.update(partnerAgencies)
      .set(updateData)
      .where(eq(partnerAgencies.id, id))
      .returning();
    if (!updated) {
      return res.status(404).json({ error: 'Partner agency not found' });
    }
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    await db.delete(partnerAgencies).where(eq(partnerAgencies.id, id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
