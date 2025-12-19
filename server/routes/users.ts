import { Router, Response } from 'express';
import { db } from '../db';
import { users, userPreferences, userDetails } from '../../shared/schema';
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

router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [user] = await db.select({
      id: users.id,
      email: users.email,
      role: users.role,
      first_name: users.first_name,
      last_name: users.last_name,
      grit_id: users.grit_id,
      avatar_path: users.avatar_path,
      default_avatar_design: users.default_avatar_design,
      created_at: users.created_at,
    }).from(users).where(eq(users.id, req.user!.id));

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const [details] = await db.select().from(userDetails).where(eq(userDetails.user_id, req.user!.id));
    
    const { id: detailsId, user_id, ...detailFields } = details || {};
    res.json({ ...user, ...detailFields });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { 
      first_name, last_name, avatar_path, default_avatar_design,
      middle_name, gender, marital_status, single_full_name, date_of_birth, birth_place,
      mobile_number, house_number, street_name, city, province, country, zipcode,
      elementary_school, elementary_city, elementary_province, elementary_country,
      elementary_years_attended, elementary_start_date, elementary_end_date,
      high_school, high_school_city, high_school_province, high_school_country,
      high_school_years_attended, high_school_start_date, high_school_end_date,
      nursing_school, nursing_school_city, nursing_school_province, nursing_school_country,
      nursing_school_years_attended, nursing_school_start_date, nursing_school_end_date,
      nursing_school_major, nursing_school_diploma_date, signature, payment_type
    } = req.body;

    const [updatedUser] = await db.update(users)
      .set({
        first_name,
        last_name,
        avatar_path,
        default_avatar_design,
        updated_at: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    const detailsData = {
      middle_name, gender, marital_status, single_full_name, date_of_birth, birth_place,
      mobile_number, house_number, street_name, city, province, country, zipcode,
      elementary_school, elementary_city, elementary_province, elementary_country,
      elementary_years_attended, elementary_start_date, elementary_end_date,
      high_school, high_school_city, high_school_province, high_school_country,
      high_school_years_attended, high_school_start_date, high_school_end_date,
      nursing_school, nursing_school_city, nursing_school_province, nursing_school_country,
      nursing_school_years_attended, nursing_school_start_date, nursing_school_end_date,
      nursing_school_major, nursing_school_diploma_date, signature, payment_type,
      updated_at: new Date(),
    };

    const [existingDetails] = await db.select().from(userDetails).where(eq(userDetails.user_id, userId));
    
    let updatedDetails;
    if (existingDetails) {
      [updatedDetails] = await db.update(userDetails)
        .set(detailsData)
        .where(eq(userDetails.user_id, userId))
        .returning();
    } else {
      [updatedDetails] = await db.insert(userDetails)
        .values({ user_id: userId, ...detailsData })
        .returning();
    }

    const { id: detailsId, user_id: uid, ...detailFields } = updatedDetails || {};
    const response = { ...updatedUser, ...detailFields };
    delete (response as any).password_hash;
    res.json(response);
  } catch (error: any) {
    console.error('Error updating user details:', error);
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
