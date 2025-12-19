import { Router, Response } from 'express';
import { db } from '../db';
import { applications, applicationTimelineSteps, applicationPayments } from '../../shared/schema';
import { eq, desc } from 'drizzle-orm';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth';

const router = Router();


router.get('/service-types', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const apps = await db.select({ service_type: applications.service_type })
      .from(applications)
      .where(eq(applications.user_id, req.user!.id));
    
    const serviceTypes = [...new Set(apps.map(a => a.service_type).filter(Boolean))] as string[];
    res.json(serviceTypes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

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

    const [app] = await db.select().from(applications).where(eq(applications.id, id));

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
    const { first_name, last_name, email, phone, service_type, state_of_application, notes } = req.body;
    
    const applicant_name = first_name && last_name 
      ? `${first_name} ${last_name}` 
      : req.body.applicant_name || req.body.name || 'Unknown';
    
    const [newApp] = await db.insert(applications).values({
      user_id: req.user?.id,
      applicant_name,
      email: email || req.user?.email || '',
      phone: phone || req.body.mobile_number,
      service_type: service_type || 'NCLEX Processing',
      state_of_application: state_of_application || req.body.service_state,
      notes,
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
