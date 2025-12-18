import { Router, Response } from 'express';
import { db } from '../db';
import { applicationTimelineSteps, applications } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

async function canAccessApplication(userId: string, userRole: string, applicationId: string): Promise<boolean> {
  if (userRole === 'admin') return true;
  const [app] = await db.select({ user_id: applications.user_id })
    .from(applications)
    .where(eq(applications.id, applicationId));
  return app?.user_id === userId;
}

router.get('/application/:applicationId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { applicationId } = req.params;
    
    const hasAccess = await canAccessApplication(req.user!.id, req.user!.role, applicationId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const steps = await db
      .select()
      .from(applicationTimelineSteps)
      .where(eq(applicationTimelineSteps.application_id, applicationId));
    res.json(steps);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { application_id, step_key, step_name, status, data } = req.body;
    const [newStep] = await db.insert(applicationTimelineSteps).values({
      application_id,
      step_key,
      step_name,
      status: status ?? 'pending',
      data: data ?? {},
    }).returning();
    res.status(201).json(newStep);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, data, completed_at } = req.body;
    
    const updateData: any = { updated_at: new Date() };
    if (status !== undefined) updateData.status = status;
    if (data !== undefined) updateData.data = data;
    if (completed_at !== undefined) updateData.completed_at = completed_at;
    if (status === 'completed' && !completed_at) updateData.completed_at = new Date();
    
    const [updated] = await db.update(applicationTimelineSteps)
      .set(updateData)
      .where(eq(applicationTimelineSteps.id, id))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ error: 'Timeline step not found' });
    }
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    await db.delete(applicationTimelineSteps).where(eq(applicationTimelineSteps.id, id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
