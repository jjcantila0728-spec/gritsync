import { Router, Response } from 'express';
import { db } from '../db';
import { applicationPayments, applications } from '../../shared/schema';
import { eq, desc } from 'drizzle-orm';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isAdmin = req.user?.role === 'admin';

    if (isAdmin) {
      const payments = await db.select().from(applicationPayments).orderBy(desc(applicationPayments.created_at));
      return res.json(payments);
    }

    const userApps = await db.select({ id: applications.id }).from(applications).where(eq(applications.user_id, req.user!.id));
    const appIds = userApps.map(a => a.id);

    if (appIds.length === 0) {
      return res.json([]);
    }

    const payments = await db.select().from(applicationPayments)
      .where(eq(applicationPayments.application_id, appIds[0]))
      .orderBy(desc(applicationPayments.created_at));

    res.json(payments);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/application/:applicationId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { applicationId } = req.params;
    
    const payments = await db.select().from(applicationPayments)
      .where(eq(applicationPayments.application_id, applicationId))
      .orderBy(desc(applicationPayments.created_at));

    res.json(payments);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [payment] = await db.insert(applicationPayments).values(req.body).returning();
    res.status(201).json(payment);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const [updated] = await db.update(applicationPayments)
      .set({ ...req.body, updated_at: new Date() })
      .where(eq(applicationPayments.id, id))
      .returning();

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    await db.delete(applicationPayments).where(eq(applicationPayments.id, id));
    res.json({ message: 'Payment deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
