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
    
    console.log('PATCH /users/me - Request body keys:', Object.keys(req.body));
    
    // Helper to filter out undefined values (keep null as valid value to clear fields)
    const filterDefined = (obj: Record<string, any>) => {
      const result: Record<string, any> = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          result[key] = value;
        }
      }
      return result;
    };

    // Update users table with only defined values
    const userUpdates = filterDefined({
      first_name: req.body.first_name,
      last_name: req.body.last_name,
      avatar_path: req.body.avatar_path,
      default_avatar_design: req.body.default_avatar_design,
    });
    
    let updatedUser;
    if (Object.keys(userUpdates).length > 0) {
      [updatedUser] = await db.update(users)
        .set({ ...userUpdates, updated_at: new Date() })
        .where(eq(users.id, userId))
        .returning();
    } else {
      [updatedUser] = await db.select().from(users).where(eq(users.id, userId));
    }

    // Prepare details data with only defined values
    const detailsData = filterDefined({
      middle_name: req.body.middle_name,
      gender: req.body.gender,
      marital_status: req.body.marital_status,
      single_full_name: req.body.single_full_name,
      date_of_birth: req.body.date_of_birth,
      birth_place: req.body.birth_place,
      mobile_number: req.body.mobile_number,
      house_number: req.body.house_number,
      street_name: req.body.street_name,
      city: req.body.city,
      province: req.body.province,
      country: req.body.country,
      zipcode: req.body.zipcode,
      elementary_school: req.body.elementary_school,
      elementary_city: req.body.elementary_city,
      elementary_province: req.body.elementary_province,
      elementary_country: req.body.elementary_country,
      elementary_years_attended: req.body.elementary_years_attended,
      elementary_start_date: req.body.elementary_start_date,
      elementary_end_date: req.body.elementary_end_date,
      high_school: req.body.high_school,
      high_school_city: req.body.high_school_city,
      high_school_province: req.body.high_school_province,
      high_school_country: req.body.high_school_country,
      high_school_years_attended: req.body.high_school_years_attended,
      high_school_start_date: req.body.high_school_start_date,
      high_school_end_date: req.body.high_school_end_date,
      nursing_school: req.body.nursing_school,
      nursing_school_city: req.body.nursing_school_city,
      nursing_school_province: req.body.nursing_school_province,
      nursing_school_country: req.body.nursing_school_country,
      nursing_school_years_attended: req.body.nursing_school_years_attended,
      nursing_school_start_date: req.body.nursing_school_start_date,
      nursing_school_end_date: req.body.nursing_school_end_date,
      nursing_school_major: req.body.nursing_school_major,
      nursing_school_diploma_date: req.body.nursing_school_diploma_date,
      signature: req.body.signature,
      payment_type: req.body.payment_type,
    });
    
    console.log('Details data keys to update:', Object.keys(detailsData));

    const [existingDetails] = await db.select().from(userDetails).where(eq(userDetails.user_id, userId));
    
    let updatedDetails;
    if (Object.keys(detailsData).length > 0) {
      if (existingDetails) {
        [updatedDetails] = await db.update(userDetails)
          .set({ ...detailsData, updated_at: new Date() })
          .where(eq(userDetails.user_id, userId))
          .returning();
        console.log('Updated existing user_details record');
      } else {
        [updatedDetails] = await db.insert(userDetails)
          .values({ user_id: userId, ...detailsData, updated_at: new Date() })
          .returning();
        console.log('Created new user_details record');
      }
    } else {
      updatedDetails = existingDetails;
      console.log('No details to update');
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
