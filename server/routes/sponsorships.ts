import { Router, Response } from 'express';
import { db } from '../db';
import { nclexSponsorships } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role === 'admin') {
      const allSponsorships = await db.select().from(nclexSponsorships);
      return res.json(allSponsorships);
    }
    const userSponsorships = await db
      .select()
      .from(nclexSponsorships)
      .where(eq(nclexSponsorships.user_id, req.user!.id));
    res.json(userSponsorships);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const [sponsorship] = await db.select().from(nclexSponsorships).where(eq(nclexSponsorships.id, id));
    if (!sponsorship) {
      return res.status(404).json({ error: 'Sponsorship not found' });
    }
    if (req.user?.role !== 'admin' && sponsorship.user_id !== req.user?.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json(sponsorship);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = req.body;
    const [newSponsorship] = await db.insert(nclexSponsorships).values({
      ...data,
      user_id: req.user!.id,
      status: data.status ?? 'pending',
    }).returning();
    res.status(201).json(newSponsorship);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body;
    
    const [existing] = await db.select().from(nclexSponsorships).where(eq(nclexSponsorships.id, id));
    if (!existing) {
      return res.status(404).json({ error: 'Sponsorship not found' });
    }
    if (req.user?.role !== 'admin' && existing.user_id !== req.user?.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const updateData: any = { updated_at: new Date() };
    const allowedFields = ['status', 'notes', 'application_id'];
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }
    
    const [updated] = await db.update(nclexSponsorships)
      .set(updateData)
      .where(eq(nclexSponsorships.id, id))
      .returning();
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    await db.delete(nclexSponsorships).where(eq(nclexSponsorships.id, id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
