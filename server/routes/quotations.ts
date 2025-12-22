import { Router, Request, Response } from 'express';
import { db } from '../db';
import { quotations } from '../../shared/schema';
import { eq, desc } from 'drizzle-orm';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Public endpoint for creating quotations (no auth required)
router.post('/public', async (req: Request, res: Response) => {
  try {
    // Calculate validity date (30 days from now)
    const validityDate = new Date();
    validityDate.setDate(validityDate.getDate() + 30);
    
    const [quotation] = await db.insert(quotations).values({
      ...req.body,
      status: 'pending',
      validity_date: validityDate.toISOString(),
    }).returning();

    res.status(201).json(quotation);
  } catch (error: any) {
    console.error('Public quotation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Public endpoint for viewing quotations by ID (no auth required)
router.get('/:id/public', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [quotation] = await db.select().from(quotations).where(eq(quotations.id, id));

    if (!quotation) {
      return res.status(404).json({ error: 'Quotation not found' });
    }

    res.json(quotation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isAdmin = req.user?.role === 'admin';

    if (isAdmin) {
      const allQuotations = await db.select().from(quotations).orderBy(desc(quotations.created_at));
      return res.json(allQuotations);
    }

    const userQuotations = await db.select().from(quotations)
      .where(eq(quotations.user_id, req.user!.id))
      .orderBy(desc(quotations.created_at));

    res.json(userQuotations);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const [quotation] = await db.select().from(quotations).where(eq(quotations.id, id));

    if (!quotation) {
      return res.status(404).json({ error: 'Quotation not found' });
    }

    if (req.user?.role !== 'admin' && quotation.user_id !== req.user?.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(quotation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [quotation] = await db.insert(quotations).values({
      ...req.body,
      user_id: req.body.user_id || req.user?.id,
    }).returning();

    res.status(201).json(quotation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const [updated] = await db.update(quotations)
      .set({ ...req.body, updated_at: new Date() })
      .where(eq(quotations.id, id))
      .returning();

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    await db.delete(quotations).where(eq(quotations.id, id));
    res.json({ message: 'Quotation deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
