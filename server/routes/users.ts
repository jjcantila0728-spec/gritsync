import { Router, Response } from 'express';
import { db } from '../db';
import { users, userPreferences } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

router.get('/', authenticateToken, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const allUsers = await db.select({
      id: users.id,
      email: users.email,
      role: users.role,
      first_name: users.first_name,
      last_name: users.last_name,
      grit_id: users.grit_id,
      avatar_path: users.avatar_path,
      created_at: users.created_at,
    }).from(users);

    res.json(allUsers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/email/:email', async (req, res: Response) => {
  try {
    const { email } = req.params;

    const [user] = await db.select({
      id: users.id,
      email: users.email,
      first_name: users.first_name,
      last_name: users.last_name,
      avatar_path: users.avatar_path,
    }).from(users).where(eq(users.email, email));

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (req.user?.role !== 'admin' && req.user?.id !== id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [user] = await db.select({
      id: users.id,
      email: users.email,
      role: users.role,
      first_name: users.first_name,
      last_name: users.last_name,
      grit_id: users.grit_id,
      avatar_path: users.avatar_path,
      created_at: users.created_at,
    }).from(users).where(eq(users.id, id));

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (req.user?.role !== 'admin' && req.user?.id !== id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { first_name, last_name, avatar_path, default_avatar_design } = req.body;

    const [updated] = await db.update(users)
      .set({
        first_name,
        last_name,
        avatar_path,
        default_avatar_design,
        updated_at: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/preferences', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (req.user?.role !== 'admin' && req.user?.id !== id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [prefs] = await db.select().from(userPreferences).where(eq(userPreferences.user_id, id));

    if (!prefs) {
      const [newPrefs] = await db.insert(userPreferences).values({ user_id: id }).returning();
      return res.json(newPrefs);
    }

    res.json(prefs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/preferences', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (req.user?.role !== 'admin' && req.user?.id !== id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updates = req.body;
    
    const [updated] = await db.update(userPreferences)
      .set({ ...updates, updated_at: new Date() })
      .where(eq(userPreferences.user_id, id))
      .returning();

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
