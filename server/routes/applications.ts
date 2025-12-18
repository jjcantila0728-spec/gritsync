import { Router, Response } from 'express';
import { db } from '../db';
import { applications, applicationTimelineSteps, applicationPayments } from '../../shared/schema';
import { eq, desc, and, or, ilike } from 'drizzle-orm';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

function generateGritAppId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'APP-';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isAdmin = req.user?.role === 'admin';
    
    let apps;
    if (isAdmin) {
      apps = await db.select().from(applications).orderBy(desc(applications.created_at));
    } else {
      apps = await db.select().from(applications)
        .where(eq(applications.user_id, req.user!.id))
        .orderBy(desc(applications.created_at));
    }

    const appsWithRelations = await Promise.all(apps.map(async (app) => {
      const timeline = await db.select().from(applicationTimelineSteps)
        .where(eq(applicationTimelineSteps.application_id, app.id))
        .orderBy(applicationTimelineSteps.created_at);
      
      const payments = await db.select().from(applicationPayments)
        .where(eq(applicationPayments.application_id, app.id));

      return {
        ...app,
        timeline_steps: timeline,
        payments: payments,
      };
    }));

    res.json(appsWithRelations);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const isAdmin = req.user?.role === 'admin';

    let app;
    
    const [byId] = await db.select().from(applications).where(eq(applications.id, id));
    
    if (!byId) {
      const [byGritId] = await db.select().from(applications).where(ilike(applications.grit_app_id, id));
      app = byGritId;
    } else {
      app = byId;
    }

    if (!app) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (!isAdmin && app.user_id !== req.user?.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const timeline = await db.select().from(applicationTimelineSteps)
      .where(eq(applicationTimelineSteps.application_id, app.id))
      .orderBy(applicationTimelineSteps.created_at);
    
    const payments = await db.select().from(applicationPayments)
      .where(eq(applicationPayments.application_id, app.id));

    res.json({
      ...app,
      timeline_steps: timeline,
      payments: payments,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const gritAppId = generateGritAppId();
    
    const [newApp] = await db.insert(applications).values({
      ...req.body,
      user_id: req.user?.id,
      grit_app_id: gritAppId,
    }).returning();

    await db.insert(applicationTimelineSteps).values({
      application_id: newApp.id,
      step_key: 'app_created',
      step_name: 'Application Created',
      status: 'completed',
      completed_at: new Date(),
    });

    res.status(201).json(newApp);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const isAdmin = req.user?.role === 'admin';

    const [existing] = await db.select().from(applications).where(eq(applications.id, id));
    
    if (!existing) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (!isAdmin && existing.user_id !== req.user?.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [updated] = await db.update(applications)
      .set({ ...req.body, updated_at: new Date() })
      .where(eq(applications.id, id))
      .returning();

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/timeline', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { step_key, step_name, status, data } = req.body;

    const [step] = await db.insert(applicationTimelineSteps).values({
      application_id: id,
      step_key,
      step_name,
      status: status || 'pending',
      data: data || {},
    }).returning();

    res.status(201).json(step);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/timeline/:stepId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { stepId } = req.params;
    const { status, data, completed_at } = req.body;

    const [updated] = await db.update(applicationTimelineSteps)
      .set({
        status,
        data,
        completed_at: status === 'completed' ? completed_at || new Date() : null,
        updated_at: new Date(),
      })
      .where(eq(applicationTimelineSteps.id, stepId))
      .returning();

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    await db.delete(applications).where(eq(applications.id, id));

    res.json({ message: 'Application deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
