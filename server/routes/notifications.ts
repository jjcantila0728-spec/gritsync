import { Router, Response } from 'express';
import { db } from '../db';
import { notifications } from '../../shared/schema';
import { eq, desc, and } from 'drizzle-orm';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userNotifications = await db.select().from(notifications)
      .where(eq(notifications.user_id, req.user!.id))
      .orderBy(desc(notifications.created_at));

    res.json(userNotifications);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/unread', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const unread = await db.select().from(notifications)
      .where(and(
        eq(notifications.user_id, req.user!.id),
        eq(notifications.read, false)
      ))
      .orderBy(desc(notifications.created_at));

    res.json(unread);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [notification] = await db.insert(notifications).values({
      ...req.body,
      user_id: req.body.user_id || req.user?.id,
    }).returning();

    res.status(201).json(notification);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/read', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const [updated] = await db.update(notifications)
      .set({ read: true })
      .where(and(
        eq(notifications.id, id),
        eq(notifications.user_id, req.user!.id)
      ))
      .returning();

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/mark-all-read', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await db.update(notifications)
      .set({ read: true })
      .where(eq(notifications.user_id, req.user!.id));

    res.json({ message: 'All notifications marked as read' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    await db.delete(notifications)
      .where(and(
        eq(notifications.id, id),
        eq(notifications.user_id, req.user!.id)
      ));

    res.json({ message: 'Notification deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
