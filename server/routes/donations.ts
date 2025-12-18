import { Router, Request, Response } from 'express';
import { db } from '../db';
import { donations, nclexSponsorships } from '../../shared/schema';
import { eq, desc } from 'drizzle-orm';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

router.get('/public-stats', async (_req: Request, res: Response) => {
  try {
    const allDonations = await db.select().from(donations);
    const totalDonated = allDonations.reduce((sum, d) => sum + parseFloat(d.amount?.toString() || '0'), 0);
    const totalDonors = allDonations.length;
    
    res.json({
      totalDonated,
      totalDonors,
      goal: 50000,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', authenticateToken, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const allDonations = await db.select().from(donations).orderBy(desc(donations.created_at));
    res.json(allDonations);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const [donation] = await db.select().from(donations).where(eq(donations.id, id));

    if (!donation) {
      return res.status(404).json({ error: 'Donation not found' });
    }

    res.json(donation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const [donation] = await db.insert(donations).values(req.body).returning();
    res.status(201).json(donation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const [updated] = await db.update(donations)
      .set({ ...req.body, updated_at: new Date() })
      .where(eq(donations.id, id))
      .returning();

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/sponsorships', authenticateToken, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const sponsorships = await db.select().from(nclexSponsorships).orderBy(desc(nclexSponsorships.created_at));
    res.json(sponsorships);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/sponsorships', async (req: Request, res: Response) => {
  try {
    const [sponsorship] = await db.insert(nclexSponsorships).values(req.body).returning();
    res.status(201).json(sponsorship);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/sponsorships/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const [updated] = await db.update(nclexSponsorships)
      .set({ ...req.body, updated_at: new Date() })
      .where(eq(nclexSponsorships.id, id))
      .returning();

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
