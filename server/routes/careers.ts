import { Router, Request, Response } from 'express';
import { db } from '../db';
import { careers, careerApplications, partnerAgencies } from '../../shared/schema';
import { eq, desc, and } from 'drizzle-orm';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const activeCareers = await db.select().from(careers)
      .where(eq(careers.is_active, true))
      .orderBy(desc(careers.created_at));
    res.json(activeCareers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/all', authenticateToken, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const allCareers = await db.select().from(careers).orderBy(desc(careers.created_at));
    res.json(allCareers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [career] = await db.select().from(careers).where(eq(careers.id, id));

    if (!career) {
      return res.status(404).json({ error: 'Career not found' });
    }

    await db.update(careers)
      .set({ views_count: (career.views_count || 0) + 1 })
      .where(eq(careers.id, id));

    res.json(career);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [career] = await db.insert(careers).values({
      ...req.body,
      created_by: req.user?.id,
    }).returning();

    res.status(201).json(career);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const [updated] = await db.update(careers)
      .set({ ...req.body, updated_at: new Date() })
      .where(eq(careers.id, id))
      .returning();

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    await db.delete(careers).where(eq(careers.id, id));
    res.json({ message: 'Career deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/applications', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const applications = await db.select().from(careerApplications)
      .where(eq(careerApplications.career_id, id))
      .orderBy(desc(careerApplications.created_at));

    res.json(applications);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/apply', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [application] = await db.insert(careerApplications).values({
      ...req.body,
      career_id: id,
    }).returning();

    await db.update(careers)
      .set({ applications_count: careers.applications_count })
      .where(eq(careers.id, id));

    res.status(201).json(application);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/apply', async (req: Request, res: Response) => {
  try {
    const { career_id, first_name, last_name, email, mobile_number } = req.body;

    if (!first_name || !last_name || !email || !mobile_number) {
      return res.status(400).json({ error: 'First name, last name, email, and mobile number are required' });
    }

    const [application] = await db.insert(careerApplications).values({
      ...req.body,
      career_id: career_id || null,
    }).returning();

    if (career_id) {
      await db.update(careers)
        .set({ applications_count: careers.applications_count })
        .where(eq(careers.id, career_id));
    }

    res.status(201).json(application);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/applications', authenticateToken, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const applications = await db.select().from(careerApplications).orderBy(desc(careerApplications.created_at));
    res.json(applications);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/applications/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const [updated] = await db.update(careerApplications)
      .set({ ...req.body, updated_at: new Date() })
      .where(eq(careerApplications.id, id))
      .returning();

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/partner-agencies', authenticateToken, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const agencies = await db.select().from(partnerAgencies).orderBy(desc(partnerAgencies.created_at));
    res.json(agencies);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/partner-agencies', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [agency] = await db.insert(partnerAgencies).values(req.body).returning();
    res.status(201).json(agency);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/partner-agencies/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const [updated] = await db.update(partnerAgencies)
      .set({ ...req.body, updated_at: new Date() })
      .where(eq(partnerAgencies.id, id))
      .returning();

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
