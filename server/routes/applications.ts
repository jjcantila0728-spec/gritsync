import { Router, Response } from 'express';
import { db } from '../db';
import { applications, applicationTimelineSteps, applicationPayments, userDetails, users } from '../../shared/schema';
import { eq, desc } from 'drizzle-orm';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { generateTimelineForApplication } from '../services/timeline-generator';

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
    const userId = req.user?.id;
    const { service_type, state_of_application, notes } = req.body;
    
    console.log('POST /applications - Request body keys:', Object.keys(req.body));
    
    const filterDefined = (obj: Record<string, any>) => {
      const result: Record<string, any> = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined && value !== null && value !== '') {
          result[key] = value;
        }
      }
      return result;
    };
    
    // Step 1: Update users table first with any new data from request (single source of truth)
    if (userId) {
      const userUpdates = filterDefined({
        first_name: req.body.first_name,
        last_name: req.body.last_name,
        middle_name: req.body.middle_name,
        mobile: req.body.phone || req.body.mobile_number,
        updated_at: new Date()
      });
      
      if (Object.keys(userUpdates).length > 1) { // More than just updated_at
        await db.update(users)
          .set(userUpdates)
          .where(eq(users.id, userId));
      }
    }
    
    // Step 2: Fetch user details from users table to use for application
    let applicant_name = 'Unknown';
    let applicantEmail = req.user?.email || '';
    let applicantPhone = '';
    
    if (userId) {
      const [userData] = await db.select({
        first_name: users.first_name,
        last_name: users.last_name,
        middle_name: users.middle_name,
        email: users.email,
        mobile: users.mobile,
      }).from(users).where(eq(users.id, userId));
      
      if (userData) {
        // Build applicant name from user's first and last name
        const nameParts = [userData.first_name, userData.middle_name, userData.last_name].filter(Boolean);
        applicant_name = nameParts.length > 0 ? nameParts.join(' ') : 'Unknown';
        applicantEmail = userData.email || applicantEmail;
        applicantPhone = userData.mobile || '';
      }
    }
    
    const serviceTypeValue = service_type || 'NCLEX Processing';
    
    // Step 3: Create the application with user data from users table
    const [newApp] = await db.insert(applications).values({
      user_id: userId,
      applicant_name,
      email: applicantEmail,
      phone: applicantPhone,
      service_type: serviceTypeValue,
      state_of_application: state_of_application || req.body.service_state,
      notes,
    }).returning();

    // Also save/update user details with the personal info from the application
    if (userId) {

      // Prepare user details from application data
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

      if (Object.keys(detailsData).length > 0) {
        const [existingDetails] = await db.select().from(userDetails).where(eq(userDetails.user_id, userId));
        
        if (existingDetails) {
          await db.update(userDetails)
            .set({ ...detailsData, updated_at: new Date() })
            .where(eq(userDetails.user_id, userId));
          console.log('Updated user_details from application');
        } else {
          await db.insert(userDetails)
            .values({ user_id: userId, ...detailsData, updated_at: new Date() });
          console.log('Created user_details from application');
        }
      }
    }

    await generateTimelineForApplication(newApp.id, serviceTypeValue);

    const timeline = await db.select().from(applicationTimelineSteps)
      .where(eq(applicationTimelineSteps.application_id, newApp.id));

    res.status(201).json({ ...newApp, timeline_steps: timeline });
  } catch (error: any) {
    console.error('Error creating application:', error);
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
